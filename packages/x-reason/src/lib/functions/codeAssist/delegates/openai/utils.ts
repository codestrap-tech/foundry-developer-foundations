import type {
  Response as OpenAIResponse,
  ResponseOutputItem,
  ResponseUsage,
} from 'openai/resources/responses/responses';

/** Narrow a ResponseOutputItem to the 'message' variant */
type MessageItem = Extract<ResponseOutputItem, { type: 'message' }>;

/** URL citation shape per Responses API annotations */
type UrlCitation = { type: 'url_citation'; url: string; title?: string };

/** Some content parts include annotations; we model only what we need */
type AnnotatedContent = { annotations?: UrlCitation[] };

/** Type guard for message items */
function isMessageItem(item: ResponseOutputItem): item is MessageItem {
  return item.type === 'message' && item.status === 'completed';
}

/**
 * Compute and format token usage + estimated cost from an OpenAI Responses API result.
 */
export function getTokenomics(resp: OpenAIResponse) {
  const usage: ResponseUsage | undefined = resp.usage;
  const input = usage?.input_tokens ?? 0;
  const output = usage?.output_tokens ?? 0;
  const total = usage?.total_tokens ?? input + output;

  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  const reasoning = usage?.output_tokens_details?.reasoning_tokens ?? 0;

  // --- Pricing table (USD per 1K tokens) ---
  const pricing: Record<string, { input: number; output: number }> = {
    // price in millions of tokens
    'gpt-5-mini': { input: 0.25, output: 2 },
    'gpt-5': { input: 1.25, output: 10 },
  };

  const model = resp.model ?? 'gpt-5-mini';
  const rate = pricing[model] ?? pricing['gpt-5-mini'];

  const inputCost = (input / 1000000) * rate.input;
  const outputCost = (output / 1000000) * rate.output;
  const totalCost = inputCost + outputCost;

  return {
    model,
    inputTokens: input,
    cachedTokens: cached,
    outputTokens: output,
    reasoningTokens: reasoning,
    totalTokens: total,
    inputCostUSD: inputCost,
    outputCostUSD: outputCost,
    totalCostUSD: totalCost,
  };
}

/**
 * Extract citations from a GPT-5 web search response and return
 * a markdown section starting with "# Citations (from web search)"
 */
export function extractCitationsMarkdown(resp: OpenAIResponse): string {
  const items = resp.output as ResponseOutputItem[] | undefined;
  if (!items?.length) return '';

  // Find the completed message item
  const message = items.find(isMessageItem);
  if (!message || !message.content?.length) return '';

  // Collect annotations from all content parts that carry them
  const annotations: UrlCitation[] = (message.content ?? []).flatMap((part) => {
    const withAnn = part as unknown as AnnotatedContent;
    return withAnn.annotations ?? [];
  });

  const citations = annotations
    .filter(
      (a: UrlCitation) =>
        a.type === 'url_citation' && typeof a.url === 'string',
    )
    .map((a: UrlCitation, i: number) => {
      const title = a.title ? `**${a.title.trim()}**` : a.url;
      return `${i + 1}. [${title}](${a.url})`;
    });

  if (citations.length === 0) return '';

  return `# Citations (from web search)\n${citations.join('\n')}`;
}
