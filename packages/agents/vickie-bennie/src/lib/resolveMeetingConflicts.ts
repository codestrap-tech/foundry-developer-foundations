import {
  GeminiService,
  OfficeService,
  OfficeServiceV3,
  ProposeMeetingConflictResolutionsInput,
  ProposeMeetingConflictResolutionsOutput,
  TYPES,
} from '@codestrap/developer-foundations-types';
import {
  extractJsonFromBackticks,
  uuidv4,
} from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';

export interface VickieResponse {
  status: number;
  message: string;
  executionId: string;
  taskList?: string;
  error?: string;
}

export interface ParsedConflictRequest {
  users: string[];
  timeFrameFrom: string;
  timeFrameTo: string;
}

/**
 * Extracts key details from a conflict resolution request using an LLM
 */
async function extractConflictDetails(
  task: string
): Promise<ParsedConflictRequest> {
  const geminiService = container.get<GeminiService>(TYPES.GeminiService);

  const timeZone = 'America/Los_Angeles';
  const currentDate = new Date();

  const system = `You are a helpful virtual assistant tasked with identifying meeting conflicts for specified users and resolving them.
    You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Vickie, Code's AI EA" or similar. 
    You can get creative on your greeting, taking into account the day of the week. Today is ${currentDate.toLocaleDateString(
      'en-US',
      { weekday: 'long' }
    )}. 
    You can also take into account the time of year such as American holidays like Halloween, Thanksgiving, Christmas, etc. 
    The current local date/time is ${currentDate.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
    })}. 
    Time zone is ${timeZone}.
    Working day is from 8 AM to 5 PM.
    When resolving meeting conflicts you always extract the key details from the input task.`;

  const user = `
# Task
Using the conflict resolution request from the end user extract the key details. You must extract:
1. The users we are resolving conflicts for
2. The time frame for the conflict resolution (default to today if not specified)
3. The frame should start from current local date/time if not specified

# The conflict resolution request from the end user is:
${task}

Let's take this step by step.
1. First determine if any users mentioned in the input task most likely match the users below. If so return the matching user(s) in the user array
Connor Deeks <connor.deeks@codestrap.me> - Connor Deeks in the CEO and board member in charge of platform leads, business strategy, and investor relations.
Dorian Smiley <dsmiley@codestrap.me> - Dorian is the CTO who manages the software engineers and is responsible for technology strategy, execution, and the lead applied AI engineer.
2. Insert any explicit email addresses into the user array
3. Extract the time frame based on the conflict resolution request from the end user.
If not time frame can be extracted for this conflict resolution request use "today" starting from now till the end of the day. Time zone is ${timeZone}
Use ISO 8601 format for the time frame.
Consider working day from 8 AM to 5 PM.

You can only respond in JSON in the following format:
{
    users: Array<string>;
    timeFrameFrom: string;
    timeFrameTo: string;
}

For example:
{
    "users": ["connor.deeks@codestrap.me", "dsmiley@codestrap.me"],
    "timeFrameFrom": "2025-04-11T16:00:00Z",
    "timeFrameTo": "2025-12-05T01:00:00Z"
}
`;

  const response = await geminiService(user, system);
  const clean = extractJsonFromBackticks(response);
  const parsed = JSON.parse(clean) as ParsedConflictRequest;

  return parsed;
}

/**
 * Filters users to only include CodeStrap users
 */
function filterCodeStrapUsers(users: string[]): string[] {
  return users.filter(
    (user) =>
      user.indexOf('codestrap.me') >= 0 || user.indexOf('codestrap.com') >= 0
  );
}

/**
 * Performs rescheduling for identified conflicts
 */
// async function performRescheduling(
//   identifyResult: ProposeMeetingConflictResolutionsOutput,
//   codeStrapUsers: string[],
//   officeService: OfficeService
// ): Promise<{ scheduledCount: number; errors: string[] }> {
//   let scheduledCount = 0;
//   const scheduledMeetings: string[] = [];
//   const errors: string[] = [];

//   // For each conflict with resolution blocks, schedule a meeting
//   for (const conflict of identifyResult) {
//     if (conflict.resolutionBlocks && conflict.resolutionBlocks.length > 0) {
//       const firstBlock = conflict.resolutionBlocks[0];
//       try {
//         const schedulingResult = await officeService.scheduleMeeting({
//           summary: `Resolved Meeting Conflict - ${conflict.id}`,
//           description: `Meeting scheduled to resolve conflict for meeting ${conflict.id}`,
//           start: firstBlock.start,
//           end: firstBlock.end,
//           attendees: codeStrapUsers,
//         });

//         scheduledCount++;
//         scheduledMeetings.push(
//           `Meeting ${conflict.id} scheduled: ${schedulingResult.htmlLink}`
//         );
//       } catch (e) {
//         const errorMsg = `Failed to schedule meeting for conflict ${
//           conflict.id
//         }: ${(e as Error).message}`;
//         errors.push(errorMsg);
//         console.error(errorMsg);
//       }
//     }
//   }
//   return { scheduledCount, errors };
// }

export async function resolveMeetingConflicts(
  task: string
): Promise<VickieResponse> {
  try {
    const officeService = await container.getAsync<OfficeService>(
      TYPES.OfficeService
    );
    const officeServiceV3 = await container.getAsync<OfficeServiceV3>(
      TYPES.OfficeServiceV3
    );
    // Extract conflict details from the task
    const parsed = await extractConflictDetails(task);

    const users = parsed.users;
    const codeStrapUsers = filterCodeStrapUsers(users);

    if (codeStrapUsers.length === 0) {
      return {
        status: 400,
        executionId: uuidv4(),
        message: 'No CodeStrap users found in the request',
        error: 'No valid users',
        taskList: 'ERROR',
      };
    }

    const input: ProposeMeetingConflictResolutionsInput = {
      userEmails: codeStrapUsers,
      timeFrameFrom: new Date(parsed.timeFrameFrom),
      timeFrameTo: new Date(parsed.timeFrameTo),
      timezone: 'America/Los_Angeles',
    };

    // Identify conflicts and propose resolutions
    const identifyResult =
      await officeServiceV3.proposeMeetingConflictResolutions(input);

    // Perform rescheduling calculations
    const { rescheduled, errors } = calculateRescheduling(identifyResult);

    return {
      status: 200,
      executionId: uuidv4(),
      message: 'Meeting conflicts resolved',
      taskList: 'SUCCESS',
    };
    // const { scheduledCount, errors } = await performRescheduling(
    //   identifyResult,
    //   codeStrapUsers,
    //   officeService
    // );

    // const message = `${
    //   identifyResult.length
    // } conflicts have been identified with possible resolutions for users ${users.join(
    //   ', '
    // )} for the time frame from ${parsed.timeFrameFrom} to ${
    //   parsed.timeFrameTo
    // }. ${scheduledCount} meeting(s) scheduled.${
    //   errors.length > 0 ? ` Errors: ${errors.join('; ')}` : ''
    // }`;

    // return {
    //   status: errors.length > 0 && scheduledCount === 0 ? 400 : 200,
    //   executionId: uuidv4(),
    //   message,
    //   error: errors.length > 0 ? errors.join('; ') : '',
    //   taskList: '',
    // };
  } catch (e) {
    console.error('resolveMeetingConflicts error:', (e as Error).message);
    return {
      status: 500,
      executionId: uuidv4(),
      message: `Error resolving meeting conflicts: ${(e as Error).message}`,
      error: (e as Error).stack || (e as Error).message,
      taskList: '',
    };
  }
}

function calculateRescheduling(
  identifyResult: ProposeMeetingConflictResolutionsOutput
) {
  return {
    rescheduled: 0,
    errors: [],
  };
}

// const exampleProposeMeetingResponse: ProposeMeetingConflictResolutionsOutput = [
//   {
//     email: 'igor@codestrap.me',
//     id: '7h491kic47b10kd6k0bp0hj4de_20251208T120000Z',
//     subject: 'daily sync',
//     start: '2025-12-08T04:00:00-08:00',
//     end: '2025-12-08T04:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/aai-kcjj-jwy',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T08:30:00-08:00',
//         end: '2025-12-05T09:00:00-08:00',
//         score: 98.67062597222223,
//       },
//       {
//         start: '2025-12-05T11:30:00-08:00',
//         end: '2025-12-05T12:00:00-08:00',
//         score: 97.17062597222223,
//       },
//       {
//         start: '2025-12-05T12:00:00-08:00',
//         end: '2025-12-05T12:30:00-08:00',
//         score: 96.9206261111111,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '54jc9djmi0te83k96o62nd7m8l_20251208T170000Z',
//     subject: 'Standup',
//     start: '2025-12-08T09:00:00-08:00',
//     end: '2025-12-08T09:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/bgh-pprj-tun',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.92063319444445,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.67063319444445,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '7h491kic47b10kd6k0bp0hj4de_20251209T120000Z',
//     subject: 'daily sync',
//     start: '2025-12-09T04:00:00-08:00',
//     end: '2025-12-09T04:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/aai-kcjj-jwy',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T08:30:00-08:00',
//         end: '2025-12-05T09:00:00-08:00',
//         score: 98.67063777777778,
//       },
//       {
//         start: '2025-12-05T11:30:00-08:00',
//         end: '2025-12-05T12:00:00-08:00',
//         score: 97.17063777777778,
//       },
//       {
//         start: '2025-12-05T12:00:00-08:00',
//         end: '2025-12-05T12:30:00-08:00',
//         score: 96.92063777777778,
//       },
//       {
//         start: '2025-12-05T12:30:00-08:00',
//         end: '2025-12-05T13:00:00-08:00',
//         score: 96.67063777777778,
//       },
//       {
//         start: '2025-12-05T13:00:00-08:00',
//         end: '2025-12-05T13:30:00-08:00',
//         score: 96.42063777777778,
//       },
//       {
//         start: '2025-12-05T13:30:00-08:00',
//         end: '2025-12-05T14:00:00-08:00',
//         score: 96.17063777777778,
//       },
//       {
//         start: '2025-12-05T14:00:00-08:00',
//         end: '2025-12-05T14:30:00-08:00',
//         score: 95.92063791666666,
//       },
//       {
//         start: '2025-12-05T14:30:00-08:00',
//         end: '2025-12-05T15:00:00-08:00',
//         score: 95.67063791666666,
//       },
//       {
//         start: '2025-12-05T15:00:00-08:00',
//         end: '2025-12-05T15:30:00-08:00',
//         score: 95.42063791666666,
//       },
//       {
//         start: '2025-12-05T15:30:00-08:00',
//         end: '2025-12-05T16:00:00-08:00',
//         score: 95.17063791666666,
//       },
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.92063791666666,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.67063791666666,
//       },
//       {
//         start: '2025-12-08T08:00:00-08:00',
//         end: '2025-12-08T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T08:30:00-08:00',
//         end: '2025-12-08T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T11:30:00-08:00',
//         end: '2025-12-08T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:00:00-08:00',
//         end: '2025-12-08T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:30:00-08:00',
//         end: '2025-12-08T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:00:00-08:00',
//         end: '2025-12-08T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:30:00-08:00',
//         end: '2025-12-08T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:00:00-08:00',
//         end: '2025-12-08T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:30:00-08:00',
//         end: '2025-12-08T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:00:00-08:00',
//         end: '2025-12-08T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:30:00-08:00',
//         end: '2025-12-08T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:00:00-08:00',
//         end: '2025-12-09T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:30:00-08:00',
//         end: '2025-12-09T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T11:30:00-08:00',
//         end: '2025-12-09T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:00:00-08:00',
//         end: '2025-12-09T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:30:00-08:00',
//         end: '2025-12-09T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:00:00-08:00',
//         end: '2025-12-09T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:30:00-08:00',
//         end: '2025-12-09T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:00:00-08:00',
//         end: '2025-12-09T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:30:00-08:00',
//         end: '2025-12-09T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:00:00-08:00',
//         end: '2025-12-09T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:30:00-08:00',
//         end: '2025-12-09T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T11:30:00-08:00',
//         end: '2025-12-10T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:30:00-08:00',
//         end: '2025-12-10T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:30:00-08:00',
//         end: '2025-12-10T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:30:00-08:00',
//         end: '2025-12-11T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T11:30:00-08:00',
//         end: '2025-12-11T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:00:00-08:00',
//         end: '2025-12-11T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:00:00-08:00',
//         end: '2025-12-11T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:30:00-08:00',
//         end: '2025-12-11T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:00:00-08:00',
//         end: '2025-12-11T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:30:00-08:00',
//         end: '2025-12-11T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '54jc9djmi0te83k96o62nd7m8l_20251209T170000Z',
//     subject: 'Standup',
//     start: '2025-12-09T09:00:00-08:00',
//     end: '2025-12-09T09:30:00-08:00',
//     durationMinutes: 30,
//     participants: [
//       'pnowak@codestrap.me',
//       'igor@codestrap.me',
//       'dsmiley@codestrap.me',
//     ],
//     meetingLink: 'https://meet.google.com/bgh-pprj-tun',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.92063416666667,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.67063416666667,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '7h491kic47b10kd6k0bp0hj4de_20251210T120000Z',
//     subject: 'daily sync',
//     start: '2025-12-10T04:00:00-08:00',
//     end: '2025-12-10T04:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/aai-kcjj-jwy',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T08:30:00-08:00',
//         end: '2025-12-05T09:00:00-08:00',
//         score: 98.67063597222223,
//       },
//       {
//         start: '2025-12-05T11:30:00-08:00',
//         end: '2025-12-05T12:00:00-08:00',
//         score: 97.17063597222223,
//       },
//       {
//         start: '2025-12-05T12:00:00-08:00',
//         end: '2025-12-05T12:30:00-08:00',
//         score: 96.92063597222223,
//       },
//       {
//         start: '2025-12-05T12:30:00-08:00',
//         end: '2025-12-05T13:00:00-08:00',
//         score: 96.67063611111111,
//       },
//       {
//         start: '2025-12-05T13:00:00-08:00',
//         end: '2025-12-05T13:30:00-08:00',
//         score: 96.42063611111111,
//       },
//       {
//         start: '2025-12-05T13:30:00-08:00',
//         end: '2025-12-05T14:00:00-08:00',
//         score: 96.17063611111111,
//       },
//       {
//         start: '2025-12-05T14:00:00-08:00',
//         end: '2025-12-05T14:30:00-08:00',
//         score: 95.92063611111111,
//       },
//       {
//         start: '2025-12-05T14:30:00-08:00',
//         end: '2025-12-05T15:00:00-08:00',
//         score: 95.67063611111111,
//       },
//       {
//         start: '2025-12-05T15:00:00-08:00',
//         end: '2025-12-05T15:30:00-08:00',
//         score: 95.42063625,
//       },
//       {
//         start: '2025-12-05T15:30:00-08:00',
//         end: '2025-12-05T16:00:00-08:00',
//         score: 95.17063625,
//       },
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.92063625,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.67063625,
//       },
//       {
//         start: '2025-12-08T08:00:00-08:00',
//         end: '2025-12-08T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T08:30:00-08:00',
//         end: '2025-12-08T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T11:30:00-08:00',
//         end: '2025-12-08T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:00:00-08:00',
//         end: '2025-12-08T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:30:00-08:00',
//         end: '2025-12-08T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:00:00-08:00',
//         end: '2025-12-08T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:30:00-08:00',
//         end: '2025-12-08T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:00:00-08:00',
//         end: '2025-12-08T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:30:00-08:00',
//         end: '2025-12-08T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:00:00-08:00',
//         end: '2025-12-08T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:30:00-08:00',
//         end: '2025-12-08T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:00:00-08:00',
//         end: '2025-12-09T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:30:00-08:00',
//         end: '2025-12-09T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T11:30:00-08:00',
//         end: '2025-12-09T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:00:00-08:00',
//         end: '2025-12-09T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:30:00-08:00',
//         end: '2025-12-09T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:00:00-08:00',
//         end: '2025-12-09T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:30:00-08:00',
//         end: '2025-12-09T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:00:00-08:00',
//         end: '2025-12-09T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:30:00-08:00',
//         end: '2025-12-09T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:00:00-08:00',
//         end: '2025-12-09T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:30:00-08:00',
//         end: '2025-12-09T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T11:30:00-08:00',
//         end: '2025-12-10T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:30:00-08:00',
//         end: '2025-12-10T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:30:00-08:00',
//         end: '2025-12-10T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:30:00-08:00',
//         end: '2025-12-11T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T11:30:00-08:00',
//         end: '2025-12-11T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:00:00-08:00',
//         end: '2025-12-11T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:00:00-08:00',
//         end: '2025-12-11T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:30:00-08:00',
//         end: '2025-12-11T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:00:00-08:00',
//         end: '2025-12-11T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:30:00-08:00',
//         end: '2025-12-11T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '54jc9djmi0te83k96o62nd7m8l_20251210T170000Z',
//     subject: 'Standup',
//     start: '2025-12-10T09:00:00-08:00',
//     end: '2025-12-10T09:30:00-08:00',
//     durationMinutes: 30,
//     participants: [
//       'pnowak@codestrap.me',
//       'igor@codestrap.me',
//       'dsmiley@codestrap.me',
//     ],
//     meetingLink: 'https://meet.google.com/bgh-pprj-tun',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.92066,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.67066,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '7h491kic47b10kd6k0bp0hj4de_20251211T120000Z',
//     subject: 'daily sync',
//     start: '2025-12-11T04:00:00-08:00',
//     end: '2025-12-11T04:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/aai-kcjj-jwy',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T08:30:00-08:00',
//         end: '2025-12-05T09:00:00-08:00',
//         score: 98.6706311111111,
//       },
//       {
//         start: '2025-12-05T11:30:00-08:00',
//         end: '2025-12-05T12:00:00-08:00',
//         score: 97.1706311111111,
//       },
//       {
//         start: '2025-12-05T12:00:00-08:00',
//         end: '2025-12-05T12:30:00-08:00',
//         score: 96.9206311111111,
//       },
//       {
//         start: '2025-12-05T12:30:00-08:00',
//         end: '2025-12-05T13:00:00-08:00',
//         score: 96.6706311111111,
//       },
//       {
//         start: '2025-12-05T13:00:00-08:00',
//         end: '2025-12-05T13:30:00-08:00',
//         score: 96.42063125,
//       },
//       {
//         start: '2025-12-05T13:30:00-08:00',
//         end: '2025-12-05T14:00:00-08:00',
//         score: 96.17063125,
//       },
//       {
//         start: '2025-12-05T14:00:00-08:00',
//         end: '2025-12-05T14:30:00-08:00',
//         score: 95.92063125,
//       },
//       {
//         start: '2025-12-05T14:30:00-08:00',
//         end: '2025-12-05T15:00:00-08:00',
//         score: 95.67063125,
//       },
//       {
//         start: '2025-12-05T15:00:00-08:00',
//         end: '2025-12-05T15:30:00-08:00',
//         score: 95.42063138888889,
//       },
//       {
//         start: '2025-12-05T15:30:00-08:00',
//         end: '2025-12-05T16:00:00-08:00',
//         score: 95.17063138888889,
//       },
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.92063138888889,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.67063138888889,
//       },
//       {
//         start: '2025-12-08T08:00:00-08:00',
//         end: '2025-12-08T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T08:30:00-08:00',
//         end: '2025-12-08T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T11:30:00-08:00',
//         end: '2025-12-08T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:00:00-08:00',
//         end: '2025-12-08T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:30:00-08:00',
//         end: '2025-12-08T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:00:00-08:00',
//         end: '2025-12-08T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:30:00-08:00',
//         end: '2025-12-08T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:00:00-08:00',
//         end: '2025-12-08T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:30:00-08:00',
//         end: '2025-12-08T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:00:00-08:00',
//         end: '2025-12-08T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:30:00-08:00',
//         end: '2025-12-08T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:00:00-08:00',
//         end: '2025-12-09T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:30:00-08:00',
//         end: '2025-12-09T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T11:30:00-08:00',
//         end: '2025-12-09T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:00:00-08:00',
//         end: '2025-12-09T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:30:00-08:00',
//         end: '2025-12-09T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:00:00-08:00',
//         end: '2025-12-09T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:30:00-08:00',
//         end: '2025-12-09T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:00:00-08:00',
//         end: '2025-12-09T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:30:00-08:00',
//         end: '2025-12-09T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:00:00-08:00',
//         end: '2025-12-09T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:30:00-08:00',
//         end: '2025-12-09T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T11:30:00-08:00',
//         end: '2025-12-10T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:30:00-08:00',
//         end: '2025-12-10T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:30:00-08:00',
//         end: '2025-12-10T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:30:00-08:00',
//         end: '2025-12-11T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T11:30:00-08:00',
//         end: '2025-12-11T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:00:00-08:00',
//         end: '2025-12-11T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:00:00-08:00',
//         end: '2025-12-11T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:30:00-08:00',
//         end: '2025-12-11T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:00:00-08:00',
//         end: '2025-12-11T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:30:00-08:00',
//         end: '2025-12-11T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '54jc9djmi0te83k96o62nd7m8l_20251211T170000Z',
//     subject: 'Standup',
//     start: '2025-12-11T09:00:00-08:00',
//     end: '2025-12-11T09:30:00-08:00',
//     durationMinutes: 30,
//     participants: [
//       'pnowak@codestrap.me',
//       'igor@codestrap.me',
//       'dsmiley@codestrap.me',
//     ],
//     meetingLink: 'https://meet.google.com/bgh-pprj-tun',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.92062986111111,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.67062986111111,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '7h491kic47b10kd6k0bp0hj4de_20251212T120000Z',
//     subject: 'daily sync',
//     start: '2025-12-12T04:00:00-08:00',
//     end: '2025-12-12T04:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/aai-kcjj-jwy',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T08:30:00-08:00',
//         end: '2025-12-05T09:00:00-08:00',
//         score: 98.67064319444444,
//       },
//       {
//         start: '2025-12-05T11:30:00-08:00',
//         end: '2025-12-05T12:00:00-08:00',
//         score: 97.17064319444444,
//       },
//       {
//         start: '2025-12-05T12:00:00-08:00',
//         end: '2025-12-05T12:30:00-08:00',
//         score: 96.92064319444444,
//       },
//       {
//         start: '2025-12-05T12:30:00-08:00',
//         end: '2025-12-05T13:00:00-08:00',
//         score: 96.67064333333333,
//       },
//       {
//         start: '2025-12-05T13:00:00-08:00',
//         end: '2025-12-05T13:30:00-08:00',
//         score: 96.42064333333333,
//       },
//       {
//         start: '2025-12-05T13:30:00-08:00',
//         end: '2025-12-05T14:00:00-08:00',
//         score: 96.17064333333333,
//       },
//       {
//         start: '2025-12-05T14:00:00-08:00',
//         end: '2025-12-05T14:30:00-08:00',
//         score: 95.92064333333333,
//       },
//       {
//         start: '2025-12-05T14:30:00-08:00',
//         end: '2025-12-05T15:00:00-08:00',
//         score: 95.67064333333333,
//       },
//       {
//         start: '2025-12-05T15:00:00-08:00',
//         end: '2025-12-05T15:30:00-08:00',
//         score: 95.42064333333333,
//       },
//       {
//         start: '2025-12-05T15:30:00-08:00',
//         end: '2025-12-05T16:00:00-08:00',
//         score: 95.17064347222222,
//       },
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.92064347222222,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.67064347222222,
//       },
//       {
//         start: '2025-12-08T08:00:00-08:00',
//         end: '2025-12-08T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T08:30:00-08:00',
//         end: '2025-12-08T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T11:30:00-08:00',
//         end: '2025-12-08T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:00:00-08:00',
//         end: '2025-12-08T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:30:00-08:00',
//         end: '2025-12-08T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:00:00-08:00',
//         end: '2025-12-08T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:30:00-08:00',
//         end: '2025-12-08T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:00:00-08:00',
//         end: '2025-12-08T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:30:00-08:00',
//         end: '2025-12-08T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:00:00-08:00',
//         end: '2025-12-08T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:30:00-08:00',
//         end: '2025-12-08T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:00:00-08:00',
//         end: '2025-12-09T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:30:00-08:00',
//         end: '2025-12-09T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T11:30:00-08:00',
//         end: '2025-12-09T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:00:00-08:00',
//         end: '2025-12-09T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:30:00-08:00',
//         end: '2025-12-09T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:00:00-08:00',
//         end: '2025-12-09T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:30:00-08:00',
//         end: '2025-12-09T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:00:00-08:00',
//         end: '2025-12-09T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:30:00-08:00',
//         end: '2025-12-09T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:00:00-08:00',
//         end: '2025-12-09T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:30:00-08:00',
//         end: '2025-12-09T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T11:30:00-08:00',
//         end: '2025-12-10T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:30:00-08:00',
//         end: '2025-12-10T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:30:00-08:00',
//         end: '2025-12-10T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:30:00-08:00',
//         end: '2025-12-11T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T11:30:00-08:00',
//         end: '2025-12-11T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:00:00-08:00',
//         end: '2025-12-11T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:00:00-08:00',
//         end: '2025-12-11T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:30:00-08:00',
//         end: '2025-12-11T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:00:00-08:00',
//         end: '2025-12-11T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:30:00-08:00',
//         end: '2025-12-11T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '54jc9djmi0te83k96o62nd7m8l_20251212T170000Z',
//     subject: 'Standup',
//     start: '2025-12-12T09:00:00-08:00',
//     end: '2025-12-12T09:30:00-08:00',
//     durationMinutes: 30,
//     participants: [
//       'pnowak@codestrap.me',
//       'igor@codestrap.me',
//       'dsmiley@codestrap.me',
//     ],
//     meetingLink: 'https://meet.google.com/bgh-pprj-tun',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.92063513888888,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.67063513888888,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
// ];
