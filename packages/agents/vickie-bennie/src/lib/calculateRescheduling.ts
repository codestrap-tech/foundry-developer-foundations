import {
  ProposedTimeSlot,
  MeetingConflictResolutionProposals,
  ResolvedMeeting,
} from '@codestrap/developer-foundations-types';

/**
 * Main Algorithm: Greedy Schedule Resolver
 * 1. Iterates through meetings based on input priority (Index 0 = Highest).
 * 2. For each meeting, sorts resolution blocks by score (Highest score = Best slot).
 * 3. Checks against a "Master Schedule" of booked slots to prevent double-booking.
 */
export function rescheduleConflictingMeetings(
  meetings: MeetingConflictResolutionProposals
): ResolvedMeeting[] {
  const resolvedMeetings: ResolvedMeeting[] = [];
  const bookedSlots: ProposedTimeSlot[] = [];

  // 1. Iterate sequentially (Priority is determined by array order)
  for (const { resolutionBlocks, ...meeting } of meetings) {
    // Create a copy of the meeting for the result
    const currentResult: ResolvedMeeting = {
      ...meeting,
      status: 'UNRESOLVED',
    };

    // 2. Sort resolution blocks by score descending.
    // We want to try the "best" quality slot first.
    const sortedBlocks = [...resolutionBlocks].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0)
    );

    for (const block of sortedBlocks) {
      const blockStart = new Date(block.start).getTime();
      const blockEnd = new Date(block.end).getTime();

      // 3. Collision Detection
      // Check if this specific block overlaps with ANY previously booked slot
      const hasConflict = bookedSlots.some((booked) =>
        doIntervalsOverlap(blockStart, blockEnd, booked.start, booked.end)
      );

      if (!hasConflict) {
        // SUCCESS: We found a valid slot for this meeting

        // A. Add to Booked Registry (so lower priority meetings can't take it)
        bookedSlots.push({
          start: blockStart,
          end: blockEnd,
          meetingId: meeting.id,
        });

        // B. Update Result Object
        currentResult.rescheduledTo = block;
        currentResult.status = 'SCHEDULED';

        // Stop looking at other blocks for this specific meeting
        break;
      }
    }

    resolvedMeetings.push(currentResult);
  }

  return resolvedMeetings;
}

function doIntervalsOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && start2 < end1;
}
