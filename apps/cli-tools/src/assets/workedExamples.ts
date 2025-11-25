// src/analyzers/tests.ts
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {
  PracticeProblem,
  WorkedExample,
} from '@codestrap/developer-foundations-types';

const TEST_PATTERNS = [/\.test\.(t|j)sx?$/, /\.spec\.(t|j)sx?$/];

function walk(dir: string, acc: string[] = []): string[] {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(p, acc);
    } else {
      acc.push(p);
    }
  }
  return acc;
}

function looksLikeTestFile(p: string) {
  return (
    TEST_PATTERNS.some((rx) => rx.test(p)) ||
    p.includes(`${path.sep}__tests__${path.sep}`)
  );
}

function fileImportsHint(sf: ts.SourceFile, hint: string): boolean {
  try {
    for (const stmt of sf.statements) {
      if (ts.isImportDeclaration(stmt)) {
        const moduleText =
          (stmt.moduleSpecifier as ts.StringLiteral).text || '';
        if (moduleText.includes(hint)) return true;
      }
    }
  } catch {
    /* ignore */
  }
  // loose fallback: raw text search
  return sf.text.includes(hint);
}

// Return true for identifiers 'it' | 'test' | 'describe'
function isTestCallee(
  expr: ts.Expression,
): { kind: 'it' | 'test' | 'describe' } | null {
  if (ts.isIdentifier(expr)) {
    const name = expr.text;
    if (name === 'it' || name === 'test' || name === 'describe')
      return { kind: name as any };
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const name = expr.name.text;
    if (name === 'it' || name === 'test' || name === 'describe')
      return { kind: name as any };
  }
  return null;
}

function literalToString(
  node: ts.Expression | undefined,
  sf: ts.SourceFile,
): string | undefined {
  if (!node) return;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  // Template string with expressions → fallback to raw text
  return node.getText(sf);
}

function extractExpects(body: ts.ConciseBody, sf: ts.SourceFile): string {
  const lines: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      // look for expect(...).toXxx(...)
      if (
        ts.isCallExpression(n.expression) ||
        ts.isPropertyAccessExpression(n.expression)
      ) {
        const chainText = n.getText(sf);
        if (/expect\s*\(/.test(chainText)) {
          // keep only reasonably short asserts (avoid giant snapshots here)
          if (chainText.length < 800) lines.push(chainText);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(body, visit);
  return lines.join('\n');
}

function clampSnippet(s: string, max = 2000): string {
  if (s.length <= max) return s;
  const head = s.slice(0, Math.floor(max * 0.6));
  const tail = s.slice(-Math.floor(max * 0.35));
  return `${head}\n/* …snip… */\n${tail}`;
}

export function discoverWorkedExamples(
  projectRoot: string,
  entryImportHint?: string,
): WorkedExample[] {
  const files = walk(projectRoot);
  const tests = files.filter(looksLikeTestFile);
  const examples: WorkedExample[] = [];

  for (const tf of tests) {
    const text = fs.readFileSync(tf, 'utf8');
    const sf = ts.createSourceFile(tf, text, ts.ScriptTarget.Latest, true);

    // If entryImportHint provided, skip tests that don't reference it
    if (entryImportHint && !fileImportsHint(sf, entryImportHint)) {
      continue;
    }

    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const kind = isTestCallee(n.expression);
        if (!kind) return;

        // args: [title, fn]
        const [titleNode, cb] = n.arguments;
        const title =
          literalToString(titleNode, sf)?.trim() || '(untitled test)';

        // Prefer emitting ONLY `it(...)` / `test(...)` cases in Worked Examples
        if (kind.kind === 'it' || kind.kind === 'test') {
          const fullCall = clampSnippet(n.getText(sf));
          let outputSnippet: string | undefined;

          // If callback is a function-like, extract expect(...) lines
          if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
            const body = cb.body;
            outputSnippet = extractExpects(body, sf) || undefined;
          }

          examples.push({
            title,
            file: tf,
            inputSnippet: fullCall, // exact it(...) call (complete)
            outputSnippet, // optional asserts block
          });
        }

        // If you also want describe() names listed (no snippet):
        // else if (kind.kind === 'describe') {
        //   examples.push({ title: `describe: ${title}`, file: tf, inputSnippet: undefined, outputSnippet: undefined });
        // }
      }
      ts.forEachChild(n, visit);
    };

    ts.forEachChild(sf, visit);

    if (examples.length > 80) break; // global cap (avoid huge READMEs)
  }

  return examples;
}

export function toPracticeProblems(
  examples: WorkedExample[],
): PracticeProblem[] {
  return examples.slice(0, 30).map((ex, i) => ({
    title: `Task ${i + 1}: ${ex.title}`,
    file: ex.file,
    description: `Recreate the behavior demonstrated by the example "${ex.title}".`,
    promptTemplate: `Given code and configuration, perform the operation described in: "${ex.title}".`,
    answerKey: ex.outputSnippet
      ? `Asserts (from test):\n${ex.outputSnippet}`
      : `See assertions in ${path.basename(ex.file)}.`,
    judgeNotes: `Compare output against assertions or snapshots in the source test.`,
  }));
}
