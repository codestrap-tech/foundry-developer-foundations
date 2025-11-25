import type {
  Context,
  MachineEvent,
  Task,
  ActionType,
} from '@codestrap/developer-foundations-types';
import { userProfile, recall, dateTime } from '../../../functions';

function getPayload(context: Context, result: Record<string, any>) {
  const stateId = context.stack?.[context.stack?.length - 1];
  if (!stateId) {
    throw new Error('Unable to find associated state in the machine stack.');
  }
  const payload = {
    stateId,
    [stateId]: {
      // we destructure to preserve other keys like result which holds values from user interaction
      ...context[stateId],
      ...result,
    },
  };

  return payload;
}
export function getFunctionCatalog(dispatch: (action: ActionType) => void) {
  return new Map<string, Task>([
    [
      'userProfile',
      {
        description:
          "Enriches the context with user details that include the current user's email and timezone. This information is always required",
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('userProfile implementation in function catalog called');
          const result = await userProfile(context, event, task);
          const payload = getPayload(context, result);
          console.log(`userProfile returned: ${JSON.stringify(result)}`);
          console.log('dispatching CONTINUE from userProfile');
          // this will pause the state machine execution
          dispatch({
            type: 'CONTINUE',
            payload,
          });
        },
      },
    ],
    [
      'dateTime',
      {
        description:
          'Enriches the context with details about the current date/time. This information is always required.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('dateTime implementation in function catalog called');
          const result = await dateTime(context, event, task);
          const payload = getPayload(context, result);
          console.log(`dateTime returned: ${JSON.stringify(result)}`);
          console.log('dispatching CONTINUE from dateTime');
          // this will pause the state machine execution
          dispatch({
            type: 'CONTINUE',
            payload,
          });
        },
      },
    ],
    [
      'recall',
      {
        description:
          'Recalls contact infromation, slack channel IDs, and meeting context. This is usefu for sending meeting requests, emails, and slack messages',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('recall implementation in function catalog called');
          const result = await recall(context, event, task);
          const payload = getPayload(context, result);
          console.log(`recall returned: ${JSON.stringify(result)}`);
          console.log('dispatching CONTINUE from recall');
          // this will pause the state machine execution
          dispatch({
            type: 'CONTINUE',
            payload,
          });
        },
      },
    ],
    [
      'UnsafeQuestion',
      {
        description: 'Default state to display for unsafe questions',
        implementation: (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('UnsafeQuestion implementation called');
          dispatch({ type: 'success' });
        },
      },
    ],
    [
      'UnsupportedQuestion',
      {
        description: 'Default state to display for unsupported questions',
        implementation: (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('UnsupportedQuestion implementation called');
          dispatch({ type: 'success' });
        },
      },
    ],
  ]);
}
