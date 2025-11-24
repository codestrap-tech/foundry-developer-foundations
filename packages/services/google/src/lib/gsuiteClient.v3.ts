import { makeGSuiteClientV2 } from './gsuiteClient.v2';
import { proposeMeetingConflictResolutionsDelegate } from './delegates/resolveMeetingConflicts';
import {
  OfficeServiceV3,
  ProposeMeetingConflictResolutionsInput,
  ProposeMeetingConflictResolutionsOutput,
} from '@codestrap/developer-foundations-types';

export async function makeGSuiteClientV3(
  user: string
): Promise<OfficeServiceV3> {
  const v2Client = await makeGSuiteClientV2(user);

  return {
    ...v2Client,
    proposeMeetingConflictResolutions: async (
      args: ProposeMeetingConflictResolutionsInput
    ): Promise<ProposeMeetingConflictResolutionsOutput> => {
      const calendarSummaries = await v2Client.summarizeCalendars({
        emails: args.userEmails,
        timezone: args.timezone,
        windowStartLocal: args.timeFrameFrom,
        windowEndLocal: args.timeFrameTo,
      });

      const result = await proposeMeetingConflictResolutionsDelegate({
        ...args,
        calendar: v2Client.getCalendarClient(),
        calendarSummaries: calendarSummaries.calendars,
      });
      console.log(
        '🚀 ~ makeGSuiteClientV3 ~ result:',
        JSON.stringify(result, null, 2)
      );

      return result;
    },
  };
}
