import { GoogleGenAI } from '@google/genai';
import { getTokenomics } from './utils';
import type {
  EditOp,
  Tokenomics,
} from '@codestrap/developer-foundations-types';
import { EditOpsJsonSchema } from '@codestrap/developer-foundations-types';

export async function generateEditOps(
  user: string,
  system: string,
): Promise<{ ops: EditOp[]; tokenomics: Tokenomics }> {
  // Configure the client
  const ai = new GoogleGenAI({});

  // Configure generation settings
  const config = {
    // tool use with json output is unsupported
    responseMimeType: 'application/json',
    responseJsonSchema: EditOpsJsonSchema,
    temperature: 0,
  };

  // Make the request
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `${system}
${user}`,
    config,
  });

  const ops = JSON.parse(response.text || '{"ops": []}').ops as EditOp[];
  const tokenomics = getTokenomics(response, 'gemini-2.5-flash');

  return {
    ops,
    tokenomics,
  };
}
