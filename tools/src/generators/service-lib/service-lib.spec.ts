import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { serviceLibGenerator } from './service-lib';
import { ServiceLibGeneratorSchema } from './schema';

describe('service-lib generator', () => {
  let tree: Tree;
  const name = 'testName';
  const expectedFileName = 'test-name';
  const options: ServiceLibGeneratorSchema = { name };
  const root = `packages/services/${expectedFileName}`;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  xit('should configure targets correctly', async () => {
    await serviceLibGenerator(tree, options);
    const config = readProjectConfiguration(tree, expectedFileName);

    // check project configuration
    expect(config).toBeDefined();
    expect(config.name).toBe(expectedFileName);
    expect(config.root).toBe(root);
    expect(config.sourceRoot).toBe(`${root}/src`);
    expect(config.projectType).toBe('library');
    expect(config.tags).toContain('type:service');

    // custom release metadata
    const rel = (config as any).release;
    expect(rel).toBeDefined();
    expect(rel.version).toBeDefined();
    expect(rel.version.manifestRootsToUpdate).toEqual(['dist/{projectRoot}']);
    expect(rel.version.currentVersionResolver).toBe('git-tag');
    expect(rel.version.fallbackCurrentVersionResolver).toBe('disk');

    // build target
    expect(config.targets?.build?.executor).toBe('@nx/js:tsc');
    expect(config.targets?.build?.outputs).toEqual(['{options.outputPath}']);
    expect(config.targets?.build?.options?.outputPath).toBe(`dist/${root}`);
    expect(config.targets?.build?.options?.main).toBe(`${root}/src/index.ts`);
    expect(config.targets?.build?.options?.tsConfig).toBe(
      `${root}/tsconfig.lib.json`
    );
    expect(config.targets?.build?.options?.assets).toEqual([`${root}/*.md`]);
    expect(config.targets?.build?.options?.packageJson).toBe(
      `${root}/package.json`
    );

    // nx-release-publish
    expect(config.targets?.['nx-release-publish']?.options?.packageRoot).toBe(
      'dist/{projectRoot}'
    );

    // test target
    expect(config.targets?.test?.executor).toBe('@nx/jest:jest');
    expect(config.targets?.test?.options?.jestConfig).toBe(
      `${root}/jest.config.ts`
    );
    expect(config.targets?.test?.outputs).toEqual([
      '{workspaceRoot}/coverage/{projectRoot}',
    ]);
  }, 10000);

  xit('should scaffold required files', async () => {
    await serviceLibGenerator(tree, options);

    expect(tree.exists(`${root}/eslint.config.mjs`)).toBe(true);
    expect(tree.exists(`${root}/jest.config.ts`)).toBe(true);
    expect(tree.exists(`${root}/tsconfig.json`)).toBe(true);
    expect(tree.exists(`${root}/tsconfig.lib.json`)).toBe(true);
    expect(tree.exists(`${root}/tsconfig.spec.json`)).toBe(true);
    expect(tree.exists(`${root}/src/index.ts`)).toBe(true);

    // content checks: jest loads dotenv
    const jestCfg = tree.read(`${root}/jest.config.ts`, 'utf-8')!;
    expect(jestCfg).toContain("import * as dotenv from 'dotenv'");
    expect(jestCfg).toContain('dotenv.config();');
    expect(jestCfg).toContain(`displayName: '${expectedFileName}'`);
    expect(jestCfg).toContain(`coverageDirectory: '../../../coverage/${root}'`);

    // content checks: eslint uses JSONC parser
    const eslintCfg = tree.read(`${root}/eslint.config.mjs`, 'utf-8')!;
    expect(eslintCfg.trim())
      .toBe(`import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];`);
  });
});
