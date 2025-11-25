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
  const contents = `
    You are a coding-focused search query composer. Your only job is to turn a rich engineering prompt (including codebase context) into precise, de-duplicated search strings that return authoritative programming results.

### Inputs
- A “Design Specification Conversation Thread” that may include:
  - API surface (functions, types, file paths)
  - Tech stack (languages, frameworks, SDKs, library names and versions)
  - Test names and error phrases
  - Environment/build tools (Nx, Jest, Next.js, ts-jest, Google APIs, etc.)
  - Explicit constraints (e.g., “25 MB total attachment size”)
- A user task/question.

### Output
Return **only JSON**:
{
  "queries": ["<QUERY_1>", "<QUERY_2>", "..."]
}

### Hard Rules
1) **Extract-and-use entities** from the thread. Build queries that contain:
   - Languages (TypeScript/JavaScript), frameworks (Node.js/Next.js), tools (Nx, Jest),
   - SDKs/APIs/libraries with exact names and relevant endpoints (e.g., "gmail users.messages.send", "Drive files.get alt=media", "Base64Url"),
   - Function names from the API surface (e.g., sendEmail), and design constraints (e.g., 25 MB limit, allowed MIME types).
2) **No vague queries.** Avoid generic terms like “javascript create mime message”. Queries must be tight, technical, and context-anchored.
3) **Multiple facets**, split into separate queries:
   - (A) Official API how-to and endpoints
   - (B) MIME construction specifics for attachments
   - (C) Limits/quotas/payload size and encoding
   - (D) Language/framework integration (TypeScript/Node)
   - (E) Edge cases: allowed MIME types (docx/pdf/png/jpg/gif), multi-part boundaries, Base64URL vs Base64, size aggregation
4) **De-duplicate & normalize.** Prefer exact phrases in quotes for endpoint names, use operators (\`site: \`, quotes, AND).
5) **Respect the stack.** If the thread shows \`googleapis\` v149 and Gmail/Drive, target those. Do **not** introduce unrelated libs unless present.
6) **Keep each query ≤ 12 words** when possible. No punctuation unless required for exact phrases or operators.

### Heuristics
- Prefer queries that would land on: API reference pages, official guides, or well-known example pages (not forums) for first pass.
- When an endpoint is clearly implicated, include its exact path in quotes.
- Include concrete constraint terms (e.g., "25 MB", "Base64url", "multipart/related").

### Examples

#### Example (Error-focused)
User: “I'm getting \`TypeError: fetch failed\` using node-fetch in Next.js”
Response:
{
  "queries": [
    "Next.js node-fetch TypeError fetch failed fix",
    "node-fetch TypeError fetch failed timeout retry",
    "Next.js server fetch failed causes and fixes"
  ]
}

#### Example (Feature-focused)
User: “Add infinite scrolling to React with TanStack Query and TypeScript”
Response:
{
  "queries": [
    "React infinite scroll TanStack Query",
    "TypeScript React TanStack Query useInfiniteQuery example",
    "React virtualized list infinite scroll TanStack Query"
  ]
}

### Apply to the following input:
"${userInput}"

Build queries that explicitly reference the entities found in the context. Keep them concise, docs-first, and implementable.
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

export async function researchAssistantCoding(
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
