import { makeGSuiteClient } from "./gsuiteClient";
import { makeGSuiteClientV2 } from "./gsuiteClient.v2";
import { resolveMeetingConflictsDelegate } from "./delegates/resolveMeetingConflicts";
import {
  ResolveMeetingConflictsInput,
  ResolveMeetingConflictsOutput,
} from "@codestrap/developer-foundations-types";
import { calendar_v3 } from "googleapis";

/**
 * makeGSuiteClientV3 extends V2 adding resolveMeetingConflicts API.
 */
export async function makeGSuiteClientV3(user: string) {
  const v2 = await makeGSuiteClientV2(user);
  const v1 = await makeGSuiteClient(user);

  return {
    ...v2,
    resolveMeetingConflicts: async (
      userEmails: string[] | ResolveMeetingConflictsInput
    ): Promise<ResolveMeetingConflictsOutput> => {
      const input: ResolveMeetingConflictsInput = Array.isArray(userEmails)
        ? { userEmails }
        : (userEmails as ResolveMeetingConflictsInput);

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
            successfullyRescheduled: 0,
            failedToReschedule: 0,
            noActionTaken: 0,
          },
          errors: ["Invalid input: userEmails array cannot be empty."],
        };
      }

      // determine day window: default to today in user's timezone (approx using local)
      const now = input.targetDayISO
        ? new Date(input.targetDayISO)
        : new Date();
      const windowStartLocal = new Date(now);
      windowStartLocal.setHours(0, 0, 0, 0);
      const windowEndLocal = new Date(now);
      windowEndLocal.setHours(23, 59, 59, 999);

      // delegate does heavy lifting
      const result = await resolveMeetingConflictsDelegate({
        calendarClient: v1.getCalendarClient() as calendar_v3.Calendar,
        userEmails: input.userEmails,
        timezone: "UTC", // best-effort; delegate may use per-user tz in future
        windowStartLocal,
        windowEndLocal,
        confirm: input.confirm,
      });

      return result;
    },
  };
}
