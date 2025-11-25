import type {
  MeetingRequest,
  OfficeServiceV2,
  Summaries,
  DriveSearchParams,
  DriveSearchOutput,
} from '@codestrap/developer-foundations-types';
import { makeGSuiteClient } from './gsuiteClient';

import { findOptimalMeetingTimeV2 } from './delegates/findOptimalMeetingTime.v2';
import { deriveWindowFromTimeframe } from './delegates/deriveWindowFromTimeframe';
import { summarizeCalendars } from './delegates/summerizeCalanders';
import { searchDriveFiles } from './delegates/searchDriveFiles';
import { wallClockToUTC, workingHoursUTCForDate } from '@codestrap/developer-foundations-utils';
import { google } from 'googleapis';
import { loadServiceAccountFromEnv, makeGoogleAuth } from './helpers/googleAuth';

export async function makeGSuiteClientV2(
  user: string
): Promise<OfficeServiceV2> {
  const v1Client = await makeGSuiteClient(user);

  const credentials = await loadServiceAccountFromEnv();

  const driveScopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ];

  const driveAuth = makeGoogleAuth(credentials, driveScopes, user);

  const driveClient = google.drive({ version: 'v3', auth: driveAuth });

  return {
    ...v1Client,
    summarizeCalendars: async (args: {
      emails: string[];
      timezone: string;
      windowStartLocal: Date;
      windowEndLocal: Date;
    }): Promise<Summaries> => {
      const result = await summarizeCalendars({
        ...args,
        calendar: v1Client.getCalendarClient(),
      });

      return result;
    },
    getAvailableMeetingTimes: async (
      meetingRequest: MeetingRequest
    ): Promise<{
      message: string;
      suggested_times: { start: string; end: string; score: number }[];
    }> => {
      // TODO, get the TZ from the user profile
      const timezone = 'America/Los_Angeles';

      // "now" as an absolute UTC instant (portable across machines)
      const nowUTC = new Date();

      // Compute UTC working hours for *today in the target tz* (e.g., 08:00–17:00 local)
      const workingHours = workingHoursUTCForDate(nowUTC, timezone, 8, 17);

      if (meetingRequest.timeframe_context === 'user defined exact date/time') {
        //localDateString
        meetingRequest.localDateString = wallClockToUTC(meetingRequest.localDateString!, timezone).toISOString();
      }

      // Ensure the request carries the UTC hours we just computed
      const req = { ...meetingRequest, working_hours: workingHours };

      console.log(`calling deriveWindowFromTimeframe`, { req, timezone, nowUTC: nowUTC.toISOString() });

      const { windowStartLocal, windowEndLocal, slotStepMinutes } =
        deriveWindowFromTimeframe(req);
      console.log(`deriveWindowFromTimeframe returned start time of ${windowStartLocal} and end time of ${windowEndLocal}`)

      const slots = await findOptimalMeetingTimeV2({
        calendar: v1Client.getCalendarClient(),
        attendees: meetingRequest.participants,
        timezone,
        windowStartUTC: windowStartLocal,
        windowEndUTC: windowEndLocal,
        durationMinutes: meetingRequest.duration_minutes,
        workingHours,
        slotStepMinutes,
        skipFriday: false,
      });

      const suggested_times = slots.map((s) => ({
        start: s.start,
        end: s.end,
        score: s.score ?? 0,
      }));

      return {
        message: `Found ${suggested_times.length} suggested times`,
        suggested_times,
      };
    },
    searchDriveFiles: async (params: DriveSearchParams): Promise<DriveSearchOutput> => {
      const result = await searchDriveFiles(driveClient, params);

      return {
        message: `Found ${result.files.length} files matching your search criteria`,
        files: result.files,
        totalResults: result.files.length,
        nextPageToken: result.nextPageToken,
        incompleteSearch: result.incompleteSearch,
      };
    },
    getDriveClient: () => driveClient,
  };
}
