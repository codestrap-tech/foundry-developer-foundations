import type { gmail_v1 } from 'googleapis';
import type {
  EmailMessage,
  ReadEmailHistoryContext,
} from '@codestrap/developer-foundations-types';

/**
 * Extract a header value from the message
 */
function getHeader(
  message: gmail_v1.Schema$Message,
  name: string
): string | undefined {
  const header = message.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  )?.value;

  return header || undefined;
}

/**
 * Extract the plain text body of the email
 */
function getPlainTextBody(
  message: gmail_v1.Schema$Message
): string | undefined {
  if (!message.payload) return;

  try {
    const getBodyData = (data?: string) =>
      data ? Buffer.from(data, 'base64').toString('utf8') : undefined;

    if (message.payload.parts) {
      const part = message.payload.parts.find(
        (p) => p.mimeType === 'text/plain'
      );
      return getBodyData(part?.body?.data || undefined);
    }

    return getBodyData(message.payload.body?.data || undefined);
  } catch (err) {
    console.error('Failed to decode email body:', err);
    return undefined;
  }
}

export async function readEmailHistory(
  gmail: gmail_v1.Gmail,
  context: ReadEmailHistoryContext
): Promise<EmailMessage[]> {
  // get all unread emails for the since since 15 minutes before the notification
  // yes this is the best way to do this, don't ask unless you want to understand how historyId works
  const afterEpoch = Math.floor(
    (new Date(context.publishTime).getTime() - 15 * 60 * 1000) / 1000
  );

  const baseQuery = [`is:unread`, `after:${afterEpoch}`];

  if (context.labels && context.labels.length > 0) {
    const quotedLabels = context.labels.map((label) => `label:"${label}"`);
    const labelQuery =
      quotedLabels.length > 1
        ? `(${quotedLabels.join(' OR ')})`
        : quotedLabels[0];
    baseQuery.push(labelQuery);
  }

  const messageListRes = await gmail.users.messages.list({
    userId: context.email,
    q: baseQuery.join(' '),
  });

  // now we can get the message IDs
  const messageIds =
    messageListRes.data.messages
      ?.map((m) => m.id)
      .filter((id): id is string => !!id) ?? [];

  // now we can can fetch the messages
  const messageResponses = (
    await Promise.allSettled(
      messageIds.map((id) =>
        gmail.users.messages.get({
          userId: context.email,
          id,
          format: 'full',
        })
      )
    )
  )
    .filter((settled) => settled.status === 'fulfilled')
    .map((fulfilled) => fulfilled.value);

  // now we can get the thread IDs
  const threadIds = Array.from(
    new Set(
      messageResponses
        .map((res) => res.data.threadId)
        .filter((id): id is string => !!id)
    )
  );

  // then fetch all the messages for a given thread
  const threadResponses = await Promise.all(
    threadIds.map((threadId) =>
      gmail.users.threads.get({
        userId: context.email,
        id: threadId,
        format: 'full',
      })
    )
  );

  // then flatten res.data.messages and construct our output
  const results = threadResponses
    .flatMap((res) => res.data.messages || [])
    .map((msg) => {
      const id = msg.id || undefined;
      const threadId = msg.threadId || undefined;
      const subject = getHeader(msg, 'Subject');
      const from = getHeader(msg, 'From');
      const body = getPlainTextBody(msg);
      return { subject, from, body, id, threadId };
    });

  return results;
}
