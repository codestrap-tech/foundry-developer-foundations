export default {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'BasicTemplate',
  type: 'object',
  additionalProperties: false,
  properties: {
    templateId: { type: 'string' },
    name: { type: 'string' },
    content: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          slideNumber: { type: 'integer' },
          content: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                targetType: {
                  type: 'string',
                  enum: ['PLACEHOLDER'],
                },
                placeholder: {
                  type: 'string',
                  enum: ['{{HEADER}}', '{{BODY}}', '{{PLACEHOLDER}}'],
                },
                text: { type: 'string' },
              },
              required: ['targetType', 'placeholder', 'text'],
            },
          },
        },
        required: ['slideNumber', 'content'],
      },
    },
  },
  required: ['templateId', 'name', 'content'],
};
