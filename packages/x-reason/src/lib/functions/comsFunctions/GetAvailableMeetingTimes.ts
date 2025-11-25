import type { Context, MachineEvent } from '@codestrap/developer-foundations-types';
import {
    extractJsonFromBackticks,
} from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';
import type {
    GeminiService,
    ProposedTimes,
    MeetingRequest,
    OfficeService} from '@codestrap/developer-foundations-types';
import {
    TYPES
} from '@codestrap/developer-foundations-types';
import type { DraftAtendeeEmailResponse } from './ResolveUnavailableAttendees';


// This function gets the attendees from the input context and then
// uses Google Calendar APIs to find available meeting times for anyone with a codestrap.me (we should make the home domain configurable) email address
// For external emails it will send an email asking for available time slots if it can not find them on the input context
// The calling function in the function catalog will then determine whether or not to pause machine execution waiting for a response of continue forward
export async function getAvailableMeetingTimes(context: Context, event?: MachineEvent, task?: string): Promise<ProposedTimes> {
    try {
        const options = {
            timeZone: "America/Los_Angeles",
            timeZoneName: "short" // This will produce "PST" or "PDT"
        };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-expect-error
        const formatter = new Intl.DateTimeFormat("en-US", options);
        const formatted = formatter.format(new Date());

        console.log(`formatted int date: ${formatted}`);
        const isPDT = formatted.includes("PDT");

        const getAvailableStateId = context.stack?.slice().reverse().find(item => item.includes('getAvailableMeetingTimes'));
        // find the last instance of a resolveUnavailableAttendees state in the stack
        const resolveStateId = context.stack?.slice().reverse().find(item => item.includes('resolveUnavailableAttendees'));

        const { resolution } = resolveStateId && context[resolveStateId] ? context[resolveStateId] as DraftAtendeeEmailResponse : { resolution: undefined };
        const { allAvailable } = getAvailableStateId && context[getAvailableStateId] ? context[getAvailableStateId] as ProposedTimes : { allAvailable: false };
        let resolutionClause = '';
        if (!allAvailable && resolution) {
            resolutionClause = `# Conflict Resolution
All the attendees were previously not available at the proposed time.
The resolution for the conflict that has been agreed upon by al parties is: ${resolution}. 
Update the meeting time to use this resolution. Output local date string in Pacific Time. 
The current day/time in Pacific Time is: ${new Date().toString()}
PDT in effect (indicated if Pacific Daylight Time is in effect): ${isPDT}`;
        }
        // we are all on the west coast so we hard code our time zone for now
        const system = `You are a helpful virtual assistant tasked with meeting scheduling.
    You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Vickie, Code's AI EA" or similar. 
    You can get creative on your greeting, taking into account the day of the week. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}. 
    You can also take into account the time of year such as American holidays like Halloween, Thanksgiving, Christmas, etc. 
    The current local date/time is ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}. 
    When scheduling meetings you always extract the key details from the input task.`;

        const user = `
# Task
Using the meeting request from the end user extract the key details. You must extract:
1. The participants
2. the meeting subject
3. The meeting duration
4. The time frame
5. The local date string for the proposed day/time if any

# The meeting request from the end user is:
${task}

${resolutionClause}

The complete task list which may contain additional information about the meeting such as the subject or agenda:
${context.solution}

Let's take this step by step.
1. First determine if any people mentioned in the input task most likely match the people below. If so return the matching participant(s) in the participant array
Connor Deeks <connor.deeks@codestrap.me> - Connor Deeks in the CEO and board member in charge of platform leads, business strategy, and investor relations.
Dorian Smiley <dsmiley@codestrap.me> - Dorian is the CTO who manages the software engineers and is responsible for technology strategy, execution, and the lead applied AI engineer.
2. Insert any explicit email addresses into the participants array
3. Extract the meting subject based on the meeting request from the end user. Most meeting requests from the ens user include Subject: THE_MEETING_SUBJECT
4. If the meeting request from the end user does not contain a subject, use the provided complete task list to extract it. 
If not subject can be extracted for this meeting request use "Circle Up"
5. Extract the meeting duration in minutes. If the duration can not be inferred return 30.
6. Determine the time frame as one of the following: "user defined exact date/time", "as soon as possible", "this week", or "next week". If the user specifies "today" without an exact time use "as soon as possible". If the user did not specify a timeframe you must use "as soon as possible".
        6.5 If the user specifies a date 2025-04-11 without a time use 9 AM Pacific Time "Fri Apr 11 2025 09:00:00 GMT-0700 (Pacific Daylight Time)"
7. If the time frame is "user defined exact date/time" output local date string in Pacific Time.
The current day/time in Pacific Time is: ${new Date().toString()}
PDT in effect (indicated if Pacific Daylight Time is in effect): ${isPDT}

You can only respond in JSON in the following format:
{
    participants: Array<string>;
    subject: string;
    timeframe_context: 'user defined exact date/time' | 'as soon as possible' | 'this week' | 'next week';
    localDateString: string,
    duration_minutes: number;
}

For example:
If the ask from the user is:
"Schedule a meeting with Connor and Dorian for next week to discuss new Palantir features from DevCon"

Your response is:
{
    "participants:" ["dsmiley@codestrap.me", "connor.deeks@codestrap.me"],
    "subject": "DevCon Feature Recap",
    "timeframe_context": "next week",
    "duration_minutes": 30;
}

If the ask from the user is:
"Schedule a meeting with Connor, Dorian, and keith@eriestreet.com to discuss investment ask"

Your response is:
{
    "participants": ["connor.deeks@codestrap.me", "dsmiley@codestrap.me", "keith@eriestreet.com"],
    "subject": "Investment Ask",
    "timeframe_context": "as soon as possible",
    "duration_minutes": 30;
}

"Schedule a meeting for today with Connor, Dorian, and keith@eriestreet.com to discuss investment ask"

Your response is:
{
    "participants": ["connor.deeks@codestrap.me", "dsmiley@codestrap.me", "keith@eriestreet.com"],
    "subject": "Investment Ask",
    "timeframe_context": "as soon as possible",
    "duration_minutes": 30;
}

Note a request for a meeting today translates to "as soon as possible" not an exact day time! This will automatically include time slots for today.

If the ask from the user is (assuming the current local day/time in your time zone is 'Tue Apr 08 2025 08:26:19 GMT-0700 (Pacific Daylight Time))':
"Schedule a meeting with Connor and Dorian to discuss to internal projects this Friday at 9 AM MT for 1 hour"

Your response is:
{
    "participants": ["connor.deeks@codestrap.me", "dsmiley@codestrap.me"],
    "subject": "Internal Projects",
    "timeframe_context": "user defined exact date/time",
    "localDateString": "Fri Apr 11 2025 09:00:00 GMT-0600 (Mountain Daylight Time)"
    "duration_minutes": 60;
}
`;

        const geminiService = container.get<GeminiService>(TYPES.GeminiService);

        const response = await geminiService(user, system);

        const clean = extractJsonFromBackticks(response);

        const parsedResult = JSON.parse(clean) as MeetingRequest;
        console.log(`the model returned the following meeting time proposal:\n${clean}`);
        const timeFrame = (parsedResult.timeframe_context === 'user defined exact date/time') ? parsedResult.localDateString! : parsedResult.timeframe_context;
        const participants = Array.from(new Set(parsedResult.participants));
        //remove external email addresses since we can't check them
        const codeStrapParticipants = participants.filter(participant => participant.indexOf('codestrap.me') >= 0 || participant.indexOf('codestrap.com') >= 0);
        const inputs = {
            participants: codeStrapParticipants,
            localDateString: timeFrame,
            timeframe_context: parsedResult.timeframe_context,
            subject: parsedResult.subject,
            duration_minutes: parsedResult.duration_minutes,
            working_hours: {
                start_hour: 8,
                end_hour: 17,
            },
            timezone: "America/Los_Angeles", // hard code for now, should be the organizer's time zone
        } as MeetingRequest;



        const officeService = await container.getAsync<OfficeService>(TYPES.OfficeService);

        let availableTimes = await officeService.getAvailableMeetingTimes(inputs);

        // no times found, retry when the user has not specified a time frame
        if (availableTimes.suggested_times.length === 0 && inputs.timeframe_context === 'as soon as possible') {
            // first try this week, then next week
            inputs.timeframe_context = 'this week';
            availableTimes = await officeService.getAvailableMeetingTimes(inputs);
            if (availableTimes.suggested_times.length === 0) {
                inputs.timeframe_context = 'next week';
                availableTimes = await officeService.getAvailableMeetingTimes(inputs);
            }
        }

        // still nothing, return allAvailable false to resolve manually
        if (availableTimes.suggested_times.length === 0) {
            return {
                times: [
                    {
                        start: timeFrame,
                        end: timeFrame,
                        availableAttendees: [],
                        unavailableAttendees: participants,
                    }
                ],
                subject: parsedResult.subject,
                durationInMinutes: inputs.duration_minutes,
                allAvailable: false,
            }
        }
        // the array is presorted based on score, 
        // we return all the times for use cases there people want the explore the times themselves
        const times = availableTimes.suggested_times.map(time => ({
            start: time.start,
            end: time.end,
            availableAttendees: participants,
            unavailableAttendees: [],
        }));
        const message = availableTimes.message;

        const returnValue: ProposedTimes = {
            times, // Array of available time slots
            agenda: message,
            subject: parsedResult.subject, // Meeting subject or title
            durationInMinutes: inputs.duration_minutes, // Meeting duration in minutes
            allAvailable: true, // findOptimalMeetingTime will always find a timeslot currently since it does not allow you to specify an exact day/time yet
        }

        console.log('findOptimalMeetingTime response:', JSON.stringify(availableTimes));

        return returnValue;
    } catch (e) {
        console.log((e as Error).message);
        throw e;
    }
}
