import { Vickie } from '../Vickie';

if (!process.env.E2E) {
  test.skip('e2e test skipped in default run', () => {
    // won't run
  });
} else {
  describe('testing Vickie', () => {
    beforeAll(() => {
      jest.clearAllMocks();
    });

    it('It should retrieve my calendar events for tomorrow', async () => {
      const vickie = new Vickie();

      const result = await vickie.askVickie(
        `
What's coming up on my calendar tomorrow
                `,
        process.env.FOUNDRY_TEST_USER,
      );
      expect(result.executionId).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.status).toBe(200);
    }, 60000);

    it('It should retrieve my emails', async () => {
      const vickie = new Vickie();

      const result = await vickie.askVickie(
        `
Get me caught up on my emails.
                `,
        process.env.FOUNDRY_TEST_USER,
      );
      expect(result.executionId).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.status).toBe(200);
    }, 60000);

    it('It should return the webpage contents as markdown with protocol', async () => {
      const vickie = new Vickie();

      const result = await vickie.askVickie(
        `
Vickie, read me the page contents of https://docs.google.com/document/d/12Osa66iz9Z4FCM4fvZwbZGpqFghSMWYaEixYvwrBEns/edit?usp=sharing.
`,
        process.env.FOUNDRY_TEST_USER,
      );
      expect(result.executionId).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.status).toBe(200);
    }, 60000);

    it('It should schedule a meeting for today with me', async () => {
      const vickie = new Vickie();

      const result = await vickie.askVickie(
        `
Schedule a meeting with me for today to discuss progression of Foundry Developer Foundations
                `,
        process.env.FOUNDRY_TEST_USER,
      );
      expect(result.executionId).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.status).toBe(200);
    }, 60000);

    it('It should schedule a meeting for today at 12 PM for me', async () => {
      const vickie = new Vickie();

      const result = await vickie.askVickie(
        `
Schedule a meeting with me for today at 12 PM to discuss progression of Foundry Developer Foundations
                `,
        process.env.FOUNDRY_TEST_USER,
      );
      expect(result.executionId).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.status).toBe(200);
    }, 60000);

    it('It should schedule a meeting for today at 3 PM with me and Connor. This time is not available so it should book for a later time.', async () => {
      const vickie = new Vickie();

      const result = await vickie.askVickie(
        `
Schedule a meeting with me and Connor Deeks for today at 3 PM to discuss progression of Foundry Developer Foundations
                `,
        process.env.FOUNDRY_TEST_USER,
      );
      expect(result.executionId).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.status).toBe(200);
    }, 60000);

    it('It should schedule a meeting, send an email, send a slack message, and create a task.', async () => {
      const vickie = new Vickie();

      const result = await vickie.askVickie(
        `
In parallel do all of the following:
Create a critical priority task for me to follow up with our rebranding and find a partner to handle our identity package.
Then schedule a meeting with me for tomorrow 1:30 PM with the subject "Reminder - Prep for calls today" for 15 minutes
After that send a slack message to the Foundry Devs channel with a joke and include the current day time. Also let them know this is part of a a unit test and to ignore.
Finally,send an email to me with the subject test and for the message tell me a joke and include the current day time.
                `,
        process.env.FOUNDRY_TEST_USER,
      );
      expect(result.executionId).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.status).toBe(200);
    }, 90000);
  });
}
