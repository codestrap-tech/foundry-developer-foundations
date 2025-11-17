import * as path from 'path';
import * as fs from 'fs';

import {
  Completion,
  Context,
  FileOp,
  MachineEvent,
  ThreadsDao,
  UserIntent,
  VersionControlService,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { TYPES } from '@codestrap/developer-foundations-types';
import {
  openAiImplementationGenerator,
} from './delegates';
import { saveFileToGithub, writeFileIfNotFoundLocally } from './delegates/github';

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
            f.file
          );

          if (!fs.existsSync(filePath)) {
            console.log(`file does not exist: ${filePath}`);
            reject(f);
          } else {
            resolve(f);
          }
        })
    );

  const fileContents = await Promise.allSettled(promises);
  const failed = fileContents.filter((result) => result.status === 'rejected');

  return failed;
}

export function parseAffectedFilesBlock(fileText: string) {
  const blockRegex = /^# Affected Files\s+```json\s*([\s\S]*?)\s*```/m;
  const match = fileText.match(blockRegex);
  if (!match) return undefined;

  try {
    const jsonText = match[1].trim();
    const data = JSON.parse(jsonText);
    return data as FileOp[];
  } catch (err) {
    console.error("Failed to parse affected files block:", err);
    return undefined;
  }
}

async function getEffectedFileList(plan: string) {
  const ops = parseAffectedFilesBlock(plan);
  const failed = await verifyFilePaths(ops || []);
  const retriedFailures = await verifyFilePaths(ops || []);

  if (failed.length > 0) {
    if (retriedFailures.length > 0) {
      throw new Error(
        `can not resolve paths for the following files: ${JSON.stringify(
          retriedFailures
        )}`
      );
    }
  }

  return ops;
}

async function getEffectedFileBlocks(ops: FileOp[]) {
  const repoRootFolder = process.env.REPO_ROOT as string;
  // TODO: for each file block classify the edits to be performed based on file type. 
  // Note you need a factory to get the delegate to handle the edits based on the path.
  // the factory can parse known paths like packages/google
  // If no delegate is found for a path just use a generic default delegate
  // using a specialized delegate allows us to use generators to generate stub code and specialized prompts for producing edits
  // for example the packages/google delegate can further check the path for an associated generator.
  // For example packages/services/google/src/lib/delegates/scheduleMeeting.ts (ADDED) could match 'packages/services/google/src/lib/delegates' -> DELEGATE GENERATOR
  // then generate the stub code passing it in the request to generate the code changes
  // once the delegate is found for each block call it passing the plan and ask it to produce the edits for the associated block and only those edits
  // use promise all settled and retry anything that is 439 rate limit
  // make sure you get back a structured response
  // then combine all settled delegate responses and return FileOp[]

  // we overwrite every time to take into account that changes may have been introduced that effect the fil list
  // load the contents of the listed file where modified is true and await Promise.all
  const root = process.cwd();
  const inInLocalDev = root.includes(repoRootFolder);
  const repoRoot = inInLocalDev
    ? root.split(repoRootFolder)[0]
    : root.split('workspace')[0];
  const promises = ops
    .filter((f) => f.type === 'modified' || f.type === 'required')
    .map(
      (f) =>
        new Promise((resolve, reject) => {
          const filePath = path.join(
            inInLocalDev
              ? `${repoRoot}/${repoRootFolder}`
              : `${repoRoot}/workspace`,
            f.file
          );

          if (!fs.existsSync(filePath)) {
            console.log(`file does not exist: ${filePath}`);
            resolve({
              file: filePath,
              modified: false,
              contents: undefined,
            });
          }

          fs.promises
            .readFile(filePath, 'utf8')
            .then((value) => {
              f.contents = value;
              resolve(f);
            })
            .catch((e) => {
              reject(e);
            });
        })
    );

  const fileContents = (
    (await Promise.all(promises)) as {
      file: string;
      modified: boolean;
      contents?: string;
    }[]
  ).filter((item) => item.contents !== undefined);

  const blocks = fileContents.reduce((acc, cur) => {
    acc = `${acc}
- File path: ${cur.file}
- Contents:
\`\`\`typescript
${cur.contents}
\`\`\`
`;
    return acc;
  }, `# Current contents of the Files to be Modified`);

  return blocks;
}

export async function architectImplementation(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<Completion> {
  // TODO fix me. the parallel attibute is not appearing on the state but the transitions
  // includes logic is being set to true by default. It should be false

  const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
  // we use the thread because it should not only contain the design specification but user comments as well
  const { messages } = await threadsDao.read(context.machineExecutionId!);
  const parsedMessages = JSON.parse(messages || '[]') as {
    user?: string;
    system?: string;
  }[];

  const architectImplementationId =
    context.stack
      ?.slice()
      .reverse()
      .find((item) => item.includes('architectImplementation')) || '';

  const { userResponse, file } =
    (context[architectImplementationId] as UserIntent) || {};

  await writeFileIfNotFoundLocally(file);

  let updatedContents;
  if (file) {
    // read the file that may contain updates from the user
    updatedContents = await fs.promises.readFile(file, 'utf8');
  }

  // if there is a user response regenerate pass it along with the updated contents
  // else generate a new architecture plan
  const confirmUserIntentId =
    context.stack
      ?.slice()
      .reverse()
      .find((item) => item.includes('confirmUserIntent')) || '';

  const { file: designSpec } =
    (context[confirmUserIntentId] as UserIntent) || {};

  await writeFileIfNotFoundLocally(designSpec);

  if (!designSpec || !fs.existsSync(designSpec))
    throw new Error(`File does not exist: ${designSpec}`);

  const plan = await fs.promises.readFile(designSpec, 'utf8');

  const files = await getEffectedFileList(plan);
  const fileBlocks = await getEffectedFileBlocks(files || []);

  const system = `
You are a helpful AI engineering architect that specializes in creating the final design specification based on the design specification created by the requirements team.
Your job is to create a clean specification grounded in the provided specification with the code to be written. You must generate the proposed code!
The specification includes citations to ground you in the sources of documentation to be used

### User Inputs Include
- A “Design Specification Conversation Thread” that may include:
  - API surface (functions, types, file paths)
  - Tech stack (languages, frameworks, SDKs, library names and versions)
  - Test names and error phrases
  - Environment/build tools (Nx, Jest, Next.js, ts-jest, Google APIs, etc.)
  - Explicit constraints (e.g., “25 MB total attachment size”)
- A user task/question.

You always carefully evaluate user input before generating your response.
  `;

  const user = userResponse
    ? `
# Instructions
Generate the code blocks for the design specification below. Ensure you adhere to the specified programming language
style, and rules. Incorporate the feedback in the user response by carefully reviewing them along with your previous response.

# Rules for answer synthesis
- For modified files output a diff view of the changes. Output the smallest change set possible. For example do not output the entire contents of the types file if all you are doing is adding a single property to a type. Just output a diff of that type with your changes applied.
- Do not nest type definitions inside functions
- Make sure you code is complete and free form error
- Prefer use of array methods like map, forEach, reduce etc and chain operations to achieve the desired output state as much as possible
- Always use Maps when you need key/value lookups. When populating a map prefer an array of tuples passed to the constructor over multiple calls to set or loops.
- Never use await inside loops, collect promises and use Promise.all or Promise.allSettled for operations where failure of some promises is acceptable
- Prefer pure functions
- Prefer stateless functions when possible.
- Always clear references that might block garbage collection and cause memory leaks
- Leave all test cases blank for the developer to fill in. In the comments for each test scenario include the gherkin specification as comments.
- prefer destructuring with defaults over handling properties. For example prefer this type of style:
  \`\`\`typescript
  const {
  userId,
  labels = [],
  senders = [],
  subject,
  maxResults,
  pageToken,
  } = input;
  \`\`\`
  over
  \`\`\`typescript
  if (!input.labels) input.labels = [];
  \`\`\`
  Destructing is more modern and efficient
- Do not engage in useless defensive programming. Let errors be thrown if types passed at runtime are incorrect. Never check things like \` typeof someString === 'string'\`. Let the freaking type system and linters do their job! The only time defensive programming is required is when handling user inputs in ui components or our api handlers for user input submission. You do not need defensive programming for operations downstream.

# User Response
${userResponse}

# The Results of Your Previous attempt at generating the final design specification .
Carefully review for any change requests, answers to questions, etc., from the user.
${updatedContents}

Generate the code blocks. Produce your answer using the **Code Edit Template** below. 
- **Code Blocks**:
  - For each file added/modified output the code block as follows:
    File: the path to the file extracted from the design specifications followed by either (MODIFIED) or (ADDED), for example: packages/services/google/src/lib/delegates/sendEmail.ts (MODIFIED)
    \`\`\`<language (for added files) or diff (for modified files)>
    <YOUR_CODE_HERE>
    \`\`\`
`
    : `
# Instructions
Generate the code blocks for the design specification below. Ensure you adhere to the specified programming language
style, and rules. 

# Rules for answer synthesis
- For modified files output a diff view of the changes. Output the smallest change set possible. For example do not output the entire contents of the types file if all you are doing is adding a single property to a type. Just output a diff of that type with your changes applied.
- Do not nest type definitions inside functions
- Make sure you code is complete and free form error
- Prefer use of array methods like map, forEach, reduce etc and chain operations to achieve the desired output state as much as possible
- Always use Maps when you need key/value lookups. When populating a map prefer an array of tuples passed to the constructor over multiple calls to set or loops.
- Never use await inside loops, collect promises and use Promise.all or Promise.allSettled for operations where failure of some promises is acceptable
- Prefer pure functions
- Prefer stateless functions when possible.
- Always clear references that might block garbage collection and cause memory leaks
- Leave all test cases blank for the developer to fill in. In the comments for each test scenario include the gherkin specification as comments.

Generate the code blocks. Produce your answer using the **Code Edit Template** below. 
- **Code Blocks**:
  - For each file added/modified output the code block as follows:
    File: the path to the file extracted from the design specifications followed by either (MODIFIED) or (ADDED), for example: packages/services/google/src/lib/delegates/sendEmail.ts (MODIFIED)
    \`\`\`<language (for added files) or diff (for modified files)>
    <YOUR_CODE_HERE>
    \`\`\`
`;

  const prompt = `${user}
# The Design Specification
${plan}

# And the complete file contents of files to be modified.
${fileBlocks}`;

  // TODO inject this
  const { answer, tokenomics } = await openAiImplementationGenerator(
    prompt,
    system
  );

  if (userResponse) {
    // reset the user response so they can respond again!
    context[confirmUserIntentId].userResponse = undefined;
  }

  parsedMessages.push({
    // we purposefully omit the file blocks and the plan from the messages to avoid massive bloat.
    // They can be reconstructed later by loading the plan file or extracting the fileBlocks from
    // the proposedCodeEdits md file (split on # The complete current contents of all files being modified without any changes applied)
    user: user,
    system: answer,
  });

  await threadsDao.upsert(
    JSON.stringify(parsedMessages),
    'cli-tool',
    context.machineExecutionId!
  );

  const msg = `
# Proposed Code Edits
${answer}

# The complete current contents of all files being modified without any changes applied
${fileBlocks}
  `;

  const fileName = `proposedCodeEdits-${context.machineExecutionId}.md`;
  const abs = path.resolve(
    process.env.BASE_FILE_STORAGE || process.cwd(),
    fileName,
  );

  await fs.promises.writeFile(abs, msg, 'utf8');

  await saveFileToGithub(abs, msg);

  return {
    confirmationPrompt: msg,
    file: abs,
    tokenomics,
  };
}
