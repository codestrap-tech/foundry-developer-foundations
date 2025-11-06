import type { Config } from 'jest';
import { getJestProjectsAsync } from '@nx/jest';

export default async (): Promise<Config> => ({
  projects: await getJestProjectsAsync(),
  transformIgnorePatterns: [
    '/node_modules/(?!(@octokit|universal-user-agent|universal-github-app-jwt|before-after-hook)/)',
  ],
});
