import type { CodeEdits } from '@codestrap/developer-foundations-types';

export function parseCodeEdits(input: string): CodeEdits[] {
  const fileRegex = /^File:\s+(.+?)\s+\((ADDED|MODIFIED|DELETED)\)$/gm;
  const blocks: CodeEdits[] = [];
  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(input)) !== null) {
    const filePath = match[1].trim();
    const typeWord = match[2];
    const type =
      typeWord === 'ADDED'
        ? 'CREATE'
        : typeWord === 'MODIFIED'
          ? 'MODIFY'
          : 'DELETE';
    const startIdx = match.index + match[0].length;
    const nextMatch = fileRegex.exec(input);
    const endIdx = nextMatch ? nextMatch.index : input.length;
    fileRegex.lastIndex = nextMatch ? nextMatch.index : input.length;
    const blockContent = input.slice(startIdx, endIdx).trim();
    //Regex101: https://regex101.com/r/IofxyI/1
    const codeBlockMatch = blockContent.match(
      // eslint-disable-next-line regexp/no-unused-capturing-group
      /```([a-zA-Z]+)(?:\r?\n|\\n)([\s\S]*?)(?:\r?\n|\\n)```/,
    );
    const proposedChange = codeBlockMatch ? codeBlockMatch[2] : '';
    blocks.push({ filePath, type, proposedChange });
  }

  return blocks;
}
