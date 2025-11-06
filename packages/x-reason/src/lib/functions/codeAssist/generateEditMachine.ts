import * as path from 'path';
import * as fs from 'fs';

import { container } from '@codestrap/developer-foundations-di';
import {
  CodeEdits,
  Context,
  MachineEvent,
  ThreadsDao,
  TYPES,
  UserIntent,
  VersionControlService,
} from '@codestrap/developer-foundations-types';
import { openAiEditOpsGenerator } from './delegates';
import { parseCodeEdits } from '@codestrap/developer-foundations-utils';
import { saveFileToGithub, writeFileIfNotFoundLocally } from './delegates/github';

export async function generateEditMachine(
  context: Context,
  event?: MachineEvent,
  task?: string
) {
  const threadsDao = container.get<ThreadsDao>(TYPES.ThreadsDao);

  const { messages } = await threadsDao.read(context.machineExecutionId!);

  const parsedMessages = JSON.parse(messages || '[]') as {
    user?: string;
    system: string;
  }[];

  const architectImplementationId =
    context.stack
      ?.slice()
      .reverse()
      .find((item) => item.includes('architectImplementation')) || '';

  const { file } = (context[architectImplementationId] as UserIntent);

  await writeFileIfNotFoundLocally(file);

  // there must be a spec file generated in the previous architectureReview state
  if (!file || !fs.existsSync(file)) throw new Error(`File does not exist: ${file}`);

  // reload the file to get the latest contents so we can capture user edits
  const plan = await fs.promises.readFile(file, 'utf8');

  const editsBlocks = parseCodeEdits(plan)
    .reduce((acc, cur) => {
      switch (cur.type) {
        case 'MODIFY':
          acc.modified.push(cur);
          break;
        case 'CREATE':
          acc.added.push(cur);
          break;
      }
      return acc;
    }, { modified: [], added: [] } as { modified: CodeEdits[], added: CodeEdits[] });

  const planParts = plan.split('# The complete current contents of all files being modified without any changes applied')
  const requiredFiles = planParts[1];
  // assemble the edit blocks for files being edited only.
  const modifiedFiles = editsBlocks.modified.map((item) => {
    return `
File: ${item.filePath} (MODIFIED)
\`\`\`diff
${item.proposedChange}
\`\`\`
`
  });
  // now manually assemble the added blocks since they don't need precise edits. 
  // All the code is already contained in the blocks and not extra operations are needed
  // if for some reason the model failed to export a function etc just fix it manually
  const createOrReplaceEdits = editsBlocks.added.map(item => {
    const overwrite = fs.existsSync(item.filePath)
    return {
      kind: 'createOrReplaceFile',
      file: item.filePath,
      text: item.proposedChange,
      overwrite,
    };
  })

  const generateEditMachineId =
    context.stack
      ?.slice()
      .reverse()
      .find((item) => item.includes('generateEditMachine')) || '';

  const { userResponse, file: editsFile } = (context[generateEditMachineId] as UserIntent) || {};

  let updatedContents;
  if (editsFile) {
    // read the file that may contain updates from the user
    updatedContents = await fs.promises.readFile(editsFile, 'utf8');
  }

  const system = `You are a senior TypeScript AST surgeon.
Your ONLY job is to read a design spec and a repo snapshot and produce a precise, minimal JSON edit plan (“ops”) that a TS-Morph executor will run.

# Rules:
- Output MUST be valid JSON matching the provided JSON Schema (strict).
- Only use the allowed op kinds. No free-form code, no extra fields.
- Be surgical: smallest possible diff that satisfies the spec. If an edit is already present, omit it.
- Do not insert comments into mutations that do not support them. For example propertySig can not contain comments!
- Never under any circumstances createOrReplace the types file! Perform focused edits like replaceType or replaceInterface.
- Don't invent files or symbols. Only reference files/symbols referenced in the provided design specification.
- Respect semantics and API constraints from the spec (e.g., types, signatures, limits).
- If the spec requires work that v1 ops cannot express, list a short note under \`non_applicable\` (do NOT include such work in \`ops\`).
- Obey the rules in the Minimal-Change Playbook below

---

# Output fields:
- \`version\`: "v1"
- \`ops\`: array of edit ops (see schema)
- \`non_applicable\`: optional string array of items that require a human or a future opcode.

---

# Minimal-Change Playbook (apply in this order)

1. **Imports:** use \`ensureImport\` / \`removeImportNames\`. Never rewrite import blocks wholesale.
2. **Object literals (config/maps):** use \`upsertObjectProperty\` per key.
3. **Interfaces / Type literals:** use \`insertInterfaceProperty\` or \`updateTypeProperty\`.
4. **Union / Enum additions:** \`addUnionMember\` / \`insertEnumMember\`.
5. **Functions/Methods:** \`replaceFunctionBody\` and/or \`updateFunctionReturnType\`.
6. **Type aliases / Interfaces replacement:** only if the entire shape truly changes and cannot be expressed as property edits; otherwise prefer the granular ops.
7. **Exports:** \`ensureExport\` for existing local symbols.
8. **Renames:** \`renameSymbol\` (one-shot; don't include it in an idempotent second run).
9. **Create file:** Only when the spec explicitly adds a new file and provides its full contents. Otherwise put it in \`non_applicable\`.

---

# Capabilities clarification (must follow)
1 The executor **can create missing top-level declarations** using existing ops:
  * \`replaceTypeAlias\` → **creates** the alias if it doesn't exist (or updates it if it does).
  * \`replaceInterface\` → **creates** the interface if it doesn't exist (or replaces it if it does).
2 After creating a new type/interface, use \`ensureExport\` if it must be exported.
3 Therefore, **adding new top-level types/interfaces to an existing file *is in scope for v1***.
  Do **not** mark this as \`non_applicable\`, and do **not** replace the entire types file.

___

# Sequencing/Phases
*always* sequences dependent edits correctly:
1. Emit ops that introduce or change provider symbols (types/interfaces/enums) in their source file.
2. Immediately ensureExport for those providers (if needed).
3. Then emit ops that introduce consumers, including createOrReplaceFile text that imports those providers, and any ensureImport ops in existing files.
4. Then emit implementation edits (function/method bodies) that rely on those imports.

This lets the executor avoid diagnostics like “cannot find name/type” during the run.

# Training Data
### Example A
For example, a notional spec that introduces a feature to search email might require the following ordered changes:
Add a new type SearchEmailsInput in packages/types/src/lib/types.ts.
Create a new file packages/services/email/src/lib/searchEmails.ts that imports SearchEmailsInput and exports searchEmails.
Update the app entry packages/app/src/index.ts to import searchEmails.
Resulting in the following edits json
{
  "version": "v1",
  "ops": [
    {
      "kind": "replaceTypeAlias",
      "file": "packages/types/src/lib/types.ts",
      "typeName": "SearchEmailsInput",
      "typeText": "{ userId: string; labels?: string[]; senders?: string[]; subject?: string; maxResults?: number; pageToken?: string; }"
    },
    {
      "kind": "ensureExport",
      "file": "packages/types/src/lib/types.ts",
      "name": "SearchEmailsInput"
    },

    {
      "kind": "createOrReplaceFile",
      "file": "packages/services/email/src/lib/searchEmails.ts",
      "text": "import { SearchEmailsInput } from "@types/lib/types";\n\nexport async function searchEmails(input: SearchEmailsInput) {\n  // minimal stub for now\n  return [] as const;\n}\n",
      "overwrite": false
    },

    {
      "kind": "ensureImport",
      "file": "packages/app/src/index.ts",
      "from": "@services/email/src/lib/searchEmails",
      "names": ["searchEmails"]
    }
  ]
}

### Example B — Add a named import without touching others
**Spec:** “Use \`z\` from \`zod\` in this file.”
**File:** \`src/user/validate.ts\` currently has no \`zod\` import.
**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "ensureImport",
      "file": "src/user/validate.ts",
      "from": "zod",
      "names": ["z"]
    }
  ]
}
\`\`\`

### Example C — Remove a specific named import (don't rewrite the line)

**Spec:** “Stop importing \`unusedThing\` from \`utils\`.”
**File:** \`src/feat/mod.ts\`

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "removeImportNames",
      "file": "src/feat/mod.ts",
      "from": "utils",
      "names": ["unusedThing"]
    }
  ]
}
\`\`\`

### Example D — Add union member if missing (idempotent)

**Spec:** “Add \`'Deleted'\` to \`Status\` union.”
**File:** \`src/types.ts\` (\`type Status = 'Active' | 'Suspended';\`)

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "addUnionMember",
      "file": "src/types.ts",
      "typeName": "Status",
      "member": "'Deleted'"
    }
  ]
}
\`\`\`

### Example E — Insert new interface property

**Spec:** “\`User\` gets optional \`email?: string\`.”
**File:** \`src/types.ts\` (has \`export interface User { id: string }\`)

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "insertInterfaceProperty",
      "file": "src/types.ts",
      "interfaceName": "User",
      "propertySig": "email?: string"
    }
  ]
}
\`\`\`

### Example F — Update property type in a type-literal alias (not whole replace)

**Spec:** “\`Config.version\` changes to \`'v2'\`.”
**File:** \`src/types.ts\` (\`export type Config = { version: 'v1'; }\`)

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "updateTypeProperty",
      "file": "src/types.ts",
      "typeName": "Config",
      "property": "version",
      "newType": "'v2'"
    }
  ]
}
\`\`\`

### Example G — Insert enum member with initializer

**Spec:** “Add \`Green = 'GREEN'\` to \`Color\`.”
**File:** \`src/types.ts\` (\`enum Color { Red = 'RED' }\`)

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "insertEnumMember",
      "file": "src/types.ts",
      "enumName": "Color",
      "memberName": "Green",
      "initializer": "'GREEN'"
    }
  ]
}
\`\`\`

### Example H — Upsert object property in a config map

**Spec:** “Set \`features.search = true\` in exported \`features\` object.”
**File:** \`src/config.ts\` (\`export const features = {}\`)

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "upsertObjectProperty",
      "file": "src/config.ts",
      "exportName": "features",
      "key": "search",
      "valueExpr": "true"
    }
  ]
}
\`\`\`

### Example I — Replace function body (don’t recreate the function)

**Spec:** “Change \`sum(a,b)\` to return \`a - (-b)\`.”
**File:** \`src/math.ts\` (\`export function sum(a:number,b:number){ return a+b }\`)

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "replaceFunctionBody",
      "file": "src/math.ts",
      "exportName": "sum",
      "body": "{ return a - (-b); }"
    }
  ]
}
\`\`\`

### Example J — Update arrow function’s return type only

**Spec:** “Make \`toStr(n)\` return \`string\` explicitly.”
**File:** \`src/util.ts\` (\`export const toStr = (n:number) => n + ''\`)

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "updateFunctionReturnType",
      "file": "src/util.ts",
      "exportName": "toStr",
      "returnType": "string"
    }
  ]
}
\`\`\`

### Example K — Replace method body (target only the method)

**Spec:** “\`Greeter.greet(name)\` should return \`hello, \${name}\`.”
**File:** \`src/greeter.ts\` (\`export class Greeter { greet(n:string){ return 'hi ' + n } }\`)

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "replaceMethodBody",
      "file": "src/greeter.ts",
      "className": "Greeter",
      "methodName": "greet",
      "body": "{ return \`hello, \${name}\`; }"
    }
  ]
}
\`\`\`

### Example L — Ensure export of an existing symbol (don't duplicate)

**Spec:** “Export \`hidden\`.”
**File:** \`src/mod.ts\` (\`const hidden = 1;\`)

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "ensureExport",
      "file": "src/mod.ts",
      "name": "hidden"
    }
  ]
}
\`\`\`

### Example M — Rename symbol (one-shot)

**Spec:** “Rename class \`Greeter\` → \`Speaker\`.”
**File:** \`src/greeter.ts\`

**Output**

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "renameSymbol",
      "file": "src/greeter.ts",
      "oldName": "Greeter",
      "newName": "Speaker"
    }
  ]
}
\`\`\`

### Example N — New file creation

**Spec:** “Add new file \`src/lib/newFeature.ts\` with the following contents: …”

\`\`\`json
{
  "version": "v1",
  "ops": [
    {
      "kind": "createOrReplaceFile",
      "file": "src/lib/newFeature.ts",
      "text": "export const ok = true;\n",
      "overwrite": false
    }
  ]
}
\`\`\`

---

### Final reminders (you must obey)

* **Always** order ops so that dependencies are considered
* Avoid broad replacements. **Granular edits first**; replace whole type/interface only when necessary.
* If required work exceeds v1 op capabilities, list it under \`non_applicable\`.
`;

  // only have the model figure out modifications since create or replace files already have code generated where as diffs need precise edits
  // if there is a spec on file be sure to use that instead of the plan as it can be edited by the user
  const user = userResponse ?
    `
# Feedback from the user
${userResponse}

# Your previous response
\`\`\`json
${updatedContents}
\`\`\`

# THE DESIGN SPEC
${modifiedFiles}

# The complete current contents of all files being modified without any changes applied
${requiredFiles}

# TASK
Produce the v1 edit plan to implement THE DESIGN SPEC taking into account the user feedback and your previous response.
Correct any errors the user has asked for. Return ONLY valid JSON.
`
    :
    `
# THE DESIGN SPEC
${modifiedFiles}

# The complete current contents of all files being modified without any changes applied
${requiredFiles}

# TASK
Produce the v1 edit plan to implement the spec in this repo.

Return ONLY JSON.
`;

  const { ops, tokenomics, non_applicable, version } = await openAiEditOpsGenerator(user, system);

  const completeOps = {
    version,
    ops: [
      ...ops,
      ...createOrReplaceEdits,
    ],
    non_applicable,
  }

  const fileName = `codeEdits-${context.machineExecutionId}.json`;
  const abs = path.resolve(process.env.BASE_FILE_STORAGE || process.cwd(), fileName);
  const content = JSON.stringify(completeOps, null, 2);

  await fs.promises.writeFile(abs, content, 'utf8');

  await saveFileToGithub(abs, content);

  parsedMessages.push({
    system: `Edits file produced: ${abs}`,
  });

  await threadsDao.upsert(
    JSON.stringify(parsedMessages),
    'cli-tool',
    context.machineExecutionId!
  );

  return {
    file: abs,
    tokenomics,
  };
}
