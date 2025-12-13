export async function openAiSoftwareDesignSpec(
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
  `;

  const user = `
Generate a design specification that solves for the user input by searching the web for relevant documentation.

### Hard Rules for Web Search
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

# Hard Rules for Answer Synthesis
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
      model: 'gpt-4o',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: system }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: user }],
        },
      ],
      text: { format: { type: 'text' } },
      reasoning: {},
      tools: [
        {
          type: 'web_search_preview',
          user_location: { type: 'approximate', country: 'US' },
          search_context_size: 'high',
        },
      ],
      temperature: 1,
      max_output_tokens: 8192,
      top_p: 1,
      store: true,
    }),
  });

  const data = (await response.json()) as any;

  // Grab the assistant message content items
  const message = data?.output?.find((o: any) => o?.type === 'message');
  const contentItems: any[] = message?.content ?? [];

  // Prefer the main output text (if present)
  const outputTextItem =
    contentItems.find((c) => c?.type === 'output_text') ??
    contentItems.find((c) => typeof c?.text === 'string');

  const mainText: string = outputTextItem?.text ?? '';

  // Collect annotations from all content items (if any)
  const allAnnotations: any[] = contentItems
    .flatMap((c) => (Array.isArray(c?.annotations) ? c.annotations : []))
    .filter(Boolean);

  // Filter to URL citations and dedupe by URL
  type UrlCitation = {
    type?: string;
    url?: string;
    title?: string;
    start_index?: number;
    end_index?: number;
  };

  const urlCitations: UrlCitation[] = allAnnotations.filter(
    (a: UrlCitation) =>
      (a?.type ?? '').toLowerCase().includes('citation') && a?.url,
  );

  const deduped = Array.from(
    new Map(
      urlCitations.map((c) => [c.url!, c]), // key by URL
    ).values(),
  );

  // Build a "Sources" markdown section (if any)
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
