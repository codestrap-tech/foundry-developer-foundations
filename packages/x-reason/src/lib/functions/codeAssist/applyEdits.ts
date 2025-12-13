import * as fs from 'fs';
import * as path from 'path';

import { container } from '@codestrap/developer-foundations-di';
import type {
  Context,
  EditOp,
  MachineEvent,
  ThreadsDao,
} from '@codestrap/developer-foundations-types';
import {
  TYPES,
  VersionControlService,
} from '@codestrap/developer-foundations-types';
import { executeEditMachine } from './executeEditMachine';
import { writeFileIfNotFoundLocally } from './delegates/github';

export async function applyEdits(
  context: Context,
  event?: MachineEvent,
  task?: string,
) {
  const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
  const repoRootFolder = process.env.REPO_ROOT as string;

  const { messages } = await threadsDao.read(context.machineExecutionId!);

  const parsedMessages = JSON.parse(messages || '[]') as {
    user?: string;
    system: string;
  }[];

  const generateEditMachineId =
    context.stack
      ?.slice()
      .reverse()
      .find((item) => item.includes('generateEditMachine')) || '';

  const { file } = context[generateEditMachineId] as { file: string };
  let updatedContents;

  await writeFileIfNotFoundLocally(file);

  if (file) {
    // read the file that may contain updates from the user
    updatedContents = await fs.promises.readFile(file, 'utf8');
  }

  if (!updatedContents) throw new Error(`updatedContents is empty!`);
  // TODO wrap in try catch
  const edits = JSON.parse(updatedContents) as { ops: EditOp[] };

  const root = process.cwd();
  const inInLocalDev = root.includes(repoRootFolder);
  // TODO support an ENV var and fallback to hard coded values
  const repoRoot = inInLocalDev
    ? root.split(repoRootFolder)[0]
    : root.split('workspace')[0];
  const baseDir = inInLocalDev
    ? `${repoRoot}/${repoRootFolder}`
    : `${repoRoot}/workspace`;
  const options = {
    baseDir,
    tsconfigPath: `${baseDir}/tsconfig.base.json`,
    dryRun: false,
    write: true,
    format: true,

    onLog: () => {},
  };

  const results = await executeEditMachine(edits.ops, options);

  parsedMessages.push({
    system: `applied edits to the following files: ${results.changedFiles.join(
      ',',
    )}`,
  });

  await threadsDao.upsert(
    JSON.stringify(parsedMessages),
    'cli-tool',
    context.machineExecutionId!,
  );

  return results;
}
