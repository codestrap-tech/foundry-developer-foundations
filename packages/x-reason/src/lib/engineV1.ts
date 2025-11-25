import { interpret } from 'xstate';

import type {
  StateConfig,
  EvaluationInput,
  EvaluatorResult,
  ReasoningEngine,
  Prompt,
} from '@codestrap/developer-foundations-types';
import programV1 from './programmerV1';

import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';
import type {
  GeminiService,
  LoggingService} from '@codestrap/developer-foundations-types';
import {
  TYPES,
} from '@codestrap/developer-foundations-types';

async function solve(query: string, solver: Prompt): Promise<string> {
  // TODO remove the use of the threads API and go with completions
  const { user, system } = await solver(query);

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);
  const response = await geminiService(user, system);

  const result = response ?? '';
  return result;
}

async function program(
  query: string,
  functionCatalog: string,
  programmer: Prompt
): Promise<StateConfig[]> {
  const { user, system } = await programmer(query, functionCatalog);

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);
  const response = await geminiService(user, system);

  const value = response ?? '';
  let unwrapped = extractJsonFromBackticks(value) || value;

  console.log(
    `programmer generated the following unchecked solution: ${unwrapped}`
  );

  // check the quality of the result
  try {
    JSON.parse(unwrapped);
  } catch (e) {
    const updatedUserMessage = `${user}
your generated solution:
${unwrapped}
generated the following error:
${(e as Error).message}
Ensure the JSON is valid and does not contain any trailing commas, correct quotes, etc
Only respond with the updated JSON! Your response will be sent to JSON.parse
`;
    const response = await geminiService(updatedUserMessage, system);

    const value = response ?? '';
    unwrapped = extractJsonFromBackticks(value) || value;
  }
  const states: StateConfig[] = JSON.parse(unwrapped);

  // make sure the state ID's are valid, including transition targets
  const notFoundTransitions: string[] = [];
  const notFound = states
    .map((state) => {
      if (
        state.type !== 'parallel' &&
        state.id !== 'success' &&
        state.id !== 'failure' &&
        functionCatalog.indexOf(state.id) < 0
      ) {
        return state;
      }
      // sometimes the model will return a state in a transition that is not a valid state node
      state.transitions?.forEach((transition) => {
        if (
          transition.target !== 'success' &&
          transition.target !== 'failure' &&
          functionCatalog.indexOf(transition.target) < 0
        ) {
          notFoundTransitions.push(transition.target);
        }
      });

      return undefined;
    })
    .filter((item) => item !== undefined)
    .map((item) => item?.id);
  if (notFound.length > 0) {
    console.log(
      `Unknown state ID encountered: ${notFound.join(
        ','
      )}. Calling GPT4o to fix.`
    );
    //console.log(`functionCatalog:\n${functionCatalog}`);
    const notFoundTransitionsMessage =
      notFoundTransitions.length > 0
        ? `The following transitions triggered an unknown state ID error: ${notFoundTransitions.join(
          ','
        )}. Please ensure all targets are referencing a valid state node. If these state nodes are invalid replace them with valid ones.`
        : undefined;
    console.log(
      `Unknown transition target encountered: ${notFoundTransitionsMessage}. Calling GPT4o to fix.`
    );
    // TODO, return a recursive call to program if max count has not been exceeded
    const updatedUserMessage = `${user}
your previous answer generated the following errors:
Unknown state ID encountered: ${notFound.join(',')}
${notFoundTransitionsMessage}
Replace the unknown state IDs with valid IDs found in the function catalog below:
###### start function catalog ######
${functionCatalog}
###### end function catalog ######
Do not modify the state machine in any other way!
Only respond with the updated JSON and don't be chatty! Your response will be sent to JSON.parse
`;
    const response = await geminiService(updatedUserMessage, system);

    const value = response ?? '';
    // TODO retest valid states by moving logic to a util function
    unwrapped = extractJsonFromBackticks(value) || value;
    console.log(
      `model returned the following updated state machine to correct errors:\n${unwrapped}`
    );
  }

  return JSON.parse(unwrapped) as StateConfig[];
}

async function evaluate(
  input: EvaluationInput,
  evaluate: Prompt
): Promise<EvaluatorResult> {
  let evaluation = {
    rating: 0,
    correct: false,
  };
  try {
    const machine = programV1(input.states, input.tools!);
    const { user, system } = await evaluate(
      input.query,
      JSON.stringify(input.states)
    );

    // see if the machine compiles
    const withContext = machine.withContext({
      status: 0,
      requestId: 'test',
      stack: [],
    });

    const machineExecution = interpret(withContext);

    evaluation = {
      rating: 5,
      correct: true,
    };
    /* TODO we need to fix this by allowing it to receive the message history so the model can evaluate the conversation
        then the model can evaluate the conversation
        // Now have the evaluator evaluate the result
        const result = await chatCompletion({
            messages: [
                { role: 'system', contents: [{ text: system }] },
                { role: 'user', contents: [{ text: user }] },
            ],
            model: "gpt-4", // gpt-4-0125-preview, gpt-4
            //response_format: { type: "json_object" } gpt-4-0125-preview
        });
        const value = result || '';
        let unwrapped = extractJsonFromBackticks(value) || value;

        // check the quality of the result
        try {
            evaluation = JSON.parse(unwrapped);
        } catch (e) {
            const result = await chatCompletion({
                messages: [
                    { role: 'system', contents: [{ text: system }] },
                    { role: 'user', contents: [{ text: user }] },
                    {
                        role: 'user', content: `your generated evaluation:
                ${unwrapped}
                generated the following error:
                ${(e as Error).message}
                Ensure the JSON is valid and does not contain any trailing commas, correct quotes, etc
                Only respond with the updated JSON! Your response will be sent to JSON.parse
                ` },
                ],
                model: "gpt-4",
                //response_format: { type: "json_object" }
            });
            const value = result || '';
            unwrapped = extractJsonFromBackticks(value) || value;
            evaluation = JSON.parse(unwrapped);
        }
        */
  } catch (e) {
    return {
      rating: 0,
      error: e as Error,
    };
  }
  // TODO better evaluation. For now if it compiles we are good. When we have evaluator models we'll expand
  console.log(`evaluator responded with: ${JSON.stringify(evaluation)}`);
  return evaluation;
}

async function transition(
  taskList: string,
  currentState: string,
  payload: string,
  aiTransition: Prompt,
  executionId: string
): Promise<string> {
  const { user, system } = await aiTransition(taskList, currentState, payload);
  const { log } = container.get<LoggingService>(TYPES.LoggingService);

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);
  const response = await geminiService(user, system);

  let value = response.trim() ?? '';

  console.log(`engine.v2.ts.transition result is: ${value}`);
  log(executionId, value);

  // coerce the reasoning step into a state ID
  const updatedUserMessage = `${user}
Extract the target state ID and only the target state id from your previous response:
${value}
Do not be chatty!
`;
  const coercedResponse = await geminiService(updatedUserMessage, system);

  value = coercedResponse ?? '';
  value = value.trim();
  // check that there is a | followed by a GUID
  // https://regex101.com/r/D5Dq4R/1
  const matchGuid = value.match(/\|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]

  // TODO improve retry mechanism
  if (!currentState.includes(value) || !matchGuid) {
    const updatedUserMessage = `${user}
your generated solution:
${value}
does not include a valid transition ID! Make sure your are picking a transition ID from the provided state's transitions array
Do not be chatty!
`;
    const result = await geminiService(updatedUserMessage, system);

    value = result ?? '';
    value = value.trim();
    if (
      currentState.indexOf(value) < 0 &&
      value !== 'CONTINUE' &&
      value !== 'success' &&
      value !== 'failure'
    ) {
      throw new Error(`Invalid model response: ${value}`);
    }
  }

  return value;
}

const implementation: ReasoningEngine = {
  solver: { solve },
  programmer: { program },
  evaluator: { evaluate },
  logic: { transition },
};

export default implementation;
