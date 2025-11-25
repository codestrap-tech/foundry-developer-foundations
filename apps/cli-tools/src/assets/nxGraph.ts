// src/analyzers/nxGraph.ts
import * as fs from 'fs';
import * as path from 'path';
import { NxDeps } from '@codestrap/developer-foundations-types';
import { execSync } from 'child_process';

function exists(p: string) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function findRepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  while (true) {
    if (
      exists(path.join(dir, 'nx.json')) ||
      exists(path.join(dir, '.git')) // last-resort marker
    ) {
      return dir;
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  // fallback: cwd (better than chopping segments)
  return process.cwd();
}

export function findOwningProject(entryFile: string): {
  projectName: string;
  projectRoot: string;
  repoRoot: string;
} | null {
  const absEntry = path.resolve(entryFile);
  const repoRoot = findRepoRoot(path.dirname(absEntry));

  // Walk up from the entry file to locate nearest project.json
  let dir = path.dirname(absEntry);
  while (true) {
    const pjPath = path.join(dir, 'project.json');
    if (fs.existsSync(pjPath)) {
      const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
      const projectRoot = path.dirname(pjPath);
      const projectName = pj.name ?? path.basename(projectRoot);
      return { projectName, projectRoot, repoRoot };
    }
    const up = path.dirname(dir);
    if (up === dir || !dir.startsWith(repoRoot)) break;
    dir = up;
  }

  // Fallback: infer from repoRoot + (apps|packages)/<name>
  const rel = path.relative(repoRoot, absEntry);
  const m = /^(apps|packages)[/\\]([^/\\]+)/.exec(rel);
  if (m) {
    const projectRoot = path.join(repoRoot, m[0]);
    const guessName = m[2];
    return { projectName: guessName, projectRoot, repoRoot };
  }

  return null;
}

export function readNxDeps(
  projectName: string,
  repoRoot: string,
): NxDeps | null {
  try {
    const jsonPath = path.join(repoRoot, 'project-graph.json');
    if (!fs.existsSync(jsonPath)) {
      // generate once (no scaffolding; safe in CI/local)
      execSync(
        'npx nx graph --file=project-graph.json --focus ' + projectName,
        {
          cwd: repoRoot,
          stdio: 'ignore',
        },
      );
    }
    const { graph } = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const nodes = graph.nodes || graph.projects || {};
    const deps = graph.dependencies || {};

    const node = nodes[projectName];
    if (!node) return null;

    const outbound = (deps[projectName] || [])
      .map((d: any) => d.target)
      .filter((x: string) => !!x);

    // inbound (dependents): scan all edges
    const inbound: string[] = [];
    for (const [src, arr] of Object.entries<any>(deps)) {
      if ((arr || []).some((e: any) => e.target === projectName))
        inbound.push(src);
    }

    return {
      projectName,
      tags: node.data?.tags || node.data?.metadata?.tags || [],
      dependencies: outbound,
      dependents: inbound,
      fileGraph: undefined,
    };
  } catch {
    return null;
  }
}
