import type { Context, MachineEvent } from '@codestrap/developer-foundations-types';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import type {
    GeminiService,
    ProposedTimes,
    OfficeService} from '@codestrap/developer-foundations-types';
import {
    TYPES
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';

export type DraftAtendeeEmailResponse = {
    emailId: string,
    message: string,
    modelDialog: string,
    dayTimes: string;
    meetingSubject: string;
    meetingDuration: number;
    meetingAgenda?: string;
    resolution?: string;
    ts: number,
}

// This function extracts the channel ID and recepients from the input context and sends a slack message
export async function resolveUnavailableAttendees(context: Context, event?: MachineEvent, task?: string): Promise<DraftAtendeeEmailResponse> {
    // find the last occurrence of a getAvailableMeetingTimes execution which had to proceed this state transition
    const stateId = context.stack?.slice().reverse().find(item => item.indexOf('getAvailableMeetingTimes') >= 0);

    console.log(`resolveUnavailableAttendees found stateId: ${stateId}`);

    if (!stateId || stateId.length === 0) {
        throw new Error('Unable to find associated getAvailableMeetingTimes state in the machine stack.')
    }

    let emails: string[] = [];
    const resultOfMeetingSchedulingAttempt = context[stateId] as ProposedTimes;
    console.log(`resultOfMeetingSchedulingAttempt is: 
        ${JSON.stringify(resultOfMeetingSchedulingAttempt, null, 2)}`);
    const dayTimes = resultOfMeetingSchedulingAttempt.times.reduce((acc, cur) => {
        emails = [...emails, ...cur.unavailableAttendees, ...cur.availableAttendees]
        acc = `${acc}
        
        start: ${cur.start},
        end: ${cur.start},
        available: ${cur.availableAttendees.join(', ')},
        unavailable: ${cur.unavailableAttendees.join(', ')}
        `;
        return acc;
    }, '');

    console.log(`resolveUnavailableAttendees found the resultOfMeetingSchedulingAttempt: ${JSON.stringify(resultOfMeetingSchedulingAttempt || {})}`);
    console.log(`resolveUnavailableAttendees emails is: ${JSON.stringify(emails || [])}`);

    if (emails.length === 0) {
        throw new Error('resolveUnavailableAttendees did not find any email addresses to send and email to!')
    }

    const user = `
    Draft an email message asking all attendees asking if anyone can move blockers to make any of the day/time work:
    Required attendees: 
    ${Array.from(new Set(emails).values()).join(', ')}

    Available Day/Time:
    ${dayTimes}

    the task list used to generate the meeting request. This can provide context for the meeting such as attendee names and what will be discussed.
    ${context.solution}

    You can only respond in JSON in the following format:
    {
        message: string,
        recipients: string[],
    }

    For example if the attendees are times are:
    Required attendees:
    "jane.doe@example.com>", "john.doe@example.com"

    Available Day/Time:
    start: Mon Mar 10 2025 01:00:00 GMT-0700 (Pacific Daylight Time),
    end: Mon Mar 10 2025 01:30:00 GMT-0700 (Pacific Daylight Time),
    available: jane.doe@example.com,
    unavailable: john.doe@example.com,

    Your response is:
    {
        "recipients": ["jane.doe@example.com", "john.doe@example.com"],
        "message": "Hi Jane and John, Happy Friday! I'm having trouble finding an available day/time that works for the both of you. Jane is available at Mon Mar 10 2025 01:00:00 GMT-0700 (Pacific Daylight Time) but John is not. Please respond to this email with a proposed day time that works. If you can make any of the unavailable times work that would be preferred. Best, Viki.",
    }
    `;

    const system = `You are a helpful AI assistant tasked with authoring Slack messages. 
    You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Vickie, Code's AI EA" or similar. 
    You can get creative on your greeting, taking into account the dat of the week. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}. 
    You can also take into account the time of year such as American holidays like Halloween, Thanksgiving, Christmas, etc. 
    The current month is ${new Date().toLocaleDateString('en-US', { month: 'long' })}.`;

    const geminiService = container.get<GeminiService>(TYPES.GeminiService);

    const response = await geminiService(user, system);

    const clean = extractJsonFromBackticks(response);

    const parsedResult = JSON.parse(clean);
    const message = parsedResult.message;
    const modelDialog = parsedResult.message;

    const officeService = await container.getAsync<OfficeService>(TYPES.OfficeService);

    const emailResponse = await officeService.sendEmail(
        {
            from: process.env.OFFICE_SERVICE_ACCOUNT,
            recipients: parsedResult.recipients,
            subject: `Resolve Meeting Conflicts - ID ${context.machineExecutionId}`,
            message,
        }
    );

    // TODO: implement email threading with event listeners
    // This will involve saving this initial email to a "threads" ontology object
    // then having the event listener monitor the Gmail inbox, then when it fins an email from Vicki
    // lookup the corresponding email thread on the ontology based on the emailResponse.id (should math the PK field of the ontology object)
    return {
        emailId: emailResponse.id,
        message,
        meetingSubject: resultOfMeetingSchedulingAttempt.subject,
        meetingDuration: resultOfMeetingSchedulingAttempt.durationInMinutes,
        meetingAgenda: resultOfMeetingSchedulingAttempt.agenda,
        dayTimes,
        modelDialog,
        ts: new Date().getTime(),
    };
}