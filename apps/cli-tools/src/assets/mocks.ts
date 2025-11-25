// src/assets/mocks.ts
import * as fs from 'fs';
import * as ts from 'typescript';
import * as path from 'path';
import fg from 'fast-glob';

export type DiscoveredMock = {
  moduleName: string;
  factoryCode: string;
  file: string;
};

function readText(p: string) {
  return fs.readFileSync(p, 'utf8');
}

function getNodeText(src: string, node: ts.Node) {
  return src.slice(node.pos, node.end).trim();
}

async function findTestFiles(
  projectRoot: string,
  debug = false,
): Promise<string[]> {
  const root = path.resolve(projectRoot);

  const patterns = [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ];

  const ignore = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/*.e2e.test.ts',
    '**/*.e2e.test.tsx',
    '**/*.e2e.spec.ts',
    '**/*.e2e.spec.tsx',
  ];

  // Async glob (prevents V8 inspector crash you’re seeing with globSync)
  const files = await fg(patterns, {
    cwd: root,
    absolute: true,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: true,
    ignore,
  });

  if (debug) {
    console.log('[mocks] root:', root);
    console.log('[mocks] found:', files.length);
    console.log('[mocks] sample:', files.slice(0, 4));
    const expected = path.join(
      root,
      'src/lib/findOptimalMeetingTimeV2.test.ts',
    );
    console.log('[mocks] sanity exists?', fs.existsSync(expected), expected);
  }

  return files;
}

export async function discoverJestMocks(
  projectRoot: string,
  debug = false,
): Promise<DiscoveredMock[]> {
  const files = await findTestFiles(projectRoot, debug);
  const out: DiscoveredMock[] = [];

  for (const file of files) {
    const src = readText(file);
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);

    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const expr = n.expression;

        const isJestMock =
          (ts.isPropertyAccessExpression(expr) &&
            expr.expression.getText(sf) === 'jest' &&
            expr.name.getText(sf) === 'mock') ||
          (ts.isPropertyAccessExpression(expr) &&
            expr.name.getText(sf) === 'mock' &&
            /jest/i.test(expr.expression.getText(sf)));

        if (isJestMock) {
          const [modArg, factoryArg] = n.arguments;
          if (modArg && ts.isStringLiteral(modArg) && factoryArg) {
            out.push({
              moduleName: modArg.text,
              factoryCode: getNodeText(src, factoryArg),
              file,
            });
          }
        }
      }
      ts.forEachChild(n, visit);
    };

    ts.forEachChild(sf, visit);
  }

  // de-dupe (module + factory)
  const seen = new Set<string>();
  return out.filter((m) => {
    const key = m.moduleName + '::' + m.factoryCode;
    seen.add(key);
    return true;
  });
}
