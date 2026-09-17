export const DREAM_TYPE_VALUES = ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream', 'Everyday Dream', 'Fantastical Dream', 'Unknown'];

export const ANALYZE_DREAM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    interpretation: { type: 'string' },
    shareableQuote: { type: 'string' },
    quoteSourceExcerpts: { type: 'array', minItems: 0, maxItems: 3, items: { type: 'string' } },
    theme: { type: 'string', enum: ['surreal', 'mystical', 'calm', 'noir'] },
    dreamType: {
      type: 'string',
      enum: DREAM_TYPE_VALUES,
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
    'quoteSourceExcerpts',
    'theme',
    'dreamType',
    'imagePrompt',
    'symbols',
    'emotions',
    'reflectionQuestions',
  ],
};

export const CATEGORIZE_DREAM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    theme: { type: 'string', enum: ['surreal', 'mystical', 'calm', 'noir'] },
    dreamType: {
      type: 'string',
      enum: DREAM_TYPE_VALUES,
    },
    hasPerson: { type: 'boolean' },
    hasAnimal: { type: 'boolean' },
  },
  required: ['title', 'theme', 'dreamType', 'hasPerson', 'hasAnimal'],
};
