import { EventObject, StateNode } from 'xstate';
import { Message } from '../types';

export type ActionType = {
  type: string;
  value?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  stateId?: string;
};

export type Context = {
  requestId: string;
  status: number;
  machineExecutionId?: string;
  stack?: string[];
  userId?: string;
  solution?: string; // holds the output from the solver which is the solution plan to execute. This is used by individual state functions to assemble their required input parameters
  onMachineError?: (error: Error) => void; // callback to capture errors in async function implementations
  // Index signature for additional properties
  [key: string]: any;
};

export type MachineEvent = {
  type: 'PAUSE_EXECUTION' | 'RESUME_EXECUTION' | 'RETRY' | 'INVOKE' | string;
  payload?: { [key: string]: any };
  stateId?: string;
  data?: { [key: string]: any };
} & EventObject;

export type Transition = Map<
  string,
  (context: Context, event: MachineEvent) => boolean
>;

export type Task = {
  description: string;
  implementation: (
    context: Context,
    event?: MachineEvent,
    task?: string
  ) => void;
  component?: (context: Context, event?: MachineEvent, task?: string) => any;
  transitions?: Transition;
};

export interface StateMachineConfig {
  [key: string]: StateNode<Context, any, MachineEvent>;
}

export type Solver = {
  // generates the instructions for solving the query
  solve(query: string, solver: Prompt): Promise<string>;
};

export type Programer = {
  // the input is the result of Solver.solve
  // generates the state machine config used by the interpreter
  program(
    query: string,
    functionCatalog: string,
    programmer: Prompt
  ): Promise<StateConfig[]>;
};

export type EvaluationInput = {
  query?: string;
  instructions?: string;
  states: StateConfig[];
  tools?: Map<string, Task>;
};

export type EvaluatorResult = {
  rating: number;
  error?: Error;
  correct?: boolean;
  revised?: string;
};

export type Evaluator = {
  // takes the user's query with the generated instructions from the solver
  // and the output machine config from the programmer
  evaluate(input: EvaluationInput, evaluate: Prompt): Promise<EvaluatorResult>;
};

export type AiTransition = {
  // takes the task list returned by the solver, the id of the current state,
  // and the value returned by the state's implementation function
  // returns true or false
  transition(
    taskList: string,
    currentState: string,
    stateValue: string,
    aiTransition: Prompt,
    executionId: string
  ): Promise<string>;
};

export type Prompt = (
  ...args: any[]
) => Promise<{ user: string; system: string }>;

export type ReasoningEngine = {
  solver: Solver;
  programmer: Programer;
  evaluator: Evaluator;
  logic: AiTransition;
};

export interface ICallable {
  (...args: any[]): any;
}

export type InterpreterInput = {
  functions: Map<string, Task>;
  states: StateConfig[];
  context?: Context;
};

export type Interpreter = {
  interpret(input: InterpreterInput): void;
};

export type StateConfig = {
  id: string;
  parentId?: string;
  transitions?: Array<{
    on: string;
    target: string;
    cond?: string;
    actions?: string;
  }>;
  type?: 'parallel' | 'final';
  onDone?: string;
  states?: StateConfig[];
  task?: string;
  includesLogic?: boolean;
};

export interface Result {
  context: string;
  nextState: string;
  planId: string;
  machine: string;
}

export interface Workflow {
  context: string | undefined;
  nextState: string | undefined;
  planId: string;
  machine: string | undefined;
  implementation1: string | undefined;
}

export type Solutions = {
  input: string;
  id: string;
  plan: string;
};

export type SystemStatus = {
  status: number;
  message: string;
};

export type Messages = {
  user?: string;
  system?: string;
};

export type AbstractReviewState = {
  approved: boolean;
  reviewRequired?: boolean;
  messages?: Messages[];
  file?: string;
};

export type CodeReviewState = {} & AbstractReviewState;

export type SpecReviewState = {} & AbstractReviewState;

export type ArchitectureReviewState = {} & AbstractReviewState;

export type Tokenomics = {
  model: string;
  inputTokens: number | undefined;
  cachedTokens: number | undefined;
  outputTokens: number | undefined;
  reasoningTokens: number | undefined;
  totalTokens: number | undefined;
  inputCostUSD: number;
  outputCostUSD: number;
  totalCostUSD: number;
};

export type FileOp = {
  file: string;
  type: string;
  contents?: string;
  stubCode?: string;
}

export const EditOpsJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'EditPlan',
  type: 'object',
  additionalProperties: false,
  properties: {
    version: { type: 'string', enum: ['v1'] },
    ops: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['ensureImport'] },
              file: { type: 'string' },
              from: { type: 'string' },
              names: { type: ['array', 'null'], items: { type: 'string' } },
              defaultName: { type: ['string', 'null'] },
              isTypeOnly: { type: ['boolean', 'null'] },
            },
            required: [
              'kind',
              'file',
              'from',
              'names',
              'defaultName',
              'isTypeOnly',
            ],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['removeImportNames'] },
              file: { type: 'string' },
              from: { type: 'string' },
              names: { type: ['array', 'null'], items: { type: 'string' } },
              defaultName: { type: ['boolean', 'null'] },
            },
            required: ['kind', 'file', 'from', 'names', 'defaultName'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['ensureExport'] },
              file: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['kind', 'file', 'name'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['replaceFunctionBody'] },
              file: { type: 'string' },
              exportName: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['kind', 'file', 'exportName', 'body'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['updateFunctionReturnType'] },
              file: { type: 'string' },
              exportName: { type: 'string' },
              returnType: { type: 'string' },
            },
            required: ['kind', 'file', 'exportName', 'returnType'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['replaceMethodBody'] },
              file: { type: 'string' },
              className: { type: 'string' },
              methodName: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['kind', 'file', 'className', 'methodName', 'body'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['addUnionMember'] },
              file: { type: 'string' },
              typeName: { type: 'string' },
              member: { type: 'string' },
            },
            required: ['kind', 'file', 'typeName', 'member'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['updateTypeProperty'] },
              file: { type: 'string' },
              typeName: { type: 'string' },
              property: { type: 'string' },
              newType: { type: 'string' },
            },
            required: ['kind', 'file', 'typeName', 'property', 'newType'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['insertInterfaceProperty'] },
              file: { type: 'string' },
              interfaceName: { type: 'string' },
              propertySig: { type: 'string' },
            },
            required: ['kind', 'file', 'interfaceName', 'propertySig'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['replaceTypeAlias'] },
              file: { type: 'string' },
              typeName: { type: 'string' },
              typeText: { type: 'string' },
            },
            required: ['kind', 'file', 'typeName', 'typeText'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['replaceInterface'] },
              file: { type: 'string' },
              interfaceName: { type: 'string' },
              interfaceText: { type: 'string' },
            },
            required: ['kind', 'file', 'interfaceName', 'interfaceText'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['insertEnumMember'] },
              file: { type: 'string' },
              enumName: { type: 'string' },
              memberName: { type: 'string' },
              initializer: { type: ['string', 'null'] },
            },
            required: ['kind', 'file', 'enumName', 'memberName', 'initializer'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['upsertObjectProperty'] },
              file: { type: 'string' },
              exportName: { type: 'string' },
              key: { type: 'string' },
              valueExpr: { type: 'string' },
            },
            required: ['kind', 'file', 'exportName', 'key', 'valueExpr'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['renameSymbol'] },
              file: { type: 'string' },
              oldName: { type: 'string' },
              newName: { type: 'string' },
              scope: {
                type: ['string', 'null'],
                enum: ['exported', 'local', null],
              },
            },
            required: ['kind', 'file', 'oldName', 'newName', 'scope'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['createOrReplaceFile'] },
              file: { type: 'string' },
              text: { type: 'string' },
              overwrite: { type: 'boolean' },
            },
            required: ['kind', 'file', 'text', 'overwrite'],
          },
        ],
      },
    },
    non_applicable: {
      type: ['array', 'null'],
      items: { type: 'string' },
    },
  },
  required: ['version', 'ops', 'non_applicable'],
};

export const AffectedFilesJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'AffectedFiles',
  description: 'Array of files affected by the spec with their change type.',
  type: 'array',
  minItems: 1,
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      file: {
        type: 'string',
        title: 'Path to file from repo root',
        description: 'Example: packages/types/src/lib/types.ts',
      },
      type: {
        type: 'string',
        enum: ['required', 'added', 'modified'],
        description: 'How the file is affected',
      },
    },
    required: ['file', 'type'],
    propertyOrdering: ['file', 'type'],
  },
};

export type CodeEdits = {
  filePath: string;
  type: 'CREATE' | 'MODIFY' | 'DELETE';
  proposedChange: string;
};

export enum SupportedEngines {
  COMS = 'coms',
  CONTEXT = 'context',
  SALES = 'sales',
  GOOGLE_SERVICES_CODE_ASSIST = 'googleServicesCodeAssist',
}

export enum SupportedCodingAgents {
  GOOGLE = 'google',
}

export type LarryAgent = {
  name: string;
  readmePath: string;
  xreason: SupportedEngines;
};

export type LarryAgentFactoryType = (config: Record<string, any>) => LarryAgent;
