// @ts-check
import { defineConfig, globalIgnores } from 'eslint/config';

import { node } from 'globals';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import _import from 'eslint-plugin-import';

import { fixupPluginRules, fixupConfigRules } from '@eslint/compat';

import tsParser from '@typescript-eslint/parser';
import { configs } from '@eslint/js';

import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: configs.recommended,
  allConfig: configs.all,
});

export default defineConfig([
  {
    languageOptions: {
      globals: {
        ...node,
      },

      parser: tsParser,
      ecmaVersion: 11,
      sourceType: 'module',

      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },

    plugins: {
      import: fixupPluginRules(_import),
    },

    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
          alwaysTryTypes: true, // resolves @types packages
        },
      },
    },

    extends: fixupConfigRules(
      compat.extends(
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript'
      )
    ),

    rules: {
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-undef': 'off',
      'no-case-declarations': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },
  globalIgnores(['**/dist', '**/.eslintrc.cjs']),
]);
