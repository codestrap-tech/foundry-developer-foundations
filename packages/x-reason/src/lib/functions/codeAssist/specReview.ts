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
import { googleFileOpsGenerator } from './delegates';
import { saveFileToGithub, writeFileIfNotFoundLocally } from './delegates/github';

async function verifyFilePaths(ops: FileOp[]) {
    const root = process.cwd();
    const inInLocalDev = root.includes('foundry-developer-foundations');
    // TODO support an ENV var and fallback to hard coded values
    const repoRoot = inInLocalDev
        ? root.split('foundry-developer-foundations')[0]
        : root.split('workspace')[0];

    // TODO we need to check each file and confirm the path exists. If not retry. If still unresolved error out.
    const promises = ops
        .filter((f) => f.type === 'modified' || f.type === 'required')
        .map(
            (f) =>
                new Promise((resolve, reject) => {
                    const filePath = path.join(
                        inInLocalDev
                            ? `${repoRoot}/foundry-developer-foundations`
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
  - Required: packages/services/palantir/src/lib/doa/communications/communications/upsert.test.ts
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
        "file": "packages/services/palantir/src/lib/doa/communications/communications/upsert.test.ts",
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
    const { file } = context[confirmUserIntentId] as UserIntent || { approved: false };

    await writeFileIfNotFoundLocally(file);

    // there must be a spec file generated in the previous confirmUserIntent state
    if (!file || !fs.existsSync(file)) throw new Error(`File does not exist: ${file}`);

    // get the state
    const specReviewId =
        context.stack
            ?.slice()
            .reverse()
            .find((item) => item.includes('specReview')) || '';
    const { approved, messages } = context[specReviewId] as AbstractReviewState || { approved: false }

    if (approved) {
        const updatedContents = await fs.promises.readFile(file, 'utf8');
        // get the file json to be used by the architect
        const files = await getEffectedFileList(updatedContents);
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
            context.machineExecutionId!
        );

        messages?.push({ system: 'Please incorporate the user\'s feedback into the design specification.' });

        // there is a user response, reset review required to false since the user has supplied feedback
        // this will allow the function catalog to re-enter the the confirm user intent state
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
