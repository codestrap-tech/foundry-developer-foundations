export async function getOpenAIResponse(
  user: string,
  system: string,
  format?: Record<string, unknown>,
  verbosity = 'low',
): Promise<string> {
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
        format,
        verbosity,
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

  return msg;
}
