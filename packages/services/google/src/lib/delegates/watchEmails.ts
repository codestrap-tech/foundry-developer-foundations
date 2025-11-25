import type { calendar_v3, gmail_v1 } from 'googleapis';
import type {
  WatchEmailsInput,
  WatchEmailsOutput,
} from '@codestrap/developer-foundations-types';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function watchEmails(
  context: WatchEmailsInput,
  makeClient: (userId: string) => Promise<{
    emailClient: gmail_v1.Gmail;
    calendarClient: calendar_v3.Calendar;
  }>
): Promise<WatchEmailsOutput> {
  const results = await Promise.allSettled(
    context.config.flatMap(
      ({ users, topicName, labelIds, labelFilterBehavior }) =>
        users.map(async (userId) => {
          const { emailClient } = await makeClient(userId);
          // google has some rate limiting in play that happen when there are too many parallel auth calls
          // This is a total hack but can work for now.
          await sleep(1000);
          return emailClient.users.watch({
            userId,
            requestBody: {
              topicName,
              labelIds,
              labelFilterBehavior,
            },
          });
        })
    )
  );

  const errors: string[] = [];
  const responses: string[] = [];

  results.forEach((result) => {
    if (result.status === 'rejected') {
      errors.push(result.reason?.message || String(result.reason));
    } else if (result.value.status !== 200) {
      errors.push(JSON.stringify(result.value.data));
    } else {
      responses.push(JSON.stringify(result.value.data));
    }
  });

  return {
    status: errors.length > 0 ? 400 : 200,
    errors,
    responses,
  };
}
