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
export async function performRescheduling(
  identifyResult: ProposeMeetingConflictResolutionsOutput,
  codeStrapUsers: string[],
  officeService: OfficeService
): Promise<{ scheduledCount: number; errors: string[] }> {
  let scheduledCount = 0;
  const scheduledMeetings: string[] = [];
  const errors: string[] = [];

  // For each conflict with resolution blocks, schedule a meeting
  for (const conflict of identifyResult) {
    if (conflict.resolutionBlocks && conflict.resolutionBlocks.length > 0) {
      const firstBlock = conflict.resolutionBlocks[0];
      try {
        const schedulingResult = await officeService.scheduleMeeting({
          summary: `Resolved Meeting Conflict - ${conflict.meetingId}`,
          description: `Meeting scheduled to resolve conflict for meeting ${conflict.meetingId}`,
          start: firstBlock.start,
          end: firstBlock.end,
          attendees: codeStrapUsers,
        });

        scheduledCount++;
        scheduledMeetings.push(
          `Meeting ${conflict.meetingId} scheduled: ${schedulingResult.htmlLink}`
        );
      } catch (e) {
        const errorMsg = `Failed to schedule meeting for conflict ${
          conflict.meetingId
        }: ${(e as Error).message}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  }
  return { scheduledCount, errors };
}

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

    // Perform rescheduling
    const { scheduledCount, errors } = await performRescheduling(
      identifyResult,
      codeStrapUsers,
      officeService
    );

    const message = `${
      identifyResult.length
    } conflicts have been identified with possible resolutions for users ${users.join(
      ', '
    )} for the time frame from ${parsed.timeFrameFrom} to ${
      parsed.timeFrameTo
    }. ${scheduledCount} meeting(s) scheduled.${
      errors.length > 0 ? ` Errors: ${errors.join('; ')}` : ''
    }`;

    return {
      status: errors.length > 0 && scheduledCount === 0 ? 400 : 200,
      executionId: uuidv4(),
      message,
      error: errors.length > 0 ? errors.join('; ') : '',
      taskList: '',
    };
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
