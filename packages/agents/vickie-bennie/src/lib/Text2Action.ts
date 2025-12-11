import { Trace } from '@codestrap/developer-foundations.foundry-tracing-foundations';

import { getState, xReasonFactory } from '@codestrap/developer-foundations-x-reason';
import { SupportedEngines } from '@codestrap/developer-foundations-types';
import { engineV1 as engine } from '@codestrap/developer-foundations-x-reason';
import { dateTime, recall, requestRfp, userProfile } from '@codestrap/developer-foundations-x-reason';
import {
  extractJsonFromBackticks,
  uuidv4,
} from '@codestrap/developer-foundations-utils';
import {
  MachineEvent,
  Context,
  CommsDao,
  MachineDao,
  MachineExecutions,
  TYPES,
  UserDao,
  ThreadsDao,
  GeminiService,
  GetNextStateResult,
  Threads,
  Communications,
  LoggingService,
} from '@codestrap/developer-foundations-types';
import type { User } from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { State } from 'xstate';

// use classes to take advantage of trace decorator
export class Text2Action {
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
  public async recall(query: string, userProfile: User) {
    const recalledInformation = await recall(
      {
        requestId: '1234',
        status: 0,
        stack: ['userProfile'],
        userProfile,
      },
      undefined,
      query
    );

    return recalledInformation;
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
    operationName: 'createTaskList',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/createTaskList/execute`,
    },
  })
  public async createTaskList(
    query: string,
    userId?: string,
    xReasonEngine: string = SupportedEngines.COMS,
    questionPrompt?: string,
    tokens?: number,
    id?: string
  ): Promise<Communications> {
    const { solver } = xReasonFactory(xReasonEngine as SupportedEngines)({});
    const userProfile = await container.get<UserDao>(TYPES.UserDao)(userId);

    if (!userId) {
      userId = userProfile.id;
    }

    const currentDateTime = await dateTime({
      requestId: '1234',
      status: 0,
      stack: ['userProfile'],
      userProfile,
    });

    const recalledInformation = await this.recall(query, userProfile);

    // TODO: remove the bard coded context information once CodeStrap employeed slack channels are added to the contacts dataset
    const groudingContext = `
Below is the orgnizationl information you will need to perform your work:
# Context
${JSON.stringify(recalledInformation)}

# Current date/Time:
${JSON.stringify(currentDateTime)}

# Team Information:
Connor Deeks <connor.deeks@codestrap.me> - Connor Deeks in the CEO and board memeber in charge of platform leads, business strategy, and investor relations.
Dorian Smiley <dsmiley@codestrap.me> - Dorian is the CTO who manages the software engineers and is responsible for technology strategy, execution, and the lead applied AI engineer.

#Slack Channels
"C082XAZ9A1E": "Foundry Devs - used by software engineers working on Palantir Foundry related tasks such as data integration, transformations, and applications",
"C082M750AQ1": "Founding - used for items related to the company founding such as legal briefs, filings, banking etc",
"C08264VFXNZ": "Comms Engineering - used by the software engineers responsible for engineering related items around slack, gmail, teams, etc",
"C0828G7BXM0": "General - General",
"C0821UEPJKG": "Platform Leads - used by our partners responsible for sales motions and client engagements",
"C0825R4EHMK": "Public relations - used for all items related to PR and marketing"
"C08LX9DDMRB": "External Partner Datalinks - used for all communications with DataLinks and us (CodeStrap). DataLinks provides data products and data negineering services. Team members at DataLinks are Andrzej Grzesik - CTO, Francisco Ferrera - CEO, Rui Valente - developer, and Timur - developer"
"C08LMJDQ25C": "Etneral partner 11 Labs" - used for all communications with 11 Labs. 11 Labs makes generative voice models and is used by our customers for call center operations and voice enabled applications. 11 Labs team members are Alox Holt Lead Developer, Jack Piunti Enterprise Sales, and Kabir Gill Enterprise Sales"
`;

    const taskList = await engine.solver.solve(
      `${query}\n\n${groudingContext}`,
      solver
    );

    const comsDao = container.get<CommsDao>(TYPES.CommsDao);
    try {
      const communication = await comsDao.upsert(
        'User Defined',
        'None, these tasks were entered by a human',
        'Accept',
        taskList,
        xReasonEngine,
        userId,
        questionPrompt,
        tokens,
        id
      );
      return communication;

    } catch (error) {
      console.error('Error upserting communication:', error);
      throw error;
    }
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
    operationName: 'getNextState',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/getNextState/execute`,
    },
  })
  public async getNextState(
    plan?: string,
    forward = true,
    executionId?: string,
    inputs = '{}',
    xreason: string = SupportedEngines.COMS,
    persistMachineOnTransition = false,
  ): Promise<GetNextStateResult> {
    const machine = await this.upsertState(
      plan,
      forward,
      executionId,
      inputs,
      xreason,
      persistMachineOnTransition
    );

    if (machine?.state) {
      const state = JSON.parse(machine.state) as State<Context, MachineEvent>;
      const currentState = state.value;
      const context = state.context as Context;
      const results = Object.keys(context)
        .filter((key) => key.indexOf('|') >= 0)
        .map((key) => {
          const taskName = key.split('|')[0];
          const taskOutput = context[key];

          return { taskName, taskOutput };
        });

      const stack = context.stack?.map((state) => state.split('|')[0]);

      // TODO add the current state
      return {
        orderTheTasksWereExecutedIn: stack!,
        theResultOfEachTask: results,
        value: currentState,
      };
    }

    throw new Error(
      "I'm sorry but I failed to get a response back. Can you try again? Soemtimes my AI brain gets a little flakey. But second time is usally the charm."
    );
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
    operationName: 'upsertState',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/upsertState/execute`,
    },
  })
  public async upsertState(
    plan?: string,
    forward = true,
    executionId?: string,
    inputs = '{}',
    xreason: string = SupportedEngines.COMS,
    persistMachineOnTransition = false,
  ): Promise<MachineExecutions> {
    const solution = {
      input: '', //not relevant for this
      id: executionId || uuidv4(),
      plan: plan || '',
    };

    const result = await getState(
      solution,
      forward,
      JSON.parse(inputs),
      xreason as SupportedEngines,
      persistMachineOnTransition
    );

    const { getLog } = container.get<LoggingService>(TYPES.LoggingService);

    const machineDao = container.get<MachineDao>(TYPES.MachineDao);

    // this is to prevent race condition because edits resulting from the state transition when auto save is on
    // may still be ongoing. This results in errors in platforms like Foundry where stale writes are detected and prevented
    if (!persistMachineOnTransition) {
      const machine = await machineDao.upsert(
        solution.id,
        JSON.stringify(result.stateMachine),
        result.jsonState,
        getLog(solution.id) ?? '',
        '', // we have to send default values for lockOwner and lockUntil or the OSDK will shit a brick. It still can't handle optional params
        1
      );

      return machine;
    }

    const state = JSON.parse(result.jsonState);

    return {
      id: solution.id,
      currentState: state.value,
      logs: getLog(solution.id) ?? '',
      machine: JSON.stringify(result.stateMachine),
      state: result.jsonState,
    }

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
    operationName: 'sendThreadMessage',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint: `/api/v2/ontologies/${process.env.ONTOLOGY_ID}/queries/sendThreadMessage/execute`,
    },
  })
  public async sendThreadMessage(
    message: string,
    userId: string,
    machineExecutionId: string
  ): Promise<Threads> {
    // I changed the response of this function to void to it can be triggered as an action. Once refactored to compute modules it can return a response
    // rehydrate the machine
    const threadDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
    const retrievedThread = await threadDao.read(machineExecutionId);

    const messageHistory = retrievedThread.messages;

    if (!messageHistory) {
      throw new Error(`no thread found for: ${machineExecutionId}`);
    }

    const currentUserProfile = await userProfile({
      requestId: '1234',
      status: 0,
      userId,
    });
    const currentDateTime = await dateTime({
      requestId: '1234',
      status: 0,
      stack: ['userProfile'],
      userProfile: currentUserProfile,
    });
    const recalledInformation = await recall(
      {
        requestId: '1234',
        status: 0,
        stack: ['userProfile'],
        userProfile: currentUserProfile,
      },
      undefined,
      `${messageHistory}  ${message}`
    );

    // TODO: remove the bard coded context information once CodeStrap employeed slack channels are added to the contacts dataset
    const groudingContext = `
    Below is the orgnizationl information you will need to perform your work:
    # Context
    ${JSON.stringify(recalledInformation)}
    
    # Current date/Time:
    ${JSON.stringify(currentDateTime)}
    
    # Team Information:
    Connor Deeks <connor.deeks@codestrap.me> - Connor Deeks in the CEO and board memeber in charge of platform leads, business strategy, and investor relations.
    Dorian Smiley <dsmiley@codestrap.me> - Dorian is the CTO who manages the software engineers and is responsible for technology strategy, execution, and the lead applied AI engineer.
    
    #Slack Channels
    "C082XAZ9A1E": "Foundry Devs - used by software engineers working on Palantir Foundry related tasks such as data integration, transformations, and applications",
    "C082M750AQ1": "Founding - used for items related to the company founding such as legal briefs, filings, banking etc",
    "C08264VFXNZ": "Comms Engineering - used by the software engineers responsible for engineering related items around slack, gmail, teams, etc",
    "C0828G7BXM0": "General - General",
    "C0821UEPJKG": "Platform Leads - used by our partners responsible for sales motions and client engagements",
    "C0825R4EHMK": "Public relations - used for all items related to PR and marketing"
    "C08LX9DDMRB": "External Partner Datalinks - used for all communications with DataLinks and us (CodeStrap). DataLinks provides data products and data negineering services. Team members at DataLinks are Andrzej Grzesik - CTO, Francisco Ferrera - CEO, Rui Valente - developer, and Timur - developer"
    "C08LMJDQ25C": "Etneral partner 11 Labs" - used for all communications with 11 Labs. 11 Labs makes generative voice models and is used by our customers for call center operations and voice enabled applications. 11 Labs team members are Alox Holt Lead Developer, Jack Piunti Enterprise Sales, and Kabir Gill Enterprise Sales"
    `;

    // determine if this is a response or a request for missing information or something else
    const system =
      'You are a helpful AI sales associate in charge of fielding incoming messages from sales agents in the field. You job is to pick the next best action based on the message history and incoming request.';
    const user = `
            # Context
            Below is information retrieved from our grounding context engine that might include relevant names, email addresses, vendor ID, etc
            This should only be used as a secondary source on information. The message history is the primary source of information.
            ${groudingContext}
    
            # Message History
            Based on the following message history
            ${messageHistory}
    
            # User Query
            And the incoming user query for a sales agent in the field:
            ${message}
    
            Determine which of the following actions should be taken based on the the user query:
            - Resubmit RFP to resolve missing information
            - Send Email
            - Send Slack Message
            - No supported action found
    
            You can only response in JSON in the following format:
            {
                "action": <YOUR_ANSWER> , 
                "emailAddresses": <ARRAY_OF RELEVANT_EMAILS>, 
                "slackChannelID": <ARRAY_OF_RELEVANT_SLACK_CHANNEL_ID>,
                "message": <THE_MESSAGE_TO_SEND>,
                "vendors": <ANY_RELEVANT_VENDOR_IDs>
            }
    
            For example 
            Id the incoming context includes:
            # User Query:
            Create a RFP for Northslope and Rangr to deliver a tariff solution on Foundry. The solution must include support for pricing models, simulations, and A/B testing of the outcomes. We expect this to be an 4 week engagement requiring 3 Python engineer, 1 TypeScript engineer, and 2 SME on developing pricing models. Then email me the responses. The company is John Doe's Doe's and there address is 123 main street dallas tx, 75081 and the main contact is johndoe@johnsdoes.com.
    
            # Technical details
            ExecutionID: 12fae652-e90e-4b45-ae07-a9fa67a874e7
    
            # Summary
            Happy Saturday! I'm Bennie, Code's AI Sales Associate, here to help summarize those RFP tasks.
    
            Okay, here's the breakdown:
    
            RFP to Northslope: Request sent successfully! They acknowledge receipt and will respond shortly. Receipt ID is 466eeb1d-435c-4062-9890-508e957344f5.
            RFP to Rangr Data: Request sent successfully! They acknowledge receipt and the solution details appear to be valid. Receipt ID is fe655407-8a48-4ef7-808f-f7a341cfdbae.
            Awaiting Responses: We're still waiting for both Northslope and Rangr Data to submit their complete RFP responses.
            Let me know if you need me to chase them up or do anything else!
            
            # Vendor Response
            ### Identifiers
            - Date and time: Sat May 31 2025 15:13:12 GMT+0000 (Coordinated Universal Time)
            - Machine and ThreadId: 12fae652-e90e-4b45-ae07-a9fa67a874e7
    
            ### Summary
            Your RFP for Northslope using ID: northslopetech.com was sent and we received the following response from their agent:
            ### 📋 We Can not process your request
            We can not process your request without a valid start and end date
    
            And the incoming message is:
            The sart date is June 3rd and the end date is june 25th
    
            Your response is:
            {
                "action": "Resubmit RFP to resolve missing information" , 
                "emailAddresses": [], 
                "slackChannelID": [],
                "message": "Create RFP - Vendor: Northslope <northslopetech.com> - Objectives: Deliver a tariff solution on Foundry that includes support for pricing models, simulations, and A/B testing of the outcomes for John Doe's Manufacturing at 123 main street dallas tx, 75081 with contact johndoe@johnsdoes.com - Deliverables: A fully functional tariff solution on Foundry. - Timeline: 4 week engagement starting Jun 3 2025 and the ending Jun 25 2025 requiring 3 Python engineers, 1 TypeScript engineer, and 2 SMEs on developing pricing models.",
                "vendors": ["Northslope <northslopetech.com>"]
            }
    
            Explanation: the vendor array correctly includes Northslope and the correct vendorID <northslopetech.com>. It also reiterates the RFP from the original user query so it can be resubmitted correctly inserting the start and end dates wupplied by the sales agent int he field.
            `;

    const geminiService = container.get<GeminiService>(TYPES.GeminiService);

    const response = await geminiService(user, system);
    const result = extractJsonFromBackticks(response);

    const parsedResult = JSON.parse(result) as {
      action: string;
      emailAddresses: string[];
      slackChannelID: string[];
      message: string;
      vendors: string[];
    };
    const category = parsedResult.action as
      | 'Resubmit RFP to resolve missing information'
      | 'Send Email'
      | 'Send Slack Message'
      | 'No supported action found'
      | undefined;

    if (!category) {
      throw new Error(`Could not classify your request: ${category}`);
    }

    let newThreadMessage = 'No mew message generated';

    if (category === 'Resubmit RFP to resolve missing information') {
      const promises = parsedResult.vendors.map(async (vendorId) => {
        console.log(`resubmitting RFP for ${vendorId}`);

        return requestRfp(
          {
            requestId: uuidv4(),
            machineExecutionId,
            executionId: machineExecutionId,
            status: 200,
          },
          undefined,
          parsedResult.message
        );
      });

      const resolvedPromises = await Promise.all(promises);
      // TODO consider using a reasoning model to check the first models work
      newThreadMessage = resolvedPromises.reduce((acc, cur) => {
        acc = `${acc}
    ### Vendor Details:
    - Vendor: ${cur.vendorName}
    - Vendor ID: ${cur.vendorId}
    - Status Code: ${cur.status}
    - Vendor Response: ${cur.message}
    `;
        return acc;
      }, '# RFPs for the following vendors were resubmitted:');
    }
    // TODO handle more categories of responses

    const appendedMessage = `${messageHistory}
    ${newThreadMessage}`;

    // update the thread with the new message
    const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
    const threadResult = await threadsDao.upsert(
      appendedMessage,
      'bennie',
      machineExecutionId
    );

    return threadResult;
  }
}
