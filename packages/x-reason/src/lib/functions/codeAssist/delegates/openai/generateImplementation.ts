import type { Tokenomics } from "@codestrap/developer-foundations-types";
import { extractCitationsMarkdown, getTokenomics } from "./utils";

export async function generateImplementation(
    user: string,
    system: string,
): Promise<{ answer: string, tokenomics: Tokenomics }> {

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
            reasoning: { "effort": "low" },
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

    const resp = (await response.json());

    // Find the message block inside the output
    const msg = (resp.output ?? []).find(
        (o: any) => o.type === 'message' && o.status === 'completed'
    ).content[0].text;
    if (!msg) {
        throw new Error('No message block found in output');
    }

    const citationsMd = extractCitationsMarkdown(resp);
    const answer = `${msg}\n${citationsMd}`
    // TODO post this to Foundry
    const tokenomics = getTokenomics(resp);

    return { answer, tokenomics };

}