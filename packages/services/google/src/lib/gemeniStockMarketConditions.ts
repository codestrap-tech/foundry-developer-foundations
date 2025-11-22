import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
// import playwright from 'playwright';

// Assuming you have API keys loaded from environment variables
const SEARCH_API_KEY = process.env['GOOGLE_SEARCH_API_KEY'];
// this search engine is specific to stock markets indices and current conditions
// https://programmablesearchengine.google.com/controlpanel/overview?cx=b7dc27c8f2cf14af1
const SEARCH_ENGINE_ID = process.env['GOOGLE_SEARCH_ENGINE_MARKETS'];
const GEMINI_API_KEY = process.env['GEMINI_API_KEY'];

const customSearch = google.customsearch('v1');
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

const geminiFlashModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
});
const geminiProModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-pro-001',
});

interface SearchResultItem {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SearchResult {
  items?: SearchResultItem[];
}

async function loadPageContent(results: SearchResultItem[]): Promise<string[]> {
  if (!results) {
    return [];
  }
  // TODO replace this service with local playwright
  /*const browser = await playwright.chromium.launch()
    const pageContents: string[] = [];

    for (const result of results) {
        if (result.link && result.snippet && result.title) {
            try {
                console.log('Connected! Navigating...');
                const page = await browser.newPage();
                await page.goto(result.link, { waitUntil: 'networkidle', timeout: 2 * 60 * 1000 });
                //console.log('Taking screenshot to page.png');
                // await page.screenshot({ path: './page.png', fullPage: true });
                console.log('Navigated! Scraping page content...');
                const textContent = await page.innerText('body', { timeout: 2 * 60 * 1000 }); // Extract text from the body element
                if (textContent) {
                    pageContents.push(textContent);
                }
            } catch (e) {
                console.log(e);
            }
        }
    }

    await browser.close();

    return pageContents;*/
  return new Promise((resolve) => resolve([]));
}

async function synthesizeAnswer(
  summaries: string[],
  originalQuery: string
): Promise<string> {
  if (!summaries || summaries.length === 0) {
    return 'No relevant information found.';
  }

  const prompt = `You are a helpful AI analyst tasked with helping users understand the current market conditions. You always format your responses per the users instructions and use tables to format key facts and figures. Using only the following information:\n\n${summaries.join(
    '\n\n'
  )} \n\n Generate a market report for the users query: "${originalQuery}"`;
  const geminiProResponse = await geminiProModel.generateContent(prompt);
  return (
    geminiProResponse.response?.text() ?? 'Could not synthesize an answer.'
  );
}

async function performSearch(
  query: string,
  numResults = 5
): Promise<SearchResult> {
  if (!SEARCH_API_KEY || !SEARCH_ENGINE_ID) {
    throw new Error('Search API key or Search Engine ID missing.');
  }

  try {
    const response = await customSearch.cse.list({
      cx: SEARCH_ENGINE_ID,
      q: query,
      auth: SEARCH_API_KEY,
      num: numResults,
      dateRestrict: 'd1', // Restricts results to the last 24 hours
      //siteSearch: 'finance.yahoo.com',
      //siteSearchFilter: 'i',
    });
    return response.data as SearchResult;
  } catch (error) {
    console.error('Error during search:', error);
    throw error;
  }
}

async function generateSearchQueries(userInput: string): Promise<string[]> {
  const prompt = `You are a helpful AI market analyst that specializes in writing search queries based on the user query.
    You carefully deconstruct keywords for the search queries to ensure the user gets valid search results
    Users tend to supply lots of information in their queries and passing this directly to the search engine will cause it to return null results
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
  const geminiProResponse = await geminiFlashModel.generateContent(prompt);
  const result =
    geminiProResponse.response?.text() ?? 'Could not synthesize an answer.';
  const clean = JSON.parse(extractJsonFromBackticks(result)) as {
    queries: string[];
  };

  return clean.queries;
}

async function researchAssistant(userInput: string): Promise<string> {
  const queries = await generateSearchQueries(userInput);

  const searchPromises = queries.map((query) => performSearch(query));
  const searchResults = await Promise.all(searchPromises);

  const flattenedResults: SearchResultItem[] = searchResults.reduce(
    (acc: SearchResultItem[], curr) => {
      if (curr.items && curr.items.length > 0) {
        acc = [...acc, ...curr.items];
      }
      return acc;
    },
    [] as SearchResultItem[]
  );

  const summaries = await loadPageContent(flattenedResults);
  return synthesizeAnswer(summaries, userInput);
}

// Example Usage:
export async function gemeniStockMarketConditions(
  userInput: string
): Promise<string> {
  const answer = await researchAssistant(userInput);

  return answer;
}
