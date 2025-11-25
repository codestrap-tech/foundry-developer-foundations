// src/analyzers/tsProgram.ts
import ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  CodeFileSummary,
  ExportedSymbol,
} from '@codestrap/developer-foundations-types';

export type ProgramGraph = {
  importTree: string[];
  files: CodeFileSummary[];
};

function readLinesCount(p: string): number {
  try {
    const data = fs.readFileSync(p, 'utf8');
    return data.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

function fileExportedSymbols(
  program: ts.Program,
  filePath: string,
): ExportedSymbol[] {
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(filePath);
  if (!source) return [];
  const result: ExportedSymbol[] = [];

  const sfSymbol = checker.getSymbolAtLocation(source);
  if (!sfSymbol) return [];

  const exports = checker.getExportsOfModule(sfSymbol);
  for (const s of exports) {
    const name = s.getName();
    let kind: ExportedSymbol['kind'] = 'unknown';
    let signature: string | undefined;
    const isDefault = name === 'default';
    let jsDoc: string | undefined;

    const declarations = s.getDeclarations() || [];
    const decl = declarations[0];

    const flags = (s.getFlags ? s.getFlags() : 0) as ts.SymbolFlags;
    if (flags & ts.SymbolFlags.Function) kind = 'function';
    else if (flags & ts.SymbolFlags.Class) kind = 'class';
    else if (flags & ts.SymbolFlags.Interface) kind = 'interface';
    else if (flags & ts.SymbolFlags.TypeAlias) kind = 'type';
    else if (flags & ts.SymbolFlags.Enum) kind = 'enum';
    else if (flags & ts.SymbolFlags.Variable) kind = 'variable';
    else if (flags & ts.SymbolFlags.Namespace) kind = 'namespace';
    else if (decl && ts.isVariableDeclaration(decl)) kind = 'const';

    // signatures
    if (kind === 'function' && decl) {
      const t = checker.getTypeOfSymbolAtLocation(s, decl);
      const callSigs = t.getCallSignatures();
      if (callSigs.length) {
        const sig = checker.signatureToString(
          callSigs[0],
          decl,
          ts.TypeFormatFlags.NoTruncation |
            ts.TypeFormatFlags.WriteArrowStyleSignature,
        );
        signature = `function ${name}${sig.substring(sig.indexOf('('))}`;
      }
    } else if (kind === 'class' && decl && ts.isClassDeclaration(decl)) {
      signature = `class ${name}${decl.typeParameters ? `<${decl.typeParameters.map((p) => p.name.getText()).join(', ')}>` : ''}`;
    }

    // jsDoc
    if (decl) {
      const jsDocs = ts.getJSDocCommentsAndTags(decl) || [];
      jsDoc = jsDocs
        .map((d) => d.getText())
        .join(' ')
        .trim();
      if (jsDoc && jsDoc.length > 600) jsDoc = jsDoc.slice(0, 600) + '…';
    }

    result.push({
      name,
      kind,
      signature,
      isDefault,
      jsDoc,
      sourceFile: filePath,
    });
  }

  return result;
}

export function buildProgramGraph(
  entryFile: string,
  tsconfigPath?: string,
): ProgramGraph {
  const resolvedEntry = path.resolve(entryFile);
  const configPath =
    tsconfigPath ??
    ts.findConfigFile(
      path.dirname(resolvedEntry),
      ts.sys.fileExists,
      'tsconfig.json',
    );

  let compilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  };

  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
    );
    compilerOptions = parsed.options;
  }

  const host = ts.createCompilerHost(compilerOptions, true);
  const program = ts.createProgram([resolvedEntry], compilerOptions, host);

  const visited = new Set<string>();
  const queue: string[] = [resolvedEntry];
  const importTree: string[] = [];

  function resolveModule(fromFile: string, spec: string): string | null {
    if (!spec) return null;
    if (spec.startsWith('node:')) return null;
    if (spec.startsWith('http:') || spec.startsWith('https:')) return null;

    const { resolvedModule } = ts.resolveModuleName(
      spec,
      fromFile,
      compilerOptions,
      ts.sys,
    );
    if (resolvedModule?.resolvedFileName) {
      const abs = path.resolve(resolvedModule.resolvedFileName);
      if (abs.includes(`${path.sep}node_modules${path.sep}`)) return null;
      return abs;
    }

    if (spec.startsWith('.') || spec.startsWith('/')) {
      const base = path.resolve(path.dirname(fromFile), spec);
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.mjs`,
        `${base}.cjs`,
        path.join(base, 'index.ts'),
        path.join(base, 'index.tsx'),
        path.join(base, 'index.js'),
      ];
      for (const c of candidates) {
        if (
          fs.existsSync(c) &&
          !c.includes(`${path.sep}node_modules${path.sep}`)
        ) {
          return c;
        }
      }
    }
    return null;
  }

  function visit(filePath: string) {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    importTree.push(filePath);

    const sf = program.getSourceFile(filePath);
    if (!sf) return;

    const scan = (node: ts.Node) => {
      if (
        ts.isImportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const resolved = resolveModule(filePath, node.moduleSpecifier.text);
        if (resolved) queue.push(resolved);
      }
      if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const resolved = resolveModule(filePath, node.moduleSpecifier.text);
        if (resolved) queue.push(resolved);
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.getText() === 'require' &&
        node.arguments.length === 1
      ) {
        const arg = node.arguments[0];
        if (ts.isStringLiteral(arg)) {
          const resolved = resolveModule(filePath, arg.text);
          if (resolved) queue.push(resolved);
        }
      }
      ts.forEachChild(node, scan);
    };
    ts.forEachChild(sf, scan);
  }

  while (queue.length) {
    visit(queue.shift()!);
  }

  const files: CodeFileSummary[] = [];
  for (const file of importTree) {
    const stat = fs.existsSync(file) ? fs.statSync(file) : null;
    files.push({
      file,
      sizeBytes: stat?.size ?? 0,
      numLines: readLinesCount(file),
      exported: fileExportedSymbols(program, file),
    });
  }

  return { importTree, files };
}
