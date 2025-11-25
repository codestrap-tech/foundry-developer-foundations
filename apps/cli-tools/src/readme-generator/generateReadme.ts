// src/index.ts
import { interpret } from 'xstate';
import { readmeMachine } from '../machines/readmeMachine';
import { writeFileEnsured } from '../assets/fs';

export async function generateReadmeFromEntry(
  entryFile: string,
  outFile?: string,
  tsconfigPath?: string,
) {
  return new Promise<string>((resolve, reject) => {
    const service = interpret(
      readmeMachine.withContext({
        entryFile,
        tsconfigPath,
        outFile,
        importTree: [],
        files: [],
        apiSurface: [],
        worked: [],
        practice: [],
        env: [],
        exposition: {},
        unknowns: [],
      } as any),
    )
      .onTransition(async (state) => {
        if (state.done) {
          const md = state.context.readmeMarkdown || '# (empty)';
          if (outFile) {
            await writeFileEnsured(outFile, md);
          }
          resolve(md);
        }
        if (state.value === 'error') {
          reject(new Error(state.context.error || 'Unknown error'));
        }
      })
      .start();

    service.send('START');
  });
}

// If you want quick local testing:
// (async () => {
//   const md = await generateReadmeFromEntry('packages/foo/src/index.ts', 'README.LLM.md');
//   console.log(md.slice(0, 400));
// })();
