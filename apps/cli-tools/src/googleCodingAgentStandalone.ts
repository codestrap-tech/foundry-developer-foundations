import * as fs from 'fs';
import * as path from 'path';

import {
  Larry,
  LarryResponse,
} from '@codestrap/developer-foundations-agents-vickie-bennie';
import { container } from '@codestrap/developer-foundations-di';
import {
  Context,
  MachineDao,
  ThreadsDao,
  TYPES,
} from '@codestrap/developer-foundations-types';
import { LarryAgentFactory, SupportedCodingAgents, SupportedEngines } from '@codestrap/developer-foundations-x-reason';
import 'dotenv/config';
import { uuidv4 } from '@codestrap/developer-foundations-utils';

export async function googleCodingAgent(
  executionId?: string,
  contextUpdateInput?: string,
  task?: string
): Promise<{ executionId: string; error?: string }> {
  try {
    container.bind(TYPES.LarryCodingAgentFactory).toConstantValue(LarryAgentFactory(SupportedCodingAgents.GOOGLE));

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

    const machineDao = container.get<MachineDao>(TYPES.MachineDao);
    const { state } = await machineDao.read(executionId);
    const { context } = JSON.parse(state!) as { context: Context };
    // handle human review states
    if (
      context.stateId.includes('specReview') ||
      context.stateId.includes('confirmUserIntent') ||
      context.stateId.includes('architectureReview') ||
      context.stateId.includes('codeReview') ||
      context.stateId.includes('pause')
    ) {
      let stateId = context.stateId;
      // sometimes we land on pause due to race conditions. I need to track them down. Once fixed we should be able to remove this
      if (context.stateId.includes('pause')) {
        // reset to the first state that is not pause
        stateId =
          context.stack
            ?.slice()
            .reverse()
            .find((item) => !item.includes('pause')) || '';
      }

      if (!stateId) {
        throw new Error('unable to resolve stateID');
      }

      if (
        !stateId.includes('specReview') &&
        !stateId.includes('architectureReview') &&
        !stateId.includes('codeReview') &&
        !stateId.includes('confirmUserIntent')
      ) {
        return;
      }

      console.log('currentStateId:: ', stateId);
      console.log(
        'running next state with contextUpdateInput:: ',
        contextUpdateInput
      );
      await larry.getNextState(
        undefined,
        true,
        executionId,
        contextUpdateInput,
        SupportedEngines.GOOGLE_SERVICES_CODE_ASSIST,
        true
      );
    }

    return { executionId };
  } catch (error) {
    console.error('Google Coding Agent Standalone Error:: ', error);
    return { executionId, error: error.message };
  }
}
