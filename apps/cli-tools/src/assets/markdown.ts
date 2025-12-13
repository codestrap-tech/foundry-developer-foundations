// src/render/markdown.ts
import { Ctx } from '@codestrap/developer-foundations-types';
import * as fs from 'fs';
import * as path from 'path';

function escPipes(s: string | undefined | null): string {
  if (!s) return '';
  return String(s).replace(/\|/g, '\\|');
}

function readTextSafe(p?: string): string | undefined {
  if (!p) return;
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return;
  }
}

function codeFenceFor(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.ts' || ext === '.cts' || ext === '.mts') return 'ts';
  if (ext === '.js' || ext === '.cjs' || ext === '.mjs') return 'js';
  if (ext === '.yaml' || ext === '.yml') return 'yaml';
  if (ext === '.md') return 'md';
  return '';
}

// Extract the *content* of a section that starts with an exact "## <heading>",
// stopping right before the next line that starts with "##".
function extractSection(md: string, heading: string): string | undefined {
  // exact "## Heading" (allow trailing text like anchors/comments on that line)
  const startRx = new RegExp(`^##\\s+${heading}\\b.*\\n?`, 'm');
  const startMatch = md.match(startRx);
  if (!startMatch) return undefined;

  const startIdx = startMatch.index! + startMatch[0].length;

  // find next "## " heading after startIdx
  const tail = md.slice(startIdx);
  const nextRx = /^##\s+/m;
  const nextMatch = tail.match(nextRx);

  const endIdx = nextMatch ? startIdx + (nextMatch.index as number) : md.length;

  return md.slice(startIdx, endIdx).trim();
}

export function renderReadme(ctx: Ctx): string {
  // Try to load existing README to preserve specific sections
  const existingMd = readTextSafe((ctx as any).outFile);
  const existingOverview = existingMd
    ? extractSection(existingMd, 'Overview')
    : undefined;
  const existingPractice = existingMd
    ? extractSection(existingMd, 'Practice Tasks')
    : undefined;
  const existingKeyConcepts = existingMd
    ? extractSection(existingMd, 'Key Concepts & Data Flow')
    : undefined;

  // Prefer synthesized fields from readmeInput if present; otherwise use raw ctx
  const ri = ctx.readmeInput;

  let expositionMd =
    ri?.expositionMd?.trim() ||
    (ctx.exposition?.purpose ? String(ctx.exposition.purpose).trim() : '') ||
    '_Overview pending._';

  // If existing README has an Overview section, override
  if (existingOverview) {
    expositionMd = existingOverview;
  }

  const projectRoot = ctx.projectRoot;
  const fileTree = ctx.files.reduce((acc, f) => {
    if (f.file.includes('index.ts')) return acc;
    acc += `${f.file}\n`;
    for (const exp of f.exported) {
      acc += `  └─ ${exp.name}\n`;
    }
    return acc;
  }, '');

  expositionMd = `${expositionMd}
## Root Directory and Layout
Project root: ${projectRoot}
File tree and exported symbols:
${fileTree}
  `.trim();

  // API surface is on ctx
  const apiSurface = Array.isArray(ctx.apiSurface) ? ctx.apiSurface : [];

  // Public functions: restrict to entry exports if you’ve computed them, otherwise all function exports
  const entryExportedFunctions = (ctx as any).entryExportedFunctions as
    | string[]
    | undefined;
  let publicFns = apiSurface.filter((e) => e.kind === 'function');
  if (entryExportedFunctions?.length) {
    const set = new Set(entryExportedFunctions);
    publicFns = publicFns.filter((e) => set.has(e.name));
  }

  const apiRows = publicFns.length
    ? publicFns
        .map((e) => {
          const sig = e.signature ? `\`${escPipes(e.signature)}\`` : '';
          const doc = e.jsDoc ? escPipes(e.jsDoc).replace(/\s+/g, ' ') : '';
          return `| \`${escPipes(e.name)}\` | ${escPipes(e.kind)} | ${sig} | ${doc} |`;
        })
        .join('\n')
    : '| _none_ | _ | _ | _ |';

  // Worked examples & practice problems (raw ctx)
  const worked = (ctx.worked || [])
    .map((w) => {
      const header = `- **${escPipes(w.title)}** — _${escPipes(w.file)}_`;
      if (w.inputSnippet) {
        return `${header}\n\`\`\`ts\n${w.inputSnippet.trim()}\n\`\`\``;
      }
      return header;
    })
    .join('\n\n');

  // Synthetic generators (from readmeInput if you created them)
  const synthGen = Array.isArray(ri?.syntheticGenerators)
    ? ri!.syntheticGenerators!
    : [];
  const synth = synthGen.length
    ? synthGen
        .map((g) => {
          const params = Object.entries(g.params ?? {})
            .map(([k, v]) => `\`${escPipes(k)}\`=${escPipes(v)}`)
            .join(', ');
          const oracle = g.oracleDescription
            ? `\n  - Oracle: ${escPipes(g.oracleDescription)}`
            : '';
          return `- **${escPipes(g.name)}** — ${escPipes(g.description)}\n  - Params: ${params}${oracle}`;
        })
        .join('\n')
    : '_No generators proposed._';

  // Env var table (from ctx.env)
  const envRows = (ctx.env || []).length
    ? ctx.env
        .map((v) => {
          const files = Array.isArray(v.files)
            ? v.files.map((f) => `\`${escPipes(f)}\``).join('<br/>')
            : '';
          return `| \`${escPipes(v.name)}\` | ${v.required ? 'yes' : 'no'} | ${escPipes(v.defaultValue)} | ${files} | ${escPipes(v.notes)} |`;
        })
        .join('\n')
    : '| _none_ | _ | _ | _ | _ |';

  // Nx summary from ctx.nx
  const nx = ctx.nx || null;
  const nxBlock = nx
    ? `**Project:** \`${escPipes(nx.projectName)}\`

- Depends on: ${nx.dependencies?.length ? nx.dependencies.map((d) => `\`${escPipes(d)}\``).join(', ') : '_none_'}
- Dependents: ${nx.dependents?.length ? nx.dependents.map((d) => `\`${escPipes(d)}\``).join(', ') : '_none_'}
`
    : '_No Nx graph available._';

  // tool-calling tasks (generated); can be overridden by existing README section
  const toolTasks = ctx.toolTasks || [];
  let practiceSection = toolTasks.length
    ? toolTasks
        .map(
          (t) =>
            `**Q:** ${t.question}
**A:**
\`\`\`typescript
${t.answerCode}
\`\`\`
${t.notes ? `> _${t.notes}_` : ''}`,
        )
        .join('\n\n')
    : ctx.practice?.length
      ? ctx.practice
          .map(
            (p) =>
              `- **${escPipes(p.title)}** — ${escPipes(p.description || '')}`,
          )
          .join('\n')
      : '_No practice tasks synthesized._';

  // If existing README has a "## Practice Tasks" section, override
  if (existingPractice) {
    practiceSection = existingPractice;
  }

  // Gaps/questions
  const gapsAQ = ri?.gapsAndQuestions ?? ctx.unknowns ?? [];
  const gaps = gapsAQ.length
    ? gapsAQ.map((g) => `- ${escPipes(g)}`).join('\n')
    : '_None_';

  // Project configuration & inline contents
  const cfg = ctx.projectConfig;
  const pkg = cfg?.packageJson;
  const depCount = pkg
    ? Object.keys(pkg.dependencies || {}).length +
      Object.keys(pkg.devDependencies || {}).length +
      Object.keys(pkg.peerDependencies || {}).length
    : 0;

  const pkgHeader = pkg
    ? [
        `**package.json**: \`${escPipes(pkg.path)}\``,
        `- name: \`${escPipes(pkg.name) || '-'}\``,
        `- version: \`${escPipes(pkg.version) || '-'}\``,
        `- private: \`${pkg.private ?? false}\``,
        `- scripts: ${
          pkg.scripts && Object.keys(pkg.scripts).length
            ? Object.keys(pkg.scripts)
                .slice(0, 12)
                .map((s) => `\`${escPipes(s)}\``)
                .join(', ')
            : '_none_'
        }`,
        `- deps: ${depCount}`,
      ].join('\n')
    : '_No package.json found._';

  const pkgContents = pkg?.path ? readTextSafe(pkg.path) : undefined;
  const pkgBlock = pkgContents
    ? `\n**contents**\n\`\`\`${codeFenceFor(pkg.path)}\n${pkgContents.trim()}\n\`\`\``
    : '';

  const tsBlocks = (cfg?.tsconfigs || []).length
    ? cfg!
        .tsconfigs!.map((t) => {
          const co: any = t.compilerOptions || {};
          const pathsKeys = co.paths ? Object.keys(co.paths).length : 0;
          const head = `- \`${escPipes(t.path)}\`${t.extends ? ` (extends: \`${escPipes(t.extends)}\`)` : ''} — baseUrl: \`${escPipes(co.baseUrl) || '-'}\`, target: \`${escPipes(co.target) || '-'}\`, module: \`${escPipes(co.module) || '-'}\`, paths: ${pathsKeys}`;
          const txt = readTextSafe(t.path);
          const body = txt
            ? `\n\`\`\`${codeFenceFor(t.path)}\n${txt.trim()}\n\`\`\``
            : '';
          return `${head}${body}`;
        })
        .join('\n')
    : '_No tsconfig files found._';

  const pj = cfg?.projectJson;
  const pjHeader = pj
    ? `**project.json**: \`${escPipes(pj.path)}\`
- name: \`${escPipes(pj.name) || '-'}\`, sourceRoot: \`${escPipes(pj.sourceRoot) || '-'}\`, tags: ${(pj.tags || []).length ? pj.tags.map((t) => `\`${escPipes(t)}\``).join(', ') : '_none_'}
- targets: ${(pj.targets || []).length ? pj.targets.map((t) => `\`${escPipes(t)}\``).join(', ') : '_none_'}`
    : '_No project.json found._';
  const pjContents = pj?.path ? readTextSafe(pj.path) : undefined;
  const pjBlock = pjContents
    ? `\n**contents**\n\`\`\`${codeFenceFor(pj.path)}\n${pjContents.trim()}\n\`\`\``
    : '';

  const jestBlocks = (cfg?.jestConfigs || []).length
    ? cfg!
        .jestConfigs!.map((pth) => {
          const txt = readTextSafe(pth);
          const head = `- \`${escPipes(pth)}\``;
          const body = txt
            ? `\n\`\`\`${codeFenceFor(pth)}\n${txt.trim()}\n\`\`\``
            : '';
          return `${head}${body}`;
        })
        .join('\n')
    : '_No Jest config found._';

  const eslintBlocks = (cfg?.eslintConfigs || []).length
    ? cfg!
        .eslintConfigs!.map((pth) => {
          const txt = readTextSafe(pth);
          const head = `- \`${escPipes(pth)}\``;
          const body = txt
            ? `\n\`\`\`${codeFenceFor(pth)}\n${txt.trim()}\n\`\`\``
            : '';
          return `${head}${body}`;
        })
        .join('\n')
    : '_No ESLint config found._';

  const projectConfigSection = `
## Project Configuration <!-- anchor: project_configuration -->

${pkgHeader}${pkgBlock}

### TypeScript Configs
${tsBlocks}

### Nx Project
${pjHeader}${pjBlock}

### Jest
${jestBlocks}

### ESLint
${eslintBlocks}

### Environment Files <!-- anchor: configuration_env -->
| name | required | default | files | notes |
|---|---|---|---|---|
${envRows}
`.trim();

  // Jest mocks (from ctx.testMocks)
  const mocks = ctx.testMocks || [];
  const mockItems = mocks.length
    ? mocks
        .map(
          (m) =>
            `- **module:** \`${m.moduleName}\`
  - from: \`${m.file}\`
  - factory:
\`\`\`ts
${m.factoryCode}
\`\`\``,
        )
        .join('\n\n')
    : '_No jest.mock factories discovered._';

  const mocksSection = `
## Test Mock Setup (extracted from Jest) <!-- anchor: test_mocks -->

${mockItems}
`.trim();

  return [
    `## Overview\n\n${expositionMd}`,

    `## Public API (Exports) <!-- anchor: public_api -->
| export | kind | signature | description |
|---|---|---|---|
${apiRows}`,

    `## Key Concepts & Data Flow <!-- anchor: concepts_flow -->
                ${existingKeyConcepts || '_See Overview; expand this section as needed._'}`,

    `## Quickstart (Worked Examples from Jest Tests) <!-- anchor: worked_examples -->
${worked || '_No worked examples detected._'}`,

    `## Jest Mocks Used <!-- anchor: jest_mocks -->
${mocksSection}`,

    projectConfigSection,

    `## Dependency Topology (Nx) <!-- anchor: deps_topology -->
${nxBlock}`,

    `## Import Graph (File-level) <!-- anchor: import_graph -->
_Text-only representation intentionally omitted in this version; agents can walk files from API surface._`,

    `## Practice Tasks (for Agents/RL) <!-- anchor: practice_tasks -->
${practiceSection}`,

    `## Synthetic Variations <!-- anchor: synthetic_variations -->
${synth}`,

    `## Guardrails & Quality <!-- anchor: guardrails_quality -->
_Include test coverage & invariants if available (future enhancement)._`,

    `## Open Questions / Needs from Engineer <!-- anchor: questions_for_engineer -->
${gaps}`,

    `## Appendix <!-- anchor: appendix -->
- Stable section anchors provided for agent navigation.
- IDs: Prefer path-based IDs for files and export names for API items.`,
  ].join('\n\n');
}
