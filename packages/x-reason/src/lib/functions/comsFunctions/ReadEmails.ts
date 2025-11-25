import type { Context, MachineEvent } from '@codestrap/developer-foundations-types';
import {
    extractJsonFromBackticks,
} from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';
import type {
    GeminiService,
    OfficeService,
    ReadEmailOutput} from '@codestrap/developer-foundations-types';
import {
    TYPES,
} from '@codestrap/developer-foundations-types';

export async function readEmails(context: Context, event?: MachineEvent, task?: string): Promise<ReadEmailOutput> {
    const system = `You are a helpful virtual ai assistant tasked with extracting the time frame in minutes for an email query.`;

    const userPrompt = `
    Using the task from the end user below classify the time frame for the email query into one of the following:
    1. past 15 minutes (also the default if no time from is specified)
    2. past hour
    3. past day (this is the farthest supported look back)

    The task from the end user:
    ${task}

    You can only respond in JSON in the following format:
    {
        timeframe: string,
        email: string
    }

    For example if the ask from the user is:
    Q: "1. **Read Emails** - Read emails for Bob Jones <bob@codestrap.me>"
    A: {
        "timeframe": "past 15 minutes",
        "email": "bob@codestrap.me"
    }

    Q: "1. **Read Emails** - Read emails for Bob Jones <bob@codestrap.me> for the previous hour"
    A: {
        "timeframe": "past hour",
        "email": "bob@codestrap.me"
    }

    Q: "1. **Read Emails** - Read emails for Bob Jones <bob@codestrap.me> for today"
    A: {
        "timeframe": "past day",
        "email": "bob@codestrap.me"
    }
    `;

    const geminiService = container.get<GeminiService>(TYPES.GeminiService);

    const response = await geminiService(userPrompt, system);

    const clean = extractJsonFromBackticks(response);

    const { timeframe, email } = JSON.parse(clean) as { timeframe: string, email: string };

    let parsedTime = 15;

    switch (timeframe) {
        case 'past hour':
            parsedTime = 60
            break;
        case 'past day':
            parsedTime = 720; // we use 12 hours instead of 24 as it's probably the most relevant window.

    }

    const officeService = await container.getAsync<OfficeService>(TYPES.OfficeService);

    const publishTime = new Date((new Date().getTime() - parsedTime * 60 * 1000)).toISOString();

    const result = await officeService.readEmailHistory({
        email,
        publishTime, // TODO construct the published time from the extracted timeframe parameter
    });

    return result;
}