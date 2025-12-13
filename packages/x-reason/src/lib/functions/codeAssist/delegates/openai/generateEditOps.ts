import type {
  EditOp,
  Tokenomics,
} from '@codestrap/developer-foundations-types';
import { EditOpsJsonSchema } from '@codestrap/developer-foundations-types';
import { getTokenomics } from './utils';

export async function generateEditOps(
  user: string,
  system: string,
): Promise<{
  ops: EditOp[];
  tokenomics: Tokenomics;
  non_applicable: string[] | null;
  version: string;
}> {
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
      // Optional: keep or remove web_search; it isn't needed if you fully inline the spec + code
      tools: [
        {
          type: 'web_search',
          user_location: { type: 'approximate', country: 'US' },
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'EditPlan',
          schema: EditOpsJsonSchema,
          strict: true,
        },
        verbosity: 'low',
      },
      store: true,
    }),
  });

  const resp = await response.json();

  // Find the message block inside the output
  const msg = (resp.output ?? []).find(
    (o: any) => o.type === 'message' && o.status === 'completed',
  ).content[0].text;
  if (!msg) {
    throw new Error('No message block found in output');
  }
  // TODO wrap in try catch and implement retry on error
  const { ops, version, non_applicable } = JSON.parse(msg) as {
    version: string;
    ops: EditOp[];
    non_applicable: string[] | null;
  };

  // TODO post this to Foundry
  const tokenomics = getTokenomics(resp);

  return { version, non_applicable, ops, tokenomics };
}
