import type { GenerateContentResponse } from '@google/genai';

export function getTokenomics(
  response: GenerateContentResponse,
  model: string,
) {
  // Extract token counts from the response
  const usage = response.usageMetadata;

  const pricing = {
    // price in millions of tokens
    'gemini-2.5-pro': {
      // Price depends on the prompt length
      inputCostPerM: (promptTokens: number) =>
        promptTokens <= 200_000 ? 1.25 : 2.5,
      outputCostPerM: (promptTokens: number) =>
        promptTokens <= 200_000 ? 10.0 : 15.0,
    },
    'gemini-2.5-flash': {
      inputCostPerM: 0.3,
      outputCostPerM: 2.5,
    },
    'gemini-2.5-flash-lite': {
      inputCostPerM: 0.1,
      outputCostPerM: 0.4,
    },
    'gemini-2.0-flash': {
      inputCostPerM: 0.1,
      outputCostPerM: 0.4,
    },
    'gemini-2.0-flash-lite': {
      inputCostPerM: 0.075,
      outputCostPerM: 0.3,
    },
    // Note: Gemini Nano models are on-device and don't use a token-based API pricing.
  };

  const {
    promptTokenCount,
    candidatesTokenCount,
    totalTokenCount,
    thoughtsTokenCount,
    cachedContentTokenCount,
  } = usage || {};

  const modelPricing = pricing['gemini-2.5-flash'];
  const inputCost =
    ((promptTokenCount ?? 0) / 1000000) * modelPricing.inputCostPerM;
  const outputCost =
    ((candidatesTokenCount ?? 0) / 1000000) * modelPricing.outputCostPerM;
  const totalCost = inputCost + outputCost;

  return {
    model,
    inputTokens: promptTokenCount,
    cachedTokens: cachedContentTokenCount,
    outputTokens: candidatesTokenCount,
    reasoningTokens: thoughtsTokenCount,
    totalTokens: totalTokenCount,
    inputCostUSD: inputCost,
    outputCostUSD: outputCost,
    totalCostUSD: totalCost,
  };
}

export function addCitations(response: GenerateContentResponse) {
  let text = response.text;
  const supports =
    response.candidates?.[0].groundingMetadata?.groundingSupports;
  const chunks = response.candidates?.[0].groundingMetadata?.groundingChunks;

  // Sort supports by end_index in descending order to avoid shifting issues when inserting.
  const sortedSupports = [...(supports || [])].sort(
    (a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0),
  );

  for (const support of sortedSupports) {
    const endIndex = support.segment?.endIndex;
    if (endIndex === undefined || !support.groundingChunkIndices?.length) {
      continue;
    }

    const citationLinks = support.groundingChunkIndices
      .map((i) => {
        const uri = chunks?.[i]?.web?.uri;
        if (uri) {
          return `[${i + 1}](${uri})`;
        }
        return null;
      })
      .filter(Boolean);

    if (citationLinks.length > 0) {
      const citationString = citationLinks.join(', ');
      text = text?.slice(0, endIndex) + citationString + text?.slice(endIndex);
    }
  }

  return text;
}
