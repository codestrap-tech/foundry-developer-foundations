import {
  Context,
  CreateGoogleSlidesOutput,
  GoogleSlideCreationInput,
  MachineEvent,
  OfficeServiceV3,
  TYPES,
} from '@codestrap/developer-foundations-types';
import { getOpenAIResponse } from '../codeAssist/delegates/openai/getOpenAIResponse';
import { default as BasicTemplateSchema } from './schemas/slides/1CRmkGVV0XASTVhNDFEXZPS_A_8ONU6ojO72nzBJBrSQ';
import { container } from '@codestrap/developer-foundations-di';

export async function generateSlides(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<CreateGoogleSlidesOutput> {
  const templateJson = await getOpenAIResponse(
    'You are a helpful AI assistant that exrtracts templateId values for Gogole Sheets templates from user queries.',
    `Extract the templateId from the user task below. 

    Task: ${task}
    
    Only response in the following JSON schema format:
    {
        templateId: string,
    }
    `,
    {
      type: 'json_schema',
      name: 'EditPlan',
      schema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: 'TemplateId',
        type: 'object',
        additionalProperties: false,
        properties: {
          templateId: { type: 'string' },
        },
        required: ['templateId'],
      },
      strict: true,
    }
  );

  if (!templateJson) {
    throw new Error('No template Json found in LLM response');
  }

  const { templateId } = JSON.parse(templateJson) as { templateId: string };

  if (!templateId) {
    throw new Error('No templateId found in parsed output');
  }

  // TODO move to factory
  const templates = new Map<string, Record<string, unknown>>([
    ['1CRmkGVV0XASTVhNDFEXZPS_A_8ONU6ojO72nzBJBrSQ', BasicTemplateSchema],
  ]);
  const schema = templates.get(templateId);

  if (!schema) {
    throw new Error(`No schema found for templateId: ${schema}`);
  }

  const slideJson = await getOpenAIResponse(
    'You are a helpful AI assistant that specialises in translating slide decks proposals into JSON.',
    `
    # Goal
    Conver the slide deck proposal into JSON using the supplied JSON schema template.
    
    # Slide Deck Proposal
    ${task}
    
    # Rules for answer synthasis
    - You must use the supplied JSON schema template to structure the output.
    - Ensure that all required fields in the JSON schema are populated.
    - The final output must be valid JSON that adheres to the provided schema.
    `,
    {
      type: 'json_schema',
      name: 'DeckSchema',
      schema,
      strict: true,
    }
  );

  if (!slideJson) {
    throw new Error('No slide Json found in LLM response');
  }

  const slides = JSON.parse(slideJson) as GoogleSlideCreationInput;

  const officeSerivce = await container.getAsync<OfficeServiceV3>(
    TYPES.OfficeService
  );
  // createGoogleSlides accepts and array of decks to generate,
  // but we only generate one at a time here.
  const result = await officeSerivce.createGoogleSlides([slides]);

  return result;
}
