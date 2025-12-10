import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTodayEvents } from '../../../lib/calendar-service';

/**
 * GET /api/events
 * Returns today's calendar events for the logged-in user.
 */
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('userId')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const events = await getTodayEvents(userId);

    // Map events to a simpler format for the frontend
    const formattedEvents = events.map((event) => ({
      id: event.id,
      summary: event.summary || 'Untitled Event',
      description: event.description,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      htmlLink: event.htmlLink,
    }));

    return NextResponse.json({
      success: true,
      events: formattedEvents,
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
