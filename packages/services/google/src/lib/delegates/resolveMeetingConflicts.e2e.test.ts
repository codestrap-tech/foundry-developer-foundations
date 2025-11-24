import { partsInTZ } from '@codestrap/developer-foundations-utils';
import { makeGSuiteClientV3 } from '../gsuiteClient.v3';
import type {
  CalendarSummary,
  ConflictingMeeting,
} from '@codestrap/developer-foundations-types';

if (!process.env.E2E) {
  test.skip('e2e test skipped in default run', () => {
    // won't run
  });
} else {
  describe('resolveMeetingConflicts E2E tests', () => {
    let client: Awaited<ReturnType<typeof makeGSuiteClientV3>>;

    beforeAll(async () => {
      // Force Node's wall-clock to PT so Date('YYYY-MM-DDTHH:mm:ss') is deterministic.
      process.env.TZ = 'America/Los_Angeles';
      client = await makeGSuiteClientV3(
        process.env['OFFICE_SERVICE_ACCOUNT'] || ''
      );
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should identify meeting conflicts', async () => {
      const testEmail = process.env['TEST_USER_EMAIL'] || 'dsmiley@codestrap.me';

      // Get today's date in PT timezone
      const p = partsInTZ(new Date(), 'America/Los_Angeles');
      const pad = (n: number, len = 2) => String(n).padStart(len, '0');
      const todayISO = `${p.year}-${pad(p.month)}-${pad(p.day)}`;

      console.log(`Checking conflicts for ${testEmail} on ${todayISO}`);

      const result = await client.identifyMeetingConflicts({
        userEmails: [testEmail],
        targetDayISO: todayISO,
      });

      console.log('Identified conflicts:', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      expect(Array.isArray(result.identifiedConflicts)).toBe(true);
      if (result.identifiedConflicts.length > 0) {
        console.log(`Found ${result.identifiedConflicts.length} conflicts.`);
      } else {
        console.log('No conflicts found.');
      }
    }, 60000);

    it('should propose meeting conflict resolutions with injected mock data', async () => {
      // Mock calendar data with conflicts (from unit test)
      const mockCalendars: CalendarSummary[] = [
        {
          email: 'alice@corp.com',
          events: [
            {
              id: 'event-1',
              subject: 'Team Standup',
              description: 'Daily standup',
              start: '2025-07-22T10:00:00-07:00',
              end: '2025-07-22T10:30:00-07:00',
              participants: ['alice@corp.com', 'bob@corp.com'],
              durationMinutes: 30,
            },
            {
              id: 'event-2',
              subject: 'Client Call',
              description: 'Important client meeting',
              start: '2025-07-22T10:15:00-07:00',
              end: '2025-07-22T11:00:00-07:00',
              participants: ['alice@corp.com', 'charlie@corp.com'],
              durationMinutes: 45,
            },
          ],
        },
        {
          email: 'bob@corp.com',
          events: [
            {
              id: 'event-1',
              subject: 'Team Standup',
              description: 'Daily standup',
              start: '2025-07-22T10:00:00-07:00',
              end: '2025-07-22T10:30:00-07:00',
              participants: ['alice@corp.com', 'bob@corp.com'],
              durationMinutes: 30,
            },
          ],
        },
        {
          email: 'charlie@corp.com',
          events: [
            {
              id: 'event-2',
              subject: 'Client Call',
              description: 'Important client meeting',
              start: '2025-07-22T10:15:00-07:00',
              end: '2025-07-22T11:00:00-07:00',
              participants: ['alice@corp.com', 'charlie@corp.com'],
              durationMinutes: 45,
            },
          ],
        },
      ];

      // Convert to ConflictingMeeting format
      const mockConflicts: ConflictingMeeting[] = [
        {
          id: 'event-1',
          title: 'Team Standup',
          description: 'Daily standup',
          organizer: 'alice@corp.com',
          attendees: [
            { email: 'alice@corp.com', role: 'required' },
            { email: 'bob@corp.com', role: 'required' },
          ],
          startTime: '2025-07-22T10:00:00-07:00',
          endTime: '2025-07-22T10:30:00-07:00',
          durationMinutes: 30,
        },
        {
          id: 'event-2',
          title: 'Client Call',
          description: 'Important client meeting',
          organizer: 'alice@corp.com',
          attendees: [
            { email: 'alice@corp.com', role: 'required' },
            { email: 'charlie@corp.com', role: 'required' },
          ],
          startTime: '2025-07-22T10:15:00-07:00',
          endTime: '2025-07-22T11:00:00-07:00',
          durationMinutes: 45,
        },
      ];

      console.log('Proposing resolutions with injected mock conflict data');
      console.log('Mock conflicts:', JSON.stringify(mockConflicts, null, 2));

      const result = await client.proposeMeetingConflictResolutions({
        userEmails: ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'],
        identifiedConflicts: mockConflicts,
        fullDayCalendars: mockCalendars,
        timeFrameStartISO: '2025-07-22T00:00:00-07:00',
        timeFrameEndISO: '2025-07-22T23:59:59-07:00',
      });

      console.log('Resolution proposals:', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      expect(Array.isArray(result.resolutionReports)).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalConflicts).toBeGreaterThan(0);

      if (result.resolutionReports.length > 0) {
        console.log(
          `Generated ${result.resolutionReports.length} resolution reports.`
        );
        console.log(
          `Valid proposals: ${result.summary.validProposals}, Invalid: ${result.summary.invalidProposals}`
        );
      } else {
        console.log('No resolutions proposed.');
      }
    }, 120000);
  });
}
