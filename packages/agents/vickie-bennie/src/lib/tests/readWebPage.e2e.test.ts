import { readWebPage } from '@codestrap/developer-foundations-x-reason/src/lib/functions/comsFunctions/ReadWebPage';

if (!process.env.E2E) {
  test.skip('e2e test skipped in default run', () => {
    // won't run
  });
} else {
  describe('researchAssistant', () => {
    afterAll(() => {
      jest.clearAllMocks();
    });

    it('should return the webpage contents as markdown with protocol', async () => {
      const query =
        'Vickie, read me the page contents of https://docs.google.com/document/d/12Osa66iz9Z4FCM4fvZwbZGpqFghSMWYaEixYvwrBEns/edit?usp=sharing';
      try {
        const results = await readWebPage(
          {
            requestId: '',
            status: 1,
          },
          { type: 'test' },
          query,
        );

        expect(results).toBeDefined();
        expect(results?.result).toBeDefined();
        expect(results?.result.includes('Failed to load')).toBeFalsy();
      } catch (error) {
        console.error('Test Failed:', error);
        throw error;
      }
    }, 600000);
  });
}
