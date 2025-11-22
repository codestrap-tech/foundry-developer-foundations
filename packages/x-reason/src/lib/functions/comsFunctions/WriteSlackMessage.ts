import type {
  Context,
  MachineEvent,
} from '@codestrap/developer-foundations-types';
import type { GeminiService } from '@codestrap/developer-foundations-types';
import { TYPES } from '@codestrap/developer-foundations-types';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';

export type DraftMessageResponse = {
  message: string;
  modelDialog: string;
  channelId: string;
  ts: number;
};

// This function extracts the channel ID and recepients from the input context and sends a slack message
export async function writeSlackMessage(
  context: Context,
  event?: MachineEvent,
  task?: string,
): Promise<DraftMessageResponse> {
  const user = `
    Draft a slack message based on this task:
    ${task}

    You can only respond in JSON in the following format:
    {
        message: <THE_SLACK_MESSAGE>,
        channelId: <THE_EXTRACTED_CHANNELID_FROM_THE_TASK>
    }

    For example if the task is:
    2. **Send a Slack message** - Channel ID: C1234567890 - Recipients: Team members - Message: Please review the project milestones and provide feedback by EOD Friday.

    Your response is:
    {
        "channelId": "C1234567890",
        "message": "Hey team, it's Viki, Code's AI EA. Happy Humpday! Don't forget to review the project milestones and provide feedback by EOD Friday.",
    }
    `;

  const system = `You are a helpful AI assistant tasked with authoring Slack messages. 
    You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Viki, Code's AI EA" or similar. 
    You can get creative on your greeting, taking into account the day of the week. Today is ${new Date().toLocaleDateString(
      'en-US',
      { weekday: 'long' },
    )}. 
    You can also take into account the time of year such as American holidays like Halloween, Thanksgiving, Christmas, etc. 
    The current month is ${new Date().toLocaleDateString('en-US', {
      month: 'long',
    })}.`;

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);

  const response = await geminiService(user, system);

  const clean = extractJsonFromBackticks(response);

  const parsedResult = JSON.parse(clean);
  const message = parsedResult.message;
  const modelDialog = parsedResult.message;
  const channelId = parsedResult.channelId;

  return {
    message,
    modelDialog,
    channelId,
    ts: new Date().getTime(),
  };
}
