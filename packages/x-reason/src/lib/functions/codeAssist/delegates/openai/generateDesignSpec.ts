import type { Tokenomics } from "@codestrap/developer-foundations-types";
import { extractCitationsMarkdown, getTokenomics } from "./utils";

export async function generateDesignSpec(user: string, system: string, readme: string): Promise<{ answer: string, tokenomics: Tokenomics }> {
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
                {
                    role: 'user', content: [{
                        // we don't store the README is thread messages as it will lead to massive token bloat
                        type: 'input_text', text: `${user}\n# 
            The README that explains the layout of the codebase you are working in. 
            You must carefully review this to understand effected files, methodologies, APIs etc. 
            It is your rosetta stone for understanding how to write code in our codebase:
            ${readme}`
                    }]
                },
            ],
            tools: [{ type: 'web_search' }],
            reasoning: { effort: 'low' },
            store: true,
        }),
    });

    const resp = await response.json();

    // Find the message block inside the output
    const msg = (resp.output ?? []).find(
        (o: any) => o.type === 'message' && o.status === 'completed'
    ).content[0].text;
    if (!msg) {
        throw new Error('No message block found in output');
    }

    const citationsMd = extractCitationsMarkdown(resp);
    const answer = `${msg}\n${citationsMd}`;
    // TODO post this to Foundry
    const tokenomics = getTokenomics(resp);

    if (!answer) {
        throw new Error('Did not receive a valid answer');
    }

    return {
        answer,
        tokenomics
    };
}