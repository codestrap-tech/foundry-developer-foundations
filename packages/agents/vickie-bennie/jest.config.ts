export default {
  displayName: 'agents-vickie-bennie',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        useESM: true,
      },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@octokit|universal-user-agent|universal-github-app-jwt|before-after-hook|@osdk|@codestrap)/)',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/packages/agents/vickie-bennie',
  extensionsToTreatAsEsm: ['.ts'],
  testPathIgnorePatterns: ['<rootDir>/dist/'],

  moduleNameMapper: {
    // Strip `.js` from your TS imports so ESM paths resolve
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@xreason/(.*)$': '<rootDir>/src/$1',
    '^@osdk/shared\\.client$':
      '<rootDir>/../../../node_modules/@osdk/shared.client/index.js',
    '^@osdk/shared\\.client2$':
      '<rootDir>/../../../node_modules/@osdk/shared.client2/index.js',
  },
};
