import * as path from 'path';
import * as fs from 'fs';

import type {
  AbstractReviewState,
  Context,
  FileOp,
  MachineEvent,
  SpecReviewState,
  ThreadsDao,
  UserIntent,
} from '@codestrap/developer-foundations-types';
import {
  TYPES,
  VersionControlService,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { googleFileOpsGenerator } from './delegates';
import {
  saveFileToGithub,
  writeFileIfNotFoundLocally,
} from './delegates/github';
import { templateFactory } from '@codestrap/developer-foundations-utils/src/lib/factory/templateFactory';
import { exec } from 'child_process';

async function verifyFilePaths(ops: FileOp[]) {
  const repoRootFolder = process.env.REPO_ROOT as string;
  const root = process.cwd();
  const inInLocalDev = root.includes(repoRootFolder);

  const repoRoot = inInLocalDev
    ? root.split(repoRootFolder)[0]
    : root.split('workspace')[0];

  // TODO we need to check each file and confirm the path exists. If not retry. If still unresolved error out.
  const promises = ops
    .filter((f) => f.type === 'modified' || f.type === 'required')
    .map(
      (f) =>
        new Promise((resolve, reject) => {
          const filePath = path.join(
            inInLocalDev
              ? `${repoRoot}/${repoRootFolder}`
              : `${repoRoot}/workspace`,
            f.file,
          );

          if (!fs.existsSync(filePath)) {
            console.log(`file does not exist: ${filePath}`);
            reject(f);
          } else {
            resolve(f);
          }
        }),
    );

  const fileContents = await Promise.allSettled(promises);
  const failed = fileContents.filter((result) => result.status === 'rejected');

  return failed;
}

async function getEffectedFileList(plan: string) {
  // TODO replace with direct call to gemini api passing schema for structured outputs
  const system = `You are a helpful AI coding assistant tasked with extracting the effected parts of the codebase from the design specification as JSON
  You always look for the file list in the spec. Below is an example:
  Files added/modified/required
  - Required: packages/services/palantir/src/lib/doa/communications/communications/upsert.ts
  - Added: packages/services/palantir/src/lib/doa/communications/communications/upsert.v2.ts
  - Added: packages/services/palantir/src/lib/doa/communications/communications/upsert.v2.test.ts
  - Modified: packages/types/src/lib/types.ts (Machine)

Once the file list is isolated you must extract and return as JSON in the following format:
[
{
file: string;
type: string;
}
]

For example:
[
    {
        "file": "packages/services/palantir/src/lib/doa/communications/communications/upsert.ts",
        "type": "required"
    },
    {
        "file": "packages/services/palantir/src/lib/doa/communications/communications/upsert.v2.ts",
        "type": "added"
    },
    {
        "file": "packages/services/palantir/src/lib/doa/communications/communications/upsert.v2.test.ts",
        "type": "added"
    },
    {
        "file": "packages/types/src/lib/types.ts",
        "type": "modified"
    }
]
  `;
  const user = `extract the changes to the codebase from the plan below and return the JSON per your system instructions
  ${plan}
  `;

  const { ops } = await googleFileOpsGenerator(user, system);

  const failed = await verifyFilePaths(ops);

  if (failed.length > 0) {
    //retry
    const { ops } = await googleFileOpsGenerator(
      `${user}
Your previous response failed to resolve the following files
${JSON.stringify(failed)}
Try again and make sure paths match exactly the paths in the supplied plan
`,
      system,
    );

    const retriedFailures = await verifyFilePaths(ops);
    if (retriedFailures.length > 0) {
      throw new Error(
        `can not resolve paths for the following files: ${JSON.stringify(
          retriedFailures,
        )}`,
      );
    }
  }

  return ops;
}

async function runNxGenerate(
  generator: string,
  options: {
    name: string | undefined; // name of the package where the generated file will be placed
    promptFile: string; // path to the prompt file to be used by the generator
    fileName: string; // name of the file to be generated
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { name, promptFile, fileName } = options;
    exec(
      `npx nx g ${generator} ${name} ${fileName} ${promptFile}`,
      { cwd: process.env.WORKSPACE_ROOT! },
      (error, stdout, stderr) => {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
        if (error) return reject(error);
        resolve();
      },
    );
  });
}

async function generateFiles(designSpec: string): Promise<FileOp[]> {
  const files: FileOp[] = await getEffectedFileList(designSpec);

  const addedFiles = files.filter((f) => f.type === 'added');
  const getTemplate = templateFactory();

  // 1) Resolve generators WITH context
  const matchSettled = await Promise.allSettled(
    addedFiles.map(async (file) => {
      const result = await getTemplate(file.file);
      return { file, ...result }; // attach file context
    }),
  );

  // 2) For each successful match, kick off the generator and keep context
  const runTasks: Promise<{ file: FileOp; fileContents: string }>[] = [];

  for (const r of matchSettled) {
    if (r.status !== 'fulfilled' || !r.value?.generator) {
      const file = r.status === 'fulfilled' ? r.value.file : undefined;
      console.error(
        `failed to find a generator for file: ${file?.file ?? '(unknown)'}`,
      );
      continue;
    }

    const { file, generator, samplePrompts, projectJson, promptGuide } =
      r.value;

    // eslint-disable-next-line no-async-promise-executor
    const promise = new Promise<{ file: FileOp; fileContents: string }>(
      async (resolve, reject) => {
        try {
          const projectConfigFile = await projectJson();
          const config = JSON.parse(projectConfigFile) as {
            name?: string;
            root?: string;
            sourceRoot?: string;
            projectType?: 'application' | 'library';
            targets?: Record<string, any>;
            tags?: string[];
          };

          // use GPT 5 mini to generate the prompt file based on the supplied file block, samplePrompts array, and design spec
          const system = `You are a helpful AI coding assistant tasked with generating code generation prompts based on file templates.`;
          const user = `
# Goal
Generate the unput prompt for the code generator based on the software design spec below and the file to be generated.

# Rules for Answer Sythesis
${promptGuide}

# The file to be generated
${file.file}

# The Design Spec
${designSpec}

# Sample Prompts
Here are some sample prompts that have been used to generate similar files in the past. Use these as inspiration to create a new prompt that fits the current file to be generated.
${samplePrompts.join('\n\n')}

# Response format
Response with the prompt as a single string. Do not include any additional commentary or explanation.
            `;

          const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.OPEN_AI_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-5-mini',
              input: [
                {
                  role: 'system',
                  content: [{ type: 'input_text', text: system }],
                },
                { role: 'user', content: [{ type: 'input_text', text: user }] },
              ],
              reasoning: { effort: 'low' },
              text: { verbosity: 'low' },
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

          // save the file
          const fileName = `generator-prompt-${generator}.md`;
          const abs = path.resolve(
            process.env.BASE_FILE_STORAGE || process.cwd(),
            fileName,
          );
          await fs.promises.writeFile(abs, msg, 'utf8');

          // make sure to capture any changes to the spec file that resulted from direct user edits
          await saveFileToGithub(fileName, msg);

          const options = {
            name: config.name, // the NX package name
            promptFile: abs,
            fileName: path.basename(file.file, path.extname(file.file)),
          };

          await runNxGenerate(generator, options);

          // load the generated file. Generators always send output to the packages src/lib directory for now
          // if this ever changes we need to capture the output path from the generator
          const pathToGeneratedFile = path.resolve(
            process.env.WORKSPACE_ROOT!,
            config.sourceRoot!,
            'lib',
            `${options.fileName}.ts`,
          );
          const fileContents = await fs.promises.readFile(
            pathToGeneratedFile,
            'utf-8',
          );
          file.stubCode = fileContents;

          resolve({ file, fileContents });
        } catch (error) {
          reject({ file, error });
        }
      },
    );

    runTasks.push(promise);
  }

  // 3) Await all generator runs and report using attached context (no indexes)
  const results = await Promise.allSettled(runTasks.map((t) => t));
  results.forEach((res) => {
    if (res.status === 'fulfilled') {
      const { file } = res.value;
      console.log(`successfully generated file for: ${file.file}`);
    } else {
      // just skip failures and let the process continue
      const { file, error } = res.reason as { file: FileOp; error: any };
      console.error(`failed to generate file for: ${file.file} with error: ${error.message}
                Error Stack: ${error.stack}`);
    }
  });

  // return updated FileOp[] if you add generated outputs
  return files;
}

export async function specReview(
  context: Context,
  event?: MachineEvent,
  task?: string,
): Promise<SpecReviewState> {
  // get the previous confirm user intent state that generated the spec we are reviewing
  const confirmUserIntentId =
    context.stack
      ?.slice()
      .reverse()
      .find((item) => item.includes('confirmUserIntent')) || '';
  const { file } = (context[confirmUserIntentId] as UserIntent) || {
    approved: false,
  };

  await writeFileIfNotFoundLocally(file);

  // there must be a spec file generated in the previous confirmUserIntent state
  if (!file || !fs.existsSync(file))
    throw new Error(`File does not exist: ${file}`);

  // get the state
  const specReviewId =
    context.stack
      ?.slice()
      .reverse()
      .find((item) => item.includes('specReview')) || '';
  const { approved, messages } = (context[
    specReviewId
  ] as AbstractReviewState) || { approved: false };

  if (approved) {
    const updatedContents = await fs.promises.readFile(file, 'utf8');
    // get the file json to be used by the architect
    const files = await generateFiles(updatedContents);
    const plan = `# Affected Files
\`\`\`json
${JSON.stringify(files, null, 2)}
\`\`\`

# Software Design Specification
${updatedContents}
`;

    // add the file block JSON for extraction downstream
    await fs.promises.writeFile(file, plan, 'utf8');

    // make sure to capture any changes to the spec file that resulted from direct user edits
    await saveFileToGithub(file, plan);

    return {
      approved,
      messages,
      reviewRequired: false,
      file,
    };
  }

  // get the most recent message as part of review
  const { user, system } = messages?.[messages?.length - 1] || {};

  // if the user has responded we want to push the system and user response onto the thread history
  // this lets us capture the user feedback as part of the broader message history
  if (user) {
    const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
    const messageThread = await threadsDao.read(context.machineExecutionId!);
    const parsedMessages = JSON.parse(messageThread?.messages || '[]') as {
      user?: string;
      system?: string;
    }[];

    parsedMessages?.push({ user, system });

    await threadsDao.upsert(
      JSON.stringify(parsedMessages),
      'cli-tool',
      context.machineExecutionId!,
    );

    messages?.push({
      system:
        "Please incorporate the user's feedback into the design specification.",
    });

    // there is a user response, reset review required to false since the user has supplied feedback
    // this will allow the function catalog to re-enter the the confirm user intent state
    return {
      approved: false,
      reviewRequired: false,
      file,
      messages: messages,
    };
  }

  messages?.push({ system: 'Please review the spec file.' });

  return {
    approved: false,
    reviewRequired: true,
    file,
    messages: messages || [{ system: 'Please review the spec file.' }],
  };
}
