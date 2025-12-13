import type {
  Message,
  MessageResponse,
} from '@codestrap/developer-foundations-types';

export async function sendSlackMessage(
  message: Message,
  baseUrl: string,
  botToken: string,
): Promise<MessageResponse> {
  try {
    // Make the API call to Slack
    const response = await fetch(`${baseUrl}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        channel: message.channelId,
        text: message.message,
        unfurl_links: true,
        unfurl_media: true,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        channel: message.channelId,
        ts: new Date().getTime(),
        error: `HTTP error: ${response.status} ${response.statusText}`,
      };
    }

    const result = (await response.json()) as {
      ok: boolean;
      error: string;
      channel: string;
    };

    if (!result.ok) {
      return {
        ok: false,
        channel: message.channelId,
        ts: new Date().getTime(),
        error: `Slack API error: ${result.error}`,
      };
    }

    return {
      ok: true,
      channel: result.channel,
      ts: new Date().getTime(),
    };
  } catch (error) {
    console.error('Error sending Slack message:', error);
    return {
      ok: false,
      channel: message.channelId,
      ts: new Date().getTime(),
      error: `Failed to send Slack message: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
