import { makeGSuiteClientV2 } from './gsuiteClient.v2';
import {
  identifyMeetingConflictsDelegate,
  proposeMeetingConflictResolutionsDelegate,
} from './delegates/resolveMeetingConflicts';
import {
  IdentifyMeetingConflictsInput,
  IdentifyMeetingConflictsOutput,
  ProposeMeetingConflictResolutionsInput,
  ProposeMeetingConflictResolutionsOutput,
} from '@codestrap/developer-foundations-types';
import { calendar_v3 } from 'googleapis';

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Returns the end of the working week (Friday 23:59:59.999 local time)
 * for the week containing the provided date.
 */
function calculateEndOfWorkingWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday

  // We treat Friday as the end of the working week.
  const daysUntilFriday = (5 - day + 7) % 7;
  const friday = new Date(d);
  friday.setDate(d.getDate() + daysUntilFriday);
  return endOfDayLocal(friday);
}

/**
 * Derive a time window from the various input fields.
 *
 * Backwards compatibility:
 * - If targetDayISO is provided, we continue to treat it as a single-day window.
 *
 * New behavior:
 * - If timeFrameStartISO/timeFrameEndISO are provided, they define the window.
 * - If only timeFrameStartISO is provided, default end to one week after start.
 * - If no explicit fields are provided, default to today through the end
 *   of the current working week.
 */
function deriveWindowFromInput(input: {
  targetDayISO?: string;
  timeFrameStartISO?: string;
  timeFrameEndISO?: string;
}): { windowStartLocal: Date; windowEndLocal: Date } {
  // Preserve existing behavior when targetDayISO is used.
  if (input.targetDayISO) {
    const day = new Date(input.targetDayISO);
    return {
      windowStartLocal: startOfDayLocal(day),
      windowEndLocal: endOfDayLocal(day),
    };
  }

  const today = new Date();

  // If explicit start/end are provided, respect them.
  if (input.timeFrameStartISO || input.timeFrameEndISO) {
    const start = input.timeFrameStartISO
      ? startOfDayLocal(new Date(input.timeFrameStartISO))
      : startOfDayLocal(today);

    const end = input.timeFrameEndISO
      ? endOfDayLocal(new Date(input.timeFrameEndISO))
      : endOfDayLocal(
          new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
        );

    return { windowStartLocal: start, windowEndLocal: end };
  }

  // Default: today through end of working week.
  const windowStartLocal = startOfDayLocal(today);
  const windowEndLocal = calculateEndOfWorkingWeek(today);

  return { windowStartLocal, windowEndLocal };
}

/**
 * makeGSuiteClientV3 extends V2 adding meeting conflict identification and proposal APIs.
 */
export async function makeGSuiteClientV3(user: string) {
  const v2 = await makeGSuiteClientV2(user);

  return {
    ...v2,
    identifyMeetingConflicts: async (
      input: IdentifyMeetingConflictsInput
    ): Promise<IdentifyMeetingConflictsOutput> => {
      if (
        !input.userEmails ||
        !Array.isArray(input.userEmails) ||
        input.userEmails.length === 0
      ) {
        return {
          identifiedConflicts: [],
          message: 'Invalid input: userEmails array cannot be empty.',
        };
      }

      // determine time window (defaults to today through the end of the
      // current working week when no explicit time frame is provided)
      const { windowStartLocal, windowEndLocal } = deriveWindowFromInput(
        input as any
      );

      const result = await identifyMeetingConflictsDelegate({
        calendarClient: v2.getCalendarClient() as calendar_v3.Calendar,
        userEmails: input.userEmails,
        timezone: 'UTC',
        windowStartLocal,
        windowEndLocal,
      });

      return result;
    },
    proposeMeetingConflictResolutions: async (
      input: ProposeMeetingConflictResolutionsInput
    ): Promise<ProposeMeetingConflictResolutionsOutput> => {
      // If identifiedConflicts are provided, we can skip userEmails validation
      if (
        !input.identifiedConflicts ||
        input.identifiedConflicts.length === 0
      ) {
        if (
          !input.userEmails ||
          !Array.isArray(input.userEmails) ||
          input.userEmails.length === 0
        ) {
          return {
            identifiedConflicts: [],
            resolutionReports: [],
            summary: {
              totalConflicts: 0,
              proposalsGenerated: 0,
              invalidProposals: 0,
              validProposals: 0,
            },
            errors: ['Invalid input: userEmails array cannot be empty.'],
          };
        }
      }

      // determine time window: default to today through the end of the
      // current working week when no explicit time frame is provided
      const { windowStartLocal, windowEndLocal } = deriveWindowFromInput(
        input as any
      );

      const result = await proposeMeetingConflictResolutionsDelegate({
        calendarClient: v2.getCalendarClient() as calendar_v3.Calendar,
        userEmails: input.userEmails || [],
        timezone: 'UTC',
        windowStartLocal,
        windowEndLocal,
        identifiedConflicts: input.identifiedConflicts,
        fullDayCalendars: input.fullDayCalendars,
      });

      return result;
    },
  };
}
