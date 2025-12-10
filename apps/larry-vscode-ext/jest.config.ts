import type { Config } from 'jest';

export default {
  displayName: 'larry-vscode-ext',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(@mdxeditor|@tanstack|preact)/)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/larry-vscode-ext',
} as Config;
