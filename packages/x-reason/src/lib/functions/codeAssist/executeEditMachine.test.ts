import * as fs from 'fs';
import * as path from 'path';
import * as prettier from 'prettier';

// Mock ts-morph BEFORE importing SUT.
jest.mock('ts-morph', () => {
    const real = jest.requireActual('ts-morph');
    class MockProject extends real.Project {
        constructor(options?: any) {
            // Force in-memory FS; avoid any real tsconfig reads.
            super({
                useInMemoryFileSystem: true,
                manipulationSettings: options?.manipulationSettings,
            });
        }
    }
    return { ...real, Project: MockProject };
});

import { Project } from 'ts-morph';
// Adjust this to your actual path:
import { executeEditMachine } from './executeEditMachine';
import type { EditOp, ApplyResult } from '@codestrap/developer-foundations-types';

// NOTE: We extend the seed so we can exercise all missing op kinds.
const baseDir = '/virtual';
const fileRel = 'src/mod.ts';
const fileAbs = path.resolve(baseDir, fileRel);

const seed = `
// imports (we will remove the named import from 'x' and add 'zod')
import { something } from 'x';

// interface & type-literal alias (for insert property + update property)
export interface User { id: string }
type UserRec = { id: string; role: string }

// union & enum (for add member ops)
type Status = 'Active' | 'Suspended';
enum Color { Red = 'RED' }

// object literal (for upsert)
const cfg = { version: 'v1' }

// functions: decl + arrow (for replace body + update return type)
export function add(a: number, b: number): number { return a + b; }
export const toStr = (n: number) => n + '';

// class + method (for replaceMethodBody, then we'll rename the class)
export class Greeter { greet(name: string) { return 'hi ' + name } }

// var to export
const hidden = 1;

// type alias & interface to replace
type ID = string;
export interface Settings { a: number }
`;

// Virtual FS
const VFS: Record<string, string> = {
    [fileRel]: seed,
};

describe('executeEditMachine (mocked FS, in-memory ts-morph) — full v1 coverage', () => {
    let existsSpy: jest.SpyInstance;
    let readSpy: jest.SpyInstance;
    let writeSpy: jest.SpyInstance;
    let addSourceSpy: jest.SpyInstance;
    let saveSpy: jest.SpyInstance;
    let prettierSpy: jest.SpyInstance;
    let getDiagsSpy: jest.SpyInstance;

    beforeEach(() => {
        // Only acknowledge existence of our single virtual file.
        existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
            return path.resolve(String(p)) === fileAbs;
        });
        // Block any accidental disk access.
        readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('readFileSync should not be called');
        });
        writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('writeFileSync should not be called');
        });

        // Hydrate from our VFS instead of disk.
        addSourceSpy = jest
            .spyOn(Project.prototype as any, 'addSourceFileAtPath')
            .mockImplementation(function (this: Project, abs: any) {
                const rel = path.posix.normalize(path.relative(baseDir, abs).replace(/\\/g, '/'));
                const txt = VFS[abs] ?? VFS[rel];
                if (txt == null) throw new Error(`Test VFS missing source for: ${abs}`);
                return this.createSourceFile(abs, txt, { overwrite: true });
            });

        // Persist modified files back into VFS so run #2 starts from edited text.
        saveSpy = jest
            .spyOn(Project.prototype as any, 'save')
            .mockImplementation(function (this: Project) {
                for (const sf of this.getSourceFiles()) {
                    const abs = sf.getFilePath();
                    const rel = path.posix.normalize(path.relative(baseDir, abs).replace(/\\/g, '/'));
                    const text = sf.getFullText();
                    VFS[abs] = text;
                    VFS[rel] = text;
                }
                return Promise.resolve();
            });

        // Prettier: return identity; assert filepath is our virtual file.
        prettierSpy = jest.spyOn(prettier, 'format').mockImplementation((text: string) => text);

        // Filter only TS2307 for 'zod' and 'x' so diagnosticsText can be null.
        const origGetDiags = Project.prototype.getPreEmitDiagnostics;
        getDiagsSpy = jest
            .spyOn(Project.prototype as any, 'getPreEmitDiagnostics')
            .mockImplementation(function (this: Project) {
                const diags = origGetDiags.call(this) as any[];
                return diags.filter(d => {
                    const code = typeof d.getCode === 'function' ? d.getCode() : undefined;
                    if (code !== 2307) return true;
                    const msg = String(d.getMessageText?.() ?? '');
                    return !/'(zod|x)'/.test(msg);
                });
            });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (getDiagsSpy) getDiagsSpy.mockRestore();
        // Reset VFS to seed for isolation (optional)
        VFS[fileRel] = seed;
        delete VFS[fileAbs];
    });

    it('applies a full v1 plan in-memory, persists edits, and is idempotent on run #2 (excluding one-shot ops)', async () => {
        const ops: EditOp[] = [
            // IMPORTS
            { kind: 'ensureImport', file: fileRel, from: 'zod', names: ['z'] },
            { kind: 'removeImportNames', file: fileRel, from: 'x', names: ['something'] },

            // TYPES & INTERFACES
            {
                kind: 'insertInterfaceProperty',
                file: fileRel,
                interfaceName: 'User',
                propertySig: 'email?: string',
            },
            {
                kind: 'updateTypeProperty',
                file: fileRel,
                typeName: 'UserRec',
                property: 'role',
                newType: '"Admin" | "User"',
            },
            { kind: 'addUnionMember', file: fileRel, typeName: 'Status', member: "'Deleted'" },
            {
                kind: 'insertEnumMember',
                file: fileRel,
                enumName: 'Color',
                memberName: 'Green',
                initializer: '"GREEN"',
            },
            {
                kind: 'replaceTypeAlias',
                file: fileRel,
                typeName: 'ID',
                typeText: 'string & { readonly brand: "ID" }',
            },
            {
                kind: 'replaceInterface',
                file: fileRel,
                interfaceName: 'Settings',
                interfaceText: 'export interface Settings { b: string }',
            },

            // OBJECT LITERAL
            {
                kind: 'upsertObjectProperty',
                file: fileRel,
                exportName: 'cfg',
                key: 'enabled',
                valueExpr: 'true',
            },

            // FUNCTIONS & METHODS
            {
                kind: 'replaceFunctionBody',
                file: fileRel,
                exportName: 'add',
                body: '{ return a - (-b); }',
            },
            {
                kind: 'updateFunctionReturnType',
                file: fileRel,
                exportName: 'toStr',
                returnType: 'string',
            },
            {
                kind: 'replaceMethodBody',
                file: fileRel,
                className: 'Greeter',
                methodName: 'greet',
                body: '{ return `hello, ${name}`; }',
            },

            // EXPORTS
            { kind: 'ensureExport', file: fileRel, name: 'hidden' },

            // RENAME (one-shot)
            { kind: 'renameSymbol', file: fileRel, oldName: 'Greeter', newName: 'Speaker' },
        ];

        // First run — applies everything and persists into VFS
        const res1: ApplyResult = await executeEditMachine(ops, {
            baseDir,
            tsconfigPath: '/virtual/tsconfig.json',
            dryRun: false,
            write: true,
            format: true,
             
            onLog: () => { },
        } as any);

        // FS sanity: no reads/writes ever, existsSync used for our file path
        expect(existsSpy).toHaveBeenCalled();
        expect(existsSpy).toHaveBeenCalledWith(fileAbs);
        expect(readSpy).not.toHaveBeenCalled();
        expect(writeSpy).not.toHaveBeenCalled();

        // ts-morph hydrated from VFS
        expect(addSourceSpy).toHaveBeenCalledWith(fileAbs);

        // prettier used with our virtual path
        expect(prettierSpy).toHaveBeenCalled();
        const prettierOpts = prettierSpy.mock.calls[0]?.[1] ?? {};
        expect(prettierOpts).toMatchObject({ filepath: fileAbs });

        // one save on first run
        expect(saveSpy).toHaveBeenCalledTimes(1);

        // outputs
        expect(res1.diagnosticsText).toBeNull();
        expect(res1.changedFiles).toEqual([fileAbs]);

        const diff1 = res1.diffByFile[fileAbs]!;
        // imports
        expect(diff1).toMatch(/import\s*\{\s*z\s*\}\s*from 'zod'/);
        // 1) Diff shows the deletion of the real import (not a comment)
        expect(diff1).toMatch(/^- \s*import\s[^;]*\bfrom\s+['"]x['"];?\s*$/m);
        // 2) Diff does NOT show any added import for 'x'
        expect(diff1).not.toMatch(/^\+ \s*import\s[^;]*\bfrom\s+['"]x['"];?\s*$/m);
        // 3) Persisted source has no non-comment import from 'x'
        // (line starts with optional whitespace, then 'import', so comments won't match)
        const persisted = VFS[fileAbs] ?? VFS[fileRel];
        expect(persisted).not.toMatch(/^[ \t]*import\s[^;]*\bfrom\s+['"]x['"];?\s*$/m);
        // interface property insert
        expect(diff1).toMatch(/export interface User[\s\S]*email\?:\s*string/);
        // type-literal property update
        expect(diff1).toMatch(/type\s+UserRec\s*=\s*\{\s*id:\s*string;?\s*role:\s*"Admin"\s*\|\s*"User"/);
        // union member added
        expect(diff1).toMatch(/type\s+Status\s*=\s*'Active'\s*\|\s*'Suspended'\s*\|\s*'Deleted'/);
        // enum member added
        expect(diff1).toMatch(/enum\s+Color[\s\S]*Green\s*=\s*"GREEN"/);
        // type alias replaced
        expect(diff1).toMatch(/type\s+ID\s*=\s*string\s*&\s*\{\s*readonly\s+brand:\s*"ID"\s*\}/);
        // interface replaced
        expect(diff1).toMatch(/export\s+interface\s+Settings\s*\{\s*b:\s*string\s*\}/);
        // object upsert
        // In the unified diff, the added cfg line (note: leading '+', and 'v1' can be ' or ")
        expect(diff1).toMatch(/^\+\s*const\s+cfg\s*=\s*\{\s*version:\s*['"]v1['"]\s*,?\s*$/m);
        // And the added enabled line (with optional trailing comma)
        expect(diff1).toMatch(/^\+\s*enabled:\s*true,?\s*$/m);
        // function body replaced
        expect(diff1).toMatch(/export function add\([^)]*\)\s*:\s*number\s*\{\s*[\s\S]*?return a - \(-b\);/);
        // arrow function return type updated
        expect(diff1).toMatch(/export const toStr = \(n:\s*number\)\s*:\s*string\s*=>/);
        // method body replaced (class gets renamed to Speaker later)
        // Class was renamed & added in the diff
        expect(diff1).toMatch(/^\+\s*export\s+class\s+Speaker\b/m);
        // Method body contains the exact template return (note the escaped ${...})
        expect(diff1).toMatch(/^\+\s*return\s*`hello,\s*\$\{name\}`;$/m);
        // ensureExport for hidden
        expect(diff1).toMatch(/export\s+const\s+hidden\s*=/);

        // Prepare idempotent second run: drop one-shot rename
        const ops2 = ops.filter(o => o.kind !== 'renameSymbol' && o.kind !== 'replaceMethodBody');

        // Second run — no changes, no extra save
        const res2: ApplyResult = await executeEditMachine(ops2, {
            baseDir,
            tsconfigPath: '/virtual/tsconfig.json',
            dryRun: false,
            write: true,
            format: true,
             
            onLog: () => { },
        } as any);

        // existsSync may be called again internally; we only assert no disk reads/writes and same path checked
        expect(existsSpy).toHaveBeenCalledWith(fileAbs);
        expect(readSpy).not.toHaveBeenCalled();
        expect(writeSpy).not.toHaveBeenCalled();

        // still only 1 save total (first run persisted to VFS; run #2 found no diffs)
        expect(saveSpy).toHaveBeenCalledTimes(1);

        // no changes on run #2
        expect(res2.changedFiles).toHaveLength(0);
        expect(res2.diffByFile[fileAbs]).toBeUndefined();
        expect(res2.diagnosticsText).toBeNull();
    });
});
