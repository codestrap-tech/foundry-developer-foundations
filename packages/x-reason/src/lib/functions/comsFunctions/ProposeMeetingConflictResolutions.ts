import {
  Context,
  MachineEvent,
  OfficeServiceV3,
  ProposeMeetingConflictResolutionsOutput,
} from '@codestrap/developer-foundations-types';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';
import { GeminiService, TYPES } from '@codestrap/developer-foundations-types';

function nowInTZ(tz: string, ref: Date): Date {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const p = Object.fromEntries(
    dtf.formatToParts(ref).map((x) => [x.type, x.value])
  );
  return new Date(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
    0
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

export async function proposeMeetingConflictResolutions(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<ProposeMeetingConflictResolutionsOutput> {
  // Extract user emails and optional time frame from task
  const TZ = 'America/Los_Angeles';
  const nowPT = nowInTZ(TZ, new Date()); // wall-clock PT "now"

  const system = `You are a helpful virtual AI assistant tasked with extracting user emails and an optional time frame for proposing meeting conflict resolutions.`;

  // Format today's date for the prompt
  const todayISO = `${nowPT.getFullYear()}-${pad(nowPT.getMonth() + 1)}-${pad(nowPT.getDate())}`;

  // Calculate tomorrow's date for the prompt example
  const tomorrow = addDays(startOfDay(nowPT), 1);
  const tomorrowISO = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

  const userPrompt = `
    Using the task from the end user below, extract the user email addresses and optional time frame for proposing meeting conflict resolutions.
    
    The task from the end user:
    ${task}

    The current day/time in the user's time zone (${TZ}) is:
    ${nowPT}

    Today's date in ISO format (YYYY-MM-DD) is: ${todayISO}

    You can only respond in JSON in the following format:
    {
        "userEmails": string[],
        "timeFrameStartISO"?: string, // optional, YYYY-MM-DD
        "timeFrameEndISO"?: string,   // optional, YYYY-MM-DD
        "timeFrame"?: string          // optional natural language, e.g. "this week"
    }

    Rules:
    - Extract email addresses from natural language (e.g., "Bob Jones <bob@codestrap.me>" should extract "bob@codestrap.me")
    - If a specific date is mentioned (e.g. "March 15, 2025" or "2025-03-15"), convert it to ISO format (YYYY-MM-DD) and set BOTH timeFrameStartISO and timeFrameEndISO to that date.
    - If a time frame like "this week" is mentioned:
      * Set timeFrame to "this week"
      * Set timeFrameStartISO to today's date (${todayISO})
      * Set timeFrameEndISO to the end of this week (e.g. Friday or Sunday) in ISO format
    - If a time frame like "next week" or "2 weeks" is mentioned:
      * Set timeFrame to the phrase (e.g. "next week", "2 weeks")
      * Choose appropriate timeFrameStartISO and timeFrameEndISO dates that match the request
    - If no time frame is mentioned at all, omit all time frame fields (it will default to today through the end of the working week)
    - Always return an array of email addresses, even if only one is mentioned

    For example if the ask from the user is:
    Q: "Propose resolutions for meeting conflicts for Bob Jones <bob@codestrap.me>"
    A: {
        "userEmails": ["bob@codestrap.me"]
    }

    Q: "Propose resolutions for meeting conflicts for Bob Jones <bob@codestrap.me> and Jane Doe <jane@codestrap.me> for today"
    A: {
        "userEmails": ["bob@codestrap.me", "jane@codestrap.me"],
        "timeFrameStartISO": "${todayISO}",
        "timeFrameEndISO": "${todayISO}"
    }

    Q: "Propose resolutions for meeting conflicts for Bob Jones <bob@codestrap.me> for tomorrow"
    A: {
        "userEmails": ["bob@codestrap.me"],
        "timeFrameStartISO": "${tomorrowISO}",
        "timeFrameEndISO": "${tomorrowISO}"
    }

    Q: "Propose resolutions for meeting conflicts for Bob Jones <bob@codestrap.me> for March 15, 2025"
    A: {
        "userEmails": ["bob@codestrap.me"],
        "timeFrameStartISO": "2025-03-15",
        "timeFrameEndISO": "2025-03-15"
    }

    Q: "Propose resolutions for meeting conflicts for Bob Jones <bob@codestrap.me> for this week"
    A: {
        "userEmails": ["bob@codestrap.me"],
        "timeFrame": "this week",
        "timeFrameStartISO": "${todayISO}",
        "timeFrameEndISO": "${todayISO}" // replace with the actual end-of-week date
    }
    `;

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);

  const response = await geminiService(userPrompt, system);

  const clean = extractJsonFromBackticks(response);

  const parsed = JSON.parse(clean) as {
    userEmails: string[];
    timeFrameStartISO?: string;
    timeFrameEndISO?: string;
    timeFrame?: string;
  };

  const userEmails = parsed.userEmails;
  const timeFrameStartISO = parsed.timeFrameStartISO;
  const timeFrameEndISO = parsed.timeFrameEndISO;
  const timeFrame = parsed.timeFrame;

  // Validate that we have at least one email
  if (!userEmails || userEmails.length === 0) {
    throw new Error('No email addresses found in the task');
  }

  const officeService = await container.getAsync<OfficeServiceV3>(
    TYPES.OfficeServiceV3
  );

  // First, identify meeting conflicts
  const identifyResult = await officeService.identifyMeetingConflicts({
    userEmails,
    timeFrameStartISO,
    timeFrameEndISO,
    timeFrame,
  });

  // Then, propose resolutions using the identified conflicts
  const result = await officeService.proposeMeetingConflictResolutions({
    userEmails,
    timeFrameStartISO,
    timeFrameEndISO,
    timeFrame,
    identifiedConflicts: identifyResult.identifiedConflicts,
  });

  return result;
}

