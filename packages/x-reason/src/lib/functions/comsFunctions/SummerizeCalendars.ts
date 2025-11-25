import type {
  Context,
  MachineEvent,
  OfficeServiceV2,
  Summaries,
} from '@codestrap/developer-foundations-types';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';
import type { GeminiService} from '@codestrap/developer-foundations-types';
import { TYPES } from '@codestrap/developer-foundations-types';

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

function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const dow = x.getDay(); // Sun=0..Sat=6
  const delta = dow === 0 ? -6 : 1 - dow;
  return startOfDay(addDays(x, delta));
}

export async function summarizeCalendars(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<Summaries> {
  const TZ = 'America/Los_Angeles';
  const nowPT = nowInTZ(TZ, new Date()); // wall-clock PT “now”

  const system = `You are a helpful virtual ai assistant tasked with extracting the time frame for a calendar queries.`;

  const userPrompt = `
    Using the task from the end user below classify the time frame for the calendar query into one of the following:
    1. today (default)
    2. tomorrow
    3. this week
    4. next week

    The task from the end user:
    ${task}

    The current day/time in the user's time zone (${TZ}) is:
    ${nowPT}

    You can only respond in JSON in the following format:
    {
        timeframe: string,
        emails: string[]
    }

    For example if the ask from the user is:
    Q: "1. **Summarize Calendars** - Summarize calendars for Bob Jones <bob@codestrap.me>"
    A: {
        "timeframe": "today",
        "emails": ["bob@codestrap.me"]
    }

    Q: "1. **Summarize Calendars** - Summarize calendars for Bob Jones <bob@codestrap.me> and Jane Doe <jane@codestrap.me> for tomorrow"
    A: {
        "timeframe": "tomorrow",
        "emails": ["bob@codestrap.me", "jane@codestrap.me"]
    }

    Q: "1. **Summarize Calendars** - Summarize calendars for Bob Jones <bob@codestrap.me> for the week"
    A: {
        "timeframe": "this week",
        "emails": ["bob@codestrap.me"]
    }

    Q: "1. **Summarize Calendars** - Summarize calendars for Bob Jones <bob@codestrap.me> for next week"
    A: {
        "timeframe": "next week",
        "emails": ["bob@codestrap.me"]
    }
    `;

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);

  const response = await geminiService(userPrompt, system);

  const clean = extractJsonFromBackticks(response);

  const { timeframe, emails } = JSON.parse(clean) as {
    timeframe: string;
    emails: string[];
  };

  /* ---------- build PT window ---------- */

  let windowStartLocal: Date;
  let windowEndLocal: Date;

  switch (timeframe) {
    case 'tomorrow': {
      windowStartLocal = startOfDay(addDays(nowPT, 1)); // tomorrow 00:00
      windowEndLocal = startOfDay(addDays(nowPT, 2)); // day after tomorrow 00:00
      break;
    }
    case 'this week': {
      windowStartLocal = startOfDay(nowPT); // today 00:00
      const nextMon = startOfWeekMonday(addDays(nowPT, 7)); // next week’s Monday 00:00
      windowEndLocal = nextMon;
      break;
    }
    case 'next week': {
      const nextMon = startOfWeekMonday(addDays(nowPT, 7)); // next Monday 00:00
      windowStartLocal = nextMon;                           // start of next week
      windowEndLocal = startOfDay(addDays(nextMon, 7));     // following Monday 00:00
      break;
    }
    case 'today':
    default: {
      windowStartLocal = startOfDay(nowPT); // today 00:00
      windowEndLocal = startOfDay(addDays(nowPT, 1)); // tomorrow 00:00
    }
  }

  const officeService = await container.getAsync<OfficeServiceV2>(
    TYPES.OfficeService
  );

  const result = await officeService.summarizeCalendars({
    emails,
    timezone: TZ,
    windowStartLocal,
    windowEndLocal,
  });

  return result;
}
