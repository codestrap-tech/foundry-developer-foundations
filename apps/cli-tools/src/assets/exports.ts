// src/analyzers/exports.ts
import {
  CodeFileSummary,
  ExportedSymbol,
} from '@codestrap/developer-foundations-types';

export function extractPublicApi(files: CodeFileSummary[]): ExportedSymbol[] {
  // Heuristic: union of all exports from files reachable by entry.
  // You can refine by filtering to "barrel"/index files if desired.
  const out: ExportedSymbol[] = [];
  for (const f of files) {
    for (const e of f.exported) {
      out.push(e);
    }
  }
  // de-dupe by name + sourceFile
  const seen = new Set<string>();
  return out.filter((e) => {
    const key = `${e.sourceFile ?? ''}::${e.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
