import {
  Completion,
  Context,
  MachineEvent,
  ThreadsDao,
  UserIntent,
  VersionControlService,
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { TYPES } from '@codestrap/developer-foundations-types';
import * as path from 'path';
import * as fs from 'fs';
import { googleSpecGenerator, openAiSpecGenerator } from './delegates';
import { saveFileToGithub, writeFileIfNotFoundLocally } from './delegates/github';

export async function confirmUserIntent(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<Completion> {
  let messages;
  const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);

  // we use the thread because it should not aonly contain the design specification but user comments as well
  try {
    messages = await threadsDao.read(context.machineExecutionId!);
  } catch {
    /**empty */
  }

  const parsedMessages = JSON.parse(messages?.messages || '[]') as {
    user?: string;
    system: string;
  }[];

  // get the contextual update if any that contains the laatest user response
  const confirmUserIntentId =
    context.stack
      ?.slice()
      .reverse()
      .find((item) => item.includes('confirmUserIntent')) || '';

  const { userResponse, file, userAnswered } = (context[confirmUserIntentId] as UserIntent) || {};

  if (userAnswered) {
    return {
      confirmationPrompt: '',
      userAnswered: true,
      reviewRequired: false,
      messages: parsedMessages,
      file,
      tokenomics: undefined,
    };
  }

  let updatedContents;

  await writeFileIfNotFoundLocally(file);

  if (file) {
    // read the file that may contain updates from the user
    updatedContents = await fs.promises.readFile(file, 'utf8');
  }

  // load the README associated with the codepath/agent/machine execution
  const readmePath = path.resolve(process.env.BASE_FILE_STORAGE || process.cwd(), `readme-${context.machineExecutionId}.md`);
  if (readmePath && !fs.existsSync(readmePath)) throw new Error(`README file does not exist: ${readmePath}`);
  const readme = await fs.promises.readFile(readmePath, 'utf8');

  const system = `
You are a **software design specialist** collaborating with a human software engineer.
Your role is to **assist in drafting actionable design specifications** for software features and changes.

Your ultimate output is a **draft of the design specification** for the user's task.

---

# Hard Rules for Generating a Design Spec

- You may ask clarifying questions **only if you lack essential information**, but never repeat the same question twice.
- Don't ask questions just to ask a question. Carefully review the users request and find answers there first. If an only if an answer can't be found in the users request ask a clarifying quesiton.
- You must always follow the user's instructions exactly.
- Ensure you clarify requirements that may be implied but not specified by the user directly. For example the user may want to add the ability to send slack messages to groups but not have states how to handle when those messages are rejected
or they don't have the required permissions.
- Prefer extension over modification when breaking changes are likely, or change sets are large (we want to reduce the blast radius of potential bugs). If the user has provided guidance here you must follow it exactly.
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

  const user = userResponse
    ? `
    # Instructions
    Read EVERYTHING below before evaluating whether you have enough information to proceed with generating a design specification.

    # Initial user request
    Below is the engineer's initial request and relevant context (stack, APIs, tests, file paths, prior threads).
    ${context.initialUserPrompt}

    # Previous questions asked
    ${updatedContents}

    # User Response
    ${userResponse}

    # Your Task
    Review the user's response carefully. Determine if you now have enough information to proceed with creating a complete design specification, or if you need more clarification.

    ## If you need MORE information:
    Generate additional clarifying questions following the same guidelines as before:
    - Don't be overly chatty or ask annoying or redundant questions
    - If you can infer the answer from the information provided, do it
    - Focus on feature behavior, user experience, error handling, retries, etc.
    - If persistence operations are involved, ensure consideration of dirty reads, stale updates, eventual consistency
    - Prefer extension over modification when breaking changes are likely
    - Never ask stupid questions about what language or dependencies to use
    - Don't delegate decisions to the developer if you know the answer
    - Don't ask for clarity just because there are multiple approaches
    - Produce the minimum number of questions possible
    - If presenting limited choices, use checkboxes: - [ ] Option

    ## If you have ENOUGH information:
    Simply respond with:
    "CLARIFICATION_COMPLETE"

    Do not generate any questions. Do not generate a design specification yet.
    Just respond with those exact words to signal that clarification is complete.
      `
    : `
# Initial user request:
Below is the engineer's initial request and relevant context (stack, APIs, tests, file paths, prior threads).
${context.initialUserPrompt}

Generate a list of questions for the developer so we can gain clarity about the work to be done so that in the next iteration we can generate a design specification.
The goal is to gather all the explicit and implied functional requirements
You also need to gather enough information to fill out the design specification.
Don't be overly chatty or ask annoying or redundant question. If you can infer the answer from the information provided then do it!
Do not ask stupid or annoying things like what language are we using or what version of dependencies.
Focus on ensuring things like the feature behavior, user experience, error handling, retries, etc.
If persistence operations are involved make sure the developer considers things like dirty reads, stale updates, and eventual consistency
Ensure the developer has context to understand complex aspects of the system by providing links to the appropriate documentation
Prefer extension over modification when breaking changes are likely, or change sets are large (we want to reduce the blast radius of potential bugs)
Never ask stupid questions like "we will send mail via Gmail API using googleapis?". Assume the existing APIs and dependencies will be used.
Never assume we will use new external dependencies. We prefer as little dependencies as possible and often opt to build solutions ourselves.
You can ask to introduce a dependency only if it could be a heavy lift to rebuild it ourselves.
Do not ask the developer to confirm tasks that will have to be done such as adding required scopes etc. You don't need to clarify something that is clearly a requirement such as auth scopes.
Don't delegate the decision to the developer if you know the answer, especially when it comes to external dependencies/APIs. You likely know more than the developer about the external APIs.
Don't ask for clarity just because there are multiple approaches. Only Ask when there clearly isn't a best practice or standard approach that will just work. For example if you can infer how dependencies are injected or passed to our code, then don't ask the developer how to provide those dependencies. Figure it out
Never ask what should the name of this new function be. Just name the function.
Strive to reuse existing type definitions if they can fullfil the use case. Types are generally safe to modify only when introducing a new optional parameter. New required parameters should always be introduced in new type that extends the old type.
Do not ask questions that are out of scope or drift out of scope.
Produce the minimum number of questions possible to get to a well defined, focused, in scope design specification
If you are presenting the user with options of which there are only a limited number of choices present them as a list of checkboxes
ie - [ ] Option.
`;

  // TODO inject this
  const { answer, tokenomics } = await googleSpecGenerator(user, system, readme);

  if (userResponse) {
    // reset the user response so they can respond again!
    context[confirmUserIntentId].userResponse = undefined;
  }

  // Check if clarification is complete
  const clarificationComplete = answer.trim() === 'CLARIFICATION_COMPLETE';

  if (clarificationComplete) {
    // User has answered all questions, ready to proceed to spec generation
    return {
      confirmationPrompt: '',
      userAnswered: true,
      reviewRequired: false,
      messages: parsedMessages,
      file,
      tokenomics,
    };
  }

  // Still need more information, save questions and pause for user response
  parsedMessages.push({
    user: user,
    system: answer,
  });

  await threadsDao.upsert(
    JSON.stringify(parsedMessages),
    'cli-tool',
    context.machineExecutionId!
  );

  const fileName = `clarification-${context.machineExecutionId}.md`;
  const abs = path.resolve(process.env.BASE_FILE_STORAGE || process.cwd(), fileName);
  await fs.promises.writeFile(abs, answer, 'utf8');

  await saveFileToGithub(abs, answer);

  return {
    confirmationPrompt: answer,
    userAnswered: false,
    reviewRequired: true,
    messages: [{system: 'Please review the clarification questions.'}],
    file: abs,
    tokenomics,
  };
}
