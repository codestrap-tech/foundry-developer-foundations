import type {
  Context,
  MachineEvent,
} from '@codestrap/developer-foundations-types';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';
import type { GeminiService } from '@codestrap/developer-foundations-types';
import { TYPES } from '@codestrap/developer-foundations-types';

export type DraftEmailResponse = {
  message: string;
  subject: string;
  recipients: string[];
  modelDialog: string;
  ts: number;
};

// This function extracts the channel ID and recepients from the input context and sends a slack message
export async function writeEmail(
  context: Context,
  event?: MachineEvent,
  task?: string,
): Promise<DraftEmailResponse> {
  const user = `
    Draft an email message based on this task:
    ${task}

    Below us some additional context as a JSON blob. It includes any work that has been done leading up to drafring this email. 
    For example it may contains deails on files or project status reports that are referenced in your task.
    ${JSON.stringify(context)}

    You can only respond in JSON in the following format:
    {
        message: <THE_EMAIL_MESSAGE_IN_HTML>,
        recipients: <THE_EXTRACTED_EMAIL_ADDRESSES_FROM_THE_TASK>,
        subject: <THE_EXTRACTED_SUBJECT_FROM_THE_TASK>
    }

     The email message should be formatted with HTML to include:
        - Bullet points for any lists
        - Paragraph spacing for readability
        - <a href='...'> links for elements such as email addresses and hyperlinks
        - A professional tone

    For example if the task is:
    1. **Send Email** - **To**: Mike Johnson <mike.johnson@example.com>, Jane Doe <jane.doe@example.com> - **Subject**: Follow-up on Marketing Plan - **Body**: "Hi Mike and Jane, following up on the recent discussion about the marketing plan. Please review the points raised by Sarah Lee <sarah.lee@example.com> and David Brown <david.brown@example.com>. Let me know if you need any further input. Best, Cody the AI Assistant"
    
    Your response is:
    {
        "recipients": ["mike.johnson@example.com", "jane.doe@example.com"],
        "subject": "Follow-up on Marketing Plan",
        "message": "<p>Hi Mike and Jane,</p><p>Happy Friday! Just following up on the recent discussion about the marketing plan. Please review the points raised by:</p><ul><li>Sarah Lee &lt;sarah.lee@example.com&gt;</li><li>David Brown &lt;david.brown@example.com&gt;</li></ul><p>Let me know if you need any further input.</p><p>Best,</p><p>Viki</p>"
    }
    `;

  const system = `You are a helpful AI assistant tasked with authoring Slack messages. 
    You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Viki, Code's AI EA" or similar. 
    You can get creative on your greeting, taking into account the dat of the week. Today is ${new Date().toLocaleDateString(
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
  const subject = parsedResult.subject;
  const recipients = parsedResult.recipients;
  const modelDialog = parsedResult.message;

  return {
    message,
    subject,
    recipients,
    modelDialog,
    ts: new Date().getTime(),
  };
}
