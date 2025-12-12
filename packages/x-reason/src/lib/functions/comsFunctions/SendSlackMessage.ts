import type { Context, MachineEvent } from '@codestrap/developer-foundations-types';
import type {
  Message,
  MessageResponse,
  MessageService} from '@codestrap/developer-foundations-types';
import {
  TYPES,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';

// This function is called by the state machine and uses the connection already established in Text2Action
export async function sendSlackMessage(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<MessageResponse> {
  // Get the state ID for the writeSlackMessage step that preceded this
  const writeSlackStateId = context.stack?.[context.stack?.length - 2];
  if (!writeSlackStateId) {
    throw new Error(
      'Unable to find writeSlackMessage state in the machine stack.'
    );
  }

  // Get the drafted message from the previous state
  const draftMessage = context[writeSlackStateId] as Message;
  if (!draftMessage?.message) {
    throw new Error('No message found in context from writeSlackMessage step.');
  }

  const messageService = container.get<MessageService>(TYPES.MessageService);

  const result = await messageService.sendMessage(draftMessage);

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result;
}
