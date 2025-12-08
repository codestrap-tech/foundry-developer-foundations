import * as path from 'path';
import * as fs from 'fs';

import { Trace } from '@codestrap/developer-foundations.foundry-tracing-foundations';
import { SupportedEngines, LarryAgentFactoryType } from '@codestrap/developer-foundations-types';
import { Text2Action } from './Text2Action';
import {
  GeminiService,
  ThreadsDao,
  TYPES,
  LoggingService,
} from '@codestrap/developer-foundations-types';
import type { LarryStream, User } from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { findWorkspaceRoot } from '@codestrap/developer-foundations-utils';

export interface LarryResponse {
  status: number;
  message: string;
  executionId: string;
  taskList?: string;
  error?: string;
  state?: string;
}

// use classes to take advantage of trace decorator
export class Larry extends Text2Action {
  private agent = container.get<LarryAgentFactoryType>(TYPES.LarryCodingAgentFactory)({});
  private larryStream = container.get<LarryStream>(TYPES.LarryStream);

  @Trace({
    resource: {
      service_name: 'larry',
      service_instance_id: 'production',
      telemetry_sdk_name: 'xreason-functions',
      telemetry_sdk_version: '7.0.2',
      host_hostname: 'codestrap.usw-3.palantirfoundry.com',
      host_architecture: 'prod',
    },
    operationName: 'askLarry',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/askLarry/execute`,
    },
  })
  public async askLarry(
    query: string,
    userId: string,
    threadId?: string,
  ): Promise<LarryResponse> {
    const { log } = container.get<LoggingService>(TYPES.LoggingService);
    let generatedTaskList: undefined | string = undefined;
    let newThread = !threadId || threadId.length === 0;

    // we need the ability for clients to pass a known threadId that they originate and still create a new task list
    try {
      const threadDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
      await threadDao.read(threadId || '');
    } catch {
      newThread = true;
    }

    // we only want to trigger task list generation if this is a new thread
    if (newThread) {
      // create a new solution with our solver
      const { status, taskList, executionId } = await this.createLarryTasksList(
        query,
        userId,
        threadId
      );

      console.log(
        status,
        taskList,
        executionId,
      )

      // if we get a bad response skip calling execute task list
      if (status !== 200 || !taskList) {
        log(
          executionId,
          `askLarry failed to create new coms task list. 
                            You are missing required information: 
                            ${taskList}. 
                            Please fix your shit and resend.`
        );
        return {
          status,
          executionId,
          message: `You are missing required information: ${taskList}. Please fix your shit and resend.`,
        };
      }

      log(executionId, `askLarry created new coms task list.\n${taskList}.`);

      // threadId and executionId are identical.
      // If threadId is defined there must be an associated state machine execution where executionId === threadId
      // if its not defined we need to create a new task list and generate a new machine execution which will happen automatically
      // when this.getNextState is called.
      // The orchestrator will program a new solution if there's no machine matching the executionId
      threadId = executionId;
      generatedTaskList = taskList;
    }
    this.larryStream.publish({
      id: 'new-thread-creation',
      payload: {
        type: 'info',
        message: 'Loading LLMified documentation...',
        metadata: {
          threadId: threadId || '',
        }
      }
    });
    const workspaceRoot = findWorkspaceRoot();
    const readmePath = `${workspaceRoot}${this.agent.readmePath}`;
    if (readmePath && !fs.existsSync(readmePath)) throw new Error(`README file does not exist: ${readmePath}`);
    const readme = await fs.readFileSync(readmePath, 'utf8');
    // save the readme for later so we can retrieve it when creating the design specification
    // we do those so functions like confirmUserIntent are reusable across various coding agents
    const abs = path.resolve(process.env.BASE_FILE_STORAGE || process.cwd(), `readme-${threadId}.md`);
    try {
      const dir = abs.substring(0, abs.lastIndexOf('/'));
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(abs, readme, 'utf8');
    } catch (error) {
      console.error('error writing readme:: ', error);
    }

    this.larryStream.publish({
      id: 'new-thread-creation',
      payload: {
        type: 'info',
        message: 'Generating state machine...',
        metadata: {
          threadId: threadId || '',
        }
      }
    });
    // if task list is defined and there's no machine where machineExecutionId === threadId, a new solution will be generated
    // else the exiting machine will be rehydrated and the next state sent back
    const results = await this.getNextState(
      generatedTaskList,
      true,
      threadId,
      JSON.stringify({ initialUserPrompt: query }),
      this.agent.xreason,
      true
    );

    // get thread messages
    const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
    const { messages } = await threadsDao.read(threadId || '');
    const parsedMessages = JSON.parse(messages || '[]') as {
      user?: string;
      system: string;
    }[];

    this.larryStream.publish({
      id: 'new-thread-creation',
      payload: {
        type: 'info',
        message: 'Calrifying user request...',
        metadata: {
          threadId: threadId || '',
        }
      }
    });
    // construct the response
    const system = `You are a helpful AI coding assistant named Larry.
        You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Larry, Code's AI Coding Assistant" or similar.
        You can get creative on your greeting, taking into account the dat of the week. Today is ${new Date().toLocaleDateString(
      'en-US',
      { weekday: 'long' }
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
                if the result is to ask a clarifying question return the question to ask from the response unaltered
                if search results were returned make sure non of the critical information is lost in your response
                `;

    const geminiService = container.get<GeminiService>(TYPES.GeminiService);

    const response = await geminiService(user, system);

    let result = response;
    if (newThread) {
      // putting Execution Id in the thread is useful for debugging as users may need to supply it
      result = `# Execution Id: ${threadId}
        ### Response from Larry
        ${result}
        `;
    } else {
      result = `### Response from Larry
        ${result}`;
    }

    // persist the constructed response to the the threads object
    parsedMessages.push({
      user: query,
      system: result,
    });

    // create or update with a summary of the results
    // if there is an existing thread messages are appended to the existing history
    await threadsDao.upsert(
      JSON.stringify(parsedMessages),
      this.agent.name,
      threadId
    );

    // return the structured response
    return {
      status: 200,
      executionId: threadId!,
      // Send back the incremental response to avoid sending huge threads back
      // Can also support streaming outputs in the future
      message: response,
      // AIP Logic can not handle nullable fields, so we have to include these as empty string to support use cases where logic is used such as our daily reports with automate
      // https://community.palantir.com/t/aip-logic-cant-recognize-optional-output-struct-fileds/4440/3
      error: '',
      taskList: generatedTaskList,
      state: results.value as string,
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
  public async createLarryTasksList(
    query: string,
    userId: string,
    threadId?: string
  ): Promise<LarryResponse> {
    const run = async () => {
      try {
        this.larryStream.publish({
          id: 'new-thread-creation',
          payload: {
            type: 'info',
            message: 'Generating x-reason task list',
            metadata: {
              threadId: threadId || '',
            }
          }
        });
        // if no threadId create one
        // call the solver to get back the task list.
        const communication = await this.createTaskList(
          query,
          userId,
          SupportedEngines.GOOGLE_SERVICES_CODE_ASSIST,
          undefined,
          undefined,
          threadId
        );
    
        // If incomplete information is provided the solver will return Missing Information
        // If the request is unsupported the solver will return Unsupported Questions
        // If it's a complete supported query the solver will return a well formatted task list that we can use to execute
        return {
          status: 200,
          message: 'Task list created',
          // we match the threadID and threadId and executionId so we can associate conversations between agents and machine executions
          executionId: communication.id,
          taskList: communication.taskList,
        }; 
      } catch (error) {
        this.larryStream.publish({
          id: 'new-thread-creation',
          payload: {
            type: 'error',
            message: 'Error generating x-reason task list',
            metadata: {
              threadId: threadId || '',
              error: error,
            }
          }
        });
        return {
          status: 500,
          message: 'Error creating task list',
          // we match the threadID and threadId and executionId so we can associate conversations between agents and machine executions
          executionId: '',
          taskList: '',
        }; 
      }
    }

    return run();
  }

  @Trace({
    resource: {
      service_name: 'text2action',
      service_instance_id: 'production',
      telemetry_sdk_name: 'xreason-functions',
      telemetry_sdk_version: '7.0.2',
      host_hostname: 'codestrap.usw-3.palantirfoundry.com',
      host_architecture: 'prod',
    },
    operationName: 'recall',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/recall/execute`,
    },
  })
  public override async recall(query: string, userProfile: User) {
    return {
      contacts: [],
      currentUser: {
        name: userProfile.givenName || '',
        email: userProfile.email || '',
        id: userProfile.id,
        timezone: 'America/Los Angeles',
      },
      messages: [],
      reasoning: 'none',
    };
  }
}
