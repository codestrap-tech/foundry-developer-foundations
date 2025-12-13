import type { ProposeMeetingConflictResolutionsOutput } from '@codestrap/developer-foundations-types';
import { makeGSuiteClientV3 } from './gsuiteClient.v3';

if (!process.env.E2E) {
  test.skip('e2e test skipped in default run', () => {
    // won't run
  });
} else {
  describe('resolveMeetingConflicts E2E tests', () => {
    let client: Awaited<ReturnType<typeof makeGSuiteClientV3>>;
    const timezone = 'America/Los_Angeles'; // another example timezone is 'Europe/Warsaw';

    beforeAll(async () => {
      // Force Node's wall-clock to PT so Date('YYYY-MM-DDTHH:mm:ss') is deterministic.
      // process.env.TZ = timezone;
      client = await makeGSuiteClientV3(process.env.OFFICE_SERVICE_ACCOUNT);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it.each([
      {
        email: process.env['TEST_USER_EMAIL'] ?? 'dsmiley@codestrap.me',
        timeFrameFrom: new Date(),
        timeFrameTo: new Date(new Date().setDate(new Date().getDate() + 7)),
      },
    ])(
      'should identify meeting conflicts for $email from $timeFrameFrom to $timeFrameTo',
      async ({
        email: emailForCalendarConflictResolution,
        timeFrameFrom,
        timeFrameTo,
      }) => {
        console.log(
          `Checking conflicts for ${emailForCalendarConflictResolution} from ${timeFrameFrom} to ${timeFrameTo}`,
        );

        const result = await client.proposeMeetingConflictResolutions({
          userEmails: [emailForCalendarConflictResolution],
          timeFrameFrom,
          timeFrameTo,
          timezone,
        });

        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              email: expect.any(String),
              end: expect.any(String),
              durationMinutes: expect.any(Number),
              id: expect.any(String),
              meetingLink: expect.any(String),
              participants: expect.arrayContaining([expect.any(String)]),
              start: expect.any(String),
              subject: expect.any(String),
              resolutionBlocks: expect.arrayContaining([
                expect.objectContaining({
                  start: expect.any(String),
                  end: expect.any(String),
                }),
              ]),
            }),
          ] as ProposeMeetingConflictResolutionsOutput),
        );
      },
    );
  });
}
