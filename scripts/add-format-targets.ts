#!/usr/bin/env ts-node

/**
 * Usage:
 * npx ts-node --compiler-options '{"module":"commonjs"}' scripts/add-format-targets.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ProjectJson {
  name?: string;
  $schema?: string;
  targets?: Record<string, any>;
  [key: string]: any;
}

/**
 * Calculate the number of directory levels deep from root
 */
function getDepthFromRoot(filePath: string, rootPath: string): number {
  const relative = path.relative(rootPath, path.dirname(filePath));
  if (relative === '' || relative === '.') {
    return 0;
  }
  return relative.split(path.sep).length;
}

/**
 * Generate the relative path to .prettierrc and .prettierignore
 */
function getPrettierConfigPath(depth: number): string {
  if (depth === 0) {
    return '.prettierrc';
  }
  return '../'.repeat(depth) + '.prettierrc';
}

function getPrettierIgnorePath(depth: number): string {
  if (depth === 0) {
    return '.prettierignore';
  }
  return '../'.repeat(depth) + '.prettierignore';
}

/**
 * Add format targets to a project.json file
 */
function addFormatTargets(projectJsonPath: string, rootPath: string): boolean {
  const content = fs.readFileSync(projectJsonPath, 'utf-8');
  const projectJson: ProjectJson = JSON.parse(content);

  // Skip if targets already exist
  if (
    projectJson.targets?.['format:check'] ||
    projectJson.targets?.['format:write']
  ) {
    console.log(
      `⏭️  Skipping ${projectJsonPath} - format targets already exist`,
    );
    return false;
  }

  // Ensure targets object exists
  if (!projectJson.targets) {
    projectJson.targets = {};
  }

  // Calculate paths
  const depth = getDepthFromRoot(projectJsonPath, rootPath);
  const projectDir =
    path.relative(rootPath, path.dirname(projectJsonPath)) || '.';
  const prettierConfig = getPrettierConfigPath(depth);
  const prettierIgnore = getPrettierIgnorePath(depth);

  // Add format:check target
  projectJson.targets['format:check'] = {
    executor: 'nx:run-commands',
    options: {
      cwd: projectDir,
      commands: [
        'prettier-package-json --list-different',
        `prettier --config ${prettierConfig} --ignore-path ${prettierIgnore} --check .`,
      ],
    },
  };

  // Add format:write target
  projectJson.targets['format:write'] = {
    executor: 'nx:run-commands',
    options: {
      cwd: projectDir,
      commands: [
        'prettier-package-json --write',
        `prettier --config ${prettierConfig} --ignore-path ${prettierIgnore} --write .`,
      ],
    },
  };

  // Write back to file with proper formatting
  const updatedContent = JSON.stringify(projectJson, null, 2) + '\n';
  fs.writeFileSync(projectJsonPath, updatedContent, 'utf-8');

  console.log(`✅ Updated ${projectJsonPath}`);
  return true;
}

/**
 * Main function
 */
function main() {
  // Resolve root path relative to this script's location
  // @ts-ignore - __dirname is available when running with ts-node in CommonJS mode
  const rootPath = path.resolve(__dirname, '..');
  const projectJsonFiles: string[] = [];

  // Find all project.json files
  function findProjectJsonFiles(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules, dist, tmp, and other build directories
      if (
        entry.isDirectory() &&
        (entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'tmp' ||
          entry.name === '.nx' ||
          entry.name === 'coverage' ||
          entry.name.startsWith('.'))
      ) {
        continue;
      }

      if (entry.isFile() && entry.name === 'project.json') {
        projectJsonFiles.push(fullPath);
      } else if (entry.isDirectory()) {
        findProjectJsonFiles(fullPath);
      }
    }
  }

  findProjectJsonFiles(rootPath);

  console.log(`Found ${projectJsonFiles.length} project.json files\n`);

  let updatedCount = 0;
  for (const projectJsonPath of projectJsonFiles) {
    if (addFormatTargets(projectJsonPath, rootPath)) {
      updatedCount++;
    }
  }

  console.log(
    `\n✨ Migration complete! Updated ${updatedCount} of ${projectJsonFiles.length} project.json files.`,
  );
}

if (require.main === module) {
  main();
}
