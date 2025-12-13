/* tools/codemods/applyEditPlan.ts */
import * as fs from 'fs';
import * as path from 'path';
import type {
  SourceFile,
  InterfaceDeclaration,
  TypeLiteralNode,
  ObjectLiteralExpression,
  ArrowFunction,
} from 'ts-morph';
import { Project, SyntaxKind, QuoteKind, Node } from 'ts-morph';
import * as prettier from 'prettier';
import type {
  ApplyOptions,
  ApplyResult,
  EditOp,
} from '@codestrap/developer-foundations-types';

/* =========================
   2) MAIN ENTRY
   ========================= */
export async function executeEditMachine(
  ops: EditOp[],
  opts: ApplyOptions = {},
): Promise<ApplyResult> {
  const {
    tsconfigPath = 'tsconfig.json',
    baseDir = process.cwd(),
    dryRun = false,
    format = true,
    write = true,
    onLog = (message: string) => {
      console.log(message);
    },
  } = opts;

  if (!Array.isArray(ops) || ops.length === 0) {
    return { changedFiles: [], diffByFile: {}, diagnosticsText: null };
  }

  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
    manipulationSettings: {
      quoteKind: QuoteKind.Single,
      useTrailingCommas: true,
    },
  });

  const createOps = ops.filter((o) => o.kind === 'createOrReplaceFile');

  const editOps = ops.filter((o) => o.kind !== 'createOrReplaceFile');

  // Track original text for each file so we can diff properly even for created/replaced files
  const originalText = new Map<string, string>();
  const byFile = new Map<string, EditOp[]>();
  // Ensure all files are in the project and cache them
  const fileCache = new Map<string, SourceFile>();

  // --- NEW: pre-pass for file creation / replacement ---
  for (const op of createOps) {
    const abs = path.resolve(baseDir, op.file);

    // always enqueue the op for this file (phases will ignore it; pre-pass applies it)
    if (!byFile.has(abs)) byFile.set(abs, []);
    byFile.get(abs)!.push(op);

    let sf = project.getSourceFile(abs);

    if (!sf) {
      // brand new file -> create in project, snapshot original as empty
      project.createDirectory(path.dirname(abs));
      originalText.set(abs, '');
      sf = project.createSourceFile(abs, op.text, { overwrite: false });
    } else {
      // file already in project -> snapshot its current text once
      const prev = sf.getFullText();
      if (!originalText.has(abs)) originalText.set(abs, prev);

      // apply replace only when overwrite===true and content differs
      if (op.overwrite && prev !== op.text) {
        sf.replaceWithText(op.text);
      }
    }

    fileCache.set(abs, sf);
  }

  // Group ops by absolute path and load SourceFiles
  for (const op of editOps) {
    const abs = path.resolve(baseDir, op.file);
    if (!fs.existsSync(abs)) throw new Error(`File does not exist: ${abs}`);
    if (!byFile.has(abs)) byFile.set(abs, []);
    byFile.get(abs)!.push(op);

    let sf = project.getSourceFile(abs);
    if (!sf) {
      //required for unit testing
      // In unit tests, we hydrate source files from a *virtual* filesystem (VFS) by
      // mocking Project.prototype.addSourceFileAtPath to read from that VFS. However,
      // those files are not preloaded into the Project (we aren't constructing the
      // Project with a tsconfig that includes them).
      sf = project.addSourceFileAtPath(abs);
    }
    fileCache.set(abs, sf);
  }

  const changedFiles: string[] = [];
  const diffByFile: Record<string, string> = {};

  // Deterministic phases
  const phases: ((sf: SourceFile, fileOps: EditOp[]) => void)[] = [
    phaseImports,
    phaseTypesAndInterfacesEnumsObjects,
    phaseFunctionsAndMethods,
    phaseExports,
    phaseRenameSymbols,
  ];

  for (const [abs, fileOps] of byFile) {
    const sf = fileCache.get(abs);
    if (!sf) {
      throw new Error('unable to get file from cache');
    }
    const prior = originalText.get(abs) ?? sf.getFullText();

    for (const phase of phases) phase(sf, fileOps);

    if (format) {
      const formatted = await prettier.format(sf.getFullText(), {
        filepath: abs,
      });
      if (formatted !== sf.getFullText()) sf.replaceWithText(formatted);
    }

    if (sf.getFullText() !== prior) {
      changedFiles.push(abs);
      diffByFile[abs] = unifiedDiff(prior, sf.getFullText(), abs);
    }
  }

  const diags = project.getPreEmitDiagnostics();
  const diagnosticsText = diags.length
    ? project.formatDiagnosticsWithColorAndContext(diags)
    : null;

  if (dryRun) {
    return { changedFiles, diffByFile, diagnosticsText };
  }

  if (write && changedFiles.length) {
    await project.save();
    onLog(`Wrote ${changedFiles.length} file(s).`);
  }
  if (diagnosticsText) onLog(diagnosticsText);

  return { changedFiles, diffByFile, diagnosticsText };
}

/* =========================
   3) PHASES
   ========================= */
function phaseImports(sf: SourceFile, ops: EditOp[]) {
  for (const op of ops) {
    if (op.kind === 'ensureImport') ensureImport(sf, op);
    else if (op.kind === 'removeImportNames') removeImportNames(sf, op);
  }
}

function phaseTypesAndInterfacesEnumsObjects(sf: SourceFile, ops: EditOp[]) {
  for (const op of ops) {
    switch (op.kind) {
      case 'addUnionMember':
        addUnionMember(sf, op);
        break;
      case 'updateTypeProperty':
        updateTypeProperty(sf, op);
        break;
      case 'insertInterfaceProperty':
        insertInterfaceProperty(sf, op);
        break;
      case 'replaceTypeAlias':
        replaceTypeAlias(sf, op);
        break;
      case 'replaceInterface':
        replaceInterface(sf, op);
        break;
      case 'insertEnumMember':
        insertEnumMember(sf, op);
        break;
      case 'upsertObjectProperty':
        upsertObjectProperty(sf, op);
        break;
      default:
        break;
    }
  }
}

function phaseFunctionsAndMethods(sf: SourceFile, ops: EditOp[]) {
  for (const op of ops) {
    switch (op.kind) {
      case 'replaceFunctionBody':
        replaceFunctionBody(sf, op);
        break;
      case 'updateFunctionReturnType':
        updateFunctionReturnType(sf, op);
        break;
      case 'replaceMethodBody':
        replaceMethodBody(sf, op);
        break;
      default:
        break;
    }
  }
}

function phaseExports(sf: SourceFile, ops: EditOp[]) {
  for (const op of ops) {
    if (op.kind === 'ensureExport') ensureExport(sf, op);
  }
}

function phaseRenameSymbols(sf: SourceFile, ops: EditOp[]) {
  for (const op of ops) {
    if (op.kind === 'renameSymbol') renameSymbol(sf, op);
  }
}

/* =========================
   4) UTILITIES
   ========================= */
function sanitizeBodyText(body: string): string {
  const t = body.trim();
  if (t.startsWith('{') && t.endsWith('}')) return t.slice(1, -1).trim();
  return t;
}
function stripQuotes(s: string) {
  return s.replace(/^['"]|['"]$/g, '');
}
function normalizeWS(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function unifiedDiff(a: string, b: string, filePath: string): string {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const max = Math.max(aLines.length, bLines.length);
  const out: string[] = [`--- ${filePath}`, `+++ ${filePath}`];
  for (let i = 0; i < max; i++) {
    const l = aLines[i] ?? '';
    const r = bLines[i] ?? '';
    if (l !== r) {
      out.push(`- ${l}`);
      out.push(`+ ${r}`);
    }
  }
  return out.join('\n');
}

/* =========================
   5) IMPORTS
   ========================= */
function ensureImport(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'ensureImport' }>,
) {
  let decl = sf.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === op.from,
  );
  if (!decl) {
    decl = sf.addImportDeclaration({
      moduleSpecifier: op.from,
      defaultImport: op.defaultName,
      namedImports: (op.names ?? []).map((n) => ({ name: n })),
      isTypeOnly: !!op.isTypeOnly,
    });
    return;
  }
  if (op.isTypeOnly != null) decl.setIsTypeOnly(!!op.isTypeOnly);
  if (op.defaultName && !decl.getDefaultImport())
    decl.setDefaultImport(op.defaultName);
  for (const name of op.names ?? []) {
    if (!decl.getNamedImports().some((ni) => ni.getName() === name)) {
      decl.addNamedImport({ name });
    }
  }
}

function removeImportNames(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'removeImportNames' }>,
) {
  const decl = sf.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === op.from,
  );
  if (!decl) return;
  if (op.defaultName) decl.removeDefaultImport();
  const toRemove = new Set(op.names ?? []);
  decl.getNamedImports().forEach((ni) => {
    if (toRemove.has(ni.getName())) ni.remove();
  });
  if (!decl.getDefaultImport() && decl.getNamedImports().length === 0)
    decl.remove();
}

/* =========================
   6) TYPES / INTERFACES / ENUMS / OBJECTS
   ========================= */
function addUnionMember(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'addUnionMember' }>,
) {
  const ta = sf.getTypeAliasOrThrow(op.typeName);
  const tn = ta.getTypeNodeOrThrow();
  if (!Node.isUnionTypeNode(tn))
    throw new Error(`Type ${op.typeName} is not a union`);
  const current = tn.getText();
  const member = op.member.trim();
  const mBare = stripQuotes(member);
  if (new RegExp(`\\b${escapeRegex(mBare)}\\b`).test(current)) return;
  ta.setType(`${current} | ${member}`);
}

function updateTypeProperty(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'updateTypeProperty' }>,
) {
  const intf = sf.getInterface(op.typeName);
  if (intf) {
    const prop = intf.getProperty(op.property);
    if (!prop)
      throw new Error(
        `Interface ${op.typeName} has no property ${op.property}`,
      );
    const current = prop.getTypeNode()?.getText();
    if (current === op.newType) return;
    prop.setType(op.newType);
    return;
  }

  const ta = sf.getTypeAliasOrThrow(op.typeName);
  const tn = ta.getTypeNodeOrThrow();
  if (!Node.isTypeLiteral(tn)) {
    throw new Error(
      `Type alias ${op.typeName} is not a type literal; cannot update property`,
    );
  }
  const typeLit: TypeLiteralNode = tn;
  const prop = typeLit.getProperty(op.property);
  if (!prop || !Node.isPropertySignature(prop)) {
    throw new Error(
      `Type literal ${op.typeName} has no property ${op.property}`,
    );
  }
  const current = prop.getTypeNode()?.getText();
  if (current === op.newType) return;
  prop.setType(op.newType);
}

function insertInterfaceProperty(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'insertInterfaceProperty' }>,
) {
  const i: InterfaceDeclaration = sf.getInterfaceOrThrow(op.interfaceName);
  // simple parser: "<name>[?]: <type>"
  const m = op.propertySig.match(/^\s*([A-Z_$][\w$]*)(\?)?\s*:\s*(.+?)\s*$/i);
  if (!m)
    throw new Error(
      `propertySig must be "name?: type" — got: ${op.propertySig}`,
    );
  const [, rawName, qmark, typeText] = m;
  if (i.getProperty(rawName)) return;
  i.addProperty({
    name: rawName,
    hasQuestionToken: !!qmark,
    type: typeText,
  });
}

function replaceTypeAlias(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'replaceTypeAlias' }>,
) {
  const newText = op.typeText.trim();
  const ta = sf.getTypeAlias(op.typeName);

  if (!ta) {
    sf.addTypeAlias({ name: op.typeName, type: newText, isExported: true });
    return;
  }

  const current = ta.getTypeNode()?.getText().trim();
  if (current === newText) return;

  try {
    ta.setType(newText);
  } catch {
    // preserve export/declare & generic params
    const mods =
      (ta.hasDeclareKeyword?.() ? 'declare ' : '') +
      (ta.isExported() ? 'export ' : '');
    const tparams = ta.getTypeParameters();
    const tparamsText = tparams.length
      ? `<${tparams.map((tp) => tp.getText()).join(', ')}>`
      : '';
    ta.replaceWithText(`${mods}type ${op.typeName}${tparamsText} = ${newText}`);
  }
}

function replaceInterface(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'replaceInterface' }>,
) {
  const newText = op.interfaceText.trim();
  const intf = sf.getInterface(op.interfaceName);

  // If it doesn't exist, add the full text and return
  if (!intf) {
    // interfaceText is full text (may already include `export`)
    sf.addStatements(newText);
    return;
  }

  // No-op if text is already equivalent
  if (normalizeWS(intf.getText()) === normalizeWS(newText)) return;

  // Primary path: replace the interface text
  try {
    intf.replaceWithText(newText);
  } catch {
    // Fallback: remove and re-insert at the same position to avoid structural issues
    const insertIndex = intf.getChildIndex();
    intf.remove();
    sf.insertStatements(insertIndex, newText);
  }
}

function insertEnumMember(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'insertEnumMember' }>,
) {
  const en = sf.getEnumOrThrow(op.enumName);
  if (en.getMember(op.memberName)) return;
  if (op.initializer)
    en.addMember({ name: op.memberName, initializer: op.initializer });
  else en.addMember({ name: op.memberName });
}

function upsertObjectProperty(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'upsertObjectProperty' }>,
) {
  const vd = sf.getVariableDeclarationOrThrow(op.exportName);
  const init = vd.getInitializer();
  if (!init || !Node.isObjectLiteralExpression(init)) {
    throw new Error(
      `${op.exportName} is not initialized with an object literal`,
    );
  }
  const obj: ObjectLiteralExpression = init;

  const keyId = stripQuotes(op.key);
  const existing = obj.getProperty((p) => {
    if (Node.isPropertyAssignment(p)) {
      const name = stripQuotes(p.getName());
      return name === keyId;
    }
    return false;
  });

  if (existing && Node.isPropertyAssignment(existing)) {
    const current = existing.getInitializer()?.getText() ?? '';
    if (normalizeWS(current) === normalizeWS(op.valueExpr)) return;
    existing.setInitializer(op.valueExpr);
  } else {
    const validIdent = /^[A-Z_$][\w$]*$/i.test(keyId);
    obj.addPropertyAssignment({
      name: validIdent ? keyId : JSON.stringify(keyId),
      initializer: op.valueExpr,
    });
  }
}

/* =========================
   7) FUNCTIONS & METHODS
   ========================= */
function replaceFunctionBody(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'replaceFunctionBody' }>,
) {
  const fn = sf.getFunction(op.exportName);
  if (fn) {
    const body = sanitizeBodyText(op.body);
    if (fn.getBodyText()?.trim() === body.trim()) return;
    fn.setBodyText(body);
    return;
  }
  const vd = sf.getVariableDeclarationOrThrow(op.exportName);
  const init = vd.getInitializer();
  if (!init || !Node.isArrowFunction(init)) {
    throw new Error(`${op.exportName} is not an arrow function`);
  }
  const af: ArrowFunction = init;
  const body = sanitizeBodyText(op.body);
  if (af.getBodyText()?.trim() === body.trim()) return;
  if (!Node.isBlock(af.getBody())) {
    af.setBodyText(`{ ${body} }`);
  } else {
    af.setBodyText(body);
  }
}

function updateFunctionReturnType(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'updateFunctionReturnType' }>,
) {
  const fn = sf.getFunction(op.exportName);
  if (fn) {
    if (fn.getReturnTypeNode()?.getText() === op.returnType) return;
    fn.setReturnType(op.returnType);
    return;
  }
  const vd = sf.getVariableDeclarationOrThrow(op.exportName);
  const init = vd.getInitializer();
  if (!init || !Node.isArrowFunction(init)) {
    throw new Error(`${op.exportName} is not an arrow function`);
  }
  const af: ArrowFunction = init;
  if (af.getReturnTypeNode()?.getText() === op.returnType) return;
  af.setReturnType(op.returnType);
}

function replaceMethodBody(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'replaceMethodBody' }>,
) {
  const cls = sf.getClassOrThrow(op.className);
  const m = cls.getMethod(op.methodName);
  if (!m) throw new Error(`Method ${op.className}.${op.methodName} not found`);
  const body = sanitizeBodyText(op.body);
  if (m.getBodyText()?.trim() === body.trim()) return;
  m.setBodyText(body);
}

/* =========================
   8) EXPORTS
   ========================= */
function ensureExport(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'ensureExport' }>,
) {
  // Functions/classes/interfaces/type aliases support setIsExported directly
  const fn = sf.getFunction(op.name);
  if (fn) {
    if (!fn.isExported()) fn.setIsExported(true);
    return;
  }
  const cls = sf.getClass(op.name);
  if (cls) {
    if (!cls.isExported()) cls.setIsExported(true);
    return;
  }
  const intf = sf.getInterface(op.name);
  if (intf) {
    if (!intf.isExported()) intf.setIsExported(true);
    return;
  }
  const ta = sf.getTypeAlias(op.name);
  if (ta) {
    if (!ta.isExported()) ta.setIsExported(true);
    return;
  }
  // Variables export via VariableStatement
  const vd = sf.getVariableDeclaration(op.name);
  if (vd) {
    const vs = vd.getVariableStatementOrThrow();
    if (!vs.isExported()) vs.setIsExported(true);
    return;
  }

  // Fallback: export { name } (if the symbol exists locally)
  const local =
    sf.getFunction(op.name) ||
    sf.getClass(op.name) ||
    sf.getInterface(op.name) ||
    sf.getTypeAlias(op.name) ||
    sf.getVariableDeclaration(op.name);

  if (local) {
    const hasSpec = sf
      .getExportDeclarations()
      .some((d) => d.getNamedExports().some((ne) => ne.getName() === op.name));
    if (!hasSpec) sf.addExportDeclaration({ namedExports: [op.name] });
    return;
  }

  throw new Error(
    `ensureExport: symbol ${op.name} not found in ${sf.getFilePath()}`,
  );
}

/* =========================
   9) RENAME
   ========================= */
function renameSymbol(
  sf: SourceFile,
  op: Extract<EditOp, { kind: 'renameSymbol' }>,
) {
  const scopeExported = (op.scope ?? 'exported') === 'exported';
  let target:
    | ReturnType<SourceFile['getFunction']>
    | ReturnType<SourceFile['getClass']>
    | ReturnType<SourceFile['getInterface']>
    | ReturnType<SourceFile['getTypeAlias']>
    | ReturnType<SourceFile['getVariableDeclaration']>
    | undefined;

  if (scopeExported) {
    target =
      sf.getFunction(op.oldName) ||
      sf.getClass(op.oldName) ||
      sf.getInterface(op.oldName) ||
      sf.getTypeAlias(op.oldName) ||
      sf.getVariableDeclaration(op.oldName);
  } else {
    target =
      sf.getVariableDeclaration(op.oldName) || sf.getFunction(op.oldName);
  }

  if (!target) throw new Error(`Symbol ${op.oldName} not found for rename`);
  // Most decls support .rename(...)
  // VariableDeclaration.rename will rename the identifier as well.
  (target as any).rename(op.newName);
}
