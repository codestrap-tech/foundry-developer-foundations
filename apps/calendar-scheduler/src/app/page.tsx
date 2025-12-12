import 'server-only';
import { cookies } from 'next/headers';
import { getUserTokens } from '../lib/token-storage';
import { getTodayEvents } from '../lib/calendar-service';
import { ClientPage } from './ClientPage';

interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  start: string | null;
  end: string | null;
  htmlLink: string | null;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;

  let isLoggedIn = false;
  let userEmail: string | null = null;
  let events: CalendarEvent[] = [];
  let fetchError: string | null = null;

  if (userId) {
    const tokens = await getUserTokens(userId);
    if (tokens) {
      isLoggedIn = true;
      userEmail = tokens.email;

      try {
        const calendarEvents = await getTodayEvents(userId);
        events = calendarEvents.map((event) => ({
          id: event.id || '',
          summary: event.summary || 'Untitled Event',
          description: event.description || null,
          start: event.start?.dateTime || event.start?.date || null,
          end: event.end?.dateTime || event.end?.date || null,
          htmlLink: event.htmlLink || null,
        }));
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        fetchError =
          error instanceof Error ? error.message : 'Failed to fetch events';
      }
    }
  }

  return (
    <ClientPage
      isLoggedIn={isLoggedIn}
      userEmail={userEmail}
      events={events}
      fetchError={fetchError}
      successMessage={params.success === 'true'}
      errorMessage={params.error}
    />
  );
}
