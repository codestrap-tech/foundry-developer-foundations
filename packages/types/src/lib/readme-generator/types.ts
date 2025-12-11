import { Tokenomics } from "../x-reason/types";

// src/types.ts
export type FilePath = string;

export type ExportedSymbol = {
    name: string;
    kind: 'function' | 'class' | 'const' | 'type' | 'enum' | 'interface' | 'variable' | 'namespace' | 'unknown';
    signature?: string;
    isDefault?: boolean;
    jsDoc?: string;
    sourceFile?: FilePath;
};

export type WorkedExample = {
    title: string;
    file: FilePath;
    startLine?: number;
    endLine?: number;
    inputSnippet?: string;
    outputSnippet?: string;
    notes?: string;
};

export type PracticeProblem = {
    title: string;
    file?: FilePath;
    description: string;
    promptTemplate: string;
    answerKey?: string; // or pointer to oracle/fixture
    judgeNotes?: string;
};

export type EnvVar = {
    name: string;
    required: boolean;
    defaultValue?: string;
    files: FilePath[];
    notes?: string;
};

export type NxDeps = {
    projectName: string;
    tags?: string[];
    dependencies: string[];      // outbound (this -> others)
    dependents: string[];        // inbound (others -> this)
    fileGraph?: Record<string, string[]>;
};

export type EntryPointSummary = {
    entryFile: FilePath;
    projectRoot: FilePath;
    tsconfigPath?: FilePath;
};

export type CodeFileSummary = {
    file: FilePath;
    sizeBytes: number;
    numLines: number;
    exported: ExportedSymbol[];
};

export type Exposition = {
    purpose?: string;
    architecture?: string;
    invariants?: string[];
    failureModes?: string[];
    performanceNotes?: string[];
    additionalNotes?: string[];
};

export type ReadmeContext = {
    entry: EntryPointSummary;
    files: CodeFileSummary[];
    importTree: FilePath[];
    nx: NxDeps | null;
    env: EnvVar[];
    worked: WorkedExample[];
    practice: PracticeProblem[];
    exposition: Exposition;
    unknowns: string[];
    projectConfig?: ProjectConfigSummary;
};

export type ReadmeInputForTemplate = {
    expositionMd: string;
    workedSFT: WorkedExample[];
    practiceRL: PracticeProblem[];
    syntheticGenerators: Array<{
        name: string;
        description: string;
        params: Record<string, string>;
        oracleDescription?: string;
    }>;
    indexingPlan: {
        chunking: string;
        ids: string;
        embeddings: string;
        crossReferences: string;
    };
    apiSurface: ExportedSymbol[];
    envTable: EnvVar[];
    nxSummary: {
        projectName: string;
        dependencies: string[];
        dependents: string[];
        notes?: string;
    } | null;
    gapsAndQuestions: string[];
    projectConfig?: ProjectConfigSummary;
    toolCallingTasks?: ToolCallingTask[];
    currentUserEmail?: string;
    entryExportedFunctions?: string[];
    entryFile?: string;
    testMocks?: { moduleName: string; factoryCode: string; file: string }[];
    testMocksUnified?: string;
};

export type AssembleOptions = {
    askUserIfInsufficient?: boolean;
    maxFiles?: number;
    includePrivate?: boolean;
    cwd?: string;
};

export type Ctx = {
    // inputs
    entryFile: string;
    tsconfigPath?: string;

    // gathered
    projectRoot?: string;
    nx?: NxDeps | null;
    importTree: string[];
    files: CodeFileSummary[];
    apiSurface: ExportedSymbol[];
    worked: WorkedExample[];
    practice: PracticeProblem[];
    env: EnvVar[];
    exposition: Exposition;
    unknowns: string[];
    projectConfig?: ProjectConfigSummary;

    // synthesized
    readmeInput?: ReadmeInputForTemplate;
    readmeMarkdown?: string;

    // execution
    error?: string;

    testMocks?: { moduleName: string; factoryCode: string; file: string }[];
    testMocksUnified?: string; // the combined setup file content

    toolTasks?: ToolCallingTask[],
};

// ✱ ADD these near your other types

export type PackageJsonSummary = {
    path: string;
    name?: string;
    version?: string;
    private?: boolean;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
};

export type TsConfigSummary = {
    path: string;
    extends?: string;
    compilerOptions?: Partial<{
        target: string;
        module: string;
        baseUrl: string;
        rootDir: string;
        outDir: string;
        paths: Record<string, string[]>;
        jsx: string;
        moduleResolution: string;
        strict: boolean;
    }>;
};

export type ProjectJsonSummary = {
    path: string;
    name?: string;
    sourceRoot?: string;
    tags?: string[];
    targets?: string[]; // just the target names
};

export type ProjectConfigSummary = {
    packageJson?: PackageJsonSummary;
    tsconfigs: TsConfigSummary[];
    projectJson?: ProjectJsonSummary;
    jestConfigs: string[];   // paths only
    eslintConfigs: string[]; // paths only
    envFiles: string[];      // .env, .env.local, etc (paths only)
};

export type ToolCallingTask = {
    tool: string;
    question: string;
    answerCode: string;
    notes?: string;
};

export type UserIntent = {
    userAnswered?: boolean;
    reviewRequired?: boolean;
    messages: Record<string, any>;
    confirmationPrompt: string;
    userResponse?: string;
    file?: string;
}

export type Completion = {
    tokenomics: Tokenomics | undefined;
} & UserIntent;

/** Keep this union small, explicit, and auditable for v0 */
export type EditOp =
    // Imports
    | {
        kind: 'ensureImport';
        file: string;
        from: string;                 // module specifier, e.g. 'zod'
        names?: string[];             // named imports: ['z']; no duplicates added
        defaultName?: string;         // default import: 'React'
        isTypeOnly?: boolean;         // import type { Foo }
    }
    | {
        kind: 'removeImportNames';
        file: string;
        from: string;
        names?: string[];             // remove specific named imports
        defaultName?: boolean;        // remove default import if true
    }

    // Exports
    | {
        kind: 'ensureExport';
        file: string;
        name: string;                 // ensure symbol is exported (adds 'export' or `export { name }`)
    }

    // Functions (module-level)
    | {
        kind: 'replaceFunctionBody';
        file: string;
        exportName: string;           // exported function name
        body: string;                 // TS code inside braces, or whole `{ ... }` — both accepted
    }
    | {
        kind: 'updateFunctionReturnType';
        file: string;
        exportName: string;
        returnType: string;           // e.g. 'Promise<User>'
    }

    // Class methods
    | {
        kind: 'replaceMethodBody';
        file: string;
        className: string;
        methodName: string;
        body: string;
    }

    // Types & interfaces
    | {
        kind: 'addUnionMember';
        file: string;
        typeName: string;             // Type alias that is a union
        member: string;               // e.g. "'NewCase'" or 'NewCase'
    }
    | {
        kind: 'updateTypeProperty';
        file: string;
        typeName: string;             // interface or type literal alias
        property: string;
        newType: string;              // e.g. 'string & Brand<"Email">'
    }
    | {
        kind: 'insertInterfaceProperty';
        file: string;
        interfaceName: string;        // interface Foo { ... }
        propertySig: string;          // full property sig, e.g. 'email: string'
    }
    | {
        kind: 'replaceTypeAlias';
        file: string;
        typeName: string;
        typeText: string;             // replaces the entire alias body
    }
    | {
        kind: 'replaceInterface';
        file: string;
        interfaceName: string;
        interfaceText: string;        // full interface text: 'export interface Foo { ... }' or 'interface Foo { ... }'
    }

    // Enums
    | {
        kind: 'insertEnumMember';
        file: string;
        enumName: string;
        memberName: string;           // 'Draft'
        initializer?: string;         // e.g. '"DRAFT"' or '1'
    }

    // Object literals (common for config & env maps)
    | {
        kind: 'upsertObjectProperty';
        file: string;
        exportName: string;           // exported const name holding an object literal
        key: string;                  // property key (identifier or string literal)
        valueExpr: string;            // initializer text, e.g. '{ enabled: true }' or '"v1"'
    }

    // Symbol rename (scoped)
    | {
        kind: 'renameSymbol';
        file: string;
        oldName: string;
        newName: string;
        scope?: 'exported' | 'local'; // default exported
    }

    // new file creation or overwrite
    | {
        kind: 'createOrReplaceFile';
        file: string;
        text: string;
        overwrite: boolean;
    };

export type ApplyOptions = {
    tsconfigPath?: string;      // default 'tsconfig.json'
    baseDir?: string;           // resolve relative file paths
    dryRun?: boolean;           // show diffs; no writes
    format?: boolean;           // default true
    write?: boolean;            // default true (ignored if dryRun)
    onLog?: (msg: string) => void;
};

export type ApplyResult = {
    changedFiles: string[];
    diffByFile: Record<string, string>;
    diagnosticsText: string | null;
};

