import { GoogleGenAI } from '@google/genai';
import { addCitations, getTokenomics } from './utils';
import type { Tokenomics } from '@codestrap/developer-foundations-types';

export async function generateImplementation(user: string, system: string): Promise<{ answer: string, tokenomics: Tokenomics }> {

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
        model: "gemini-2.5-flash",
        contents: `${system}
${user}`,
        config,
    });

    const answer = addCitations(response);
    const tokenomics = getTokenomics(response, 'gemini-2.5-flash');

    if (!answer) {
        throw new Error('Did not receive a valid answer');
    }

    return {
        answer,
        tokenomics
    };

}