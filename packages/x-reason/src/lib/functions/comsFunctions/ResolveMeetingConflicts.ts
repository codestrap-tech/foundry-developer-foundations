import {
  Context,
  MachineEvent,
  OfficeServiceV3,
  ProposeMeetingConflictResolutionsInput,
} from '@codestrap/developer-foundations-types';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';
import { GeminiService, TYPES } from '@codestrap/developer-foundations-types';

export async function resolveMeetingConflicts(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<{ message: string }> {
  const timeZone = 'America/Los_Angeles';

  const system = `You are a helpful virtual assistant tasked with identifying meeting conflicts for specified users and resolving them.
    You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Vickie, Code's AI EA" or similar. 
    You can get creative on your greeting, taking into account the day of the week. Today is ${new Date().toLocaleDateString(
      'en-US',
      { weekday: 'long' }
    )}. 
    You can also take into account the time of year such as American holidays like Halloween, Thanksgiving, Christmas, etc. 
    The current local date/time is ${new Date().toLocaleString('en-US', {
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

The complete task list which may contain additional information about the conflict resolution request:
${context.solution}


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

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);

  const response = await geminiService(user, system);

  const clean = extractJsonFromBackticks(response);

  const parsed = JSON.parse(clean) as {
    users: string[];
    timeFrameFrom: string;
    timeFrameTo: string;
  };

  const users = parsed.users;
  const codeStrapUsers = users.filter(
    (user) =>
      user.indexOf('codestrap.me') >= 0 || user.indexOf('codestrap.com') >= 0
  );

  const input: ProposeMeetingConflictResolutionsInput = {
    userEmails: codeStrapUsers,
    timeFrameFrom: new Date(parsed.timeFrameFrom),
    timeFrameTo: new Date(parsed.timeFrameTo),
    timezone: 'America/Los_Angeles',
  };

  const officeService = await container.getAsync<OfficeServiceV3>(
    TYPES.OfficeServiceV3
  );

  const identifyResult = await officeService.proposeMeetingConflictResolutions(
    input
  );

  return {
    message: `${
      identifyResult.length
    } conflicts have been identified with possible resolutions for users ${users.join(
      ', '
    )} for the time frame from ${parsed.timeFrameFrom} to ${
      parsed.timeFrameTo
    }.`,
  };
}
