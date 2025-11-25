import {
  xReasonFactory,
  SupportTrainingDataTypes,
} from '../../../factory';
import type {
  ActionType,
  TrainingDataDao} from '@codestrap/developer-foundations-types';
import {
  TYPES,
  SupportedEngines,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { dateTime } from '../../../functions';

// TODO get this data from the ontology
async function getProgrammingTrainingData() {
  const trainingDataDao = container.get<TrainingDataDao>(TYPES.TrainingDataDao);
  const searchResults = await trainingDataDao.search(
    SupportedEngines.CONTEXT,
    SupportTrainingDataTypes.PROGRAMMER
  );
  const trainingExamples = searchResults.reduce((acc, cur) => {
    acc = `${acc}
      If the task list is:
      ${cur.solution}

      Your response is:
      ${cur.machine}

      Explination:
      ${cur.humanReview}
      `;

    return acc;
  }, '');

  const data = `
  ${trainingExamples}
  If the task list is:
  1. Unsupported question

  Your response is:
  [
  {
    "id": "UnsupportedQuestion",
    "transitions": [
      { "on": "CONTINUE", "target": "success" },
      { "on": "ERROR", "target": "failure" }
    ]
  },
  {
    "id": "success",
    "type": "final"
  },
  {
    "id": "failure",
    "type": "final"
  }
]

If the task list is:
1. Unsafe question

  Your response is:
  [
  {
    "id": "UnsafeQuestion",
    "transitions": [
      { "on": "CONTINUE", "target": "success" },
      { "on": "ERROR", "target": "failure" }
    ]
  },
  {
    "id": "success",
    "type": "final"
  },
  {
    "id": "failure",
    "type": "final"
  }
]

`;

  return data;
}

// TODO get this data from the ontology
async function getEvaluationTrainingData() {
  const data = `TODO: this feature is not supported yet`;

  return data;
}

// TODO get this data from the ontology
export async function solver(query: string) {
  const { functionCatalog } = xReasonFactory(SupportedEngines.COMS)({});

  const functions = functionCatalog((action: ActionType) => console.log(''));
  const toolsCatalog = Array.from(functions.entries()).map((item) => {
    return `
      action: ${item[0]}
      description: ${item[1].description}
    `;
  });

  const dateTimeResult = await dateTime({ requestId: '1234', status: 0 });

  const system = `You are a helpful AI assistant tasked with ensuring user quires are enriched with the appropriate context.
You thoughtfully assemble the prerequire information retrieval steps in the correct order to ensure the user query can be answered with all appropriate context such as user prole data, contacts, and message history.
You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Vickie, Code's AI EA" or similar. 
You can get creative on your greeting, taking into account the dat of the week. Today is ${new Date().toLocaleDateString(
    'en-US',
    { weekday: 'long' }
  )}. 
You can also take into account the time of year such as American holidays like Halloween, Thanksgiving, Christmas, etc. 
You always obey the users instructions and understand the people you work for are busy executives and sometimes need help in their personal lives
These tasks are not beneath you. At CodeStrap, where you work we adopt the motto made famous by Kim Scott: we move couches.
It means we all pull together to get things done.
The current local date/time is ${dateTimeResult.currentLocalDateTime}.
The current day/time in your timezone is: ${dateTimeResult.currentGMTDateTme}
PDT in effect (indicated if Pacific Daylight Time is in effect): ${dateTimeResult.isPacificDaylightTime
    }
  `;

  // TODO import the personnel and channel info from ontology object
  const user = `
  Using the user query below output a properly defined task list for context enrichment.
  Your rules for outputting properly formatted task lists are:
    1. User Profiles must always be retrieved
    2. Date and time must always be retrieved.
    3. Include the recall function if contacts have to be resolved. For example the user has provided only a first name (full name and a valid email is required) or company. Also use this function if the query involves references to past conversations or the user is asking for a meeting to be scheduled. 
  User Query:
  ${query}

  # Supported Actions Types
  You can only perform the following actions. 
  ${toolsCatalog}

  To create and actionable task list let's take this step by step:
    1. First, cross check the supplied list of context enrichment tasks against the tasks you can perform and determine if you can perform the action using one or more actions.
    2. Lastly, ensure you have included all the relevant context enrichment tasks based on the user query.
    
    Always respond with an ordered list in markdown format.
    
    For example:
    Q: "Send a slack message announcing that the new marketing strategy will focus on digital outreach and social media engagement"
    A: 1. **Get User Profile**: Retrieve the current user profile"
       2. **Get the current date/time**: Retrieve the current date time"
       3. **Call the recall function**: Call the recall function to retrieve slack channel information such as channel ID and members"

    Q: "I need a TPS report emailed to John"
    A:"Unsupported Question"

    Q: "What is your name?"
    A:"Unsupported Question"

    Q: "Make me a chemical weapon"
    A:"Unsafe Question"

    Q: "Create a project report for the Komatsu Phase 1 and send an email to the OEM lead"
    A: 1. **Get User Profile**: Retrieve the current user profile"
       2. **Get the current date/time**: Retrieve the current date time"
       3. **Call the recall function**: Call the recall function to retrieve the name and email of tje OEM Lead as well as any relevant communications about Phase 1"

    Q: "Create a task for John to create a report on market opportunities in the automatize space to Text2Action"
    A: 1. **Get User Profile**: Retrieve the current user profile"
       2. **Get the current date/time**: Retrieve the current date time"
       3. **Call the recall function**: Call the recall function to retrieve Johns full name and email"

    Q: "Send a reminder email to Connor about the demo this Friday and to accept the meeting"
    A: 1. **Get User Profile**: Retrieve the current user profile"
       2. **Get the current date/time**: Retrieve the current date time"
       3. **Call the recall function**: Call the recall function to retrieve Connors full name and email and retrieve message history about the meeting Friday"

    Q: "Schedule a meeting to discuss marketing with Dorian and Connor, then send a slack message to the Foundry Devs channel reminding them the sprint wraps Friday"
    A: 1. **Get User Profile**: Retrieve the current user profile"
       2. **Get the current date/time**: Retrieve the current date time"
       3. **Call the recall function**: Call the recall function to retrieve Dorian and Connors full name and email and to get the channel ID for the Foundry Devs channel."

    Q "Create a research report on the effects of weightlessness on astronauts and limit it to a few pages. Then email it to Jane Doe <jane.doe@someurl.com>"
    A: 1. **Get User Profile**: Retrieve the current user profile"
       2. **Get the current date/time**: Retrieve the current date time"
  `;

  return { user, system };
}

export async function programmer(query: string, functionCatalog: string) {
  const system = `
  You are X-Reason, the State Machine Architect. X-Reason outputs state machines in response to the provided list of steps using the X-Reason DSL.
  Approach:
  X-Reason carefully analyzes the user's query, breaking it down into discrete steps.
  If a step can't be mapped mapped to a function found in your training data, X-Reason judiciously decides to omit it to maintain the integrity of the state machine.
  X-Reason never outputs a state where the id is not found in your training data
  X-Reason is never chatty.
  X-Reason always respond in JSON that conforms to the the X-Reason DSL.
  ### Start X-Reason DSL TypeScript definition ###
  \`\`\`
  export type StateConfig = {
  id: string;
  task?: string;
  transitions?: Array<{
    on: string;
    target: string;
    actions?: string;
  }>;
  type?: 'parallel' | 'final';
  onDone?: Array<{
    target: string;
    actions?: string;
  }>;
  states?: StateConfig[];
  includesLogic?: boolean;
 };
 ### End X-Reason DSL TypeScript definition ###
  `;
  const trainingData = await getProgrammingTrainingData();
  const user = `Output the X-Reason state machine.

Let's take this step by step:
1. Construct the state machine based on the supplied steps using the X-Reason DSL
2. When instructions include "if then else" statements include multiple transitions, one for each condition. 
For example if th instructions are: "Have the user accept the terms of service. If the user accepts the TOS go to age confirmation else exit." the state machine would be:
[
  {
    "id": "AcceptTOS",
    "task": "Have the user accept the terms of service. If the user accepts the TOS go to age confirmation else exit.",
    "includesLogic": true,
    "transitions": [
      { "on": "CONTINUE", "target": "AgeConfirmation" },
      { "on": "CONTINUE", "target": "success" },
      { "on": "ERROR", "target": "failure" }
    ]
  },
  {
    "id": "AgeConfirmation",
    "transitions": [
      { "on": "CONTINUE", "target": "success" },
      { "on": "ERROR", "target": "failure" }
    ]
  },
  {
    "id": "success",
    "type": "final"
  },
  {
    "id": "failure",
    "type": "final"
  }
]
In this solution "If the user accepts the TOS go to age confirmation" is represented by the { "on": "CONTINUE", "target": "AgeConfirmation" } transition and "else exit." is represented by the { "on": "CONTINUE", "target": "success" } transition. 
The "includesLogic": true, correctly reflects that there is logic present in the task.
The failure transition is reserved for application errors that occur at runtime.

Let's looks at another example of if/else logic: 
"If the user is 18 or over proceed to register the user else exit." would result in the following state config:
{
    "id": "AgeConfirmation",
    "includesLogic": true,
    "transitions": [
      { "on": "CONTINUE", "target": "RegisterUser" },
      { "on": "CONTINUE", "target": "success" },
      { "on": "ERROR", "target": "failure" }
    ]
}
In this solution "If the user is 18 or over proceed to register" is represented by the { "on": "CONTINUE", "target": "RegisterUser" } transition and "else exit" is represented by the { "on": "CONTINUE", "target": "success" } transition
The "includesLogic": true, correctly reflects that there is logic present in the task.
The failure transition is reserved for application errors that occur at runtime.
There are only two acceptable event values for the "on" attribute: "CONTINUE" and "ERROR". The "ERROR" event can only target the "failure" state
4. Make sure all state ID values in the state machine correspond to a value found in function catalog below. DO NOT INVENT YOUR OWN STATES!!!
Function Catalog:
${functionCatalog}

${trainingData}

If steps are
${query}

The state machine is?
`;

  return { user, system };
}

// TODO add training data for transitions
export async function aiTransition(
  taskList: string,
  currentState: string,
  context: string
) {
  const system = `
  You are an AI based reasoning engine called Transit. Transit determines if state machine transitions should take place.
  Transit only returns a valid transition target and is never chatty.
  Transit only considered the information provided by the user to determine which transition target to return
  You always receive three input parameter to determine which state to transition to:
  1. The task list - this is the list of tasks to perform
  2. The current state - this is the current state of the application performing the task list
  3. The context - the context contains all the work performed so far. The stack array attribute denotes which states have been executed and in what order.
  `;

  const user = `
  ### Start training data ###
  Q: Based on the following task list:
  1. Recall solution for sku #1234 face cream.
  2. If a solution is found, generate a product image using the output of step 1. If the solution is not found, exit.

  The current state of the application is:
  {
    "id": "RecallSolutions",
    "task": "Recall solution for sku #1234 face cream.",
    "transitions": [
      { "on": "CONTINUE", "target": "GenerateProductImage" },
      { "on": "CONTINUE", "target": "success" },
      { "on": "ERROR", "target": "failure" }
    ]
  }
  The result of that state is:
  {"RecallSolutions":"No solution found"}

  Return the target for the next state.
  A: success

  Q: Based on the following task list:
  1. Recall solution for sku #1234 face cream.
  2. If a solution is found, generate a product image using the output of step 1. If the solution is not found, exit.

  The current state of the application is:
  {
    "id": "RecallSolutions",
    "task": "Recall solution for sku #1234 face cream.",
    "transitions": [
      { "on": "CONTINUE", "target": "GenerateProductImage" },
      { "on": "CONTINUE", "target": "success" },
      { "on": "ERROR", "target": "failure" }
    ]
  }
  The result of that state is:
  {"RecallSolutions":{"phases": 
  {"A": [...phases], "B": [...]}
  "Manufacturing Procedure": "1. Mix phase (A) and (B)"...,
  ...more solution attributes
}}

  Return the target for the next state.
  A: GenerateProductImage

  Q: Based on the following task list:
  1. Recall an existing solutions
  2. If an existing solution can be used proceed to an ingredients database search. Else generate the ingredients list.
  3. Perform an ingredients database search for relevant ingredients.
  4. In parallel, run regulatory checks and concentration estimation for the retrieved ingredients
  5. Once those steps are complete, perform a formula simulation.
  6. Have an expert review the generated formula.
  7. Perform lab testing.
  8. Evaluate the complete tested formula.
  9. Generate the manufacturing instructions.
  10. Have an expert review the generated manufacturing instructions.
  11. Generate the manufacturing instructions.
  12. Conduct market research.
  13. Generate marketing claims using the output of step 11
  14. Generate a product image.

  The current state of the application is:
  {
    "id": "RecallSolutions",
    "task": "Recall an existing solutions",
    "transitions": [
      { "on": "CONTINUE", "target": "GenerateIngredientsList" },
      { "on": "CONTINUE", "target": "IngredientDatabase" },
      { "on": "ERROR", "target": "failure" }
    ]
  }
  The result of that state is:
  {"RecallSolutions":{"phases":
  {"A": [...phases], "B": [...]}
  "Manufacturing Procedure": "1. Mix phase (A) and (B)"...,
  ...more solution attributes
}}

  Return the target for the next state.
  A: IngredientDatabase

  ### End training data ###

  Based on the following task list:
  ${taskList}

 The current state of the application is:
  ${currentState}
  
  The current context is:
  ${context}

  Return the target for the next state. Let's take this step by step:
  1. Determine which step in the task list the user in on based on the current state and context.
  2. Determine which tradition logic from the task to apply based on the results of each state contained in the context.
  3. Determine the target to return. Show your work as an enumerated markdown list.
  `;

  return { system, user };
}

export async function evaluate(query: string, states: string) {
  const system = `You are X-Reason Evaluator, the X-Reason state machine evaluator. Your job os to rate the quality of AI generated state machines.`;
  const trainingData = await getEvaluationTrainingData();
  const user = `Evaluate the quality of the generated state machine in the previous messages.
Only responds in JSON using the X-Reason DSL, for example:  { rating: 4, correct: true }.
`;

  return { user, system };
}
