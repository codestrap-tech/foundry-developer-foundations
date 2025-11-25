export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',

  // Treat JS and TS as ESM
  extensionsToTreatAsEsm: ['.ts'],

  testPathIgnorePatterns: ['<rootDir>/dist/'],

  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      useESM: true,
    },
  },

  testMatch: ['**/test/**/*.test.ts', '**/test/**/*.test.js'],

  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
    '^.+\\.js$': 'ts-jest',
  },

  // Allow ts-jest to transform @osdk/* ESM modules
  transformIgnorePatterns: ['node_modules/(?!(?:@osdk)/)'],

  moduleNameMapper: {
    // Strip `.js` from your TS imports so ESM paths resolve
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@hello/(.*)$': '<rootDir>/src/$1',
    '^@osdk/shared\\.client$':
      '<rootDir>/node_modules/@osdk/shared.client/index.js',
    '^@osdk/shared\\.client2$':
      '<rootDir>/node_modules/@osdk/shared.client2/index.js',
  },
};
