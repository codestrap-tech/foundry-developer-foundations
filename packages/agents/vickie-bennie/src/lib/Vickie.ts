import { Trace } from '@codestrap/developer-foundations.foundry-tracing-foundations';

import { Text2Action } from './Text2Action';
import {
  extractJsonFromBackticks,
  uuidv4,
} from '@codestrap/developer-foundations-utils';
import {
  Context,
  GeminiService,
  ThreadsDao,
  TYPES,
  OfficeService,
  EmailMessage,
  MachineDao,
  LoggingService,
  SupportedEngines,
  OfficeServiceV3,
  ProposeMeetingConflictResolutionsInput,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';

interface VickieResponse {
  status: number;
  message: string;
  executionId: string;
  taskList?: string;
  error?: string;
}

// use classes to take advantage of trace decorator
export class Vickie extends Text2Action {
  @Trace({
    resource: {
      service_name: 'vickie',
      service_instance_id: 'production',
      telemetry_sdk_name: 'xreason-functions',
      telemetry_sdk_version: '7.0.2',
      host_hostname: 'codestrap.usw-3.palantirfoundry.com',
      host_architecture: 'prod',
    },
    operationName: 'proposeNewMeetingTime',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/proposeNewMeetingTime/execute`,
    },
  })
  public async processEmailEvent(
    data: string,
    publishTime: string,
  ): Promise<VickieResponse> {
    // get emails since the publish time
    const officeService = await container.getAsync<OfficeService>(
      TYPES.OfficeService,
    );
    const decodedJson = Buffer.from(data, 'base64').toString('utf8');
    const { emailAddress } = JSON.parse(decodedJson) as {
      emailAddress: string;
      historyId: number;
    };
    const { log, getLog } = container.get<LoggingService>(TYPES.LoggingService);

    const result = await officeService.readEmailHistory({
      email: emailAddress,
      publishTime,
    });
    // filter by subject to find threads Vickie generated
    const resolveMeetingConflicts = result.messages
      .filter((message) => {
        if (message.subject) {
          return message.subject.indexOf('Resolve Meeting Conflicts - ID') >= 0;
        }

        return false;
      })
      .reduce((acc, cur) => {
        if (cur.threadId && !acc.get(cur.threadId)) {
          acc.set(cur.threadId, []);
        }

        if (cur.threadId) {
          acc.get(cur.threadId)?.push(cur);
        }

        return acc;
      }, new Map<string, EmailMessage[]>());

    const geminiService = container.get<GeminiService>(TYPES.GeminiService);

    console.log(`processEmailsEvent found the following meeting conflict emails:
            ${JSON.stringify(Array.from(resolveMeetingConflicts.keys()))}`);

    // for each thread in the map call an llm to determine of a resolution has been found, and if so rehydrate the machine
    // passing the updated information and calling getNextState
    const threadPromises = Array.from(resolveMeetingConflicts.entries())
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - threadId is a string
      .map(async ([threadId, messages]) => {
        const errorResponse = {
          status: 400,
          executionId: uuidv4(),
          message: 'ERROR',
          // AIP Logic can not handle nullable fields, so we have to include these as empty string to support use cases where logic is used such as our daily reports with automate
          // https://community.palantir.com/t/aip-logic-cant-recognize-optional-output-struct-fileds/4440/3
          error: '',
          taskList: 'ERROR',
        };
        const system = `You are a helpful virtual ai assistant tasked with extracting meeting conflict resolutions form message histories.`;
        const userPrompt = `
Using the message history below output whether or not the conflict has been resolved and the new proposed day/time.

Message history:
${JSON.stringify(messages)}

You can only respond in JSON:
{
  "resolutionFound": boolean,
  "resolution": string
}

For example if the message history is:
[
  {
    "subject": "Resolve Meeting Conflicts - ID ad179ef1-063f-4335-8541-cfdb65f824923",
    "from": "vici@codestrap.me",
    "body": "Hey Dorian and Connor  nHappy Thursday! I'm Vickie, Code's AI EA. I'm having trouble scheduling a meeting for you both on July 18, 2025, between 2:00 PM and 3:00 PM. It looks like neither of you are available at that time. Could you please let me know if there's any chance you could move things around to make that time work? Knowing whether that slot is flexible would really help in finding a suitable time. Thanks! Best Vickie",
    "id": "1234",
    "threadId": "234dsfd"
  },
  {
    "subject": "Resolve Meeting Conflicts - ID ad179ef1-063f-4335-8541-cfdb65f82492",
    "from": "dsmiley@codestrap.me",
    "body": "Hey Connor what about Tue at 9 AM?",
    "id": "5678",
    "threadId": "234dsfd"
  },
  {
    "subject": "Resolve Meeting Conflicts - ID ad179ef1-063f-4335-8541-cfdb65f82492",
    "from": "connor.deeks@codestrap.me",
    "body": "That works.",
    "id": "9101112",
    "threadId": "234dsfd"
  }
]
Your answer is:
{
  "resolutionFound": true,
  "resolution": "Tue at 9 AM"
}

If the user specifies a resolution that can not be resolved to a specific dat/time output
{
  "resolutionFound": false,
  "resolution": ""
}
`;

        // Grab machine ID from subject
        const id = messages[0]?.subject
          ?.split('Resolve Meeting Conflicts - ID')[1]
          ?.trim();
        if (!id) {
          errorResponse.error = 'No id found';
          return errorResponse;
        }

        const machineDao = container.get<MachineDao>(TYPES.MachineDao);
        const { state, lockOwner, lockUntil, logs, machine } =
          await machineDao.read(id);
        // first in wins for lock ID. The assumption is we have single event concurrency configured
        // as Foundry doesn't provide a distributed locks solution. Then the first email address processed in the thread
        // will be assigned the owner
        // TODO add the eventID from pub/sub to the input params so we can handle the same event being processed twice
        // remember Google Pub/Sub it garenteed at least once delivery, meaning you can get the same event twice!
        const lockOwnerId = `${emailAddress}-${threadId}`;

        // If another owner holds a live lease, skip
        if (
          lockOwner &&
          lockOwner !== lockOwnerId &&
          // lockUntil must be defined if lockOwner is set, enforced in our upsert function
          lockUntil! > Date.now()
        ) {
          errorResponse.error = `Locked by ${lockOwner} until ${lockUntil}`;

          log(
            id,
            `ExecutionId: ${id} is locked by ${lockOwner} until ${lockUntil}`,
          );

          await machineDao.upsert(id, machine!, state!, getLog(id));

          return errorResponse;
        }

        // update the machine before proceeding with a lock to ensure we don't get redundant executions (mutex)!
        // this can occur within the same thread if the proposed time to resolve the conflict isn't actually available
        // this will result in a new conflict email being generated with a different thread ID adn can generate an infinite loop!
        // While in theory this same mechanism could handle multiple concurrent events it would likely result in a large number of erros
        // being thrown as Foundry should reject updates for stale records (have been modified since read). But I don't know id
        // the OSDK API enforces this policy or not. Functions did, but I think that was only in the context of a single function execution as it maintained a cache
        // IMPORTANT: figure out if upsert methods are responsible for enforcing rejections of writes on stale data
        // by using a lock we can prevent his from happening. I use 15 minutes out of an abundance of caution. This could likely be much lower
        // like 1 - 2 minutes
        try {
          await machineDao.upsert(
            id,
            machine!,
            state!,
            logs!,
            lockOwnerId,
            Date.now() + 15 * 60 * 1000,
          );
        } catch (e) {
          console.log(`failed to upsert the machine in order to set lock:
                        message: ${(e as Error).message}
                        stack: ${(e as Error).stack}
                    `);

          log(
            id,
            `failed to upsert the machine in order to set lock:
                        message: ${(e as Error).message}
                        stack: ${(e as Error).stack}
                    `,
          );

          await machineDao.upsert(id, machine!, state!, getLog(id));

          throw e;
        }

        // Ask the model
        const response = await geminiService(userPrompt, system);
        const extracted = extractJsonFromBackticks(response);

        // Expect the shape we asked for
        const { resolutionFound, resolution } = JSON.parse(extracted) as {
          resolutionFound: boolean;
          resolution: string;
        };

        log(
          id,
          `The model returned the following email thread 
                    subject: ${messages[0]?.subject}
                    resolutionFound: ${resolutionFound}
                    resolution: ${resolution}

                    `,
        );

        if (!resolutionFound) {
          errorResponse.error = 'No resolution found';

          log(
            id,
            `The model returned "No resolution found" for following email thread 
                    ${messages[0]?.subject}
                    ${resolutionFound}
                    ${resolution}
                    `,
          );

          await machineDao.upsert(id, machine!, state!, getLog(id));

          return errorResponse;
        } // Nothing to do for this thread

        const { context } = JSON.parse(state!) as { context: Context };
        // find the last instance of a resolveUnavailableAttendees state in the stack
        const currentStateId = context.stack
          ?.slice()
          .reverse()
          .find((item) => item.includes('resolveUnavailableAttendees'));

        if (!currentStateId) {
          errorResponse.error = 'No currentStateId found';

          log(
            id,
            `No currentStateId found email thread ${messages[0]?.subject}
                    The context is
                    ${JSON.stringify(context)}
                    currentStateId is:
                    ${currentStateId}
                    `,
          );

          await machineDao.upsert(id, machine!, state!, getLog(id));

          return errorResponse;
        }

        const contextUpdate = {
          [currentStateId]: { resolution, processEmail: true },
        };

        log(
          id,
          `Sending updated context for the following email thread ${
            messages[0]?.subject
          }
                    contextUpdate:
                    ${JSON.stringify(contextUpdate)}
                    `,
        );

        // logs will be persisted in the call to getNextState
        try {
          const result = await this.getNextState(
            undefined,
            true,
            id,
            JSON.stringify(contextUpdate),
            SupportedEngines.COMS,
          );

          console.log(getLog(id));

          console.log(`getNextStateReturned: ${JSON.stringify(result)}`);
        } catch (e) {
          log(
            id,
            `getNextState failed with the following error:
                        ${(e as Error).message}
                        ${(e as Error).stack}
                    `,
          );

          errorResponse.error = (e as Error).stack || 'ERROR';
          errorResponse.message = (e as Error).message || 'ERROR';

          return errorResponse;
        }
      });

    // 3. Fire all requests in parallel and wait for them all to settle
    const results = await Promise.allSettled(threadPromises);

    console.log(`processEmailEvent settled the following promises:
            ${JSON.stringify(results)}`);

    // 1. Extract failed results with shape you defined
    const failed = results
      .map((res) => {
        if (
          res.status === 'rejected' ||
          (res.status === 'fulfilled' && res.value?.status === 400)
        ) {
          return res;
        }
        return undefined;
      })
      .filter((item) => item !== undefined);

    // 2. If there are any failures, build an aggregated error response
    if (failed.length > 0) {
      const aggregatedMessage = failed.reduce((msg, curr) => {
        return msg + `\n ${JSON.stringify(curr)}`;
      }, 'Some threads failed to resolve:');

      console.log(`Aggregated Failure MEssages:\n${aggregatedMessage}`);

      return {
        status: 400,
        executionId: uuidv4(),
        message: aggregatedMessage,
        error: 'At least one thread failed',
        taskList: 'ERROR',
      };
    }

    // return the structured response
    return {
      status: 200,
      executionId: uuidv4(),
      message: `All emails were processed and next state processed for the following machines:\n${JSON.stringify(
        results,
        null,
        2,
      )}`,
      // AIP Logic can not handle nullable fields, so we have to include these as empty string to support use cases where logic is used such as our daily reports with automate
      // https://community.palantir.com/t/aip-logic-cant-recognize-optional-output-struct-fileds/4440/3
      error: '',
      taskList: '',
    };
  }

  @Trace({
    resource: {
      service_name: 'vickie',
      service_instance_id: 'production',
      telemetry_sdk_name: 'xreason-functions',
      telemetry_sdk_version: '7.0.2',
      host_hostname: 'codestrap.usw-3.palantirfoundry.com',
      host_architecture: 'prod',
    },
    operationName: 'vickie',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/vickie/execute`,
    },
  })
  public async askVickie(
    query: string,
    userId: string,
    threadId?: string,
  ): Promise<VickieResponse> {
    const { log } = container.get<LoggingService>(TYPES.LoggingService);
    let generatedTaskList: undefined | string = undefined;
    let newThread = !threadId || threadId.length === 0;

    // we need the ability for clients to pass a known threadId that they originate and still create a new task list
    try {
      const threadDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
      await threadDao.read(threadId || '');
    } catch (e) {
      console.log(e);
      // the client has sent a threadId they originated
      newThread = true;
    }

    // we only want to trigger task list generation if this is a new thread
    if (newThread) {
      // create a new solution with our solver
      const { status, taskList, executionId } = await this.createComsTasksList(
        query,
        userId,
        threadId,
      );

      // if we get a bad response skip calling execute task list
      if (status !== 200 || !taskList) {
        log(
          executionId,
          `askVickie failed to create new coms task list. 
                    You are missing required information: 
                    ${taskList}. 
                    Please fix your shit and resend.`,
        );
        return {
          status,
          executionId,
          message: `You are missing required information: ${taskList}. Please fix your shit and resend.`,
        };
      }

      log(executionId, `askVickie created new coms task list.\n${taskList}.`);

      // threadId and executionId are identical.
      // If threadId is defined there must be an associated state machine execution where executionId === threadId
      // if its not defined we need to create a new task list and generate a new machine execution which will happen automatically
      // when this.getNextState is called.
      // The orchestrator will program a new solution if there's no machine matching the executionId
      threadId = executionId;
      generatedTaskList = taskList;
    }

    // if task list is defined and there's no machine where machineExecutionId === threadId, a new solution will be generated
    // else the exiting machine will be rehydrated and the next state sent back
    // TODO we need to append the user query as input to getNextState so its interpolated onto the context
    // ideally what would happen is we check if the user query is relevant to an existing state then update it
    // then when the orchestrator rehydrates the machine is can reason about what state to retry based on the new information
    // this replaces the need for the text2ActionInstance.sendThreadMessage handler which was a hack to void doing this
    // you'll likely need to provide training data for transition for each engine to the model can learn what to do
    // Once done you'll need to copy this pattern to Vickie's askVickie method
    const results = await this.getNextState(
      generatedTaskList,
      true,
      threadId,
      undefined,
      SupportedEngines.COMS,
    );
    // construct the response
    const system = `You are a helpful AI executive assistant named Vickie.
        You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Vickie, Code's AI Executive Assistant" or similar.
        You can get creative on your greeting, taking into account the dat of the week. Today is ${new Date().toLocaleDateString(
          'en-US',
          { weekday: 'long' },
        )}. 
        You can also take into account the time of year such as American holidays like Halloween, Thanksgiving, Christmas, etc. 
        You always obey the users instructions and understand the people you work for are busy executives and sometimes need help in their personal lives
        These tasks are not beneath you. At CodeStrap, where you work we adopt the motto made famous by Kim Scott: we move couches.
        It means we all pull together to get things done.
        The current local date/time is ${new Date().toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles',
        })}.
        The current day/time in your timezone is: ${new Date().toString()}`;
    const user = `
                Based on the following user query
                ${query}
        
                And the results of the state machine execution that was generated to service their request
                The value attribute contains the current state
                The theResultOfEachTask attribute contains the output of state executions
                The orderTheTasksWereExecutedIn lets you know what order the states were executed in. States can be executed multiple times if they are retied.
                ${JSON.stringify(results)}
        
                Generate a response to the user query based on the results of the state machine execution 
                Be sure to structure your response so that it's readable by a human.
                For example if the state machine execution includes facts and figures use a table to format them
                Use lists to structure information hierarchies suck as task list execution and there results
                `;

    const geminiService = container.get<GeminiService>(TYPES.GeminiService);

    const response = await geminiService(user, system);

    let result = response;
    if (newThread) {
      // putting Execution Id in the thread is useful for debugging as users may need to supply it
      result = `# Execution Id: ${threadId}
        ### Response from Vickie
        ${result}
        `;
    } else {
      result = `### Response from Vickie
        ${result}`;
    }

    // persist the constructed response to the the threads object
    const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);

    const messages = `### User Query:
        ${query}
        
        ${result}`;
    // create or update with a summary of the results
    // if there is an existing thread messages are appended to the existing history
    await threadsDao.upsert(messages, 'bennie', threadId);

    // return the structured response
    return {
      status: 200,
      executionId: threadId!,
      // Send back the incremental response to avoid sending huge threads back
      // Can also support streaming outputs in the future
      message: result,
      // AIP Logic can not handle nullable fields, so we have to include these as empty string to support use cases where logic is used such as our daily reports with automate
      // https://community.palantir.com/t/aip-logic-cant-recognize-optional-output-struct-fileds/4440/3
      error: '',
      taskList: '',
    };
  }

  @Trace({
    resource: {
      service_name: 'vickie',
      service_instance_id: 'production',
      telemetry_sdk_name: 'xreason-functions',
      telemetry_sdk_version: '7.0.2',
      host_hostname: 'codestrap.usw-3.palantirfoundry.com',
      host_architecture: 'prod',
    },
    operationName: 'createComsTasksList',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/createComsTasksList/execute`,
    },
  })
  public async createComsTasksList(
    query: string,
    userId: string,
    threadId?: string,
  ): Promise<VickieResponse> {
    console.log('createComsTasksList called');
    // if no threadId create one
    // call the solver to get back the task list.
    const communication = await this.createTaskList(
      query,
      userId,
      SupportedEngines.COMS,
      undefined,
      undefined,
      threadId,
    );

    // If incomplete information is provided the solver will return Missing Infromation
    // If the request is unsupported the solver will return Usupported Questions
    // If it's a complete supported query the solver will return a well formatted task list that we can use to execute
    return {
      status: 200,
      message: 'Task list created',
      // we match the threadID and threadId and executionId so we can associate conversations between agents and machine executions
      executionId: communication.id,
      taskList: communication.taskList,
    };
  }

  @Trace({
    resource: {
      service_name: 'vickie',
      service_instance_id: 'production',
      telemetry_sdk_name: 'xreason-functions',
      telemetry_sdk_version: '7.0.2',
      host_hostname: 'codestrap.usw-3.palantirfoundry.com',
      host_architecture: 'prod',
    },
    operationName: 'resolveMeetingConflicts',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/resolveMeetingConflicts/execute`,
    },
  })
  public async resolveMeetingConflicts(
    users: string[],
    timeFrameFrom = new Date().toISOString(),
    timeFrameTo = new Date(
      new Date().getTime() + 24 * 60 * 60 * 1000,
    ).toISOString(),
    timezone = 'America/Los_Angeles',
  ): Promise<VickieResponse> {
    try {
      const officeServiceV3 = await container.getAsync<OfficeServiceV3>(
        TYPES.OfficeServiceV3,
      );

      const codeStrapUsers = filterCodeStrapUsers(users);

      if (codeStrapUsers.length === 0) {
        return {
          status: 400,
          executionId: uuidv4(),
          message: 'No CodeStrap users found in the request',
          error: 'No valid users',
          taskList: 'ERROR',
        };
      }

      const input: ProposeMeetingConflictResolutionsInput = {
        userEmails: codeStrapUsers,
        timeFrameFrom: new Date(timeFrameFrom),
        timeFrameTo: new Date(timeFrameTo),
        timezone,
      };

      // Identify conflicts and propose resolutions
      const identifyResult =
        await officeServiceV3.proposeMeetingConflictResolutions(input);

      // Perform rescheduling calculations

      return {
        status: 200,
        executionId: uuidv4(),
        message: 'Meeting conflicts resolved',
        taskList: 'SUCCESS',
      };
    } catch (e) {
      console.error('resolveMeetingConflicts error:', (e as Error).message);
      return {
        status: 500,
        executionId: uuidv4(),
        message: `Error resolving meeting conflicts: ${(e as Error).message}`,
        error: (e as Error).stack || (e as Error).message,
        taskList: '',
      };
    }

    /**
     * Filters users to only include CodeStrap users
     */
    function filterCodeStrapUsers(users: string[]): string[] {
      return users.filter(
        (user) =>
          user.indexOf('codestrap.me') >= 0 ||
          user.indexOf('codestrap.com') >= 0,
      );
    }
  }
}
