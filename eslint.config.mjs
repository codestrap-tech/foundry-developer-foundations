// @ts-check
import nx from '@nx/eslint-plugin';
import * as regexpPlugin from 'eslint-plugin-regexp';
import reactRefresh from 'eslint-plugin-react-refresh';

/** @type {import('eslint').Linter.Config[]} */
export default [
  reactRefresh.configs.next,
  regexpPlugin.configs['flat/recommended'],
  {
    // JSON files
    files: ['**/*.json'],
    // Override or add rules here
    rules: {},
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  ...nx.configs['flat/base'],
  .../** @type {import('eslint').Linter.Config[]} */ (
    nx.configs['flat/typescript']
  ),
  .../** @type {import('eslint').Linter.Config[]} */ (
    nx.configs['flat/javascript']
  ),
  {
    // Ignore dist directory
    ignores: ['**/dist'],
  },
  {
    // All TypeScript and JavaScript files
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    // All JavaScript and TypeScript files
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // TODO: @kopach - fix those
    rules: {
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'regexp/no-super-linear-backtracking': 'off',
    },
  },
  {
    // TypeScript files
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.base.json'],
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
];
