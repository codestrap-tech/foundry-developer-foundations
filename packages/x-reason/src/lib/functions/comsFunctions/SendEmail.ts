import type { Context, MachineEvent } from '@codestrap/developer-foundations-types';
import { extractHtmlFromBackticks } from '@codestrap/developer-foundations-utils';
import type {
  GeminiService,
  OfficeService} from '@codestrap/developer-foundations-types';
import {
  TYPES,
  MessageService
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';

// Types for Email functionality
export type EmailThread = {
  id: string;
  threadId: string;
  labelIds?: string[];
};

// Email-specific types and utilities
export interface EmailContext {
  message: string;
  subject: string;
  recipients: string[];
  modelDialog: string;
  ts: number;
}

export interface ContextData {
  status: number;
  requestId: string;
  stack: string[];
  [key: string]: any;
}

export function parseEmailContext(context: ContextData): EmailContext | null {
  if (!context?.stack?.length) {
    return null;
  }

  // Get the previous state which must be write email
  // we use - 2 because the state machine has already trasitioned to the next state state
  // at this point, which is SendEmail;
  const lastStackKey = context.stack[context.stack.length - 2];
  if (!lastStackKey || !context[lastStackKey]) {
    return null;
  }

  const emailData = context[lastStackKey];
  if (!emailData?.message || !emailData?.subject || !emailData?.recipients) {
    throw new Error('Invalid email data format in context');
  }

  return emailData;
}

async function parseResearchReport(
  context: Context,
  task?: string
): Promise<string | undefined> {
  const user = `
# Task
Extract any research reports in the state machine DSL that may be related to this task:
${task}

# State Machine DSL:
The stack property let's you know which states have been visited. Each state has a property on the context
which includes the output from that state. There is where you may find a research report that should be returned.
Extract any relevant report(s)
${JSON.stringify(context)}

# Output
Seperate each report by a section heading. Convert the markdown to HTML. Do not output the JSON, only the HTML conversion of the markdown.
If no reports are found output N/A
    `;

  const system = `You are a helpful AI assistant tasked with looking for any relevant research report(s).
    You understand common state machine DSL's like x-state.`;

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);

  const response = await geminiService(user, system);

  return extractHtmlFromBackticks(response ?? 'N/A');
}

const EMAIL_FOOTER = `
<br/>
<div style="border-top: 1px solid #ddd; margin-top: 20px; padding-top: 20px; font-family: Arial, sans-serif;">
    <strong>Vicki</strong><br/>
    Executive AI Assistant | Codestrap<br/>
    <a href="mailto:vicki@codestrap.me">vicki@codestrap.me</a>
</div>
`;

// Main email sending function
export async function sendEmail(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<EmailThread> {
  console.log('[EMAIL] Starting email send process...');
  const emailData = parseEmailContext(context as unknown as ContextData);
  if (!emailData) {
    throw new Error('No email data found in context');
  }
  const researchReports = await parseResearchReport(context, task);
  // if there are any attached reports incude int in the email
  const message =
    researchReports !== 'N/A'
      ? `${emailData.message}\n\n${researchReports}`
      : emailData.message;

  console.log('sending email via compute module:', {
    recipients: emailData.recipients,
    subject: emailData.subject,
    message,
  });

  const messageService = await container.getAsync<OfficeService>(
    TYPES.OfficeService
  );

  const response = await messageService.sendEmail({
    from: process.env.OFFICE_SERVICE_ACCOUNT!,
    recipients: emailData.recipients,
    subject: emailData.subject,
    message,
  });

  console.log('[EMAIL] Constructed email thread response:', response);

  return response;
}
