// src/cli.ts
import { input } from '@inquirer/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { generateReadmeFromEntry } from './generateReadme';

async function promptForEntryFile(): Promise<string> {
  while (true) {
    const entryPoint = await input({
      message: 'Entry point file (e.g., packages/foo/src/index.ts):',
    });

    const raw = entryPoint.trim();
    const resolved = path.resolve(raw);

    try {
      const stat = await fs.promises.stat(resolved);
      if (stat.isFile()) return resolved;
      console.error(`✖ Not a file: ${resolved}`);
    } catch {
      console.error(`✖ Entry file not found: ${resolved}`);
      console.error(`  cwd: ${process.cwd()}`);
    }
  }
}

async function promptForOutputPath(entryFile: string): Promise<string> {
  const defaultOut = path.join(path.dirname(entryFile), 'README.LLM.md');

  while (true) {
    const outPath = await input({
      message:
        'Output README path (file OR existing directory, default = README.LLM.md next to entry):',
      default: defaultOut,
    });

    const resolved = path.resolve(outPath.trim());

    try {
      const stat = await fs.promises.stat(resolved);

      if (stat.isDirectory()) {
        // User provided a directory: write default file inside it
        const candidate = path.join(resolved, 'README.LLM.md');
        return candidate;
      }

      if (stat.isFile()) {
        // Valid existing file path
        return resolved;
      }

      // Exists but neither file nor dir (unlikely)
      console.error(
        `✖ Path exists but is not a file or directory: ${resolved}`,
      );
    } catch {
      // Path does not exist. Decide if it's intended as a file or a dir.
      const hasExtension = Boolean(path.extname(resolved));

      if (hasExtension) {
        // Treat as file: parent directory must exist
        const parent = path.dirname(resolved);
        try {
          const pstat = await fs.promises.stat(parent);
          if (pstat.isDirectory()) return resolved;
          console.error(`✖ Output parent is not a directory: ${parent}`);
        } catch {
          console.error(`✖ Output parent directory not found: ${parent}`);
        }
      } else {
        // Treat as directory (no extension) → must already exist per requirement
        console.error(
          `✖ Output directory not found: ${resolved}\n  (Create it first, or provide a file path ending with .md whose parent exists.)`,
        );
      }
    }
  }
}

async function main() {
  // Configure marked to render for the terminal
  marked.use(
    markedTerminal({
      reflowText: true,
      tab: 4,
    }),
  );

  // Preprocess hook to gently unindent markdown-ish lines outside code fences
  marked.use({
    hooks: {
      preprocess(src: string) {
        const lines = src.replace(/\r\n?/g, '\n').split('\n');
        let inFence = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // toggle for ``` fences (keep fence line intact)
          if (/^\s*```/.test(line)) {
            inFence = !inFence;
            continue;
          }
          if (inFence) continue;

          // If the line starts with 4+ spaces *and* looks like markdown, peel 4 off repeatedly
          let s = line;
          while (
            /^ {4,}(?=(?:#{1,6}\s|\* |\d+\.\s|> |-{3,}\s*$|`{3}|.+))/.test(s)
          ) {
            s = s.replace(/^ {4}/, '');
          }
          lines[i] = s.replace(/[ \t]+$/g, ''); // strip trailing spaces
        }

        return lines.join('\n').trim();
      },
    },
    gfm: true,
    breaks: true,
  });

  const entryPoint = await promptForEntryFile();
  const outPath = await promptForOutputPath(entryPoint);

  const md = await generateReadmeFromEntry(entryPoint, outPath);
  const rendered = marked(md);

  console.log('\n=== Generated README (preview) ===\n');
  console.log(rendered);
  console.log('\n✅ Wrote:', outPath);
}

main().catch((err) => {
  console.error('Unhandled error:', err?.stack || err);
  process.exit(1);
});
