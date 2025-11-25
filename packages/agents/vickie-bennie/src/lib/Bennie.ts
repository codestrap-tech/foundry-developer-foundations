import { Trace } from '@codestrap/developer-foundations.foundry-tracing-foundations';

import { SupportedEngines } from '@codestrap/developer-foundations-types';
import { Text2Action } from './Text2Action';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import {
  GeminiService,
  MachineDao,
  RfpRequestsDao,
  Threads,
  ThreadsDao,
  TYPES,
  RfpResponseReceipt,
  RfpRequestResponse,
  RfpResponsesResult,
  StateConfig,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';

interface BennieResponse {
  status: number;
  message: string;
  executionId: string;
  taskList?: string;
  error?: string;
}

export class Bennie extends Text2Action {
  @Trace({
    resource: {
      service_name: 'bennie',
      service_instance_id: 'production',
      telemetry_sdk_name: 'xreason-functions',
      telemetry_sdk_version: '7.0.2',
      host_hostname: 'codestrap.usw-3.palantirfoundry.com',
      host_architecture: 'prod',
    },
    operationName: 'askBennie',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/askBennie/execute`,
    },
  })
  public async askBennie(
    query: string,
    userId: string,
    threadId?: string
  ): Promise<BennieResponse> {
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
      const { status, taskList, executionId } = await this.createSalesTasksList(
        query,
        userId,
        threadId
      );
      // if we get a bad response skip calling execute task list
      if (status !== 200 || !taskList) {
        return {
          status,
          executionId,
          message: `You are missing required information: ${taskList}. Please fix your shit and resend.`,
        };
      }
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
      SupportedEngines.SALES
    );
    // construct the response
    const system = `You are a helpful AI sales assistant named Bennie.
You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Bennie, Code's AI Sales Associate" or similar. 
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
        Be sure to structure your response so that it's readable by a human.
        For example if the state machine execution includes facts and figures use a table to format them
        Use lists to structure information hierarchies suck as task list execution and there results
        `;

    const geminiService = container.get<GeminiService>(TYPES.GeminiService);

    const response = await geminiService(user, system);

    let result = extractJsonFromBackticks(response);
    if (newThread) {
      // putting Execution Id in the thread is useful for debugging as users may need to supply it
      result = `# Execution Id: ${threadId}
### Response from Bennie
${result}
`;
    } else {
      result = `### Response from Bennie
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
      service_name: 'bennie',
      service_instance_id: 'production',
      telemetry_sdk_name: 'xreason-functions',
      telemetry_sdk_version: '7.0.2',
      host_hostname: 'codestrap.usw-3.palantirfoundry.com',
      host_architecture: 'prod',
    },
    operationName: 'createSalesTasksList',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/createSalesTasksList/execute`,
    },
  })
  public async createSalesTasksList(
    query: string,
    userId: string,
    threadId?: string
  ): Promise<BennieResponse> {
    console.log('createSalesTasksList called');
    // if no threadId create one
    // call the solver to get back the task list.
    const communication = await this.createTaskList(
      query,
      userId,
      SupportedEngines.SALES,
      undefined,
      undefined,
      threadId
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

  /**
   * A dedicated webhook callback for RFP submissions
   * Extract parameters from query param using an LLM.
   * The client is expected to send the machine exection ID (which is the same as the orignal threadID) back in it's responses.
   * We will have passed this ID to exteranl agents as part of createSalesTasks invocation above
   * If no machine exection ID is found throw ERROR
   * Use an LLM to extract the required parameters for an RFP from the provided query param such as:
   * Volume of staffing (we use Tech Leads, Engineers, and Engagement Directors)
   * Rate Card / how much it’s going to cost. Monthly for long term, one time for short term where short term is < 2 months
   * Available Start Date
   * if any required parameters are missing return a a textual response stating what is missing along with a machine execution ID
   * Once all required parameters are retireved execute the request
   */
  @Trace({
    resource: {
      service_name: 'bennie',
      service_instance_id: 'production',
      telemetry_sdk_name: 'xreason-functions',
      telemetry_sdk_version: '7.0.2',
      host_hostname: 'codestrap.usw-3.palantirfoundry.com',
      host_architecture: 'prod',
    },
    operationName: 'submitRfpResponse',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/submitRfpResponse/execute`,
    },
  })
  public async submitRfpResponse(
    rfpResponse: string,
    vendorId: string,
    machineExecutionId: string
  ): Promise<RfpResponseReceipt> {
    // rehydrate the machine
    const machineDao = container.get<MachineDao>(TYPES.MachineDao);
    // allow this to throw if no machine execution is found
    const execution = await machineDao.read(machineExecutionId);

    const machine: StateConfig[] = execution.machine
      ? JSON.parse(execution.machine)
      : undefined;
    const stateDefinition = execution.state
      ? JSON.parse(execution.state)
      : undefined;

    if (!machine) {
      throw new Error(
        `no programmed state machine found for: ${machineExecutionId}`
      );
    }

    if (!stateDefinition) {
      throw new Error(`no state definition found for: ${machineExecutionId}`);
    }

    const context = stateDefinition.context;
    // find the requestRftp on the context associated with the supplied vendorId (requestRftp.vendorId)
    const vendorRfpRequest = Object.keys(context)
      .filter((key) => key.indexOf('requestRfp') >= 0)
      .map((key) => context[key])
      .filter((item) => item.vendorId === vendorId)?.[0] as
      | RfpRequestResponse
      | undefined;
    // add the response to the requestRftp object.
    if (!vendorRfpRequest) {
      throw new Error(
        `Could not find matching RFP request for vendorId: ${vendorId}`
      );
    }
    // determine if this is a response or a request for missing information or something else
    const system =
      'You are a helpful AI classifier that classifies incoming RFP responses per the user instructions. You only response in JSON in the format defined by the user.';
    const user = `
        Classify the RFP response below into one of thre categories: "valid response", "request for missing information", "error"
        ${rfpResponse}

        You can only response in JSON in the following format:
        {"responseCategory": <YOUR_ANSWER>}

        For example if the rfp response is: "We can not process your request without a valid start and end date"
        Your response is:
        {"responseCategory": "request for missing information"}

        Do not be chatty, do not self reflect, just fucking respond in JSON with the correct classification!!!
        `;

    const geminiService = container.get<GeminiService>(TYPES.GeminiService);

    const response = await geminiService(user, system);
    const result = extractJsonFromBackticks(response);
    const category = JSON.parse(result).responseCategory as
      | 'valid response'
      | 'request for missing information'
      | 'error'
      | undefined;
    if (!category) {
      throw new Error(`Could not classify RFP response: ${category}`);
    }

    // handle the vendor response
    vendorRfpRequest.received = true;
    vendorRfpRequest.response = rfpResponse;

    switch (category) {
      case 'valid response':
        // if it's a respone mark the rfp state as received and recalculate all responses received
        vendorRfpRequest.status = 200;
        break;
      case 'request for missing information':
        vendorRfpRequest.status = 400;
        break;
      case 'error':
        vendorRfpRequest.status = 500;
        break;
    }
    // figure out if all responses from the vendors have been received
    const allResponsesReceived = Object.keys(context)
      .filter((key) => key.indexOf('requestRfp') >= 0)
      .map((key) => context[key])
      .every((item) => item.received);

    // find the associated await rfp response state, there should be only one becuase request for rfp is done in parrallel
    const awaitRfpResponseState = Object.keys(context)
      .filter((key) => key.indexOf('awaitRfpResponses') >= 0)
      .map((key) => context[key])?.[0] as RfpResponsesResult | undefined;

    if (!awaitRfpResponseState) {
      throw new Error('Could not locate awaitRfpResponseState state');
    }

    awaitRfpResponseState.allResponsesReceived = allResponsesReceived;
    awaitRfpResponseState.vendors.push(vendorId);

    // reset the history as it seems x-state will hydrate the state from the history context
    if (stateDefinition.history) {
      stateDefinition.history.context = stateDefinition.context;
    }

    execution.state = JSON.stringify(stateDefinition);
    // update the machine
    await machineDao.upsert(
      machineExecutionId,
      JSON.stringify(machine),
      JSON.stringify(stateDefinition),
      execution.logs!,
      '', // we have to send default values for lockOwner and lockUntil or the OSDK will shit a brick. It still can't handle optional params
      1
    );

    const threadDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
    let thread: Threads | undefined = undefined;

    try {
      thread = await threadDao.read(machineExecutionId);
    } catch (e) {
      console.log(e);
      console.log(
        `thread not found for id: ${machineExecutionId}, creating a new one`
      );
    }

    const threadMessage = `# Vendor Response
### Identifiers
- Date and time: ${new Date().toString()}
- Machine and ThreadId: ${machineExecutionId}

### Summary
Your RFP for ${vendorRfpRequest.vendorName} using ID: ${vendorRfpRequest.vendorId
      } was sent and we received the following response from their agent:
${vendorRfpRequest.response}
`;
    const appendedMessage = `${thread?.messages}
${threadMessage};
`;
    await threadDao.upsert(appendedMessage, 'bennie', machineExecutionId);

    await this.upsertState(
      undefined,
      true,
      machineExecutionId,
      undefined,
      SupportedEngines.SALES
    );

    const rfpDao = container.get<RfpRequestsDao>(TYPES.RfpRequestsDao);
    // find the associated RFP
    const rfpRequest = await rfpDao.search(machineExecutionId, vendorId);
    // there should be only one matching record
    // TODO add rfpResponseStatus = vendorRfpRequest.status
    await rfpDao.upsert(
      rfpRequest.rfp!,
      rfpResponse,
      vendorId,
      machineExecutionId,
      rfpRequest.id,
      vendorRfpRequest.status
    );

    return {
      status: 200,
      message: `We've received your RFP response and are reviewing it with the customer. We'll get back to you shortly.`,
      machineExecutionId,
      reciept: {
        id: '',
        timestamp: Date.now(),
      },
    };
  }
}
