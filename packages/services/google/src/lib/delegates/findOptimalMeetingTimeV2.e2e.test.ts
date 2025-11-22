import { google } from 'googleapis';

import { partsInTZ } from '@codestrap/developer-foundations-utils';
import type { OfficeServiceV2 } from '@codestrap/developer-foundations-types';
import { makeGSuiteClientV2 } from '../gsuiteClient.v2';

if (!process.env.E2E) {
  test.skip('e2e test skipped in default run', () => {
    // won't run
  });
} else {
  describe('findOptimalMeetingTimeV2 E2E tests', () => {
    let client: OfficeServiceV2;

    beforeAll(async () => {
      // Force Node's wall-clock to PT so Date('YYYY-MM-DDTHH:mm:ss') is deterministic.
      process.env.TZ = 'America/Los_Angeles';
      client = await makeGSuiteClientV2(process.env.OFFICE_SERVICE_ACCOUNT);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should get an exact time within PT working hours', async () => {
      // LA wall-clock "YYYY-MM-DDT10:30:00" one week from now:
      const p = partsInTZ(new Date(), 'America/Los_Angeles');
      const pad = (n: number, len = 2) => String(n).padStart(len, '0');
      const localDateString = `${p.year}-${pad(p.month)}-${pad(p.day + 7)}T10:30:00`;

      const slots = await client.getAvailableMeetingTimes({
        participants: ['dsmiley@codestrap.me'],
        subject: 'Circle Up',
        timeframe_context: 'user defined exact date/time',
        localDateString,
        duration_minutes: 30,
        working_hours: {
          start_hour: 8,
          end_hour: 17,
        },
      });

      expect(slots.suggested_times.length).toBeGreaterThan(0);
    }, 60000);
  });
}
