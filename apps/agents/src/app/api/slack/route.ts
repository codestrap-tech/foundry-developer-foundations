import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { Vickie } from '@codestrap/developer-foundations-agents-vickie-bennie';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN!;
const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET!;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function verifySlackSignature(req: NextRequest, body: string): boolean {
  const timestamp = req.headers.get('x-slack-request-timestamp');
  const signature = req.headers.get('x-slack-signature');
  if (!timestamp || !signature) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;

  const sigBase = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', SIGNING_SECRET);
  hmac.update(sigBase);
  const mySig = `v0=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(Buffer.from(mySig), Buffer.from(signature));
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  if (!verifySlackSignature(req, bodyText)) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const params = new URLSearchParams(bodyText);
  const threadTs = params.get('thread_ts');
  const userId = params.get('user_id');
  const text = params.get('text');
  const channelId = params.get('channel_id');
  const command = params.get('command');

  if (!channelId || !userId || !text || !command) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: '⚠️ Missing required data.',
    });
  }

  try {
    // Post command acknowledgment to channel (and get ts for a new thread if needed)
    const initialPostRes = await fetch(
      'https://slack.com/api/chat.postMessage',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channelId,
          text: `💡 <@${userId}> used \`${command} ${text}\``,
        }),
      },
    );

    const initialPostData = await initialPostRes.json();
    const threadRootTs = threadTs || initialPostData.ts;

    if (!initialPostData.ok) {
      throw new Error(`Slack postMessage failed: ${initialPostData.error}`);
    }

    const vickie = new Vickie();
    const result = await vickie.askVickie(text, userId);

    // Post Foundry result as threaded reply
    const replyRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        thread_ts: threadRootTs,
        mrkdwn: true,
        text: `💬 <@${userId}>,\n${result.message}`,
      }),
    });

    const replyData = await replyRes.json();

    if (!replyData.ok) {
      throw new Error(`Slack reply failed: ${replyData.error}`);
    }

    return new NextResponse('Message posted to thread.', { status: 200 });
  } catch (err) {
    console.error('Error handling slash command:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
