import type { StateMachine, State } from 'xstate';
import { interpret } from 'xstate';

import type {
  ActionType,
  MachineEvent,
  Context,
  StateConfig,
  Task,
} from '@codestrap/developer-foundations-types';
import programV1 from './programmerV1';

export default function headlessInterpreter(
  states: StateConfig[],
  functions: Map<string, Task>,
  // callback function to revieve notifications on state change
  dispatch: (action: ActionType) => void,
  context?: Context,
  state?: State<Context, MachineEvent>,
  retriggerEntryFunction = false,
) {
  const result: StateMachine<Context, any, MachineEvent> = programV1(
    states,
    functions,
  );
  const returnedContext = result.context;

  const initialContext = context || {
    status: 0,
    requestId: 'test',
    stack: [],
  };
  // make sure initialContext overwrites anything on the input context
  const contextToSupply = { ...returnedContext, ...initialContext };
  const machine = result.withContext(contextToSupply);

  const instance = interpret(machine).onTransition((state) => {
    console.log(
      `onTransition called: machine: ${machine.id} state: ${state.value}`,
    );
    dispatch({
      type: 'SET_STATE',
      value: {
        currentState: state,
        context: state.context,
      },
    });
    if (state.done) {
      console.log('Final state reached, stopping the interpreter.');
      instance.stop(); // Stop the interpreter when the final state is reached
    }
  });
  const done = () => {
    return instance?.getSnapshot().done;
  };
  const serialize = (state: State<Context, MachineEvent> | undefined) =>
    state ? JSON.stringify(state) : '{}';
  const stop = () => instance.stop();
  const send = (event: MachineEvent, id?: string) => {
    if (id) {
      instance.send(event, { to: id });
    } else {
      instance.send(event);
    }
  };
  // if state is defined the machine will hydrate from where it left off as defined by the supplied state
  // for more an persisting state visit: https://xstate.js.org/docs/guides/states.html#persisting-state
  const start = () => {
    instance.start(state);
    if (state && retriggerEntryFunction) {
      // Manually invoke the entry actions for the starting state
      // The entry actions are not executed because XState interpreters treat instance.start()
      // when the next state to execute is determined by an LLM we need to manually invoke entry
      const startingStateConfig =
        machine.config?.states?.[state.value as string];
      if (
        startingStateConfig?.entry &&
        typeof startingStateConfig?.entry === 'function'
      ) {
        console.log(startingStateConfig.entry);
        (
          startingStateConfig.entry as (
            context: Context,
            event: MachineEvent,
          ) => void
        )(state.context!, { type: 'xstate.init' });
      }
    }
  };
  const getContext = () => instance.getSnapshot().context;

  // TODO define an actual interface and think about what to expose
  return { done, serialize, stop, send, start, getContext };
}
