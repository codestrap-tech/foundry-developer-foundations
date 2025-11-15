import { promises as fs } from 'fs';
import { buildTemplateFactory, templateFactory, templateRegistry, SupportedTemplates } from './templateFactory';

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('templateFactory', () => {
  const mockTemplatePath = templateRegistry[SupportedTemplates.GSUITE_CLIENT].template;
  const mockTemplateContent = 'mocked template content';

  beforeAll(() => {
    // Set a default mock return for all tests
    mockedFs.readFile.mockResolvedValue(mockTemplateContent);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should return file content for a matching Grok expression (case-insensitive)', async () => {
    const inputPath = '/Users/test/workspace/google/src/lib/GSuiteClient.v2.ts';
    const result = await templateFactory(templateRegistry, inputPath);

    expect(result).toBe(mockTemplateContent);
    expect(mockedFs.readFile).toHaveBeenCalledWith(mockTemplatePath, 'utf8');
  });

  it('should normalize file paths before matching', async () => {
    const inputPath = 'C:\\workspace\\services\\google\\lib\\gsuiteCLIENT.ts';
    const result = await templateFactory(templateRegistry, inputPath);

    expect(result).toBe(mockTemplateContent);
    expect(mockedFs.readFile).toHaveBeenCalledTimes(2); // second read from this test
  });

  it('should throw an error if no Grok expression matches', async () => {
    const inputPath = '/Users/test/workspace/some/other/module.ts';
    await expect(templateFactory(templateRegistry, inputPath)).rejects.toThrow(
      /No matching template found/
    );
    expect(mockedFs.readFile).toHaveBeenCalledTimes(2); // no new reads since this one failed early
  });
});

describe('buildTemplateFactory', () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should create a bound factory function that resolves a template', async () => {
    const getTemplate = buildTemplateFactory();
    const result = await getTemplate('/Users/test/gsuite/clientHandler.ts');

    expect(result).toBe('mocked template content');
    expect(mockedFs.readFile).toHaveBeenCalledWith(
      templateRegistry[SupportedTemplates.GSUITE_CLIENT].template,
      'utf8'
    );
  });
});
