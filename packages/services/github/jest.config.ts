import * as dotenv from 'dotenv';

dotenv.config();

export default {
  displayName: 'github',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@octokit|universal-user-agent|universal-github-app-jwt|before-after-hook)/)',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/packages/services/github',
};
