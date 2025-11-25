import {
    Context,
    MachineEvent,
    OfficeServiceV2,
    MeetingSearchContext,
    MeetingSearchResult,
    MeetingDetails,
    DriveSearchParams,
    DriveDateField,
    EventSummary,
  } from '@codestrap/developer-foundations-types';
  import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
  import { container } from '@codestrap/developer-foundations-di';
  import { GeminiService, TYPES } from '@codestrap/developer-foundations-types';
  
  async function extractMeetingSearchContext(
    task?: string
  ): Promise<MeetingSearchContext> {
    const system = `You are a helpful AI assistant that extracts meeting search parameters from user queries.`;
    
    const userPrompt = `
      Extract meeting search parameters from: "${task}"
      
      Return JSON:
      {
        "attendees": ["email1@domain.com", "email2@domain.com"],
        "operator": "and" | "or",
        "timeframe": "next" | "previous",
        "timeRangeDays": number (only if explicitly mentioned)
      }
      
      Examples:
      "When is my next meeting with Dorian Smiley <dsmiley@codestrap.me> or Ryan Goodwin <ryan@codestrap.me>?" → {"attendees": ["dsmiley@codestrap.me", "ryan@codestrap.me"], "operator": "or", "timeframe": "next"}
      "When is my next meeting with Dorian Smiley <dsmiley@codestrap.me> and Ryan Goodwin <ryan@codestrap.me>?" → {"attendees": ["dsmiley@codestrap.me", "ryan@codestrap.me"], "operator": "and", "timeframe": "next"}
      "When was my last meeting with Ryan Goodwin <ryan@codestrap.me> in the last month?" → {"attendees": ["ryan@codestrap.me"], "operator": "or", "timeframe": "previous", "timeRangeDays": 30}
    `;
    
    const geminiService = container.get<GeminiService>(TYPES.GeminiService);
    const response = await geminiService(userPrompt, system);
    const clean = extractJsonFromBackticks(response);
    return JSON.parse(clean);
  }
  
  function matchesAttendeeCriteria(
    event: EventSummary,
    attendees: string[],
    operator: 'and' | 'or'
  ): boolean {
    const eventAttendees = event.participants.map(email => email.toLowerCase());
    const searchAttendees = attendees.map(email => email.toLowerCase());
    
    if (operator === 'and') {
      return searchAttendees.every(attendee => eventAttendees.includes(attendee));
    } else {
      return searchAttendees.some(attendee => eventAttendees.includes(attendee));
    }
  }
  
  function findClosestMeeting(events: EventSummary[]): EventSummary | null {
    if (events.length === 0) return null;
  
    const now = new Date();
    return events.reduce((closest, current) => {
      const closestTime = new Date(closest.start).getTime();
      const currentTime = new Date(current.start).getTime();
      const nowTime = now.getTime();
  
      const closestDiff = Math.abs(closestTime - nowTime);
      const currentDiff = Math.abs(currentTime - nowTime);
  
      return currentDiff < closestDiff ? current : closest;
    });
  }
  
  function convertToMeetingDetails(event: EventSummary): MeetingDetails {
    return {
      id: event.id,
      subject: event.subject,
      description: event.description,
      start: event.start,
      end: event.end,
      durationMinutes: event.durationMinutes,
      participants: event.participants,
      meetingLink: event.meetingLink,
    };
  }
  
  async function generateMeetingSummary(
    meeting: MeetingDetails,
    transcript?: string
  ): Promise<string> {
    const geminiService = container.get<GeminiService>(TYPES.GeminiService);
    
    const system = `You are an expert meeting summarizer. Create a concise, informative summary of the meeting based on the provided details and transcript (if available).`;
    
    const userPrompt = `
      Meeting Details:
      - Subject: ${meeting.subject}
      - Date: ${new Date(meeting.start).toLocaleString()}
      - Duration: ${meeting.durationMinutes} minutes
      - Participants: ${meeting.participants.join(', ')}
      - Description: ${meeting.description || 'No description provided'}
      - Meeting Link: ${meeting.meetingLink || 'No meeting link available'}
      
      ${transcript ? `Transcript:\n${transcript}` : 'No transcript available - provide summary based on meeting details only'}
      
      Please provide a summary that includes:
      1. Meeting overview and purpose
      2. Key discussion points (if transcript available)
      3. Decisions made (if transcript available)
      4. Action items (if transcript available)
      5. Next steps (if transcript available)
      6. Meeting logistics and participants
      
      Keep it concise but informative. For future meetings without transcripts, focus on the meeting details and logistics.
    `;
    
    return await geminiService(userPrompt, system);
  }
  
  async function findMeetingTranscript(
    officeService: OfficeServiceV2,
    meeting: MeetingDetails
  ): Promise<string | null> {
    const meetingDate = new Date(meeting.start);
    const startOfDay = new Date(meetingDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(meetingDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    
    const keywords = [
      meeting.subject,
      'transcript',
      'notes',
      'gemini',
      'meeting'
    ].filter(Boolean);
    
    const searchParams: DriveSearchParams = {
      keywords,
      dateRange: {
        startDate: startOfDay,
        endDate: endOfDay,
        field: DriveDateField.MODIFIED_TIME
      },
      trashed: false,
      pageSize: 10,
      orderBy: 'modifiedTime desc'
    };
    
    const searchResult = await officeService.searchDriveFiles(searchParams);  
    
    if (searchResult.files.length === 0) {
      return null;
    }
    
    // Find the most relevant file (first result is most relevant due to ordering)
    const mostRelevantFile = searchResult.files[0];
    
    // Retrieve file content
    const driveClient = officeService.getDriveClient();
    const fileContent = await driveClient.files.get({
      fileId: mostRelevantFile.id,
      alt: 'media'
    }, { responseType: 'text' });
    
    return fileContent.data as string;
  }
  
  export async function findMeetingDetails(
    context: Context,
    event?: MachineEvent,
    task?: string
  ): Promise<MeetingSearchResult> {
    const searchContext = await extractMeetingSearchContext(task);
    
    const officeService = await container.getAsync<OfficeServiceV2>(TYPES.OfficeService);
    
    const now = new Date();
    const timeRangeDays = searchContext.timeRangeDays || 30;
    
    let windowStartLocal: Date;
    let windowEndLocal: Date;
    
    if (searchContext.timeframe === 'previous') {
      windowStartLocal = new Date(now.getTime() - (timeRangeDays * 24 * 60 * 60 * 1000));
      windowEndLocal = now;
    } else {
      windowStartLocal = now;
      windowEndLocal = new Date(now.getTime() + (timeRangeDays * 24 * 60 * 60 * 1000));
    }
    
    const calendarResult = await officeService.summarizeCalendars({
      emails: ['primary'],
      timezone: 'UTC',
      windowStartLocal,
      windowEndLocal
    });
    
    const allEvents = calendarResult.calendars.flatMap(cal => cal.events);
    const filteredEvents = allEvents.filter(event => 
      matchesAttendeeCriteria(event, searchContext.attendees, searchContext.operator)
    );
    
    const closestEvent = findClosestMeeting(filteredEvents);
    
    if (!closestEvent) {
      return { 
        found: false, 
        message: `No ${searchContext.timeframe} meetings found with ${searchContext.attendees.join(', ')}`,
        meeting: null 
      };
    }
    
    const meetingDetails = convertToMeetingDetails(closestEvent);
    
    const transcript = await findMeetingTranscript(officeService, meetingDetails);
    
    const summary = await generateMeetingSummary(meetingDetails, transcript ?? undefined);
    
    return {
      found: true,
      meeting: meetingDetails,
      transcript: transcript ?? undefined,
      summary,
      message: `Found ${searchContext.timeframe} meeting with ${searchContext.attendees.join(', ')}`
    };
  }
  