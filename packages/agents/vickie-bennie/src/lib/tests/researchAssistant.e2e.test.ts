import * as dotenv from 'dotenv';

dotenv.config();

import { researchAssistant } from '@codestrap/developer-foundations-services-google';

if (!process.env.E2E) {
  test.skip('e2e test skipped in default run', () => {
    // won't run
  });
} else {
  describe('researchAssistant', () => {
    afterAll(() => {
      jest.clearAllMocks();
    });

    it('should return search results for a stock market report', async () => {
      const query =
        'What are the current market conditions including key indices such as volatility, SPX, SPY, QQQ including todays top movers and losers. Your report should include a table for each index mentioned. Seperate sections for Top Gainers, Top Losers, and Sector performers.';
      try {
        const results = await researchAssistant(
          query,
          1, // number of results per search to sample
          'd1', // restrict to past 24 hours
          undefined, //you can restrict to a specific site if you want: 'finance.yahoo.com',
          undefined, //include or exclude: 'i' = include results from 'finance.yahoo.com',
          process.env.GOOGLE_SEARCH_ENGINE_MARKETS,
        );

        expect(results).toBeDefined();
        expect(results?.length).toBeGreaterThan(0);
      } catch (error) {
        console.error('Test Failed:', error);
        throw error;
      }
    }, 600000);

    it('should return search results for a AI headline report', async () => {
      const query =
        'Get me the top AI headlines for today including announcements in AI research, AI engineering, code generation, and AIs projected impact on the economy.';
      try {
        const results = await researchAssistant(query, 1, 'd1');

        expect(results).toBeDefined();
        expect(results?.length).toBeGreaterThan(0);
      } catch (error) {
        console.error('Test Failed:', error);
        throw error;
      }
    }, 600000);
  });
}
