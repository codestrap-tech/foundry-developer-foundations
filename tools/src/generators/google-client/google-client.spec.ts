import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  addProjectConfiguration,
  joinPathFragments,
} from '@nx/devkit';
import { googleClientGenerator } from './google-client';
import { GoogleClientGeneratorSchema } from './schema';

// --- Mock filesystem and Gemini API ---
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue('// mock client template'),
  },
  mkdirSync: jest.fn(),
}));
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          code: '// generated client code',
          exampleUsage: 'example usage',
          summary: 'summary',
        }),
      }),
    },
  })),
}));

describe('google-client generator', () => {
  let tree: Tree;

  const options: GoogleClientGeneratorSchema = {
    name: 'utils',
    fileName: 'testFactory',
    promptFile: 'create a new test factory',
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    // Register a dummy Nx project named 'test-google-client'
    addProjectConfiguration(tree, 'test-google-client', {
      root: 'libs/test-google-client',
      projectType: 'library',
      targets: {},
    });
  });

  it('should generate a factory file using AI code', async () => {
    await googleClientGenerator(tree, options);

    // --- Verify project configuration exists ---
    const config = readProjectConfiguration(tree, 'test-google-client');
    expect(config).toBeDefined();

    // --- Verify factory file was written ---
    const expectedPath = joinPathFragments(
      config.root,
      options.name,
      'src',
      'lib',
      'test-google-client.factory.ts'
    );

    expect(tree.exists(expectedPath)).toBe(true);
    expect(tree.read(expectedPath, 'utf8')).toContain('// generated client code');
  });

  it('should read the client template file and call Gemini once', async () => {
    const { promises } = require('fs');
    const { GoogleGenAI } = require('@google/genai');

    await googleClientGenerator(tree, options);

    // Verify the template was read
    expect(promises.readFile).toHaveBeenCalledWith(
      expect.stringContaining('client.template.ts'),
      'utf8'
    );

    // Verify Gemini was called to generate code
    expect(GoogleGenAI).toHaveBeenCalledTimes(1);
  });
});
