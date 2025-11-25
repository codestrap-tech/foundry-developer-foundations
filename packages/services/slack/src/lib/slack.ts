import { sendSlackMessage } from './delegates/sendMessage';
import type {
  Message,
  MessageService,
} from '@codestrap/developer-foundations-types';

export function makeSlackClient(
  baseUrl: string,
  botToken: string
): MessageService {
  return {
    sendMessage: async (message: Message) => {
      const response = await sendSlackMessage(message, baseUrl, botToken);

      return response;
    },
  };
}
