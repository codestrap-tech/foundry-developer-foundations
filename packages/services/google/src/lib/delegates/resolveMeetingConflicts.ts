import {
  CalendarSummary,
  EventSummary,
  ProposeMeetingConflictResolutionsInput,
  ProposeMeetingConflictResolutionsOutput,
} from '@codestrap/developer-foundations-types';
import { calendar_v3 } from 'googleapis';
import { findOptimalMeetingTimeV2 } from './findOptimalMeetingTime.v2';
import { workingHoursUTCForDate } from '@codestrap/developer-foundations-utils';

export async function proposeMeetingConflictResolutionsDelegate(
  args: ProposeMeetingConflictResolutionsInput & {
    calendar: calendar_v3.Calendar;
    calendarSummaries: CalendarSummary[];
  }
): Promise<ProposeMeetingConflictResolutionsOutput> {
  const flatEvents = args.calendarSummaries.flatMap((summary) =>
    summary.events.map((event) => ({
      email: summary.email,
      ...event,
    }))
  );

  return await Promise.all(
    flatEvents.map(async (event) => {
      const resolutionBlocks = await fetchResolutionBlocks(event);
      return {
        meetingId: event.id,
        resolutionBlocks: resolutionBlocks.map((block) => ({
          start: block.start,
          end: block.end,
        })),
      };
    })
  );

  function fetchResolutionBlocks(event: EventSummary) {
    const workingHours = workingHoursUTCForDate(
      args.timeFrameFrom,
      args.timezone,
      8,
      17
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
