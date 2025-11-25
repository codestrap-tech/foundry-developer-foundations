import type {
  Context,
  MachineEvent,
  Task,
  ActionType,
} from '@codestrap/developer-foundations-types';
import {
  incompleteQuestion,
  requestRfp,
  awaitRfpResponses,
  writeEmail,
  sendEmail,
  sendSlackMessage,
  writeSlackMessage,
} from '../../../functions';

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
      'incompleteQuestion',
      {
        description: 'Sends a request for proposal to a vendor.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log(
            'incompleteQuestion function catalog implementation called'
          );
          const result = await incompleteQuestion(context, event, task);
          const payload = getPayload(context, result);

          dispatch({
            type: 'CONTINUE',
            payload,
          });
        },
      },
    ],
    [
      'requestRfp',
      {
        description: 'Sends a request for proposal to a vendor.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('requestRfp function catalog implementation called');
          const result = await requestRfp(context, event, task);
          const payload = getPayload(context, result);
          console.log(
            'requestRfp function response received, calling dispatch'
          );
          const parentId = context.childToParentStateMap[payload.stateId];

          if (!parentId) {
            // if the state has a parent, meaning it's executed as part of a parallel state
            // do not dispatch continue. I haven't figured out how to get the targeting to work correctly
            // ie send('CONTINUE', {to: id}) to send the event to a specific state
            // so I used invoke for parallel states as a hack. This means we do not want to trigger
            // a transition here as the onDone handler of invoke will take care of it
            dispatch({
              type: 'CONTINUE',
              payload,
            });
            return undefined;
          } else {
            return result;
          }
        },
      },
    ],
    [
      'awaitRfpResponses',
      {
        description:
          'Waits until all rfp responses are received before proceeding.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log(
            'awaitRfpResponses function catalog implementation called'
          );
          const result = await awaitRfpResponses(context, event, task);
          const payload = getPayload(context, result);
          if (result.allResponsesReceived) {
            return dispatch({
              type: 'CONTINUE',
              payload,
            });
          }
          // pause untill all responses received
          dispatch({
            type: 'pause',
            payload,
          });
        },
      },
    ],
    [
      'sendEmail',
      {
        description: 'Sends an email.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('sendEmail function catalog implementation called');
          const result = await sendEmail(context, event, task);
          const payload = getPayload(context, result);

          dispatch({
            type: 'CONTINUE',
            payload,
          });
        },
      },
    ],
    [
      'writeEmail',
      {
        description: 'Writes a draft email for review.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log('writeEmail function catalog implementation called');
          const result = await writeEmail(context, event, task);
          const payload = getPayload(context, result);
          // Change the type to pause to allow the user to review the email in the UI before send
          dispatch({
            type: 'CONTINUE',
            payload,
          });
        },
      },
    ],
    [
      'writeSlackMessage',
      {
        description: 'Writes a draft slack message for review.',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log(
            'writeSlackMessage function catalog implementation called'
          );
          const result = await writeSlackMessage(context, event, task);
          const payload = getPayload(context, result);
          // Change the type to pause to allow the user to review the email in the UI before send
          dispatch({
            type: 'CONTINUE',
            payload,
          });
        },
      },
    ],
    [
      'sendSlackMessage',
      {
        description: 'Sends a Slack Message',
        implementation: async (
          context: Context,
          event?: MachineEvent,
          task?: string
        ) => {
          console.log(
            'sendSlackMessage function catalog implementation called'
          );
          const result = await sendSlackMessage(context, event, task);
          const payload = getPayload(context, result);
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
