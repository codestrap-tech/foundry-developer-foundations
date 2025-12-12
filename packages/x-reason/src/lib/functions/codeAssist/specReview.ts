import * as path from 'path';
import * as fs from 'fs';

import {
    AbstractReviewState,
    Context,
    FileOp,
    MachineEvent,
    SpecReviewState,
    ThreadsDao,
    TYPES,
    UserIntent,
    VersionControlService,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { googleFileOpsGenerator, googleSpecGenerator } from './delegates';
import { saveFileToGithub, writeFileIfNotFoundLocally } from './delegates/github';
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
            system
        );

        const retriedFailures = await verifyFilePaths(ops);
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

async function runNxGenerate(generator: string, options: {
    name: string | undefined; // name of the package where the generated file will be placed
    promptFile: string; // path to the prompt file to be used by the generator
    fileName: string; // name of the file to be generated
}): Promise<void> {
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
            }
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
        })
    );

    // 2) For each successful match, kick off the generator and keep context
    const runTasks: Promise<{file: FileOp; fileContents: string}>[] = [];

    for (const r of matchSettled) {
        if (r.status !== 'fulfilled' || !r.value?.generator) {
            const file = r.status === 'fulfilled' ? r.value.file : undefined;
            console.error(`failed to find a generator for file: ${file?.file ?? '(unknown)'}`);
            continue;
        }

        const { file, generator, samplePrompts, projectJson, promptGuide } = r.value;

        const promise = new Promise<{file: FileOp; fileContents: string}>(async (resolve, reject) => {
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
                            { role: 'system', content: [{ type: 'input_text', text: system }] },
                            { role: 'user', content: [{ type: 'input_text', text: user }] },
                        ],
                        reasoning: { "effort": "low" },
                        text: { verbosity: 'low' },
                        store: true,
                    }),
                });

                const resp = await response.json();

                // Find the message block inside the output
                const msg = (resp.output ?? []).find(
                    (o: any) => o.type === 'message' && o.status === 'completed'
                ).content[0].text;
                if (!msg) {
                    throw new Error('No message block found in output');
                }

                // save the file
                const fileName = `generator-prompt-${generator}.md`;
                const abs = path.resolve(process.env.BASE_FILE_STORAGE || process.cwd(), fileName);
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
                const pathToGeneratedFile = path.resolve(process.env.WORKSPACE_ROOT!, config.sourceRoot!, 'lib', `${options.fileName}.ts`);
                const fileContents = await fs.promises.readFile(pathToGeneratedFile, 'utf-8');
                file.stubCode = fileContents;

                resolve({file, fileContents});
            } catch (error) {
                reject({ file, error });
            }
        });

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
            const { file, error } = res.reason as {file: FileOp; error: any};
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
    task?: string
): Promise<SpecReviewState> {
    // get the previous confirm user intent state that generated the spec we are reviewing
    const confirmUserIntentId =
        context.stack
            ?.slice()
            .reverse()
            .find((item) => item.includes('confirmUserIntent')) || '';
    const { file: clarificationFile } = context[confirmUserIntentId] as UserIntent || { approved: false };

    await writeFileIfNotFoundLocally(clarificationFile);

    // there must be a clarification file from the previous confirmUserIntent state
    if (!clarificationFile || !fs.existsSync(clarificationFile)) throw new Error(`clarification file does not exist: ${clarificationFile}`);

    // get the state
    const specReviewId =
        context.stack
            ?.slice()
            .reverse()
            .find((item) => item.includes('specReview')) || '';
    const { approved, messages, file: specReviewFile, userResponse } = context[specReviewId] as AbstractReviewState || { approved: false }

    const fileName = `spec-${context.machineExecutionId}.md`;
    const file = specReviewFile || path.resolve(process.env.BASE_FILE_STORAGE || process.cwd(), fileName);

    // If spec file doesn't exist yet, generate it from the clarification
    if (!fs.existsSync(file)) {
        const clarificationContents = await fs.promises.readFile(clarificationFile, 'utf8');

        const readmePath = path.resolve(process.env.BASE_FILE_STORAGE || process.cwd(), `readme-${context.machineExecutionId}.md`);
        if (readmePath && !fs.existsSync(readmePath)) throw new Error(`README file does not exist: ${readmePath}`);
        const readme = await fs.promises.readFile(readmePath, 'utf8');

        const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
        let messagesThread;
        try {
            messagesThread = await threadsDao.read(context.machineExecutionId!);
        } catch {
            /**empty */
        }
        const parsedMessages = JSON.parse(messagesThread?.messages || '[]') as {
            user?: string;
            system: string;
        }[];

        const system = `
You are a **software design specialist** collaborating with a human software engineer.
Your role is to **produce actionable design specifications** for software features and changes.

Your ultimate output is a **complete design specification** for the user's task.

---

# Hard Rules for Generating a Design Spec

- You must always follow the user's instructions exactly.
- Ensure you clarify requirements that may be implied but not specified by the user directly.
- Prefer extension over modification when breaking changes are likely, or change sets are large (we want to reduce the blast radius of potential bugs).
- A valid design spec MUST include all of the following sections:

 **Design spec name**

   * Concise title (≤7 words) with a version if supplied (e.g., v0.1). Default version to v0.

**Instructions**

   * Summarize the user's request clearly and directly.

**Overview**

   * Describe the feature or proposed change in plain language.
   * State scope, purpose, success criteria, dependencies, and assumptions.

**Constraints**

   * **Language**: Required programming language(s) and version(s).
   * **Libraries**: Required external libraries with rationale.

**Auth scopes required**

   * List all permissions/scopes needed, with justification.

**Security and Privacy**

   * Required access controls, data protection, privacy measures, log sanitization, and least-privilege enforcement.

**External API Documentation References**

   * Provide relevant links.
   * Summarize the methods, request/response types, and key behaviors used.

 **Files Added/Modified/Required**:
  Added files are net new files
  Modified files are that will be changes
  Required files are files that will neither be added nor modified but required to perform the additions or modification.
  The most common case is when creation a new version of an existing file or extending the capabilities of an existing function
  For example:
    Files added/modified
    - Modified: packages/services/google/src/lib/delegates/sendEmail.ts
    - Added: packages/services/google/src/lib/delegates/driveHelpers.ts
    - Modified: packages/services/google/src/lib/types.ts (EmailContext, SendEmailOutput)
    - Added: packages/services/google/src/lib/delegates/sendEmail.test.ts
  Or
  Files added/modified
    - Required: packages/services/palantir/src/lib/doa/communications/communications/upsert.ts
    - Added: packages/services/palantir/src/lib/doa/communications/communications/upsert.v2.ts
    - Added: packages/services/palantir/src/lib/doa/communications/communications/upsert.v2.test.ts
    - Modified: packages/types/src/lib/types.ts (Machine)
  This ensures our code editor can distinguish how to handle the changes with ts-morph, and the coder has sufficient context to write the code

**Inputs and Outputs**

    * **Proposed Input Type Changes/Additions**: schemas, fields, validation rules.
    * **Proposed Output Type Changes/Additions**: schemas, error envelope structure.

**Functional Behavior**

    * Step-by-step description of algorithm and feature behavior.
    * Include idempotency, concurrency, and performance if applicable.
    * Denote what is in scope vs. out of scope.

**Error Handling**

    * Describe categories, HTTP status mappings (if relevant), retry/backoff strategies, and sanitization of logs.

**Acceptance Criteria**

    * Provide plain-text test specification in **Gherkin format** only.
    * Cover happy paths, edge cases, and error scenarios.

**Usage (via client)**

    * Show how a client would use the feature.
    * Use pseudo code only (never real code).
    * Include example request/response shapes.

---

## Additional Requirements

* Specs can only contain **pseudo code** (never runnable code).
* Every requirement must be **observable and testable**.
* Always distinguish between **Added files**, **Modified files**, and **Required files**.
* Never omit sections — all must be present, even if marked TBD.

---
`;

        const user = `
    # Instructions
    Read EVERYTHING below before writing. Then produce a single, final design specification that follows the template exactly.

    # Initial user request
    Below is the engineer's initial request and relevant context (stack, APIs, tests, file paths, prior threads).
    ${context.initialUserPrompt}

    # Clarification Q&A
    Below is the complete clarification conversation where all questions have been answered.
    ${clarificationContents}

    Ensure your answer follows the **Design Specification Template**.
    All sections are REQUIRED. Do not add or remove sections or bullets.

    # Design Specification Template
    - **Design spec**: The name of the design spec
      - Provide a concise, unique name (≤ 7 words) and include a version (e.g., v0.1).
    - **Instructions**: The request(s) from the end user
      - Quote or summarize the user's ask in one short paragraph. Include goals and explicit non-goals if stated.
    - **Overview**: The expanded prompt filled in with key general details that more clearly define the scope of work
      - Summarize purpose, primary user(s), and success criteria.
      - List major assumptions if any were required to proceed.
      - Note dependencies (systems/services) at a high level.
    - **Constraints**
      - **Language**: The required programming language
        - State exact version range (e.g., Node.js 20.x, Python 3.11).
      - **Libraries**: The required external libraries derived from the information in the supplied README
        - Enumerate by name@version with brief rationale and any pinning/compat constraints.
    - **Files Added/Modified/Required**:
      - Files Added/Modified/Required
      - List provider(s), scopes/permissions, and why each is needed. Include least-privilege notes.
    - **Security and Privacy**: Security and privacy concerns.
      - Specify data handled (PII/PHI/credentials), storage/retention, encryption in transit/at rest, secrets management, and threat/abuse considerations.
    - **External API Documentation References**: Documentation links and method summaries for consumed public interfaces
      - For each API: base URL, key endpoints/methods, request/response schemas (brief), and rate limits/timeouts/retry guidance.
    - **Inputs and Outputs**
      - **Proposed Input Type Changes/Additions**:
        - Define input schema(s) with fields, types, required/optional, defaults, and validation rules.
      - **Proposed Output types Changes/Additions**:
        - Define output schema(s) with fields, types, error envelope structure, and pagination/streaming if applicable.
    - **Functional Behavior**: The functional requirements including implied behaviors
      - Describe end-to-end flow as numbered steps.
      - Include edge cases, idempotency, ordering, concurrency, and performance SLAs if stated or implied.
      - Call out out-of-scope behaviors explicitly (for future work).
    - **Error Handling**
      - Define error classes/categories, HTTP status mappings (if applicable), retry/backoff policy, and user-visible messages vs. internal logs.
    - **Acceptance Criteria**: A proposed test specification in plain text. No code. Use the Gherkin spec file syntax.
    For example:
      \`\`\`gherkin
  Feature: Guess the word
      # The first example has two steps
  Scenario: Maker starts a game
        When the Maker starts a game
        Then the Maker waits for a Breaker to join

      # The second example has three steps
  Scenario: Breaker joins a game
        Given the Maker has started a game with the word "silky"
        When the Breaker joins the Maker's game
        Then the Breaker must guess a word with 5 characters
    \`\`\`
      - Provide happy path, key edge cases, and failure cases that map to "Functional Behavior" and "Error Handling."
    - **Usage (via client)**: a description of the proposed API and of how clients will call the proposed API. Can include pseudo code.
      - Show request/response shapes (names only, not full code), example call(s), and minimal integration steps. Indicate auth usage and expected status codes.
`;

        const { answer: specContent } = await googleSpecGenerator(user, system, readme);

        // Save the generated spec
        await fs.promises.writeFile(file, specContent, 'utf8');
        await saveFileToGithub(file, specContent);

        // Return for user review
        return {
            approved: false,
            messages: [{ system: 'Please review the design specification.' }],
            reviewRequired: true,
            file,
        };
    }

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
        }
    }

    // get the most recent message as part of review
    const { user, system } = messages?.[messages?.length - 1] || {};

    // if the user has responded we want to regenerate the spec with their feedback
    if (user || userResponse) {
        const feedbackText = user || userResponse;
        const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);
        const messageThread = await threadsDao.read(context.machineExecutionId!);
        const parsedMessages = JSON.parse(messageThread?.messages || '[]') as {
            user?: string;
            system?: string;
        }[];

        parsedMessages?.push({ user: feedbackText, system });

        await threadsDao.upsert(
            JSON.stringify(parsedMessages),
            'cli-tool',
            context.machineExecutionId!
        );

        const currentSpec = await fs.promises.readFile(file, 'utf8');
        const clarificationFile = (context[confirmUserIntentId] as UserIntent)?.file;
        const clarificationContents = clarificationFile ? await fs.promises.readFile(clarificationFile, 'utf8') : '';

        const readmePath = path.resolve(process.env.BASE_FILE_STORAGE || process.cwd(), `readme-${context.machineExecutionId}.md`);
        const readme = await fs.promises.readFile(readmePath, 'utf8');

        const systemPrompt = `
You are a **software design specialist** collaborating with a human software engineer.
Your role is to **revise design specifications** based on user feedback.

The user has reviewed the design specification and provided feedback.
Your task is to incorporate their feedback and produce an updated design specification.

All sections from the original template are REQUIRED. Do not add or remove sections.
`;

        const userPrompt = `
# Initial user request
${context.initialUserPrompt}

# Clarification Q&A
${clarificationContents}

# Current Design Specification
${currentSpec}

# User Feedback
${feedbackText}

# Your Task
Incorporate the user's feedback into the design specification.
Merge and reconcile: Resolve conflicts explicitly; don't drop constraints.
Reuse prior facts: Keep existing sections verbatim unless the user specifically requested changes.
Ensure your answer follows the complete Design Specification Template with all required sections.
`;

        const { answer: updatedSpec } = await googleSpecGenerator(userPrompt, systemPrompt, readme);

        await fs.promises.writeFile(file, updatedSpec, 'utf8');
        await saveFileToGithub(file, updatedSpec);

        // there is a user response, reset review required to false since the user has supplied feedback
        // this will allow the function catalog to re-enter the specReview state
        return {
            approved: false,
            reviewRequired: false,
            file,
            messages: messages,
        }
    }

    messages?.push({ system: 'Please review the spec file.' });

    return {
        approved: false,
        reviewRequired: true,
        file,
        messages: messages || [{ system: 'Please review the spec file.' }],
    }
}
