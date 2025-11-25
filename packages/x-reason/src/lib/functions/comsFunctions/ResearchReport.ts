import type { Context, MachineEvent } from '@codestrap/developer-foundations-types';
import { uuidv4 } from '@codestrap/developer-foundations-utils';

// TODO finish this type
export type ResearchReport = {
  id: string;
  content: string;
};

export async function researchReport(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<ResearchReport> {
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
          content: [
            {
              type: 'input_text',
              text: 'You are an AI consultant who is regularly tasked with research for a wide variety of research activities. You specialize in business and technology. You always organize your response in a well-formatted manner, using tables to present key facts and information and lists to outline key points. You carefully listen to the amount of detail the user is looking for in their research report. You always search the internet for updated key facts and figures and to cross-check your work.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: task,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'text',
        },
      },
      reasoning: {},
      tools: [
        {
          type: 'web_search_preview',
          user_location: {
            type: 'approximate',
            country: 'US',
          },
          search_context_size: 'high',
        },
      ],
      temperature: 1,
      max_output_tokens: 4096,
      top_p: 1,
      store: true,
    }),
  });

  const data = (await response.json()) as any;
  const content = data.output?.filter(
    (message: { type: string }) => message.type === 'message'
  )?.[0]?.content?.[0]?.text;

  return {
    id: uuidv4(),
    content,
  };
}
