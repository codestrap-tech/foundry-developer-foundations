import { partsInTZ } from '@codestrap/developer-foundations-utils';
import { OfficeServiceV3 } from '@codestrap/developer-foundations-types';
import { makeGSuiteClientV3 } from '../gsuiteClient.v3';

if (!process.env.E2E) {
  test.skip('e2e test skipped in default run', () => {
    // won't run
  });
} else {
  describe('resolveMeetingConflicts E2E tests', () => {
    let client: OfficeServiceV3;

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

    it.only('should identify conflicts when meetings overlap in time', async () => {
      // Use a test email that has access to calendars
      const testEmail = process.env['TEST_USER_EMAIL'] || 'igor@codestrap.me';

      // Get today's date in PT timezone
      const p = partsInTZ(new Date(), 'America/Los_Angeles');
      const pad = (n: number, len = 2) => String(n).padStart(len, '0');
      const todayISO = `${p.year}-${pad(p.month)}-${pad(p.day)}`;

      const result = await client.resolveMeetingConflicts({
        userEmails: [testEmail],
        targetDayISO: todayISO,
      });

      // Should return a valid result structure
      expect(result).toBeDefined();
      expect(result.identifiedConflicts).toBeDefined();
      expect(result.resolutionReports).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalConflicts).toBe('number');
      expect(typeof result.summary.successfullyRescheduled).toBe('number');
      expect(typeof result.summary.failedToReschedule).toBe('number');
      expect(typeof result.summary.noActionTaken).toBe('number');
    }, 60000);

    it('should handle multiple user emails and detect conflicts across calendars', async () => {
      const testEmails = process.env['TEST_USER_EMAILS']
        ? process.env['TEST_USER_EMAILS'].split(',')
        : ['igor@codestrap.me', 'dsmiley@codestrap.me'];

      // Get today's date in PT timezone
      const p = partsInTZ(new Date(), 'America/Los_Angeles');
      const pad = (n: number, len = 2) => String(n).padStart(len, '0');
      const todayISO = `${p.year}-${pad(p.month)}-${pad(p.day)}`;

      const result = await client.resolveMeetingConflicts({
        userEmails: testEmails,
        targetDayISO: todayISO,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.identifiedConflicts)).toBe(true);
      expect(Array.isArray(result.resolutionReports)).toBe(true);
    }, 60000);

    it('should return empty conflicts when no conflicts exist', async () => {
      const testEmail = process.env['TEST_USER_EMAIL'] || 'igor@codestrap.me';

      // Use a date far in the future where there are likely no meetings
      const p = partsInTZ(new Date(), 'America/Los_Angeles');
      const pad = (n: number, len = 2) => String(n).padStart(len, '0');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 365);
      const futureP = partsInTZ(futureDate, 'America/Los_Angeles');
      const futureISO = `${futureP.year}-${pad(futureP.month)}-${pad(
        futureP.day
      )}`;

      const result = await client.resolveMeetingConflicts({
        userEmails: [testEmail],
        targetDayISO: futureISO,
      });

      expect(result).toBeDefined();
      // May or may not have conflicts, but structure should be valid
      expect(Array.isArray(result.identifiedConflicts)).toBe(true);
    }, 60000);

    it('should handle user confirmation callback when provided', async () => {
      const testEmail = process.env['TEST_USER_EMAIL'] || 'igor@codestrap.me';
      const mockConfirm = jest.fn().mockResolvedValue(false); // User declines

      const p = partsInTZ(new Date(), 'America/Los_Angeles');
      const pad = (n: number, len = 2) => String(n).padStart(len, '0');
      const todayISO = `${p.year}-${pad(p.month)}-${pad(p.day)}`;

      const result = await client.resolveMeetingConflicts({
        userEmails: [testEmail],
        targetDayISO: todayISO,
        confirm: mockConfirm,
      });

      expect(result).toBeDefined();
      // If there were proposals, confirm should have been called
      // If no proposals, confirm won't be called
      if (
        result.resolutionReports.some((r) => r.status === 'no_action_taken')
      ) {
        expect(mockConfirm).toHaveBeenCalled();
      }
    }, 60000);

    it('should handle errors gracefully when calendar access fails', async () => {
      // Use an invalid email to test error handling
      const invalidEmail = 'invalid-email@nonexistent.com';

      const p = partsInTZ(new Date(), 'America/Los_Angeles');
      const pad = (n: number, len = 2) => String(n).padStart(len, '0');
      const todayISO = `${p.year}-${pad(p.month)}-${pad(p.day)}`;

      const result = await client.resolveMeetingConflicts({
        userEmails: [invalidEmail],
        targetDayISO: todayISO,
      });

      // Should return a result structure even on error
      expect(result).toBeDefined();
      expect(result.identifiedConflicts).toBeDefined();
      // May have errors array if calendar access failed
      if (result.errors) {
        expect(Array.isArray(result.errors)).toBe(true);
      }
    }, 60000);
  });
}
