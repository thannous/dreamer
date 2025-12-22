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
      enum: ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream'],
    },
    imagePrompt: { type: 'string' },
  },
  required: ['title', 'interpretation', 'shareableQuote', 'theme', 'dreamType', 'imagePrompt'],
};

export const CATEGORIZE_DREAM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    theme: { type: 'string', enum: ['surreal', 'mystical', 'calm', 'noir'] },
    dreamType: {
      type: 'string',
      enum: ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream'],
    },
    hasPerson: { type: 'boolean' },
    hasAnimal: { type: 'boolean' },
  },
  required: ['title', 'theme', 'dreamType', 'hasPerson', 'hasAnimal'],
};
