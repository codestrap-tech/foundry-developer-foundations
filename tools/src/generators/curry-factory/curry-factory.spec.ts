import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  addProjectConfiguration,
  joinPathFragments,
} from '@nx/devkit';
import { curryFactoryGenerator } from './curry-factory';
import { CurryFactoryGeneratorSchema } from './schema';

// --- Mock filesystem and Gemini API ---
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue('// mock factory template'),
  },
  mkdirSync: jest.fn(),
}));
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          code: '// generated factory code',
          exampleUsage: 'example usage',
          summary: 'summary',
        }),
      }),
    },
  })),
}));

describe('curry-factory generator', () => {
  let tree: Tree;

  const options: CurryFactoryGeneratorSchema = {
    name: 'testFactory',
    destination: 'src/lib',
    userPrompt: 'create a new test factory',
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    // Register a dummy Nx project named 'test-factory'
    addProjectConfiguration(tree, 'test-factory', {
      root: 'libs/test-factory',
      projectType: 'library',
      targets: {},
    });
  });

  it('should generate a factory file using AI code', async () => {
    await curryFactoryGenerator(tree, options);

    // --- Verify project configuration exists ---
    const config = readProjectConfiguration(tree, 'test-factory');
    expect(config).toBeDefined();

    // --- Verify factory file was written ---
    const expectedPath = joinPathFragments(
      config.root,
      options.destination,
      'test-factory.factory.ts'
    );

    expect(tree.exists(expectedPath)).toBe(true);
    expect(tree.read(expectedPath, 'utf8')).toContain('// generated factory code');
  });

  it('should read the factory template file and call Gemini once', async () => {
    const { promises } = require('fs');
    const { GoogleGenAI } = require('@google/genai');

    await curryFactoryGenerator(tree, options);

    // Verify the template was read
    expect(promises.readFile).toHaveBeenCalledWith(
      expect.stringContaining('factory.template.ts'),
      'utf8'
    );

    // Verify Gemini was called to generate code
    expect(GoogleGenAI).toHaveBeenCalledTimes(1);
  });
});
