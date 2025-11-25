export async function softwareDesignSpec(
  userInput: string,
  num = 5,
  dateRestrict?: string,
  siteSearch?: string,
  siteSearchFilter?: string,
  searchEngineId?: string,
): Promise<string> {
  const system = `
You are a helpful AI engineering architect assistant that specializes in formulating design specification from user input.
Your job is to search the web and create a clean specification grounded in your search results and knowledge that solves for the user inputs.

### User Inputs Include
- A “Design Specification Conversation Thread” that may include:
  - API surface (functions, types, file paths)
  - Tech stack (languages, frameworks, SDKs, library names and versions)
  - Test names and error phrases
  - Environment/build tools (Nx, Jest, Next.js, ts-jest, Google APIs, etc.)
  - Explicit constraints (e.g., “25 MB total attachment size”)
- A user task/question.

You always carefully evaluate user input before crafting your search queries and obey all search rules provided by the user.
You never under any circumstances ask clarifying questions. Just use best practice and judgement.
  `;

  const user = `
Generate a design specification that solves for the user input by searching the web for relevant documentation.

### Hard Rules for Web Search
1) **Extract-and-use entities** from the thread. Build queries that contain:
   - Languages (TypeScript/JavaScript), frameworks (Node.js/Next.js), tools (Nx, Jest),
   - SDKs/APIs/libraries with exact names and relevant endpoints (e.g., "gmail users.messages.send", "Drive files.get alt=media", "Base64Url"),
   - Function names from the API surface (e.g., sendEmail), and design constraints (e.g., 25 MB limit, allowed MIME types).
2) **No vague queries.** Avoid generic terms like “javascript create mime message”. Queries must be tight, technical, and context-anchored.
3) **Multiple facets**, split into separate queries. For example:
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

# Hard Rules for Answer Synthesis
Never ask clarifying questions!
Be sure you have captured changes that are required for the existing public API such as new parameters, methods, etc
Be sure you prevent developer foot gunning by designing the solution to handle errors, retries, and backoff policies
Do not over engineer the solution, engineer for an MVP that meets the user requirements
Organize your code such that you don't nest function declarations or type definitions inside functions
Include optional suggested enhancements over the MVP solution

# User Input
${userInput}
  `;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPEN_AI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        { role: 'user', content: [{ type: 'input_text', text: user }] },
      ],
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' },
      tools: [
        {
          type: 'web_search',
          user_location: { type: 'approximate', country: 'US' },
        },
      ],
      store: true,
    }),
  });

  const data = (await response.json()) as any;

  // Robustly collect all assistant text from the new Responses API shape
  const outputItems: any[] = Array.isArray(data?.output) ? data.output : [];
  const textChunks: string[] = [];
  const annotations: any[] = [];

  for (const item of outputItems) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (typeof c?.text === 'string') textChunks.push(c.text);
        if (Array.isArray(c?.annotations))
          annotations.push(...c.annotations.filter(Boolean));
      }
    }
  }

  // Some SDKs expose a convenience concatenation; use as a fallback if present
  const mainText =
    typeof data?.output_text === 'string' && data.output_text.trim().length > 0
      ? data.output_text
      : textChunks.join('\n\n').trim();

  // Extract URL citations from annotations (GPT-5 emits `type: "url_citation"`)
  type UrlCitation = {
    type?: string;
    url?: string;
    title?: string | null | undefined;
  };
  const urlCitations: UrlCitation[] = annotations.filter(
    (a: UrlCitation) =>
      (a?.type ?? '').toLowerCase() === 'url_citation' && a?.url,
  );

  // Dedupe by URL
  const deduped = Array.from(
    new Map(urlCitations.map((c) => [c.url!, c])).values(),
  );

  // Build "Sources" markdown
  const sourcesMd =
    deduped.length > 0
      ? `\n\n---\n### Sources\n${deduped
          .map((c, i) => {
            const url = c.url!;
            let title = (c.title || '').trim();
            if (!title) {
              try {
                const { hostname } = new URL(url);
                title = hostname.replace(/^www\./, '');
              } catch {
                title = url;
              }
            }
            return `${i + 1}. [${title}](${url})`;
          })
          .join('\n')}\n`
      : '';

  return `${mainText}${sourcesMd}`;
}
