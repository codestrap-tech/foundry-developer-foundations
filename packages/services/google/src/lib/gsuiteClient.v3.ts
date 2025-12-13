// v3 client
import { google } from 'googleapis';

import { makeGSuiteClientV2 } from './gsuiteClient.v2';
import { proposeMeetingConflictResolutionsDelegate } from './delegates/resolveMeetingConflicts';
import type {
  OfficeServiceV3,
  ProposeMeetingConflictResolutionsInput,
  ProposeMeetingConflictResolutionsOutput,
  CreateGoogleSlidesInput,
  CreateGoogleSlidesOutput,
} from '@codestrap/developer-foundations-types';
import { createGoogleSlidesDelegate } from './delegates/createGoogleSlides';
import {
  loadServiceAccountFromEnv,
  makeGoogleAuth,
} from './helpers/googleAuth';

export async function makeGSuiteClientV3(
  user: string,
): Promise<OfficeServiceV3> {
  const v2Client = await makeGSuiteClientV2(user);

  // --- Slides client setup (similar to drive client in v2) ---
  const credentials = await loadServiceAccountFromEnv();

  const slidesScopes = [
    'https://www.googleapis.com/auth/presentations',
    // for copying/updating slide decks we typically also need a Drive scope:
    'https://www.googleapis.com/auth/drive',
  ];

  const driveScopes = [
    // for copying/updating slide decks we typically also need a Drive scope:
    'https://www.googleapis.com/auth/drive',
  ];

  const slidesAuth = makeGoogleAuth(credentials, slidesScopes, user);

  const slidesClient = google.slides({
    version: 'v1',
    auth: slidesAuth,
  });
  const driveAuth = makeGoogleAuth(credentials, driveScopes, user);

  const driveClient = google.drive({ version: 'v3', auth: driveAuth });

  return {
    ...v2Client,
    proposeMeetingConflictResolutions: async (
      args: ProposeMeetingConflictResolutionsInput,
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

      return result;
    },
    createGoogleSlides: async (
      input: CreateGoogleSlidesInput,
    ): Promise<CreateGoogleSlidesOutput> => {
      return createGoogleSlidesDelegate({
        input,
        // note: this uses the drive client created in v2
        drive: driveClient,
        slides: slidesClient,
      });
    },
  };
}
