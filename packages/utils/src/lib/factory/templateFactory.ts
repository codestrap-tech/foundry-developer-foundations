/**
 * Template Factory (Grok Expression Version)
 * ------------------------------------------
 * This factory retrieves templates dynamically based on file paths
 * that match Grok-like expressions (regex patterns).
 * The first matching pattern in SupportedTemplates will be used.
 */

import { curry } from 'ramda';
import { promises as fs } from 'fs';
import * as path from 'path';

import { curryFactoryGenerator, CurryFactoryGeneratorSchema, googleClientGenerator, GoogleClientGeneratorSchema } from '@codestrap/tools';

import {
  Tree,
} from '@nx/devkit';

/**
 * Enumeration of supported templates.
 * Each key corresponds to a Grok-style regex expression used
 * to match the incoming file path.
 *
 * Example:
 *   - `.*gsuite.*client.*`  matches any path containing "gsuite" and "client"
 *   - `.*report.*summary.*` matches any path with "report" and "summary"
 * https://regex101.com/r/Mwtdtw/1
 */
export enum SupportedTemplates {
  GSUITE_CLIENT = '.*gsuite.*client.*',
  FACTORY = '*factory.*',
}

/**
 * Defines the structure of a single template definition.
 * Each template maps to a file path that can be loaded dynamically.
 */
export interface TemplateDefinition<TOptions = unknown> {
  generator: (tree: Tree, options: TOptions) => Promise<void>;
  samplePrompts: string[];
}

/**
 * Type alias for the function that builds and loads a template instance.
 */
export type TemplateFactory<T> = (filePath: string) => Promise<T>;

// Registry type that pins per-entry option types
type TemplateRegistry = {
  [SupportedTemplates.GSUITE_CLIENT]: TemplateDefinition<GoogleClientGeneratorSchema>;; // no generator/options
  [SupportedTemplates.FACTORY]: TemplateDefinition<CurryFactoryGeneratorSchema>;
};

/**
 * Registry of supported templates.
 * Each entry corresponds to a Grok-style match expression associated with a specific template file.
 */
export const templateRegistry: TemplateRegistry = {
  [SupportedTemplates.GSUITE_CLIENT]: {
      generator: async (tree: Tree, options) => {
      // the caller in the code gen tool can derive the package name and function/fileName from the path in the added block.
      // the prompt will bee supplied by the developer for now as an additional property in the added block
      await googleClientGenerator(tree, options);
    },
    samplePrompts: [
      `Generate a new google service client using the provided template to learn the CodeStrap pattern.
The new client should be able to write files to drive. The new client number should be v3.
The only method to add is writeFileToDrive. This should take an array of files to write. The file content will be a file Buffer.`
    ],
  },
  [SupportedTemplates.FACTORY]: {
    generator: async (tree: Tree, options) => {
      // the caller in the code gen tool can derive the package name and function/fileName from the path in the added block.
      // the prompt will bee supplied by the developer for now as an additional property in the added block
      await curryFactoryGenerator(tree, options);
    },
    samplePrompts: [
      `Create a new factory using the template below that will:
Manage retrieval of templates based on file paths in the moduleRegistry. 
The factory should: 
1. First check for an exact match based on file path in moduleRegistry 
2. Then check if the path to the folder is in the moduleRegistry 
3. Load the file for the associated template using fs.promises as a string and return it 
Rename all the placeholder variables for moduleRegistry, SupportedModules, etc to something contextually relevant for a template factory. 
The ModuleInterface should also be renamed and have the property: template: string (path to the template to use)
 `
    ],
  },
};

/**
 * Curried Template Factory
 * ------------------------
 * Accepts a registry of templates, evaluates the incoming path
 * against the Grok expressions (regex patterns), and returns
 * the loaded template as a string.
 *
 * Search order:
 *  1. Evaluate each Grok expression (first match wins)
 *  2. Load template file via fs.promises
 *  3. Throw if no match found
 */
export const templateFactory = curry(
  async (
    registry: Record<string, TemplateDefinition>,
    filePath: string
  ): Promise<string> => {
    const normalizedPath = path.normalize(filePath);
    const entries = Object.entries(registry) as Array<[string, TemplateDefinition]>;

    // Step 1: Evaluate each Grok expression (treated as regex)
    for (const [patternKey, definition] of entries) {
      // patternKey is already the Grok-style expression string
      const grokExpression = patternKey;
      const regex = new RegExp(grokExpression, 'i');

      if (regex.test(normalizedPath)) {
        // Match found
        return fs.readFile(definition.template, 'utf8');
      }
    }

    // Step 2: Not found
    throw new Error(`No matching template found for path: ${filePath}`);
  }
);

/**
 * Example: Create a factory bound to your registry
 * ------------------------------------------------
 * Consumers can import and call:
 *   const getTemplate = buildTemplateFactory();
 *   const content = await getTemplate('/path/to/gsuite/clientConfig.ts');
 */
export const buildTemplateFactory = () =>
  templateFactory(templateRegistry) as (filePath: string) => Promise<string>;

/**
 * Example Usage
 * -------------
(async () => {
  const getTemplate = buildTemplateFactory();

  try {
    const result = await getTemplate(
      '/Users/doriansmiley/workspace/foundry-developer-foundations/packages/services/google/src/lib/gsuiteClient.v2.ts'
    );
    console.log('Loaded template content:\n', result);
  } catch (err) {
    console.error(err);
  }
})();
 */
