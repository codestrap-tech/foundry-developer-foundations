import * as fs from 'fs';
import * as path from 'path';
import {
  PackageJsonSummary,
  ProjectConfigSummary,
  ProjectJsonSummary,
  TsConfigSummary,
} from '@codestrap/developer-foundations-types';

function tryReadJSON<T = any>(p: string): T | undefined {
  try {
    const txt = fs.readFileSync(p, 'utf8');
    return JSON.parse(txt) as T;
  } catch {
    return undefined;
  }
}

function findFiles(
  dir: string,
  names: string[] = [],
  patterns: RegExp[] = [],
): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.git')) continue;
      results.push(...findFiles(p, names, patterns));
    } else {
      if (names.includes(e.name)) results.push(p);
      else if (patterns.some((rx) => rx.test(e.name))) results.push(p);
    }
  }
  return results;
}

export function discoverProjectConfigs(
  projectRoot: string,
): ProjectConfigSummary {
  // Package.json (nearest in project root)
  const pkgPath = path.join(projectRoot, 'package.json');
  let packageJson: PackageJsonSummary | undefined;
  if (fs.existsSync(pkgPath)) {
    const pkg = tryReadJSON<any>(pkgPath);
    if (pkg) {
      packageJson = {
        path: pkgPath,
        name: pkg.name,
        version: pkg.version,
        private: !!pkg.private,
        scripts: pkg.scripts,
        dependencies: pkg.dependencies,
        devDependencies: pkg.devDependencies,
        peerDependencies: pkg.peerDependencies,
      };
    }
  }

  // project.json
  const projPath = path.join(projectRoot, 'project.json');
  let projectJson: ProjectJsonSummary | undefined;
  if (fs.existsSync(projPath)) {
    const pj = tryReadJSON<any>(projPath);
    if (pj) {
      projectJson = {
        path: projPath,
        name: pj.name,
        sourceRoot: pj.sourceRoot,
        tags: pj.tags,
        targets: pj.targets ? Object.keys(pj.targets) : [],
      };
    }
  }

  // tsconfig files in the project (limit to common names)
  const tsconfigNames = [
    'tsconfig.json',
    'tsconfig.base.json',
    'tsconfig.lib.json',
    'tsconfig.spec.json',
    'tsconfig.app.json',
  ];
  const tsconfigPaths = findFiles(projectRoot, tsconfigNames, []);
  const tsconfigs: TsConfigSummary[] = tsconfigPaths
    .slice(0, 10) // keep it bounded
    .map((p) => {
      const tc = tryReadJSON<any>(p) || {};
      return {
        path: p,
        extends: typeof tc.extends === 'string' ? tc.extends : undefined,
        compilerOptions: tc.compilerOptions,
      };
    });

  // jest / eslint config files (paths only)
  const jestConfigs = findFiles(projectRoot, [], [/^jest\.config\./i]).slice(
    0,
    8,
  );
  const eslintConfigs = findFiles(
    projectRoot,
    [],
    [/^eslint\.config\./i, /^\.eslintrc(\..+)?$/i],
  ).slice(0, 8);

  // env files
  const envFiles = findFiles(projectRoot, [], [/^\.env(\..+)?$/]).slice(0, 8);

  return {
    packageJson,
    tsconfigs,
    projectJson,
    jestConfigs,
    eslintConfigs,
    envFiles,
  };
}
