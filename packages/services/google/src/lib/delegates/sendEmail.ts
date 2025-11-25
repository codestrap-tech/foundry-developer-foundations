import type { gmail_v1 } from 'googleapis';
import type {
  EmailContext,
  SendEmailOutput,
} from '@codestrap/developer-foundations-types';

const LOG_PREFIX = 'GSUITE - sendEmail - ';

// Helper Functions
function validateEmailInput(context: EmailContext): void {
  const { recipients, subject, message, from } = context;

  if (!from || !recipients || !subject || !message) {
    throw new Error(
      'No email data found in context. From, recipients, subject and message are required!'
    );
  }

  if (typeof from !== 'string') {
    throw new Error('From is required and must be a string');
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('Recipients array is required and must not be empty');
  }
  if (typeof subject !== 'string') {
    throw new Error('Subject is required and must be a string');
  }
  if (typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function createEmailContent(
  from: string,
  message: string,
  subject: string,
  recipients: string | string[]
): string {
  const boundary = `boundary_${Date.now().toString(36)}`;
  const recipientList = Array.isArray(recipients)
    ? recipients.join(', ')
    : recipients;
  const plainTextContent = htmlToPlainText(message);
  const footer = `<br/>
<div style="border-top: 1px solid #ddd; margin-top: 20px; padding-top: 20px; font-family: Arial, sans-serif;">
    <strong>Vici</strong><br/>
    Executive AI Assistant | Codestrap<br/>
    <a href="mailto:${from}">${from}</a>
</div>`;

  const emailParts = [
    'MIME-Version: 1.0',
    `From: ${from}`,
    `To: ${recipientList}`,
    `Subject: ${Buffer.from(subject).toString('utf8')}`,
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    'Content-Transfer-Encoding: 7bit',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    plainTextContent + `\n${from}`,
    '',
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<meta charset="UTF-8">',
    '<style>',
    'body { font-family: Arial, sans-serif; line-height: 1.6; }',
    'a { color: #0066cc; text-decoration: none; }',
    'a:hover { text-decoration: underline; }',
    '</style>',
    '</head>',
    '<body>',
    Buffer.from(message).toString('utf8'),
    footer,
    '</body>',
    '</html>',
    '',
    '--' + boundary + '--',
  ];

  return emailParts.join('\r\n');
}

function encodeEmailForTransport(emailContent: string): string {
  const encoded = Buffer.from(emailContent)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  if (!encoded) {
    throw new Error('Failed to encode email content');
  }

  return encoded;
}

function createGmailRequest(encodedContent: string) {
  return {
    userId: 'me',
    requestBody: {
      raw: encodedContent,
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          {
            name: 'Content-Transfer-Encoding',
            value: 'base64url',
          },
        ],
      },
    },
  };
}

export async function sendEmail(
  gmail: gmail_v1.Gmail,
  context: EmailContext
): Promise<SendEmailOutput> {
  console.log(
    `${LOG_PREFIX} Processing email request:\n  subject: ${
      context.subject
    }\n  recipients: ${JSON.stringify(context.recipients, null, 2)}`
  );

  try {
    validateEmailInput(context);

    const emailContent = createEmailContent(
      context.from,
      context.message,
      context.subject,
      context.recipients
    );

    const encodedContent = encodeEmailForTransport(emailContent);
    const request = createGmailRequest(encodedContent);
    const response = await gmail.users.messages.send(request);

    if (!response.data.id || !response.data.threadId) {
      throw new Error('Invalid response from Gmail API');
    }

    console.log(
      `${LOG_PREFIX} email sent:\n  gmail returned: ${JSON.stringify(
        {
          id: response.data.id,
          threadId: response.data.threadId,
          labelIds: response.data.labelIds || [],
        },
        null,
        2
      )}`
    );

    return {
      id: response.data.id,
      threadId: response.data.threadId,
      labelIds: response.data.labelIds || [],
    };
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Email sending failed:\n  message: ${
        error instanceof Error ? error.message : error
      }\n  stack: ${
        error instanceof Error ? error.stack : ''
      }\n  response: ${JSON.stringify((error as any).response?.data, null, 2)}`
    );
    throw error;
  }
}
