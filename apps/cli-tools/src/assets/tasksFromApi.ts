import { container } from '@codestrap/developer-foundations-di';
import {
  GeminiService,
  TYPES,
  ExportedSymbol,
  WorkedExample,
  PracticeProblem,
  EnvVar,
  ReadmeInputForTemplate,
  ToolCallingTask,
} from '@codestrap/developer-foundations-types';
import {
  extractJsonFromBackticks,
  cleanJsonString,
} from '@codestrap/developer-foundations-utils';

// --- tiny helpers ------------------------------------------------------------

type FnMeta = {
  name: string;
  signature: string;
  doc: string;
  isAsync: boolean; // Promise<...> return
  params: Array<{ name: string; type: string }>;
  returnType?: string;
};

function parseFnSignature(sig?: string): {
  params: FnMeta['params'];
  returnType?: string;
  isAsync: boolean;
} {
  const out = {
    params: [] as Array<{ name: string; type: string }>,
    returnType: undefined as string | undefined,
    isAsync: false,
  };
  if (!sig) return out;

  // Example forms:
  // "function sendEmail(gmail: gmail_v1.Gmail, ctx: EmailContext) => Promise<SendEmailOutput>"
  // "(calendar: calendar_v3.Calendar, context: OptimalTimeContext) => Promise<FindOptimalMeetingTimeOutput>"
  const ps = sig.match(/\((.*)\)\s*=>/s);
  if (ps && ps[1]) {
    const raw = ps[1].trim();
    if (raw.length) {
      // split by commas that are not inside <> or {}
      const parts = raw
        .split(/,(?![^<]*>|[^{]*})/g)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const p of parts) {
        // paramName?: type   |   ...rest: type
        const m = p.match(/^(?:\.\.\.)?([\w$]+)\??\s*:\s*([\s\S]+)$/);
        if (m) out.params.push({ name: m[1], type: m[2].trim() });
        else out.params.push({ name: p.replace(/\?.*$/, ''), type: 'unknown' });
      }
    }
  }

  const rt = sig.match(/=>\s*([\s\S]+)$/);
  if (rt && rt[1]) {
    const r = rt[1].trim();
    out.returnType = r;
    if (/^Promise<|^Promise\s*</.test(r)) out.isAsync = true;
  }
  return out;
}

function buildFnMeta(functions: ExportedSymbol[]): FnMeta[] {
  return functions.map((f) => {
    const parsed = parseFnSignature(f.signature || '');
    return {
      name: f.name,
      signature: f.signature || '',
      doc: (f.jsDoc || '').slice(0, 800),
      isAsync: parsed.isAsync,
      params: parsed.params,
      returnType: parsed.returnType,
    };
  });
}

function guessFactories(fns: FnMeta[]) {
  // A "factory" is any function whose returnType name appears as a param type in another function,
  // or whose name looks like make*/create*/get*Client and returns some type.
  const paramTypes = new Set<string>();
  for (const fn of fns)
    for (const p of fn.params) if (p.type) paramTypes.add(p.type);

  const factories: Array<{ factory: string; returns?: string }> = [];
  for (const fn of fns) {
    const looksLikeFactory =
      /^(make|create|get).+/i.test(fn.name) ||
      /Client|Service|Connection|Db|Store|Calendar|Gmail/i.test(
        fn.returnType || '',
      );
    const matchesParamType = fn.returnType && paramTypes.has(fn.returnType);
    if (looksLikeFactory || matchesParamType) {
      factories.push({ factory: fn.name, returns: fn.returnType });
    }
  }
  return factories;
}

function clamp<T>(arr: T[], n: number): T[] {
  return n >= 0 ? arr.slice(0, n) : arr;
}

// --- main --------------------------------------------------------------------

export async function generateToolCallingTasksLLM(opts: {
  apiSurface: ExportedSymbol[];
  workedSFT?: WorkedExample[];
  practiceRL?: PracticeProblem[];
  expositionMd?: string;
  envTable?: EnvVar[];
  nxSummary?: ReadmeInputForTemplate['nxSummary'];
  projectConfig?: ReadmeInputForTemplate['projectConfig'];
  includeFunctionNames?: string[];
  currentUserEmail?: string;
  maxTasksPerFunction?: number;
  totalTaskBudget?: number;
}): Promise<ToolCallingTask[]> {
  const {
    apiSurface,
    workedSFT = [],
    practiceRL = [],
    expositionMd = '',
    envTable = [],
    nxSummary,
    projectConfig,
    includeFunctionNames,
    currentUserEmail,
    maxTasksPerFunction = 2,
    totalTaskBudget = 12,
  } = opts;

  const functions = apiSurface.filter((s) => s.kind === 'function');
  const includeSet = includeFunctionNames?.length
    ? new Set(includeFunctionNames)
    : null;
  const publicFunctions = includeSet
    ? functions.filter((f) => includeSet.has(f.name))
    : functions;
  if (!publicFunctions.length) return [];

  // Structured metadata for the LLM
  const meta = buildFnMeta(publicFunctions);
  const factories = guessFactories(meta);

  const fnBrief = meta.map((m) => ({
    name: m.name,
    signature: m.signature,
    isAsync: m.isAsync,
    params: m.params, // [{name,type}]
    returnType: m.returnType || null,
    doc: m.doc,
  }));

  const typeIndex = {
    // functions that *return* a given type
    returns: fnBrief.reduce<Record<string, string[]>>((acc, f) => {
      const r = f.returnType || '';
      if (!r) return acc;
      (acc[r] ||= []).push(f.name);
      return acc;
    }, {}),
    // functions whose *first param* is a given type
    firstParam: fnBrief.reduce<Record<string, string[]>>((acc, f) => {
      const t = f.params?.[0]?.type || '';
      if (!t) return acc;
      (acc[t] ||= []).push(f.name);
      return acc;
    }, {}),
  };

  const envBrief = clamp(envTable, 40).map((e) => ({
    name: e.name,
    required: e.required,
    defaultValue: e.defaultValue ?? null,
  }));
  const workedBrief = clamp(workedSFT, 15).map((w) => ({
    title: w.title,
    file: w.file,
  }));
  const practiceBrief = clamp(practiceRL, 15).map((p) => ({
    title: p.title,
    description: p.description,
  }));
  const nxBrief = nxSummary
    ? {
        projectName: nxSummary.projectName,
        dependencies: clamp(nxSummary.dependencies || [], 20),
      }
    : null;
  const pkgPath = projectConfig?.packageJson?.path || null;

  const system = `
You generate *tool-calling tasks* for ANY codebase, domain-agnostic.
You are given public function signatures + minimal docs + some examples.

ABSOLUTE RULES
- Use ONLY functions listed under "publicFunctions".
- **Mirror the signature exactly**:
  - If a function takes (client: SomeClient, input: InputType), call it with two arguments — do NOT collapse into a single object.
  - If return type is Promise<...>, use \`await\` in the snippet (assume top-level await).
- If a parameter type looks like a client (e.g., *Client, *Service, *Connection) or matches a type that another exported function returns, then:
  - **First** try to call a listed factory function whose returnType matches that param type.
  - Else, create a minimal stub variable of that type name (e.g., \`const client = {} as SomeClient\`), then call the tool.
- Prefer real values hinted by example titles/names (emails, time ranges, IDs); otherwise pick plausible values.
- Include only the minimum required fields implied by the types/docs.
- Do NOT add imports, comments, or surrounding prose. Return **only** the call snippet when asked for \`answerCode\`.
- Keep question natural and concise.
- Output strict JSON **array** following:

type ToolCallingTask = {
  tool: string;         // function name
  question: string;     // natural language instruction
  answerCode: string;   // single TypeScript snippet, no fences/backticks
  notes?: string;       // optional assumptions
};
`;

  const user = JSON.stringify({
    publicFunctions: fnBrief,
    factories, // [{ factory, returns }]
    typeIndex, // { returns: {Type: [fns]}, firstParam: {Type: [fns]} }
    workedExamples: workedBrief,
    practiceExamples: practiceBrief,
    expositionMd: expositionMd.slice(0, 4000),
    env: envBrief,
    nx: nxBrief,
    packageJsonPath: pkgPath,
    hints: {
      currentUserEmail: currentUserEmail || null,
      maxTasksPerFunction,
      totalTaskBudget,
    },
  });

  const gemini = container.get<GeminiService>(TYPES.GeminiService);
  const raw = await gemini(user, system);

  // Parse tolerant: array | {tasks:[...]}
  let parsed: any;
  const cleaned = extractJsonFromBackticks(raw);

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // salvage: try to find "tasks" property
    try {
      const m = cleaned.match(/\{[\s\S]*\}$/);
      parsed = m ? JSON.parse(m[0]) : null;
    } catch {
      /* noop */
    }
  }

  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.tasks)
      ? parsed.tasks
      : null;
  if (!arr)
    throw new Error('LLM did not return JSON array for ToolCallingTask');

  // Validate & clamp
  const byName = new Set(publicFunctions.map((f) => f.name));
  const tasks: ToolCallingTask[] = [];
  const budget = Math.max(1, totalTaskBudget);

  for (const t of arr) {
    if (!t || typeof t !== 'object') continue;
    if (!t.tool || !t.question || !t.answerCode) continue;
    if (!byName.has(String(t.tool))) continue;

    // minimal arity sanity check — if function has N required params, ensure code contains N commas or placeholders
    const metaForTool = meta.find((m) => m.name === t.tool);
    if (metaForTool) {
      const requiredCount = metaForTool.params.length; // simple heuristic; can enhance with '?'
      // If single object param, OK; else ensure we see a comma-separated arg list length >= requiredCount-1
      // (Heuristic only; we trust LLM plus examples more than hard rejection.)
    }

    tasks.push({
      tool: String(t.tool),
      question: String(t.question),
      answerCode: String(t.answerCode),
      notes: t.notes ? String(t.notes) : undefined,
    });
    if (tasks.length >= budget) break;
  }

  return tasks;
}
