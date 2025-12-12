import type {
  Context,
  MachineEvent,
  ThreadsDao,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { TYPES } from '@codestrap/developer-foundations-types';
import { softwareDesignSpec } from './softwareDesignSpec';

export type SearchDocumentationResults = {
  searchResults: string;
};

export async function searchDocumentation(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<SearchDocumentationResults> {
  const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);

  const { messages } = await threadsDao.read(context.machineExecutionId || '');
  const parsedMessages = JSON.parse(messages || '[]') as {
    user?: string;
    system: string;
  }[];

  const prompt = `
    Design Specification Conversation Thread:
    ${messages}

    Task:
    ${task}
    `;

  // TODO: explore how we can Promise.allSettled(researchAssistant1, researchAssistant1, ...) without killing ourselves with token cost and rate limits
  // then use a higher end none reasoning model (or gpt with instant answer) to use the input plans and synthesize the best possible response
  const response = await softwareDesignSpec(
    prompt,
    2,
    undefined,
    undefined,
    undefined,
    'b2b532a80bf4c4303'
  );

  parsedMessages.push({
    user: task,
    system: response,
  });

  if (context.machineExecutionId) {
    await threadsDao.upsert(
      JSON.stringify(parsedMessages),
      'cli-tool',
      context.machineExecutionId
    );
  }

  return {
    searchResults: response,
  };
}
