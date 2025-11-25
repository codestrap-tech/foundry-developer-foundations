import { Buffer } from 'buffer';
import type { OfficeService} from '@codestrap/developer-foundations-types';
import { TYPES } from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';

if (!process.env.E2E) {
  test.skip('e2e test skipped in default run', () => {
    // won't run
  });
} else {
  describe('Gmail Watch E2E', () => {
    beforeAll(() => {
      jest.clearAllMocks();
    });

    it('should register Gmail watch notifications for each user', async () => {
      const topicName =
        'projects/foundry-coms-foundations/topics/codestrap-emails';
      const users = [
        'dsmiley@codestrap.me',
        'connor.deeks@codestrap.me',
        'vici@codestrap.me',
      ];

      const inputs = {
        config: [
          {
            topicName,
            users,
            labelIds: ['INBOX'],
            labelFilterBehavior: 'INCLUDE',
          },
        ],
      };

      const officeService = await container.getAsync<OfficeService>(
        TYPES.OfficeService
      );

      const schedulingResult = await officeService.watchEmails(inputs);

      expect(schedulingResult.status).toBe(200);
      expect(schedulingResult.responses?.length).toBe(3);
      const results = '';
      console.log(
        schedulingResult.responses?.reduce((acc, cur) => {
          acc = `${acc}\n${cur}`;
          return acc;
        }, results)
      );
    }, 60000);

    it('should retrieve a message history when no labels are provided', async () => {
      const rawEvent = `{"message":{"data":"eyJlbWFpbEFkZHJlc3MiOiJkc21pbGV5QGNvZGVzdHJhcC5tZSIsImhpc3RvcnlJZCI6MTc1NDI5M30=","messageId":"15100603300208417","message_id":"15100603300208417","publishTime":"2025-07-16T00:58:13.054Z","publish_time":"2025-07-16T00:58:13.054Z"},"subscription":"projects/foundry-coms-foundations/subscriptions/codestra-emails-subscription-push"}`;
      const parsedEvent = JSON.parse(rawEvent) as {
        message: { data: string; publishTime: string };
      };
      const data = parsedEvent.message.data;
      const publishTime = parsedEvent.message.publishTime;
      const decodedJson = Buffer.from(data, 'base64').toString('utf8');
      const { emailAddress, historyId } = JSON.parse(decodedJson) as {
        emailAddress: string;
        historyId: number;
      };

      const officeService = await container.getAsync<OfficeService>(
        TYPES.OfficeService
      );

      const result = await officeService.readEmailHistory({
        email: emailAddress,
        publishTime,
      });

      expect(result.messages.length).toBeGreaterThan(0);
    }, 60000);

    it('should retrieve a message history when one label is provided', async () => {
      const rawEvent = `{"message":{"data":"eyJlbWFpbEFkZHJlc3MiOiJkc21pbGV5QGNvZGVzdHJhcC5tZSIsImhpc3RvcnlJZCI6MTc1NDI5M30=","messageId":"15100603300208417","message_id":"15100603300208417","publishTime":"2025-07-16T00:58:13.054Z","publish_time":"2025-07-16T00:58:13.054Z"},"subscription":"projects/foundry-coms-foundations/subscriptions/codestra-emails-subscription-push"}`;
      const parsedEvent = JSON.parse(rawEvent) as {
        message: { data: string; publishTime: string };
      };
      const data = parsedEvent.message.data;
      const publishTime = parsedEvent.message.publishTime;
      const decodedJson = Buffer.from(data, 'base64').toString('utf8');
      const { emailAddress, historyId } = JSON.parse(decodedJson) as {
        emailAddress: string;
        historyId: number;
      };

      const officeService = await container.getAsync<OfficeService>(
        TYPES.OfficeService
      );

      const result = await officeService.readEmailHistory({
        email: emailAddress,
        publishTime,
        labels: ['inbox'],
      });

      expect(result.messages.length).toBeGreaterThan(0);
    }, 60000);

    it('should retrieve a message history when multiples labels are provided', async () => {
      const rawEvent = `{"message":{"data":"eyJlbWFpbEFkZHJlc3MiOiJkc21pbGV5QGNvZGVzdHJhcC5tZSIsImhpc3RvcnlJZCI6MTc1NDI5M30=","messageId":"15100603300208417","message_id":"15100603300208417","publishTime":"2025-07-16T00:58:13.054Z","publish_time":"2025-07-16T00:58:13.054Z"},"subscription":"projects/foundry-coms-foundations/subscriptions/codestra-emails-subscription-push"}`;
      const parsedEvent = JSON.parse(rawEvent) as {
        message: { data: string; publishTime: string };
      };
      const data = parsedEvent.message.data;
      const publishTime = parsedEvent.message.publishTime;
      const decodedJson = Buffer.from(data, 'base64').toString('utf8');
      const { emailAddress, historyId } = JSON.parse(decodedJson) as {
        emailAddress: string;
        historyId: number;
      };

      const officeService = await container.getAsync<OfficeService>(
        TYPES.OfficeService
      );

      const result = await officeService.readEmailHistory({
        email: emailAddress,
        publishTime,
        labels: ['inbox', 'cigars', 'pltr'],
      });

      expect(result.messages.length).toBeGreaterThan(0);
    }, 60000);
  });
}
