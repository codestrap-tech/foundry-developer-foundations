import type {
  Tree} from '@nx/devkit';
import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  names,
} from '@nx/devkit';
import * as fs from 'fs';
import * as path from 'path';
import type { GoogleClientGeneratorSchema } from './schema';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config({
  path: path.resolve(process.cwd(), 'tools/src/generators/google-client/.env')
});

async function generateCode(user: string, system: string): Promise<string> {
  const FactoryJsonSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'GeneratedClientCode',
    type: 'object',
    additionalProperties: false,
    properties: {
      code: { type: 'string' },
      exampleUsage: { type: 'string' },
      summary: { type: 'string' },
    },
    required: ['code', 'exampleUsage', 'summary'],
  };

  const ai = new GoogleGenAI({});

  const config = {
    responseMimeType: 'application/json',
    responseJsonSchema: FactoryJsonSchema,
    temperature: 0,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `${system}
${user}`,
    config,
  });

  const parsed = JSON.parse(response.text || '{}');
  const factoryCode = parsed.code ?? parsed.ops?.code ?? '';
  return factoryCode;
}

export async function googleClientGenerator(
  tree: Tree,
  options: GoogleClientGeneratorSchema
) {
  const libName = names(options.name);
  const fileName = names(options.fileName);
  const promptFile = options.promptFile || '';
  const system =
    'You are a helpful AI code assistant that specializes in generating google API client per the our custom design pattern.';

  // Path to template file
  const templateFile = 'tools/src/generators/google-client/client.template.ts';
  const absTemplatePath = path.resolve(process.cwd(), templateFile);
  const template = await fs.promises.readFile(absTemplatePath, 'utf8');

  // load the prompt file
  const user = await fs.promises.readFile(promptFile, 'utf8');

  // Generate the factory code using Gemini
  const code = await generateCode(
    `
# User Prompt
${user}

# Template
${template}
`,
    system
  );

  // Read Nx project configuration
  const project = readProjectConfiguration(tree, libName.fileName);
  const projectRoot = project.root;

  // Compute output path for generated factory
  const outputFile = joinPathFragments(
    projectRoot,
    `src/lib/${fileName.fileName}.ts`
  );

  // Ensure directory exists
  const outputDirPath = path.dirname(outputFile);
  if (!tree.exists(outputDirPath)) {
    fs.mkdirSync(outputDirPath, { recursive: true });
  }

  // Write AI-generated factory file
  tree.write(outputFile, code);

  await formatFiles(tree);
}

export default googleClientGenerator;
