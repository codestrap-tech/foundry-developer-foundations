import { NextResponse } from 'next/server';
import { getAllUsers } from '../../../lib/token-storage';
import { getTodayEvents, findEventsByName, rescheduleEvent } from '../../../lib/calendar-service';

const TARGET_EVENT_NAME = 'test event';

/**
 * GET /api/reschedule
 * CRON endpoint (no authentication required).
 * Fetches today's events for all stored users, finds "test event" events,
 * and reschedules them +/- 15 minutes randomly.
 */
export async function GET() {
  try {
    const users = await getAllUsers();
    
    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users found with stored tokens',
        rescheduledEvents: 0,
      });
    }

    const results: Array<{
      userId: string;
      email: string;
      eventsRescheduled: number;
      errors: string[];
    }> = [];

    for (const user of users) {
      const userResult = {
        userId: user.userId,
        email: user.email,
        eventsRescheduled: 0,
        errors: [] as string[],
      };

      try {
        // Get today's events for this user
        const todayEvents = await getTodayEvents(user.userId);
        
        // Find events named "test event"
        const targetEvents = findEventsByName(todayEvents, TARGET_EVENT_NAME);
        
        console.log(`Found ${targetEvents.length} "${TARGET_EVENT_NAME}" events for user ${user.email}`);

        // Reschedule each matching event
        for (const event of targetEvents) {
          try {
            await rescheduleEvent(user.userId, event);
            userResult.eventsRescheduled++;
          } catch (eventError) {
            const errorMessage = eventError instanceof Error ? eventError.message : 'Unknown error';
            userResult.errors.push(`Failed to reschedule event ${event.id}: ${errorMessage}`);
            console.error(`Error rescheduling event ${event.id}:`, eventError);
          }
        }
      } catch (userError) {
        const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
        userResult.errors.push(`Failed to process user: ${errorMessage}`);
        console.error(`Error processing user ${user.email}:`, userError);
      }

      results.push(userResult);
    }

    const totalRescheduled = results.reduce((sum, r) => sum + r.eventsRescheduled, 0);

    return NextResponse.json({
      success: true,
      message: `Processed ${users.length} user(s), rescheduled ${totalRescheduled} event(s)`,
      rescheduledEvents: totalRescheduled,
      details: results,
    });
  } catch (error) {
    console.error('Error in reschedule endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reschedule
 * Alternative method for triggering reschedule (same logic as GET).
 */
export async function POST() {
  return GET();
}

