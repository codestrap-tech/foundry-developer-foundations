import { createMachine, assign, StateNode, MachineConfig } from 'xstate';
import {
  getUniqueStateIds,
  uuidv4,
} from '@codestrap/developer-foundations-utils';

import {
  Context,
  MachineEvent,
  StateConfig,
  Task,
  Transition,
} from '@codestrap/developer-foundations-types';

function getTransition(
  transition: { target: string; cond?: string; actions?: string },
  task: Task,
  transitionEvent: 'CONTINUE' | 'ERROR'
) {
  const transitionConfig: any = {
    target: transition.target,
    actions: transition.actions || 'saveResult',
  };
  const genericStateId = transition.target.split('|')[0];
  // if there is a transition guard defined to this Task add a condition for the transition
  // guards can either be generic, ie for all CONTINUE or ERROR events, or for specific targets delineated cia a |
  // for example CONTINUE which would be triggered for all CONTINUE events
  // or CONTINUE|scheduleMeeting which would be specific to transition.target === 'scheduleMeeting'
  if (task.transitions?.get(transitionEvent)) {
    transitionConfig.cond = (context: Context, event: MachineEvent) => {
      // TODO improve this by using a function supplied by the function catalog which can either be
      // a classical algorithm or a call to an LLM that returns true or false
      return (task.transitions as Transition).get(transitionEvent)!(
        context,
        event
      );
    };
  } else if (task.transitions?.get(`${transitionEvent}|${genericStateId}`)) {
    transitionConfig.cond = (context: Context, event: MachineEvent) => {
      // TODO improve this by using a function supplied by the function catalog which can either be
      // a classical algorithm or a call to an LLM that returns true or false
      return (task.transitions as Transition).get(
        `${transitionEvent}|${genericStateId}`
      )!(context, event);
    };
  }

  return transitionConfig;
}

function generateStateConfig(
  state: StateConfig,
  functionCatalog: Map<string, Task>,
  context: Context,
  parallel = false,
  isNestedState = false
): Partial<StateNode<Context, any, MachineEvent>> {
  if (parallel) {
    const stateConfig: any = {};
    stateConfig.type = 'parallel';
    stateConfig.states = {};
    stateConfig.id = state.id;
    stateConfig.onDone = state.onDone; // TODO have to find the target
    state.states?.forEach((state) => {
      if (
        state.id !== 'success' &&
        state.id !== 'failure' &&
        state.id !== 'pause'
      ) {
        stateConfig.states[state.id] = {
          initial: 'pending',
          id: state.id,
          states: {
            pending: generateStateConfig(
              state,
              functionCatalog,
              context,
              false,
              true
            ),
            success: {
              type: 'final',
            },
            failure: {
              type: 'final',
            },
            pause: {
              type: 'final',
            },
          },
        };
      }
    });

    return stateConfig;
  }

  if (state.parentId) {
    context.childToParentStateMap[state.id] = state.parentId;
  }

  const functionName = state.id.split('|')?.[0];
  if (state.type === 'final') {
    return {
      // for some reason the entry property is not defined when we return here
      // we have to manuall push the final state onto the stack so the next state is correctly returned
      // TODO: fix me
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      entry: (context: Context, event: MachineEvent) => {
        console.log('Received Event:', event.type);
        context.stack?.push(state.id);
      },
      type: state.type,
    };
  }

  const retrievedFunction = functionCatalog.get(functionName);
  if (!retrievedFunction) {
    throw new Error(
      `function implementation for stateId: ${state.id} functionName: ${functionName} not found`
    );
  }

  const stateConfig: any = !isNestedState
    ? {
        entry: (context: Context, event: MachineEvent) => {
          console.log('Received Event:', event.type);
          context.stack?.push(state.id);
          // if the function is async, we ignore the promise as this is fire and forget.
          // it's up to the function to dispatch the CONTINUE event on the machine to capture results
          // in the vent payload and continue execution
          console.log('Executing function:', functionName);
          try {
            Promise.resolve(
              retrievedFunction.implementation(context, event, state.task)
            ).catch((error) => {
              console.error(`Async error in ${functionName}:`, error);
              context.machineError = error;
            });
          } catch (error) {
            console.error(`Sync error in ${functionName}:`, error);
            context.machineError = error as Error;
          }
        },
      }
    : {
        invoke: {
          src: async (context: Context, event: MachineEvent) => {
            console.log('Received Event:', event.type);
            context.stack?.push(state.id);
            // if the function is async, we ignore the promise as this is fire and forget.
            // it's up to the function to dispatch the CONTINUE event on the machine to capture results
            // in the vent payload and continue execution
            console.log('Executing nested state function:', functionName);
            const result = await retrievedFunction.implementation(
              context,
              event,
              state.task
            );
            console.log(
              `received result from nested state function: ${result}`
            );
            const returnValue = {
              stateId: state.id,
              [state.id]: {
                // we destructure to preserve other keys like result which holds values from user interaction
                ...context[state.id],
                ...(result as any),
              },
            };
            return returnValue;
          },
          onDone: {
            target: 'success',
            actions: 'saveResult',
          },
          onError: {
            target: 'failure',
          },
        },
      };

  stateConfig.id = state.id;
  // TODO augment with retrievedFunction.transitions.
  if (state.transitions && !isNestedState) {
    // we add these transtiions for states that require callbacks
    // ie sagas, wait for external system to call back in and resume excecution
    // in these cases a state with distach success or failure
    stateConfig.on = {
      pause: {
        target: 'pause',
        actions: 'saveResult',
      },
      success: {
        target: 'success',
        actions: 'saveResult',
      },
      failure: {
        target: 'failure',
        actions: 'saveResult',
      },
    };
    // we add stateConfig.on[transition.target] to support dynamic transitions added by the LLM
    // The LLM will determine which event to dispatch
    state.transitions.forEach((transition) => {
      stateConfig.on[transition.target] = {
        target: transition.target,
        actions: transition.actions || 'saveResult',
      };
    });
    // we add these transitions so than non dynamic transitions still work
    stateConfig.on.CONTINUE = state.transitions
      .filter((transition) => transition.on === 'CONTINUE')
      .map((transition) =>
        getTransition(transition, retrievedFunction, 'CONTINUE')
      );
    stateConfig.on.ERROR = state.transitions
      .filter((transition) => transition.on === 'ERROR')
      .map((transition) =>
        getTransition(transition, retrievedFunction, 'ERROR')
      );
  }

  // sort the array such that any transition with a conditional statement appears first
  // this ensures logic is evaulauted
  stateConfig.on?.CONTINUE?.sort((a: any, b: any) => {
    const aHasCond = typeof a.cond !== 'undefined';
    const bHasCond = typeof b.cond !== 'undefined';

    if (aHasCond && !bHasCond) return -1;
    if (!aHasCond && bHasCond) return 1;
    return 0;
  });

  return stateConfig;
}

function generateStateMachineConfig(
  statesArray: StateConfig[],
  functionCatalog: Map<string, Task>
) {
  const states: {
    [key: string]: Partial<StateNode<Context, any, MachineEvent>>;
  } = {
    // pause is a special state that allows functions to dispatch pause event that will not show up in the stack
    // this allows for the machine to progress through the states and pause when needed
    pause: { type: 'final' },
  };

  const context = {
    requestId: uuidv4(), // Replace with actual uniqueId function
    status: 0,
    childToParentStateMap: {},
    // ... other context properties
  };

  // deduplicate the states and trasitions
  const deduplicatedStates = getUniqueStateIds(statesArray);

  deduplicatedStates.forEach((state) => {
    states[state.id] = generateStateConfig(
      state,
      functionCatalog,
      context,
      state.type === 'parallel'
    );
  });

  return {
    id: uuidv4(),
    predictableActionArguments: true,
    initial: deduplicatedStates[0]?.id,
    context,
    states,
  };
}

function program(
  statesArray: StateConfig[],
  functionCatalog: Map<string, Task>
) {
  const states = generateStateMachineConfig(
    statesArray,
    functionCatalog
  ) as MachineConfig<Context, any, MachineEvent>;
  return createMachine<Context, MachineEvent>(states, {
    actions: {
      saveResult: assign((context, event) => {
        const data = event.payload ?? event.data;
        // IMPORTANT: it's up to the caller to set status to -1 to trigger errors
        // we can work on improving this in the future
        return {
          ...context,
          ...data,
        };
      }),
    },
  });
}

export default program;
