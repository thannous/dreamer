export const DREAM_TYPE_VALUES = ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream', 'Everyday Dream', 'Fantastical Dream', 'Unknown'];

export const ANALYZE_DREAM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', maxLength: 500 },
    interpretation: { type: 'string', maxLength: 20000 },
    shareableQuote: { type: 'string', maxLength: 2000 },
    quoteSourceExcerpts: { type: 'array', minItems: 0, maxItems: 3, items: { type: 'string' } },
    theme: { type: 'string', enum: ['surreal', 'mystical', 'calm', 'noir'] },
    dreamType: {
      type: 'string',
      enum: DREAM_TYPE_VALUES,
    },
    imagePrompt: { type: 'string', maxLength: 1000 },
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
          // A dictionary id or "none"; the list lives in the prompt and is checked on return.
          symbolId: { type: 'string' },
          key: { type: 'string' },
        },
        required: ['name', 'meaning', 'symbolId', 'key'],
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

/** Claude structured outputs omit length bounds; the app validates strings and clamps counts. */
export const withoutArrayBounds = (schema: unknown): unknown => {
  if (Array.isArray(schema)) return schema.map(withoutArrayBounds);
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(
    Object.entries(schema as Record<string, unknown>)
      .filter(([key]) => key !== 'minItems' && key !== 'maxItems' && key !== 'maxLength')
      .map(([key, value]) => [key, withoutArrayBounds(value)])
  );
};

/**
 * The form Claude structured outputs accept: no array bounds, `anyOf` instead of a
 * JSON type array, and every object closed with `additionalProperties: false`.
 */
export const toClaudeSchema = (schema: unknown): unknown => {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== 'object') return node;
    const { type, ...rest } = node as Record<string, unknown>;
    const mapped = Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, visit(value)]));
    if (Array.isArray(type)) return { ...mapped, anyOf: type.map((member) => ({ type: member })) };
    // `type` can also be a property named "type" inside a properties map.
    const result = type === undefined ? mapped : { type: typeof type === 'object' ? visit(type) : type, ...mapped };
    return type === 'object' && !('additionalProperties' in result) ? { ...result, additionalProperties: false } : result;
  };
  return visit(withoutArrayBounds(schema));
};

/** A response schema whose theme is kept to the themes offered for the request. */
export const withDreamThemes = <T extends { properties: { theme: object } }>(schema: T, themes: readonly string[]): T => ({
  ...schema,
  properties: { ...schema.properties, theme: { type: 'string', enum: [...themes] } },
});

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
