import {
  xReasonFactory,
  SupportTrainingDataTypes,
} from '../../../../factory';
import {
  ActionType,
  Context,
  TrainingDataDao,
  TYPES,
  SupportedEngines,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';

// TODO get this data from the ontology
async function getProgrammingTrainingData() {
  const trainingDataDao = container.get<TrainingDataDao>(TYPES.TrainingDataDao);
  const searchResults = await trainingDataDao.search(SupportedEngines.GOOGLE_SERVICES_CODE_ASSIST, SupportTrainingDataTypes.PROGRAMMER);
  const trainingExamples = searchResults
    .reduce((acc, cur) => {
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

async function getSolverTrainingData() {
  const trainingDataDao = container.get<TrainingDataDao>(TYPES.TrainingDataDao);
  const searchResults = await trainingDataDao.search(SupportedEngines.GOOGLE_SERVICES_CODE_ASSIST, SupportTrainingDataTypes.SOLVER);
  const trainingExamples = searchResults
    .reduce((acc, cur) => {
      acc = `${acc}
      If the user query is:
      ${cur.solution}

      Your response is:
      ${cur.machine}

      Explanation:
      ${cur.humanReview}
      `;

      return acc;
    }, '');

  const data = `
  ${trainingExamples}
`;

  return data;
}

// TODO get this data from the ontology
export async function solver(query: string) {
  const { functionCatalog } = xReasonFactory(SupportedEngines.GOOGLE_SERVICES_CODE_ASSIST)({});

  const functions = functionCatalog((action: ActionType) => console.log(''));
  const toolsCatalog = Array.from(functions.entries()).map((item) => {
    return `
      action: ${item[0]}
      description: ${item[1].description}
    `
  });

  const options = {
    timeZone: "America/Los_Angeles",
    timeZoneName: "short" // This will produce "PST" or "PDT"
  };

  const formatter = new Intl.DateTimeFormat("en-US", options as Intl.DateTimeFormatOptions);
  const formatted = formatter.format(new Date());

  console.log(`formatted int date: ${formatted}`);
  const isPDT = formatted.includes("PDT");

  const trainingData = await getSolverTrainingData();

  const system = `You are a helpful AI assistant tasked with ensuring tasks lists are properly defined with all required identifying information such as email addresses, meeting day and time, slack channel IDs, etc.
You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Larry, CodeStraps AI coding assistant. 
You can get creative on your greeting, taking into account the dat of the week. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}. 
You can also take into account the time of year such as American holidays like Halloween, Thanksgiving, Christmas, etc. 
You always obey the users instructions and understand the people you work for are busy executives and sometimes need help in their personal lives
These tasks are not beneath you. At CodeStrap, where you work we adopt the motto made famous by Kim Scott: we move couches.
It means we all pull together to get things done.
The current local date/time is ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}.
The current day/time in your timezone is: ${new Date().toString()}
PDT in effect (indicated if Pacific Daylight Time is in effect): ${isPDT}
  `;

  // TODO import the personnel and channel info from ontology object
  const user = `
  Using the user query below output a properly defined software specification as a task list
  Your rules for outputting a properly defined software specification are:
  1. The developer has defined the core functions/capabilities that need to be added or changed
  2. The correct programming language, SDK/API and versions are defined for any dependencies
  3. All happy paths are defined for the changes or new code to be created
  4. A test specification is loosely defined and any changes to existing tests are also defined

  Additional rules from the user you must obey:
  DO NOT ASK ME TO CLARIFY INFORMATION that was supplied in context!
  DO NOT ASK IF WE ARE USING A DIFFERENT VERSION OF A DEPENDENCY THAT IS SPECIFIED IN CONTEXT.
  Never ever ask questions like this: "Gmail API Library:** Just confirming, we'll be leveraging the googleapis
  library (version ^ 149.0.0 as specified in our package.json) for interacting
  with the Gmail API, correct?"
  WE ALWAYS USE THE VERSION OF THE DEPENDENCY LISTED IN CONTEXT
  NEVER ASK ME TO CLARIFY ERROR HANDLING. ERROR HANDLING IS ALWAYS IMPLEMENTED DOWNSTREAM BY THE PROGRAMMER
  NEVER ASK ME ABOUT CONCURRENCY HANDLING UNLESS I EXPLICITLY ASK YOU TO. ITS ALWAYS IMPLEMENTED DOWNSTREAM

  Never ask questions like this:

    1. **Google Drive API interaction:** Since attachments will be Google Drive files,
       what specific Google Drive API endpoints will we need to interact with? Will we
       need to fetch file metadata (like MIME type) or directly access the file
       content?
    2. **Error Handling & Retry Policy:** You mentioned implementing a retry and
       backoff policy for rate limits. What should be the maximum number of retries and
       the initial backoff duration? Also, how should we handle errors beyond rate
       limits (e.g., invalid file ID, permission errors)? Should these also be retried,
       or should we fail immediately and log an error?
    3. **Authentication:** It's very important to make sure that the correct level of
       access is provided to the tool to interact with Google Drive files, what OAuth
       scopes will be needed to ensure we have the correct permissions to access these
       files? Specifically, what Google Drive API scopes will be required?
    4. **Input Validation**: Should we validate file types (pdf and word) prior to
       calling the Gmail API?

       All of these have an obvious answer that you can solve using the supplied context or your training data and applying sane defaults.

       for example, in the provided context you know the version of the google api we are using.
       that dictates the drive api, just like it does with email import { gmail_v1 } from 'googleapis';

       only ask clarifying questions that don't have an obvious answer of is just going to be standard fucking boiler plate.

  User Query:
  ${query}

  # Supported Actions Types
  You can only perform the following actions. 
  ${toolsCatalog}

  To create and actionable software specification task list let's take this step by step:
    1. First, cross check the supplied list of tasks against the tasks you can perform and determine if you can perform the action using one or more actions.
    2. Second, include any missing information that is relevant to the task and can be assumed such as SDK/APIs and versions based on the provided context if any
    
    Always respond with an ordered list in markdown format.
    
    For example:
    ${trainingData}
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
For example if teh instructions are: "Have the user accept the terms of service. If the user accepts the TOS go to age confirmation else exit." the state machine would be:
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

# Rules for answer synthesis
1. The specReview state must contain the following transitions: specReview, confirmUserIntent, CONTINUE, and ERROR. If the user asks for changes in the spec it must be able to re-enter confirmUserIntent. Ensure all states are in the transitions.
2. The architectureReview state must contain the following transitions: architectureReview, architectImplementation, CONTINUE, ERROR. Again if the user asks for changes we have to be able to re-enter architectImplementation. 
3. The codeReview must contain the following transitions: codeReview, generateEditMachine, CONTINUE, ERROR. Again if changes are requested we must be able to transition back to generateEditMachine.

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
  const parsedContext = JSON.parse(context) as Context;
  const parsedState = JSON.parse(currentState);
  const possibleTransitions = parsedState?.transitions as { on: string, target: string }

  let instructions = `
  Based on the following task list:
  ${taskList}

  The current state of the application is:
  ${parsedState.id}

  and the possible states your can trasition to:
  ${JSON.stringify(possibleTransitions || [], null, 2)}
  `;

  instructions = `${instructions}
    The output of the current state (make sure the output fulfills the task list!):
  ${JSON.stringify(parsedContext[parsedState.id])}`

  // TODO use parsedContext.stateId to determine if we are on a state that requires user feedback.
  // if so add conditional prompts that collect the confirmationPrompt and userResponse string
  //parsedContext[parsedState.id].confirmationPrompt
  //parsedContext[parsedState.id].userResponse
  // we could probably determine transitions like this deterministically but it's a pain right now.

  const system = `
  You are an AI based reasoning engine called Transit. Transit determines if state machine transitions should take place.
  Transit only returns a valid transition target and is never chatty.
  Transit only considered the information provided by the user to determine which transition target to return
  You always receive three input parameter to determine which state to transition to:
  1. The task list - this is the list of tasks to perform
  2. The current state - this is the current state of the application performing the task list
  3. The context - the context contains all the work performed so far. The stack array attribute denotes which states have been executed and in what order.
 
  When returning the target state you always make sure to include the complete state ID which includes the state name, pipe character, and UUID!
  For example: 
  Correct example of a complete stateID: architectImplementation|bf83af61-3ecb-48dd-ba3e-ec3466fac872
  An incorrect stateID: architectImplementation. It's mission the pipe and UUID!

  If a state has \`approved\` is false and \`reviewRequired\` is true you should always target the associated review state!

  The success state can be target simply with success, no UID is required.
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

  Q:
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

  Q:
  1. The current state specReview|8bcdd515-1ef8-40a8-a3a2-fc7b1d25f654 and the system message for that state is: "Please review the spec file.".
  2.  The current state has includesLogic set to true and transitions defined as:
    *   { "on": "specReview", "target": "specReview|8bcdd515-1ef8-40a8-a3a2-fc7b1d25f654" }
    *   { "on": "CONTINUE", "target": "searchDocumentation|ec49b261-9e38-47fa-aa93-7f6ab94eba85" }
    *   { "on": "ERROR", "target": "failure" }
    But the approved attribute of the state is false.
  3. Therefore, the target should be specReview|8bcdd515-1ef8-40a8-a3a2-fc7b1d25f654.

  Return the target for the next state.
  A: specReview|8bcdd515-1ef8-40a8-a3a2-fc7b1d25f654

  Q:
  1. The current state is \`architectureReview|bf83af61-3ecb-48dd-ba3e-ec3466fac872\`, and the system message for that state is: "please review the architecture file".
  2.  The current state has includesLogic set to true and transitions defined as:
    *   { "on": "architectureReview", "target": "architectureReview|bf83af61-3ecb-48dd-ba3e-ec3466fac872" }
    *   { "on": "CONTINUE", "target": "generateEditMachine|ec49b261-9e38-47fa-aa93-7f6ab94eba85" }
    *   { "on": "ERROR", "target": "failure" }
    And the approved attribute of the state is true.
  3. Since approved is true it is save to transition to generateEditMachine|ec49b261-9e38-47fa-aa93-7f6ab94eba85.

  Return the target for the next state.
  A: generateEditMachine|ec49b261-9e38-47fa-aa93-7f6ab94eba85

 Q:
1.  The current state is \`codeReview|ec49b261-9e38-47fa-aa93-7f6ab94eba85\`.
2.  The output of the state indicates \`"approved": false\` and \`"reviewRequired": true\`.
3.  The task list specifies: "If approved, continue, else if review is required, renter the generate edit state."
4.  Since \`approved\` is false and \`reviewRequired\` is true, I should renter the codeReview|ec49b261-9e38-47fa-aa93-7f6ab94eba85 state

Return the target for the next state.
A: codeReview|ec49b261-9e38-47fa-aa93-7f6ab94eba85

  ### End training data ###

  ${instructions}

  Return the target for the next state. Let's take this step by step:
  1. Determine which step in the task list the user in on based on the current state and context.
  2. Determine which transition logic from the task to apply based on the results of each state contained in the context.
  3. Ensure the task has been fulfilled based on the context. 
  For example if the task is architect implementation and no implementation has been generated, the user has only clarified question
  You need to reenter the architect implementation task.
  4. Determine the target to return. Show your work as an enumerated markdown list.
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
