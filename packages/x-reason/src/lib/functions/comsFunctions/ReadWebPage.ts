import type {
  Context,
  MachineEvent,
} from '@codestrap/developer-foundations-types';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';
import type { GeminiService } from '@codestrap/developer-foundations-types';
import { TYPES } from '@codestrap/developer-foundations-types';
import FirecrawlApp from '@mendable/firecrawl-js';

/**
 * Returns `true` only when `input` is a syntactically valid
 * HTTP or HTTPS URL (must include the protocol).
 */
function isValidWebUrl(input: string): boolean {
  try {
    const u = new URL(input);
    const valid = u.protocol === 'http:' || u.protocol === 'https:';
    return valid;
  } catch {
    return false;
  }
}

export async function readWebPage(
  context: Context,
  event?: MachineEvent,
  task?: string,
): Promise<{ result: string }> {
  const system = `You are a helpful virtual ai assistant tasked with extracting the url from user queries.`;

  const userPrompt = `
    Using the user query below output the URL contained in the user query. If the URL does not include the protocol (https://) use must include it

    The user query is:
    ${task}

    You can only respond in JSON in the following format:
    {
        url: string,
    }

    For example if the ask from the user is:
    Q: "1. **Read Web Page** - Read the following web page: codestrap.com
    A: {
        "url": "https://codestrap.com"
    }

    Q: "1. **Read Web Page** - Read the following web page: https://codestrap.com
    A: {
        "url": "https://codestrap.com"
    }
    `;

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);

  const response = await geminiService(userPrompt, system);

  const clean = extractJsonFromBackticks(response);

  let { url } = JSON.parse(clean) as { url: string };

  if (!isValidWebUrl(url)) {
    // ask Gemini to fix the bad URL
    const retryPrompt = `
The URL you just returned (“${url}”) is invalid.  
Please correct it.  Respond **only** with JSON in the form:

{
  "url": "https://example.com"
}

Original user query:
${task}
`;

    const retryRaw = await geminiService(retryPrompt, system);

    const clean = extractJsonFromBackticks(retryRaw);

    url = (JSON.parse(clean) as { url: string }).url;

    if (!isValidWebUrl(url)) {
      throw new Error(`Invalid URL after retry: “${url}”`);
    }
  }

  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY is not defined!');
  }

  try {
    const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

    const pageContents = await app.scrapeUrl(url, {
      formats: ['markdown'],
    });

    if (pageContents.success && pageContents.markdown) {
      return { result: pageContents.markdown };
    }

    return { result: `Failed to load ${url}\n${pageContents.error}` };
  } catch (e) {
    console.log((e as Error).message);
    console.log((e as Error).stack);

    return {
      result: `Failed to scrape the webpage with FireCraw: ${
        (e as Error).message
      }`,
    };
  }
}
