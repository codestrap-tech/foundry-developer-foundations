import { google, calendar_v3 } from 'googleapis';
import { createOAuth2Client } from './google-oauth';
import { getUserTokens, saveUserTokens } from './token-storage';
import { UserTokens } from '../types/tokens';

/**
 * Create an authenticated OAuth2 client for a user.
 * Handles token refresh automatically.
 */
export async function getAuthenticatedClient(userId: string) {
  const tokens = await getUserTokens(userId);
  if (!tokens) {
    throw new Error(`No tokens found for user ${userId}`);
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate,
  });

  // Listen for token refresh events and save updated tokens
  oauth2Client.on('tokens', async (newTokens) => {
    const updatedTokens: UserTokens = {
      ...tokens,
      accessToken: newTokens.access_token || tokens.accessToken,
      refreshToken: newTokens.refresh_token || tokens.refreshToken,
      expiryDate: newTokens.expiry_date || tokens.expiryDate,
    };
    await saveUserTokens(updatedTokens);
  });

  return oauth2Client;
}

/**
 * Get today's calendar events for a user.
 */
export async function getTodayEvents(userId: string): Promise<calendar_v3.Schema$Event[]> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

/**
 * Find events with a specific name.
 */
export function findEventsByName(events: calendar_v3.Schema$Event[], name: string): calendar_v3.Schema$Event[] {
  return events.filter(event => 
    event.summary?.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Parse the update counter from an event description.
 * Returns 0 if no counter is found.
 */
export function parseUpdateCounter(description: string | null | undefined): number {
  if (!description) return 0;
  
  const match = description.match(/Updated (\d+) times?/i);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Update the counter in an event description.
 */
export function updateDescriptionCounter(description: string | null | undefined, newCount: number): string {
  const counterText = `Updated ${newCount} time${newCount === 1 ? '' : 's'}`;
  
  if (!description) {
    return counterText;
  }
  
  // Replace existing counter or append new one
  const existingMatch = description.match(/Updated \d+ times?/i);
  if (existingMatch) {
    return description.replace(/Updated \d+ times?/i, counterText);
  }
  
  return `${description}\n\n${counterText}`;
}

/**
 * Reschedule an event by shifting its time +/- 15 minutes randomly.
 * Also updates the description with a counter.
 */
export async function rescheduleEvent(
  userId: string,
  event: calendar_v3.Schema$Event
): Promise<calendar_v3.Schema$Event> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  // Determine random shift: +15 or -15 minutes
  const shiftMinutes = Math.random() < 0.5 ? -15 : 15;
  
  // Calculate new start and end times
  const startDateTime = event.start?.dateTime;
  const endDateTime = event.end?.dateTime;
  
  if (!startDateTime || !endDateTime) {
    throw new Error('Event does not have dateTime (may be an all-day event)');
  }

  const newStart = new Date(new Date(startDateTime).getTime() + shiftMinutes * 60 * 1000);
  const newEnd = new Date(new Date(endDateTime).getTime() + shiftMinutes * 60 * 1000);

  // Update the counter in description
  const currentCount = parseUpdateCounter(event.description);
  const newDescription = updateDescriptionCounter(event.description, currentCount + 1);

  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId: event.id!,
    requestBody: {
      summary: event.summary,
      description: newDescription,
      start: {
        dateTime: newStart.toISOString(),
        timeZone: event.start?.timeZone,
      },
      end: {
        dateTime: newEnd.toISOString(),
        timeZone: event.end?.timeZone,
      },
    },
  });

  console.log(`Rescheduled event "${event.summary}" by ${shiftMinutes} minutes. Update count: ${currentCount + 1}`);
  
  return response.data;
}

