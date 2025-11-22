import { GoogleGenAI } from '@google/genai';
import { addCitations, getTokenomics } from './utils';
import type { Tokenomics } from '@codestrap/developer-foundations-types';

export async function generateDesignSpec(
  user: string,
  system: string,
  readme: string,
): Promise<{ answer: string; tokenomics: Tokenomics }> {
  // Configure the client
  const ai = new GoogleGenAI({});

  // Define the grounding tool
  const groundingTool = {
    googleSearch: {},
  };

  // Configure generation settings
  const config = {
    tools: [groundingTool],
    temperature: 0,
  };

  // Make the request
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `${system}
${user}
# The README that explains the layout of the codebase you are working in. 
You must carefully review this to understand effected files, methodologies, APIs etc. 
It is your rosetta stone for understanding how to write code in our codebase:
${readme}`,
    config,
  });

  const answer = addCitations(response);
  const tokenomics = getTokenomics(response, 'gemini-2.5-flash');

  if (!answer) {
    throw new Error('Did not receive a valid answer');
  }

  return {
    answer,
    tokenomics,
  };
}
