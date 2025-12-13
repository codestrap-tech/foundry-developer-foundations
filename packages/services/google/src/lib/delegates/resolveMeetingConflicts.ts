import type {
  CalendarSummary,
  EventSummary,
  ProposeMeetingConflictResolutionsInput,
  ProposeMeetingConflictResolutionsOutput,
} from '@codestrap/developer-foundations-types';
import type { calendar_v3 } from 'googleapis';
import { findOptimalMeetingTimeV2 } from './findOptimalMeetingTime.v2';
import { workingHoursUTCForDate } from '@codestrap/developer-foundations-utils';

export async function proposeMeetingConflictResolutionsDelegate(
  args: ProposeMeetingConflictResolutionsInput & {
    calendar: calendar_v3.Calendar;
    calendarSummaries: CalendarSummary[];
  },
): Promise<ProposeMeetingConflictResolutionsOutput> {
  const calendarSummariesWithConflicts = args.calendarSummaries.map(
    (summary) => {
      return {
        ...summary,
        events: summary.events.filter((eventA) => {
          return summary.events.some((eventB) => {
            return (
              eventA.id !== eventB.id &&
              Date.parse(eventA.start) < Date.parse(eventB.end) &&
              Date.parse(eventA.end) > Date.parse(eventB.start)
            );
          });
        }),
      };
    },
  );

  const allEvents = calendarSummariesWithConflicts.flatMap((summary) =>
    summary.events.map((event) => ({
      email: summary.email,
      ...event,
    })),
  );

  return await Promise.all(
    allEvents.map(async (event) => {
      try {
        const resolutionBlocks = await fetchResolutionBlocks(event);
        return {
          ...event,
          resolutionBlocks,
        };
      } catch (e) {
        console.error(
          `Error fetching resolution blocks for event ${event.id}: ${e}`,
        );
        return {
          ...event,
          resolutionBlocks: [],
        };
      }
    }),
  );

  function fetchResolutionBlocks(event: EventSummary) {
    const workingHours = workingHoursUTCForDate(
      args.timeFrameFrom,
      args.timezone,
      8,
      17,
    );

    return findOptimalMeetingTimeV2({
      calendar: args.calendar,
      attendees: event.participants,
      timezone: args.timezone,
      windowStartUTC: args.timeFrameFrom,
      windowEndUTC: args.timeFrameTo,
      durationMinutes: event.durationMinutes,
      workingHours,
    });
  }
}
