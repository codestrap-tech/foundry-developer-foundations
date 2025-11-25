// src/machine/readmeMachine.ts
import { Machine, assign } from 'xstate';
import { Ctx } from '@codestrap/developer-foundations-types';
import { findOwningProject, readNxDeps } from '../assets/nxGraph';
import { buildProgramGraph } from '../assets/tsProgram';
import { extractPublicApi } from '../assets/exports';
import {
  discoverWorkedExamples,
  toPracticeProblems,
} from '../assets/workedExamples';
import { discoverEnv } from '../assets/env';
import { renderReadme } from '../assets/markdown';
import { discoverProjectConfigs } from '../assets/configs';
import { discoverJestMocks } from '../assets/mocks';
import { generateToolCallingTasksLLM } from '../assets/tasksFromApi';

type Ev =
  | { type: 'START' }
  | { type: 'ENGINEER_INPUT'; payload: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' };

export const readmeMachine = Machine<Ctx, any, Ev>({
  id: 'readme',
  initial: 'init',
  states: {
    init: {
      on: { START: 'owningProject' },
    },

    // Use async/Promise services for one-shot work; rely on onDone/onError
    owningProject: {
      invoke: {
        src: async (ctx) => {
          const found = findOwningProject(ctx.entryFile);
          if (!found)
            throw new Error('Could not find owning Nx project for entry file.');

          ctx.projectRoot = found.projectRoot;

          // ✅ Use the discovered repoRoot
          const repoRoot = found.repoRoot;

          // Whatever your implementation does, ensure it reads
          // `${repoRoot}/project-graph.json` or generates it.
          ctx.nx = readNxDeps(found.projectName, repoRoot);
        },
        onDone: 'resolveProgram',
        onError: {
          target: 'error',
          actions: assign({ error: (_: Ctx, e: any) => String(e.data || e) }),
        },
      },
    },

    resolveProgram: {
      invoke: {
        src: async (ctx) => {
          const pg = buildProgramGraph(ctx.entryFile, ctx.tsconfigPath);
          ctx.importTree = pg.importTree;
          ctx.files = pg.files;
        },
        onDone: 'extractApi',
        onError: {
          target: 'error',
          actions: assign({ error: (_: Ctx, e: any) => String(e.data || e) }),
        },
      },
    },

    extractApi: {
      invoke: {
        src: async (ctx) => {
          ctx.apiSurface = extractPublicApi(ctx.files);
        },
        onDone: 'discoverExamples',
        onError: {
          target: 'error',
          actions: assign({ error: (_: Ctx, e: any) => String(e.data || e) }),
        },
      },
    },

    discoverExamples: {
      invoke: {
        src: async (ctx) => {
          const ex = discoverWorkedExamples(ctx.projectRoot || process.cwd());
          ctx.worked = ex;
          ctx.practice = toPracticeProblems(ex);
        },
        onDone: 'discoverMocks',
        onError: {
          target: 'error',
          actions: assign({ error: (_: Ctx, e: any) => String(e.data || e) }),
        },
      },
    },

    discoverMocks: {
      invoke: {
        src: async (ctx) => {
          const root = ctx.projectRoot || process.cwd();
          const mocks = await discoverJestMocks(root);
          ctx.testMocks = mocks;
        },
        onDone: 'discoverEnv',
        onError: { target: 'discoverEnv' }, // non-fatal
      },
    },

    discoverEnv: {
      invoke: {
        src: async (ctx) => {
          ctx.env = discoverEnv(ctx.projectRoot || process.cwd());
        },
        onDone: 'discoverConfigs',
        onError: {
          target: 'error',
          actions: assign({ error: (_: Ctx, e: any) => String(e.data || e) }),
        },
      },
    },

    discoverConfigs: {
      invoke: {
        src: async (ctx) => {
          const root = ctx.projectRoot || process.cwd();
          ctx.projectConfig = discoverProjectConfigs(root);
        },
        onDone: 'toolTasks',
        onError: {
          target: 'error', // non-fatal if configs fail to parse
        },
      },
    },

    toolTasks: {
      invoke: {
        src: async (ctx) => {
          const toolTasks = await generateToolCallingTasksLLM({
            apiSurface: ctx.apiSurface || [],
            workedSFT: ctx.worked || [],
            practiceRL: ctx.practice || [],
            expositionMd:
              (ctx as any).expositionMd || ctx.exposition?.purpose || '',
            envTable: ctx.env || [],
            nxSummary: ctx.nx
              ? {
                  projectName: ctx.nx.projectName,
                  dependencies: ctx.nx.dependencies || [],
                  dependents: ctx.nx.dependents || [],
                }
              : null,
            projectConfig: ctx.projectConfig,
            currentUserEmail:
              (ctx as any).currentUserEmail ||
              process.env.USER_EMAIL ||
              process.env.GMAIL_USER ||
              undefined,
            maxTasksPerFunction: 2,
            totalTaskBudget: 12,
          });

          ctx.toolTasks = toolTasks;
        },
        onDone: 'render',
        onError: {
          target: 'error',
          actions: assign({ error: (_: Ctx, e: any) => String(e.data || e) }),
        },
      },
    },

    render: {
      invoke: {
        src: async (ctx) => {
          ctx.readmeMarkdown = renderReadme(ctx);
        },
        onDone: 'done',
        onError: {
          target: 'error',
          actions: assign({ error: (_: Ctx, e: any) => String(e.data || e) }),
        },
      },
    },

    error: {
      on: { RETRY: 'init', CANCEL: 'done' },
    },

    done: { type: 'final' },
  },
});
