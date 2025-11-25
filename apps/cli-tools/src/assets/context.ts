// src/analyzers/context.ts
import type { Context as DFContext } from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { GeminiService, TYPES } from '@codestrap/developer-foundations-types';
import {
  ReadmeContext,
  ReadmeInputForTemplate,
  AssembleOptions,
  ExportedSymbol,
} from '@codestrap/developer-foundations-types';
import { generateToolCallingTasksLLM } from './tasksFromApi';

function summarizeApi(api: ExportedSymbol[]): string {
  const rows = api
    .slice(0, 80)
    .map((e) => {
      const sig = e.signature ? ` — ${e.signature}` : '';
      const doc = e.jsDoc
        ? ` — ${e.jsDoc.replace(/\s+/g, ' ').slice(0, 160)}…`
        : '';
      return `- ${e.name} (${e.kind})${sig}${doc}`;
    })
    .join('\n');
  return rows || 'No public exports detected.';
}

export async function assembleReadmeContext(
  dfContext: DFContext,
  readmeCtx: ReadmeContext,
  opts: AssembleOptions = {},
): Promise<ReadmeInputForTemplate> {
  const gemini = container.get<GeminiService>(TYPES.GeminiService);

  const system = `
You are an expert software doc generator. Your job is to LLMify a codebase for machine legibility per Karpathy:
- Exposition in Markdown only (no images).
- Worked problems => SFT examples (with references).
- Practice problems => RL env tasks with answer keys for a judge.
- Propose synthetic data generators with parameters and an oracle.
- Produce an indexing plan for RAG/MCP.
- Keep content *concise but complete*; preserve math/LaTeX as-is.
Return a strict JSON object matching ReadmeInputForTemplate. Do not include Markdown fences.`;

  const user = `
ENTRY SUMMARY:
- Entry file: ${readmeCtx.entry.entryFile}
- Project root: ${readmeCtx.entry.projectRoot}
- Tsconfig: ${readmeCtx.entry.tsconfigPath ?? '(auto)'}
- Files (${readmeCtx.files.length}): ${readmeCtx.files
    .slice(0, 50)
    .map((f) => f.file)
    .join(', ')}${readmeCtx.files.length > 50 ? ', …' : ''}
- Env Vars (${readmeCtx.env.length}): ${readmeCtx.env.map((v) => v.name).join(', ') || 'None'}
- Nx: ${readmeCtx.nx ? `${readmeCtx.nx.projectName} deps=${readmeCtx.nx.dependencies.length} dependents=${readmeCtx.nx.dependents.length}` : 'None'}
- Project Config:
  - package.json: ${readmeCtx.projectConfig?.packageJson?.path ?? 'not found'}
  - tsconfigs: ${(readmeCtx.projectConfig?.tsconfigs || []).map((t) => t.path).join(', ') || 'none'}
  - project.json: ${readmeCtx.projectConfig?.projectJson?.path ?? 'not found'}
  - jest: ${(readmeCtx.projectConfig?.jestConfigs || []).join(', ') || 'none'}
  - eslint: ${(readmeCtx.projectConfig?.eslintConfigs || []).join(', ') || 'none'}
  - env files: ${(readmeCtx.projectConfig?.envFiles || []).join(', ') || 'none'}

PUBLIC API (abbrev):
${summarizeApi(readmeCtx.files.flatMap((f) => f.exported))}

WORKED EXAMPLES (abbrev):
${
  readmeCtx.worked
    .slice(0, 10)
    .map((w) => `- ${w.title} (${w.file})`)
    .join('\n') || 'None'
}

PRACTICE TASKS (abbrev):
${
  readmeCtx.practice
    .slice(0, 10)
    .map((p) => `- ${p.title}`)
    .join('\n') || 'None'
}

EXPOSITION HINTS:
- Purpose: ${readmeCtx.exposition.purpose ?? 'unknown'}
- Architecture: ${readmeCtx.exposition.architecture ?? 'unknown'}
- Invariants: ${(readmeCtx.exposition.invariants || []).join(', ') || 'none'}
- Failure modes: ${(readmeCtx.exposition.failureModes || []).join(', ') || 'none'}
- Performance notes: ${(readmeCtx.exposition.performanceNotes || []).join(', ') || 'none'}

REQUIRED OUTPUT SHAPE (typescript):
{
  expositionMd: string;
  workedSFT: WorkedExample[];
  practiceRL: PracticeProblem[];
  syntheticGenerators: Array<{ name: string; description: string; params: Record<string,string>; oracleDescription?: string; }>;
  indexingPlan: { chunking: string; ids: string; embeddings: string; crossReferences: string; };
  apiSurface: ExportedSymbol[];
  envTable: EnvVar[];
  nxSummary: { projectName: string; dependencies: string[]; dependents: string[]; notes?: string } | null;
  gapsAndQuestions: string[];
}

If information is insufficient, set gapsAndQuestions with concrete questions and keep other fields best-effort.`;

  const draft = await gemini(user, system);

  let parsed: ReadmeInputForTemplate | undefined;
  try {
    parsed = JSON.parse(draft);
  } catch {
    // try to salvage JSON substring
    const m = draft.match(/\{[\s\S]*\}$/);
    if (m) {
      parsed = JSON.parse(m[0]);
    }
  }

  if (!parsed) {
    // fallback minimal structure
    parsed = {
      expositionMd: readmeCtx.exposition.purpose || 'Overview pending.',
      workedSFT: readmeCtx.worked,
      practiceRL: readmeCtx.practice,
      syntheticGenerators: [],
      indexingPlan: {
        chunking: 'by file and export',
        ids: 'stable path-based IDs',
        embeddings: 'code+doc model',
        crossReferences: 'exports ↔ files ↔ tests',
      },
      apiSurface: readmeCtx.files.flatMap((f) => f.exported),
      envTable: readmeCtx.env,
      nxSummary: readmeCtx.nx
        ? {
            projectName: readmeCtx.nx.projectName,
            dependencies: readmeCtx.nx.dependencies,
            dependents: readmeCtx.nx.dependents,
          }
        : null,
      gapsAndQuestions: readmeCtx.unknowns,
      projectConfig: readmeCtx.projectConfig,
    };
  }

  const includeNames =
    ((readmeCtx as any).entryExportedFunctions as string[] | undefined) ??
    // fall back: take function names from parsed.apiSurface
    (parsed.apiSurface || [])
      .filter((s: any) => s.kind === 'function')
      .map((s: any) => s.name);

  const toolTasks = await generateToolCallingTasksLLM({
    apiSurface: parsed.apiSurface || [],
    workedSFT: parsed.workedSFT || [],
    practiceRL: parsed.practiceRL || [],
    expositionMd: parsed.expositionMd || '',
    envTable: parsed.envTable || [],
    nxSummary: parsed.nxSummary || null,
    projectConfig: (parsed as any).projectConfig,
    includeFunctionNames: includeNames,
    currentUserEmail:
      parsed.currentUserEmail ||
      process.env.USER_EMAIL ||
      process.env.GMAIL_USER ||
      undefined,
    maxTasksPerFunction: 2,
    totalTaskBudget: 12,
  });

  parsed.toolCallingTasks = toolTasks;

  return parsed;
}
