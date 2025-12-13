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

describe('templateFactory (bound to default registry)', () => {
  const dummyTree = {} as unknown as Tree;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the google client generator for a matching GSuite path (case-insensitive)', async () => {
    const getTemplate = templateFactory();
    const { generator, samplePrompts, promptGuide, projectJson } =
      await getTemplate(
        '/Users/test/workspace/google/src/lib/GSuiteClient.v2.ts',
      );

    const projectConfigFile = await projectJson();
    const config = JSON.parse(projectConfigFile) as {
      name?: string;
      root?: string;
      sourceRoot?: string;
      projectType?: 'application' | 'library';
      targets?: Record<string, any>;
      tags?: string[];
    };

    expect(generator).toBeDefined();
    expect(Array.isArray(samplePrompts)).toBe(true);
    expect(typeof promptGuide).toBe('string');
    expect(config.name).toBeDefined();
  });

  it('resolves the curry-factory generator when filename contains factory (case-insensitive)', async () => {
    const getTemplate = templateFactory();
    const { generator, samplePrompts, promptGuide, projectJson } =
      await getTemplate('/path/to/my/new-Factory.file.ts');

    const projectConfigFile = await projectJson();
    const config = JSON.parse(projectConfigFile) as {
      name?: string;
      root?: string;
      sourceRoot?: string;
      projectType?: 'application' | 'library';
      targets?: Record<string, any>;
      tags?: string[];
    };

    expect(generator).toBeDefined();
    expect(Array.isArray(samplePrompts)).toBe(true);
    expect(typeof promptGuide).toBe('string');
    expect(config.name).toBeDefined();
  });
});
