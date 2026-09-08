// Exact v1 schema snapshot at d0791edb3. Evaluation only.
export const ANALYZE_DREAM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    interpretation: { type: 'string' },
    shareableQuote: { type: 'string' },
    theme: { type: 'string', enum: ['surreal', 'mystical', 'calm', 'noir'] },
    dreamType: {
      type: 'string',
      enum: ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream', 'Unknown'],
    },
    imagePrompt: { type: 'string' },
    symbols: {
      type: 'array',
      minItems: 0,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          meaning: { type: 'string' },
        },
        required: ['name', 'meaning'],
      },
    },
    emotions: {
      type: 'array',
      minItems: 0,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          insight: { type: 'string' },
        },
        required: ['name', 'insight'],
      },
    },
    reflectionQuestions: {
      type: 'array',
      minItems: 0,
      maxItems: 3,
      items: { type: 'string' },
    },
  },
  required: [
    'title',
    'interpretation',
    'shareableQuote',
    'theme',
    'dreamType',
    'imagePrompt',
    'symbols',
    'emotions',
    'reflectionQuestions',
  ],
};

