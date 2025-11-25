// src/analyzers/env.ts
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { EnvVar } from '@codestrap/developer-foundations-types';

// --- SHORT-CIRCUIT WALK: stop as soon as process-env.d.ts is found ---
function walkForProcessEnvDts(dir: string): string | null {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of ents) {
    // skip junk dirs
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const hit = walkForProcessEnvDts(path.join(dir, e.name));
      if (hit) return hit; // ✅ EARLY EXIT
    } else if (e.isFile()) {
      if (e.name === 'process-env.d.ts') {
        return path.join(dir, e.name); // ✅ FOUND, BAIL OUT
      }
    }
  }
  return null;
}

// --- tiny helpers for comments/types ---
function getLeadingOrJsDoc(
  sf: ts.SourceFile,
  node: ts.Node,
): string | undefined {
  const jsDocs = (node as any).jsDoc as ts.JSDoc[] | undefined;
  if (jsDocs?.length) {
    const c = jsDocs[0].comment;
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (Array.isArray(c)) {
      const s = c
        .map((p) => (typeof p === 'string' ? p : p.text))
        .join('')
        .trim();
      if (s) return s;
    }
  }
  const full = sf.getFullText();
  const ranges = ts.getLeadingCommentRanges(full, node.pos) || [];
  if (!ranges.length) return;
  const out: string[] = [];
  for (const r of ranges) {
    const raw = full.slice(r.pos, r.end);
    if (raw.startsWith('//')) out.push(raw.replace(/^\/\/\s?/, '').trim());
    else if (raw.startsWith('/*')) {
      out.push(
        raw
          .replace(/^\/\*+/, '')
          .replace(/\*+\/$/, '')
          .split(/\r?\n/)
          .map((l) => l.replace(/^\s*\*\s?/, '').trim())
          .join('\n')
          .trim(),
      );
    }
  }
  return out.filter(Boolean).join('\n') || undefined;
}

function typeText(sf: ts.SourceFile, t?: ts.TypeNode): string {
  return t ? t.getText(sf).replace(/\s+/g, ' ').trim() : 'unknown';
}

function propName(n: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(n) ||
    ts.isStringLiteral(n) ||
    ts.isNoSubstitutionTemplateLiteral(n)
  )
    return n.text;
  return null;
}

// --- parse the single process-env.d.ts we found ---
function parseProcessEnvFile(dtsPath: string): EnvVar[] {
  const src = fs.readFileSync(dtsPath, 'utf8');
  const sf = ts.createSourceFile(dtsPath, src, ts.ScriptTarget.Latest, true);

  const out: EnvVar[] = [];

  function handleInterface(i: ts.InterfaceDeclaration) {
    if (i.name.text !== 'ProcessEnv') return;
    for (const m of i.members) {
      if (!ts.isPropertySignature(m) || !m.name) continue;
      const name = propName(m.name);
      if (!name) continue;

      const required = !m.questionToken;
      const t = typeText(sf, m.type);
      const desc = getLeadingOrJsDoc(sf, m);
      const notes = desc ? `${t} — ${desc}` : t;

      out.push({
        name,
        required,
        defaultValue: undefined, // d.ts won’t have defaults
        files: [dtsPath],
        notes,
      });
    }
  }

  function visit(n: ts.Node) {
    if (ts.isInterfaceDeclaration(n) && n.name.text === 'ProcessEnv')
      handleInterface(n);
    if (ts.isModuleDeclaration(n)) {
      const body = n.body;
      if (body && ts.isModuleBlock(body)) {
        for (const st of body.statements) {
          if (ts.isInterfaceDeclaration(st) && st.name.text === 'ProcessEnv')
            handleInterface(st);
        }
      }
    }
    ts.forEachChild(n, visit);
  }

  visit(sf);

  // dedupe by name (last wins), sorted
  const map = new Map<string, EnvVar>();
  for (const v of out) map.set(v.name, v);
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// --- public API ---
export function discoverEnv(projectRoot: string): EnvVar[] {
  const target = walkForProcessEnvDts(projectRoot);
  if (!target) return []; // no file, no envs. period.
  try {
    return parseProcessEnvFile(target);
  } catch {
    return []; // strict: parsing failure → empty
  }
}
