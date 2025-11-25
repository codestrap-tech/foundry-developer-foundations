/**
 * Template Factory (Grok Expression Version)
 * ------------------------------------------
 * This factory retrieves templates dynamically based on file paths
 * that match Grok-like expressions (regex patterns).
 * The first matching pattern in SupportedTemplates will be used.
 */

import { curry } from 'ramda';
import * as fs from 'fs';
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
 * https://regex101.com/r/k7aMCv/1
 */
export enum SupportedTemplates {
  GSUITE_CLIENT = '.*gsuite.*client.*',
  FACTORY = '.*factory.*', // matches any path containing "factory"
}

/**
 * Defines the structure of a single template definition.
 * Each template maps to a file path that can be loaded dynamically.
 */
export interface TemplateDefinition<TOptions = unknown> {
  generator: string;
  samplePrompts: string[];
  promptGuide: string;
  projectJson: () => Promise<string>;
}

// we had to duplicate GoogleClientGeneratorSchema and CurryFactoryGeneratorSchema interfaces here to avoid circular dependencies
interface GoogleClientGeneratorSchema {
  name: string;
  promptFile: string;
  fileName: string;
}
interface CurryFactoryGeneratorSchema {
  name: string;
  promptFile: string;
  fileName: string;
}

/**
 * Type alias for the function that builds and loads a template instance.
 */
export type TemplateFactory<T> = (filePath: string) => Promise<T>;

// Registry type that pins per-entry option types
type TemplateRegistry = {
  [SupportedTemplates.GSUITE_CLIENT]: TemplateDefinition<GoogleClientGeneratorSchema>; // no generator/options
  [SupportedTemplates.FACTORY]: TemplateDefinition<CurryFactoryGeneratorSchema>;
};

/**
 * Registry of supported templates.
 * Each entry corresponds to a Grok-style match expression associated with a specific template file.
 */
export const templateRegistry: TemplateRegistry = {
  [SupportedTemplates.GSUITE_CLIENT]: {
    generator: 'google-client',
    projectJson: async () =>
      fs.promises.readFile(
        path.resolve(
          process.env.WORKSPACE_ROOT!,
          'packages/services/google/project.json',
        ),
        'utf-8',
      ),
    samplePrompts: [
      `Create packages/services/google/src/lib/gsuiteClient.v3.ts implementing makeGSuiteClientV3 (TypeScript, Node.js 20.x) based on the existing v2 client (packages/services/google/src/lib/gsuiteClient.v2.ts). Use googleapis@149.0.0 and integrate with the new helper packages/services/google/src/lib/helpers/driveAttachmentProcessor.ts and the modified types in packages/types/src/lib/types.ts.

Client version: v3

Required OAuth scopes (must be requested/provided by this client):
- https://www.googleapis.com/auth/gmail.send
- https://www.googleapis.com/auth/drive.readonly

Methods to add/modify:
- sendEmail (modify existing delegate signature to support Drive attachments)

sendEmail inputs (types):
- EmailContext (from packages/types/src/lib/types.ts) with fields:
  - from: string
  - recipients: string | string[]
  - subject: string
  - messageHtml: string
  - messageText?: string
  - headers?: Record<string, string>
  - labelIds?: string[]
  - driveAttachmentIds?: string[] // NEW: array of Google Drive file IDs to attach

sendEmail output (types):
- SendEmailOutput (from packages/types/src/lib/types.ts) with fields:
  - id: string
  - threadId: string
  - labelIds?: string[]
  - skippedAttachments?: { fileId: string; reason: string; mimeType?: string; size?: string }[]

Behavioral requirements to implement in sendEmail:
leave the method implementation blank with a comment //TODO call delegate

Dependencies to import/use in the file:
- googleapis (Gmail and Drive clients) @149.0.0
- types from packages/types/src/lib/types.ts (EmailContext, SendEmailOutput)
- utility/logging from @codestrap/developer-foundations-utils
- helper driveAttachmentProcessor from packages/services/google/src/lib/helpers/driveAttachmentProcessor.ts (for per-file fetch/export/validation/retry logic)

Files that must remain compatible:
- packages/services/google/src/lib/gsuiteClient.v2.ts (use or reference to ensure consistency)
- Modified delegates/sendEmail.ts should align with the new signature
- New helper driveAttachmentProcessor.ts will be used by this client

Generate the full contents of packages/services/google/src/lib/gsuiteClient.v3.ts implementing makeGSuiteClientV3 with the modified sendEmail behavior and the exact types/inputs/outputs described above.
      `,
    ],
    promptGuide: `The prompt must include the client version to use, required permissions/scopes the method(s) to be added 
    or modified, and the method inputs such as file arrays, identifiers, etc and their types.
    Do not generate method bodies for functions like sendEmail, etc. We implement a delegate pattern and those implementation will be handled elsewhere.
    Instead add a comment to the method body liike so: //TODO call delegate
    Do not ever advise on security policy or design patters.
    Just generate the fucking prompt and nothing else.`,
  },
  [SupportedTemplates.FACTORY]: {
    generator: 'curry-factory',
    projectJson: async () =>
      fs.promises.readFile(
        path.resolve(
          process.env.WORKSPACE_ROOT!,
          'packages/utils/project.json',
        ),
        'utf-8',
      ),
    samplePrompts: [
      `Create a new factory using the template below that will:
Manage retrieval of templates based on file paths in the moduleRegistry. 
The factory should: 
1. First check for an exact match based on file path in moduleRegistry 
2. Then check if the path to the folder is in the moduleRegistry 
3. Load the file for the associated template using fs.promises as a string and return it 
Rename all the placeholder variables for moduleRegistry, SupportedModules, etc to something contextually relevant for a template factory. 
The ModuleInterface should also be renamed and have the property: template: string (path to the template to use)
 `,
    ],
    promptGuide: `The prompt should clearly outline the factory's purpose and shape of the proposed moduleRegistry.
    It should also include a description of the factory behavior and a propsal for the ModuleInterface shape.
    The ModuleInterface maps factory keys to values, for example:
    /**
     * Defines the structure of a single module implementation.
     * You can replace the function signatures below with whatever
     * components your modules expose (e.g., services, actions, handlers).
     */
    export interface ModuleInterface {
      initialize: (config: Record<string, unknown>) => void;
      execute: (...args: unknown[]) => unknown;
      shutdown?: () => void;
    }
    `,
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
export const buildTemplateFactory = curry(
  async (
    registry: TemplateRegistry,
    filePath: string,
  ): Promise<TemplateDefinition> => {
    const normalizedPath = path.normalize(filePath);
    const entries = Object.entries(registry) as Array<
      [string, TemplateDefinition]
    >;

    // Step 1: Evaluate each Grok expression (treated as regex)
    for (const [patternKey, definition] of entries) {
      // patternKey is already the Grok-style expression string
      const regex = new RegExp(patternKey, 'i');

      if (regex.test(normalizedPath)) {
        // Match found
        return definition;
      }
    }

    // Step 2: Not found
    throw new Error(`No matching template found for path: ${filePath}`);
  },
);

/**
 * Example: Create a factory bound to your registry
 * ------------------------------------------------
 * Consumers can import and call:
 *   const getTemplate = buildTemplateFactory();
 *   const content = await getTemplate('/path/to/gsuite/clientConfig.ts');
 */
export const templateFactory = () =>
  buildTemplateFactory(templateRegistry) as (
    filePath: string,
  ) => Promise<TemplateDefinition>;

/**
 * Example Usage
 * -------------
(async () => {
  const getTemplate = templateFactory();

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
