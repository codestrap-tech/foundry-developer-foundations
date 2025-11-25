#!/usr/bin/env node

import { input, select } from '@inquirer/prompts';
import * as fs from 'fs';

import {
  Larry,
  LarryResponse,
} from '@codestrap/developer-foundations-agents-vickie-bennie';
import { container } from '@codestrap/developer-foundations-di';
import {
  AbstractReviewState,
  Context,
  MachineDao,
  TYPES,
  CreateGoogleSlidesInput,
} from '@codestrap/developer-foundations-types';
import {
  SupportedCodingAgents,
  SupportedEngines,
} from '@codestrap/developer-foundations-types';
import { LarryAgentFactory } from '@codestrap/larry-config';
import 'dotenv/config';
import { uuidv4 } from '@codestrap/developer-foundations-utils';
import { makeGSuiteClientV3 } from '@codestrap/developer-foundations-services-google';

import { applyEdits } from './assets/applyEdits';
import { generateSlides } from '@codestrap/developer-foundations-x-reason';

export async function googleCodingAgent(
  executionId?: string,
  contextUpdateInput?: string,
  task?: string,
) {
  const larry = new Larry();
  let result: LarryResponse | undefined;

  if (!executionId) {
    // start a new execution and thread using the input task
    executionId = uuidv4();

    result = await larry.askLarry(
      `# User Question
      ${task}
      `,
      process.env.FOUNDRY_TEST_USER,
    );

    executionId = result.executionId;
  } else {
    // restart where we left off
    await larry.getNextState(
      undefined,
      true,
      executionId,
      contextUpdateInput,
      SupportedEngines.GOOGLE_SERVICES_CODE_ASSIST,
      true,
    );
  }

  const machineDao = container.get<MachineDao>(TYPES.MachineDao);
  const { state } = await machineDao.read(executionId);
  const { context } = JSON.parse(state!) as { context: Context };

  // handle human review states
  if (
    context.stateId.includes('specReview') ||
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
      !stateId.includes('codeReview')
    ) {
      return;
    }

    // get the system response by grabbing the last instance of system response from the messages array
    const { messages, reviewRequired } = context[
      stateId
    ] as AbstractReviewState;
    const lastMessage = messages
      ?.slice()
      .reverse()
      .find((item) => item.user === undefined);

    if (reviewRequired) {
      const approved =
        (await select({ message: 'Approved', choices: ['yes', 'no'] })) ===
        'yes';

      if (!approved) {
        const userResponse = await input({
          message: 'Please provide feedback on what you would like changed',
        });

        lastMessage!.user = userResponse;
      } else {
        lastMessage!.user = 'Looks good, approved.';
      }

      // get the target stateId to apply the contextual update to, in this case where we left off
      const contextUpdate = {
        [context.stateId]: { messages, approved }, // messages will be destructured onto the rest of the context values
      };

      await googleCodingAgent(executionId, JSON.stringify(contextUpdate));
    }
  }
}

async function runCreateGoogleSlides() {
  const filePath = await input({
    message: 'Enter the full file path to your conversation file',
  });

  if (!fs.existsSync(filePath)) {
    throw new Error(`file not found: ${filePath}`);
  }

  const raw = await fs.promises.readFile(filePath, 'utf8');

  const result = await generateSlides(
    { requestId: 'cli-context', status: 0 },
    undefined,
    raw,
  );

  console.log('\n=== Google Slides Creation Result ===\n');
  console.log('Successes:\n', JSON.stringify(result.successes, null, 2));
  console.log('\nFailures:\n', JSON.stringify(result.failures, null, 2));
  console.log('\n====================================\n');
}

async function main() {
  const args = process.argv.slice(2);
  const executionIdArg = args[0];

  if (executionIdArg) {
    // TODO figure out how to resolve the coding agent from the executionIdArg
    // likely need to add an attribute to the machine execution object to track the agent
    // or maintain a separate lookup table
    await googleCodingAgent(executionIdArg);
  }

  const whichAgent = await select({
    message: 'select the agent',
    choices: ['googleCodingAgent', 'applyEdits', 'createGoogleSlides'],
  });

  if (whichAgent === 'googleCodingAgent') {
    if (container.isBound(TYPES.LarryCodingAgentFactory)) {
      container.unbind(TYPES.LarryCodingAgentFactory);
      container
        .bind(TYPES.LarryCodingAgentFactory)
        .toConstantValue(LarryAgentFactory(SupportedCodingAgents.GOOGLE));
    }

    const file = await input({
      message: 'Enter the full file path to your prompt:',
    });
    if (!fs.existsSync(file)) throw new Error('file not found!');

    const prompt = await fs.promises.readFile(file, 'utf8');
    await googleCodingAgent(undefined, undefined, prompt);
  }

  if (whichAgent === 'applyEdits') {
    const file = await input({
      message: 'Enter the full file path to the edits file:',
    });
    await applyEdits(file);
  }

  if (whichAgent === 'createGoogleSlides') {
    await runCreateGoogleSlides();
  }
}

main();
