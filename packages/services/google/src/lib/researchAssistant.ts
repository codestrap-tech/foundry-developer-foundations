import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import type { ScrapeResponse } from '@mendable/firecrawl-js';
import FirecrawlApp from '@mendable/firecrawl-js';

// import playwright from 'playwright';

// Assuming you have API keys loaded from environment variables
const SEARCH_API_KEY = process.env['GOOGLE_SEARCH_API_KEY'];
// this search engine is specific to stock markets indices and current conditions
// https://programmablesearchengine.google.com/controlpanel/overview?cx=b7dc27c8f2cf14af1
const SEARCH_ENGINE_ID = process.env['GOOGLE_SEARCH_ENGINE_ID'];
const GEMINI_API_KEY = process.env['GEMINI_API_KEY'];
const FIRECRAWL_API_KEY = process.env['FIRECRAWL_API_KEY'];

const customSearch = google.customsearch('v1');
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

interface SearchResultItem {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SearchResult {
  items?: SearchResultItem[];
}

async function loadPageContent(
  results: SearchResultItem[],
  app: FirecrawlApp,
): Promise<string[]> {
  if (!results) {
    return [];
  }

  const pageContentsPromises = results
    .filter(
      (result) => typeof result.link === 'string' && result.link.trim() !== '',
    )
    .map((result) => {
      // Scrape a website
      return app.scrapeUrl(result.link!, {
        formats: ['markdown'],
      });
    });

  const scrapeResults = await Promise.allSettled(pageContentsPromises);

  const pageContents: string[] = scrapeResults
    .filter(
      (r): r is PromiseFulfilledResult<ScrapeResponse> =>
        r.status === 'fulfilled' && r.value.success,
    )
    .map((r) => r.value.markdown ?? '');

  return pageContents;
}

async function synthesizeAnswer(
  summaries: string[],
  originalQuery: string,
  citations: SearchResultItem[],
): Promise<string> {
  if (!summaries || summaries.length === 0) {
    return 'No relevant information found.';
  }

  const contents = `You are a helpful AI analyst tasked with helping users understand the current market conditions. You always format your responses per the users instructions and use tables to format key facts and figures. Using only the following information:\n\n${summaries.join('\n\n')} \n\n Generate a market report for the users query: "${originalQuery}"`;
  const geminiProResponse = await ai.models.generateContent({
    model: 'gemini-2.0-flash-001',
    contents,
  });

  const answer = geminiProResponse.text ?? 'Could not synthesize an answer.';
  const sources = (citations || [])
    .filter((c) => typeof c.link === 'string' && c.link!.trim() !== '')
    .map(
      (c, i) =>
        `${i + 1}. [${c.title || c.link}](${c.link}) — ${c.snippet || ''}`,
    )
    .join('\n');

  return sources ? `${answer}\n\n---\n**Sources**\n${sources}` : answer;
}

async function performSearch(
  query: string,
  num = 5,
  dateRestrict?: string,
  siteSearch?: string,
  siteSearchFilter?: string,
  searchEngineId?: string,
): Promise<SearchResult> {
  if (!SEARCH_API_KEY || !SEARCH_ENGINE_ID) {
    throw new Error('Search API key or Default Search Engine ID missing.');
  }

  try {
    const response = await customSearch.cse.list({
      cx: searchEngineId || SEARCH_ENGINE_ID,
      q: query,
      auth: SEARCH_API_KEY,
      num,
      dateRestrict,
      siteSearch,
      siteSearchFilter,
    });
    return response.data as SearchResult;
  } catch (error) {
    console.error('Error during search:', error);
    throw error;
  }
}

async function generateSearchQueries(userInput: string): Promise<string[]> {
  const contents = `You are a helpful AI search assistant that specializes in writing search queries based on the user query.
    You carefully deconstruct keywords for the search queries to ensure the user gets valid search results
    Users tend to supply lots of information in their queries and passing this directly to the search engine will cause it to return null results

    Be mindful to include all relevant keywords to help isolate the most relevant search results.

    Decompose the following user query into the required number of searches to cover their request while obtaining valid search results: 
    "${userInput}"
    You can only respond in JSON in the following format:
    {
        "queries": ["<QUERY_1>", "<QUERY_2>", "<QUERY_3>"...]
    }
    
    for example is the user asks: "what are the current market indices doing, who are the top movers"
    You respond with:
    {
        "queries": ["current VIX level", "what is the current QQQ Index Level", "What is the current SPX level", "top stock market winners today", "top stock market losers today", "top stock market sectors today"]
    }
    Explanation: They query is broken out into separate queries so the search engine will return valid results. There is timeliness to each query limiting the results to the last 24 hours.
    `;
  const geminiProResponse = await ai.models.generateContent({
    model: 'gemini-2.0-flash-001',
    contents,
  });
  const result = geminiProResponse.text ?? 'Could not synthesize an answer.';
  const clean = JSON.parse(extractJsonFromBackticks(result)) as {
    queries: string[];
  };

  return clean.queries;
}

export async function researchAssistant(
  userInput: string,
  num = 5,
  dateRestrict?: string,
  siteSearch?: string,
  siteSearchFilter?: string,
  searchEngineId?: string,
): Promise<string> {
  try {
    const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

    const queries = await generateSearchQueries(userInput);

    const searchPromises = queries.map((query) =>
      performSearch(
        query,
        num,
        dateRestrict,
        siteSearch,
        siteSearchFilter,
        searchEngineId,
      ),
    );
    const searchResults = await Promise.all(searchPromises);

    const flattenedResults: SearchResultItem[] = searchResults.reduce(
      (acc: SearchResultItem[], curr) => {
        if (curr.items && curr.items.length > 0) {
          acc = [...acc, ...curr.items];
        }
        return acc;
      },
      [] as SearchResultItem[],
    );

    const summaries: string[] = [];
    // we are rate limited by firecrawl to two concurrent requests in the free tier
    for (let i = 0; i < flattenedResults.length; i += 2) {
      const batch = flattenedResults.slice(i, i + 2);
      const batchResults = await loadPageContent(batch, app);
      summaries.push(...batchResults.flat());
    }
    return synthesizeAnswer(summaries, userInput, flattenedResults);
  } catch (e) {
    console.log((e as Error).message);
    console.log((e as Error).stack);
    return `Failed to scrape the webpage with FireCraw: ${(e as Error).message}`;
  }
}
