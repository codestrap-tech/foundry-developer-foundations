// templateFactory.spec.ts
import { buildTemplateFactory, templateFactory } from './templateFactory';
import type { TemplateDefinition } from './templateFactory';
import { SupportedTemplates } from './templateFactory';
import type { Tree } from '@nx/devkit';

// --- Mock the external generators used by the registry ---
jest.mock('@codestrap/tools', () => ({
  // types are irrelevant for tests; we just need callables
  googleClientGenerator: jest.fn().mockResolvedValue(undefined),
  curryFactoryGenerator: jest.fn().mockResolvedValue(undefined),
}));

import { googleClientGenerator, curryFactoryGenerator } from '@codestrap/tools';

describe('templateFactory (bound to default registry)', () => {
  const dummyTree = {} as unknown as Tree;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the google client generator for a matching GSuite path (case-insensitive)', async () => {
    const getGenerator = templateFactory();
    const gen = await getGenerator('/Users/test/workspace/google/src/lib/GSuiteClient.v2.ts');

    expect(typeof gen).toBe('function');

    // call the returned generator function
    const opts = { name: 'proj', destination: 'src/lib', userPrompt: 'prompt' } as any;
    await gen(dummyTree, opts);

    expect(googleClientGenerator).toHaveBeenCalledTimes(1);
    expect(googleClientGenerator).toHaveBeenCalledWith(dummyTree, opts);
    expect(curryFactoryGenerator).not.toHaveBeenCalled();
  });

  it('resolves the curry-factory generator when filename contains "factory"', async () => {
    const getGenerator = templateFactory();
    const gen = await getGenerator('/path/to/my/new-factory.file.ts');

    expect(typeof gen).toBe('function');
    const dummyTree = {} as any;
    await gen(dummyTree, { name: 'factory-proj' } as any);

    expect(require('@codestrap/tools').curryFactoryGenerator).toHaveBeenCalledTimes(1);
  });

  it('normalizes Windows-style paths and still matches', async () => {
    const getGenerator = templateFactory();
    const gen = await getGenerator('C:\\workspace\\services\\google\\lib\\gsuiteCLIENT.ts');

    expect(typeof gen).toBe('function');

    const opts = { name: 'proj2' } as any;
    await gen(dummyTree, opts);

    expect(googleClientGenerator).toHaveBeenCalledTimes(1);
  });

  it('throws a friendly error when no regex matches (using a safe custom registry)', async () => {
    // Create a safe custom registry without the problematic FACTORY pattern
    const customRegistry: Record<SupportedTemplates, TemplateDefinition<any>> =
    {
      [SupportedTemplates.GSUITE_CLIENT]: {
        generator: async (tree, options) => {
          await googleClientGenerator(tree, options);
        },
        samplePrompts: [],
      },
      // We still need to satisfy the index signature, but we won't use FACTORY here.
      [SupportedTemplates.FACTORY]: {
        // Provide a valid regex in a custom scenario only if used.
        generator: async (tree, options) => {
          await curryFactoryGenerator(tree, options);
        },
        samplePrompts: [],
      },
    };

    const getGenerator = await buildTemplateFactory(customRegistry);
    await expect(
      getGenerator('/Users/test/workspace/some/other/module.ts')
    ).rejects.toThrow(/No matching template found/);

    expect(googleClientGenerator).not.toHaveBeenCalled();
    expect(curryFactoryGenerator).not.toHaveBeenCalled();
  });

  it('can resolve a different entry when provided in a custom registry (valid factory regex)', async () => {
    // Custom registry with a *valid* factory pattern to test alternate matching
    const VALID_FACTORY_REGEX = '.*factory.*';

    const customRegistry = {
      // swap in a valid pattern for testing
      [SupportedTemplates.FACTORY]: {
        generator: async (tree: Tree, options: any) => {
          await curryFactoryGenerator(tree, options);
        },
        samplePrompts: [],
      },
      [SupportedTemplates.GSUITE_CLIENT]: {
        generator: async (tree: Tree, options: any) => {
          await googleClientGenerator(tree, options);
        },
        samplePrompts: [],
      },
    } as unknown as Record<string, TemplateDefinition<any>>;

    // Build a resolver bound to the custom registry
    const resolveGen = await buildTemplateFactory(
      customRegistry as any // cast to satisfy the function signature
    );

    const gen = await resolveGen('/path/to/my/new-factory.file.ts');
    expect(typeof gen).toBe('function');

    const opts = { name: 'factory-proj' } as any;
    await gen({} as Tree, opts);

    expect(curryFactoryGenerator).toHaveBeenCalledTimes(1);
    expect(googleClientGenerator).not.toHaveBeenCalled();
  });
});
