import * as fs from 'fs';
import * as path from 'path';

import {
  Larry,
  LarryResponse,
} from '@codestrap/developer-foundations-agents-vickie-bennie';
import { container } from '@codestrap/developer-foundations-di';
import {
  TYPES,
  LarryStream,
} from '@codestrap/developer-foundations-types';
import { SupportedCodingAgents, SupportedEngines } from '@codestrap/developer-foundations-types';
import { LarryAgentFactory } from '@codestrap/larry-config';
import 'dotenv/config';
import { uuidv4 } from '@codestrap/developer-foundations-utils';

export async function googleCodingAgent(
  executionId?: string,
  contextUpdateInput?: string,
  task?: string
): Promise<{ executionId: string; error?: string }> {
  try {
    // make sure correct LarryCodingAgentFactory is bound
    if (container.isBound(TYPES.LarryCodingAgentFactory)) {
      container.unbind(TYPES.LarryCodingAgentFactory);
      container.bind(TYPES.LarryCodingAgentFactory).toConstantValue(LarryAgentFactory(SupportedCodingAgents.GOOGLE));
    }

    const larry = new Larry();
    let result: LarryResponse | undefined;
    let answer;

    console.log('updated context:: ', contextUpdateInput);
    if (!executionId) {
      // start a new execution and thread using the input task
      answer = task;
      executionId = uuidv4();

      result = await larry.askLarry(
        `# User Question
        ${answer}
        `,
        process.env.FOUNDRY_TEST_USER
      );
      executionId = result.executionId;

      return { executionId };
    }
    

    await larry.getNextState(
      undefined,
      true,
      executionId,
      contextUpdateInput,
      SupportedEngines.GOOGLE_SERVICES_CODE_ASSIST,
      true
    );

    return { executionId };
  } catch (error) {
    console.error('Google Coding Agent Standalone Error:: ', error);
    const larryStream = container.get<LarryStream>(TYPES.LarryStream);
    
    larryStream.publish({
      id: executionId || 'new-thread-creation',
      payload: {
        type: 'error',
        message: `Error in googleCodingAgent: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          error: error,
          executionId: executionId || 'new-thread-creation',
        },
      },
    });
    
    return { executionId, error: error instanceof Error ? error.message : String(error) };
  }
}
