import { makeGSuiteClientV3 } from './gsuiteClient.v3';

if (!process.env.E2E) {
  test.skip('e2e test skipped in default run', () => {
    // won't run
  });
} else {
  describe('resolveMeetingConflicts E2E tests', () => {
    let client: Awaited<ReturnType<typeof makeGSuiteClientV3>>;
    const timezone = 'America/Los_Angeles';

    beforeAll(async () => {
      // Force Node's wall-clock to PT so Date('YYYY-MM-DDTHH:mm:ss') is deterministic.
      // process.env.TZ = timezone;
      client = await makeGSuiteClientV3(process.env.OFFICE_SERVICE_ACCOUNT);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('true should be true', () => {
      expect(true).toBe(true);
    });

    it('should identify meeting conflicts', async () => {
      const emailForCalendarConflictResolution =
        process.env['TEST_USER_EMAIL'] ?? 'dsmiley@codestrap.me';
      const timeFrameFrom = new Date();
      const timeFrameTo = new Date();
      timeFrameTo.setDate(timeFrameFrom.getDate() + 7);

      console.log(
        `Checking conflicts for ${emailForCalendarConflictResolution} from ${timeFrameFrom} to ${timeFrameTo}`
      );

      const result = await client.proposeMeetingConflictResolutions({
        userEmails: [emailForCalendarConflictResolution],
        timeFrameFrom,
        timeFrameTo,
        timezone,
      });

      console.log(
        'Propose meeting conflict resolutions:',
        JSON.stringify(result, null, 2)
      );

      expect(result).toEqual(
        expect.arrayContaining([
          {
            meetingId: expect.any(String),
            resolutionBlocks: expect.arrayContaining([
              { start: expect.any(String), end: expect.any(String) },
            ]),
          },
        ])
      );
    });
  });
}
