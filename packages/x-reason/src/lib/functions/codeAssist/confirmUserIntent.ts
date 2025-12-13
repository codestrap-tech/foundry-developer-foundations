import type {
  Completion,
  Context,
  MachineEvent,
  ThreadsDao,
  UserIntent,
} from '@codestrap/developer-foundations-types';
import { VersionControlService } from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { TYPES } from '@codestrap/developer-foundations-types';
import * as path from 'path';
import * as fs from 'fs';
import { googleSpecGenerator, openAiSpecGenerator } from './delegates';
import {
  saveFileToGithub,
  writeFileIfNotFoundLocally,
} from './delegates/github';

export async function confirmUserIntent(
  context: Context,
  event?: MachineEvent,
  task?: string,
): Promise<Completion> {
  let messages;
  const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);

  // we use the thread because it should not aonly contain the design specification but user comments as well
  try {
    messages = await threadsDao.read(context.machineExecutionId!);
  } catch {
    /**empty */
  }

  // get the contextual update if any that contains the laatest user response
  const confirmUserIntentId =
    context.stack
      ?.slice()
      .reverse()
      .find((item) => item.includes('confirmUserIntent')) || '';

  const { userResponse, file } =
    (context[confirmUserIntentId] as UserIntent) || {};

  const parsedMessages = JSON.parse(messages?.messages || '[]') as {
    user?: string;
    system: string;
  }[];

  let updatedContents;

  await writeFileIfNotFoundLocally(file);

  if (file) {
    // read the file that may contain updates from the user
    updatedContents = await fs.promises.readFile(file, 'utf8');
  }

  // load the README associated with the codepath/agent/machine execution
  const readmePath = path.resolve(
    process.env.BASE_FILE_STORAGE || process.cwd(),
    `readme-${context.machineExecutionId}.md`,
  );
  if (readmePath && !fs.existsSync(readmePath))
    throw new Error(`README file does not exist: ${readmePath}`);
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
    Read EVERYTHING below before writing. Then produce a single, final design specification that follows the template exactly.

    RULES FOR SYNTHESIS
    - Merge and reconcile: Incorporate all feedback from both the "User Response" and "The Design Specification". Resolve conflicts explicitly; don't drop constraints.
    - Reuse prior facts: If Language/Libraries/Auth scopes/etc. were provided earlier, reuse them verbatim unless the user overrode them. Missing items must be inferred only if strongly implied; otherwise call them out as TBD.
    - ALWAYS REUSE PATHS IN THE DESIGN SPECIFICATION! If a user asks for a new file to be created in their response infer based on existing paths in the spec where to place that fil. This ensure paths are resolvable!
    - Prefer extension over modification when breaking changes are likely, or change sets are large (we want to reduce the blast radius of potential bugs)
    
    # Initial user request
    Below is the engineer's initial request and relevant context (stack, APIs, tests, file paths, prior threads).
    ${context.initialUserPrompt}

    # User Response
    ${userResponse}

    # The spec file
    Carefully review for any change requests, answers to questions, etc., from the user.
    ${updatedContents}

    Ensure your answer follows the **Design Specification Template**. 
    All sections are REQUIRED. Do not add or remove sections or bullets. 
    Reuse supplied sections unmodified (e.g., Overview, Constraints, Files Added/Modified) when no changes are required.

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
      - Provide happy path, key edge cases, and failure cases that map to “Functional Behavior” and “Error Handling.”
    - **Usage (via client)**: a description of the proposed API and of how clients will call the proposed API. Can include pseudo code.
      - Show request/response shapes (names only, not full code), example call(s), and minimal integration steps. Indicate auth usage and expected status codes.
    
# Sample Training Data
Q: "create sending email function to send an custom templated email"
A:
- **Design spec**: Send Email (Templated) v0.1
- **Instructions**: Create a function to send a custom templated email.
- **Overview**: Implement a \`sendEmail\` delegate using \`googleapis@149.0.0\` (Gmail API) to send an HTML-templated email with an auto-derived plain-text alternative. Expose only via \`gsuiteClient.ts\` and scaffold tests per package conventions.
- **Constraints**
  - **Language**: TypeScript (Node.js 20.x)
  - **Libraries**: googleapis@149.0.0
- **Files Added/Modified**:
  For example:
    Files added/modified
    - Modified: packages/services/google/src/lib/delegates/sendEmail.ts
    - Added: packages/services/google/src/lib/delegates/driveHelpers.ts
    - Modified: packages/services/google/src/lib/types.ts (EmailContext, SendEmailOutput)
    - Added: packages/services/google/src/lib/delegates/sendEmail.test.ts
  This ensures our code editor can distinguish how to handle the changes with ts-morph. 
  File paths can be inferred from the Initial user request. It includes the complete listing of existing files and their exposed members (functions, types, etc).
- **Auth scopes required**:
  - https://mail.google.com/
  - https://www.googleapis.com/auth/gmail.modify
  - https://www.googleapis.com/auth/gmail.compose
  - https://www.googleapis.com/auth/gmail.send
- **Security and Privacy**: Do not log credentials or full message bodies. Mask recipient emails in logs. Store no message content at rest beyond transient processing. Use least-privilege OAuth scopes.
- **External API Documentation References**:
  - Gmail API: \`users.messages.send\` — https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send
- **Inputs and Outputs**
  - **Proposed Input Type Changes/Additions**:
    - \`EmailContext\`:
      - \`from: string\` (required, RFC5322)
      - \`recipients: string | string[]\` (required; supports comma-separated or array)
      - \`subject: string\` (required, non-empty)
      - \`messageHtml: string\` (required; HTML template-rendered content)
      - \`messageText?: string\` (optional; if omitted, derive from HTML)
      - \`headers?: Record<string, string>\` (optional; e.g., \`Reply-To\`)
      - \`labelIds?: string[]\` (optional; Gmail label IDs)
  - **Proposed Output types Changes/Additions**:
    - \`SendEmailOutput\`:
      - \`id: string\`
      - \`threadId: string\`
      - \`labelIds?: string[]\`
- **Functional Behavior**:
  1) Validate \`from\`, \`recipients\`, \`subject\`, and \`messageHtml\`.
  2) Build \`multipart/alternative\` MIME with \`text/plain\` (derived if not supplied) and \`text/html\`.
  3) Base64url-encode MIME; call \`gmail.users.messages.send({ userId: 'me', requestBody: { raw } })\`.
  4) If \`labelIds\` provided, ensure they are included in the request.
  5) Return \`{ id, threadId, labelIds }\`.
  6) Expose via \`gsuiteClient.ts\` only; keep internal delegate under \`src/lib/delegates/\`.
- **Error Handling**:
  - On validation errors, throw typed errors with field details.
  - On Gmail API failure, include HTTP status, error code, and \`response.data\` when available; do not include message content.
  - Retry once on \`429\`/\`5xx\` with exponential backoff; otherwise propagate error.
- **Acceptance Criteria**:
  \`\`\`gherkin
  Feature: Send templated email
    Scenario: Successfully send an HTML email with derived text part
      Given a valid EmailContext with from, recipients, subject, and messageHtml
      When the client calls sendEmail
      Then the Gmail API users.messages.send is invoked with a base64url MIME payload
      And the payload contains both text/plain and text/html parts
      And the response includes id and threadId

    Scenario: Reject invalid sender address
      Given an EmailContext with an invalid from address
      When the client calls sendEmail
      Then a validation error is thrown identifying the from field

    Scenario: Include label IDs
      Given an EmailContext with labelIds
      When the client calls sendEmail
      Then the created message has those labelIds applied

    Scenario: Handle Gmail rate limiting
      Given the Gmail API responds with HTTP 429
      When the client calls sendEmail
      Then the client retries once with backoff
      And if the retry fails, an error is surfaced without logging message content
\`\`\`
- **Usage (via client)**:
  * Pseudo:
    * \`const client = await makeGSuiteClient('user@company.com');\`
    * \`await client.sendEmail({ from, recipients, subject, messageHtml, messageText?, headers?, labelIds? });\`
    * Returns \`{ id, threadId, labelIds? }\`.
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
  const { answer, tokenomics } = await googleSpecGenerator(
    user,
    system,
    readme,
  );

  if (userResponse) {
    // reset the user response so they can respond again!
    context[confirmUserIntentId].userResponse = undefined;
  }

  parsedMessages.push({
    user: user,
    system: answer,
  });

  await threadsDao.upsert(
    JSON.stringify(parsedMessages),
    'cli-tool',
    context.machineExecutionId!,
  );

  const fileName = `spec-${context.machineExecutionId}.md`;
  const abs = path.resolve(
    process.env.BASE_FILE_STORAGE || process.cwd(),
    fileName,
  );
  await fs.promises.writeFile(abs, answer, 'utf8');

  await saveFileToGithub(abs, answer);

  return {
    confirmationPrompt: answer,
    file: abs,
    tokenomics,
  };
}
