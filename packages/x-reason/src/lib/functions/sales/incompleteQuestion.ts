import type { Context, MachineEvent } from '@codestrap/developer-foundations-types';

export type IncompleteQuestionResponse = {
  summary: string;
  rawResponse: string;
};

export async function incompleteQuestion(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<IncompleteQuestionResponse> {
  // use an LLM to summerize the missing infromation and return the result
  return {
    summary: 'you fucked up, fix your shit',
    rawResponse:
      'Incomplete Question - you are missing the objectives, deliverables, and timeline required for an RFP',
  };
}
