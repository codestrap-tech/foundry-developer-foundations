// @ts-check
import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import { fixupConfigRules } from '@eslint/compat';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...fixupConfigRules(compat.extends('next')),
  ...fixupConfigRules(compat.extends('next/core-web-vitals')),
  ...baseConfig,
  .../** @type {import('eslint').Linter.Config[]} */ (
    nx.configs['flat/react-typescript']
  ),
  {
    ignores: ['.next/**/*'],
  },
];
