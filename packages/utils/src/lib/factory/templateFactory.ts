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
}

/**
 * Defines the structure of a single template definition.
 * Each template maps to a file path that can be loaded dynamically.
 */
export interface TemplateDefinition {
  template: string; // Absolute or relative path to the template file
}

/**
 * Type alias for the function that builds and loads a template instance.
 */
export type TemplateFactory<T> = (filePath: string) => Promise<T>;

/**
 * Registry of supported templates.
 * Each entry corresponds to a Grok-style match expression associated with a specific template file.
 */
export const templateRegistry: Record<SupportedTemplates, TemplateDefinition> = {
  [SupportedTemplates.GSUITE_CLIENT]: {
    template:
      'packages/services/google/src/lib/gsuiteClient.v2.ts',
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
