import type { StateConfig } from '@codestrap/developer-foundations-types';
import { uuidv4 } from './uuid';

export function getUniqueStateIds(
  inputArray: StateConfig[],
  parent?: StateConfig
): StateConfig[] {
  let statesArray = [...inputArray];

  // the presence of the | character means we've already deduplicated this states
  // Skip if already deduplicated
  if (statesArray[0]?.id.indexOf('|') >= 0) {
    return statesArray;
  }

  // first rewrite all the state id values in the top level states
  statesArray = statesArray.map((state, index) => {
    switch (state.id) {
      // these states only hve one occurrence in all machines
      case 'success':
      case 'failure':
      case 'pause':
        break;
      default:
        // generate unique ID for each state. Without this states that share the same function will collapse to a single one
        // if a parent is supplied append the parent ID so the send to event
        state.id = `${state.id}|${uuidv4()}`;
        if (parent) state.parentId = parent.id;
        break;
    }
    return state;
  });

  // next rewrite the id of transitions by slicing the states array from the current index and finding the first occurrence of that transition
  statesArray = statesArray.map((state, index) => {
    switch (state.id) {
      // these states only hve one occurrence in all machines
      case 'success':
      case 'failure':
      case 'pause':
        break;
      default:
        {
          // transition states can be ahead of the current state or behind in the states array, ahead is more common thus proffered
          // so we slice the array to find all possible candidates
          const futureStates = statesArray.slice(index + 1);
          const pastStates = statesArray.slice(0, index).reverse();

          // Helper function to find target in future first, then past, then the entire array
          const findTargetState = (target: string) => {
            return (
              futureStates.find((s) => s.id.includes(target)) ||
              pastStates.find((s) => s.id.includes(target)) ||
              statesArray.find((s) => s.id.includes(target))
            );
          };

          // Update transitions
          state.transitions = state.transitions?.map((transition) => {
            const targetState = findTargetState(transition.target);
            transition.target = targetState ? targetState.id : transition.target;
            if (
              transition.target.includes('|') &&
              transition.on !== 'CONTINUE' &&
              transition.on !== 'ERROR' &&
              transition.on !== 'failure' &&
              transition.on !== 'pause'
            ) {
              /** 
              states like this result from the need to re-enter a state for user review,
              such as spec review taking feedback from a user that requires we renter the spec generation state
              or a self transition when restarting the state machine
              For example:
              {
                    "id": "codeReview",
                    "task": "If approved, continue, else if review is required, renter the code review state. If review is not required but the design is not been approved this means the user has provided feedback that needs to be incorporated, thus renter the generateEditMachine state.",
                    "includesLogic": true,
                    "transitions": [
                  {
                            "on": "codeReview",
                            "target": "codeReview"
                        },
                  {
                            "on": "generateEditMachine",
                            "target": "generateEditMachine"
                        },
                        {
                            "on": "CONTINUE",
                            "target": "applyEdits"
                        },
                        {
                            "on": "ERROR",
                            "target": "failure"
                        }
                    ]
                },
              In these cases I need to reset the on handler to the state with the unique ID
              */
              transition.on = transition.target;
            }
            return transition;
          });

          // Update onDone
          if (state.onDone) {
            // sometimes the programmer model fucks up and send back an object array instead of a string
            if ((state.onDone as any) instanceof Array) {
              state.onDone = (state.onDone as any)[0].target;
            }
            // sometimes the programmer model fucks up and send back an object instead of a string
            if ((state.onDone as any) instanceof Object) {
              state.onDone = (state.onDone as any).target;
            }
            // set the transition target to the new ID or default back to the original
            const targetState = findTargetState(state.onDone as string);
            state.onDone = targetState ? targetState.id : state.onDone;
          }

          // Handle parallel states recursively
          if (state.states) {
            getUniqueStateIds(state.states, state);
          }
          break;
        }
    }
    return state;
  });

  return statesArray;
}
