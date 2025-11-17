import * as fs from 'fs';

import { container } from '@codestrap/developer-foundations-di';
import {
    Context,
    EditOp,
    MachineEvent,
    ThreadsDao,
    TYPES,
} from '@codestrap/developer-foundations-types';
import { executeEditMachine } from 'packages/x-reason/src/lib/functions/codeAssist/executeEditMachine';


export async function applyEdits(
    file: string,
) {
    const repoRoot = process.env.REPO_ROOT as string;
    let updatedContents;
    if (file && !fs.existsSync(file)) throw new Error(`File does not exist: ${file}`);
    if (file) {
        // read the file that may contain updates from the user
        updatedContents = await fs.promises.readFile(file, 'utf8');
    }

    if (!updatedContents) throw new Error(`updatedContents is empty!`);
    // TODO wrap in try catch
    const edits = JSON.parse(updatedContents) as { ops: EditOp[] };

    const root = process.cwd();
    const baseDir = root.split(repoRoot)[0];
    const options = {
        baseDir: `${baseDir}${repoRoot}`,
        tsconfigPath: `${baseDir}${repoRoot}/tsconfig.base.json`,
        dryRun: false,
        write: true,
        format: true,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onLog: () => { },
    };

    const results = await executeEditMachine(edits.ops, options);

    return results;
}
