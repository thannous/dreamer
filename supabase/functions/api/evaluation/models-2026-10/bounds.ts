// Kept apart from compare.ts so its test does not load the Anthropic SDK into the locked graph.
/** Arrays outside the schema's bounds; Claude is sent the schema without them, so check here. */
export const arrayBoundViolations = (schema: unknown, value: unknown, path = '$'): string[] => {
  if (!schema || typeof schema !== 'object') return [];
  const node = schema as { minItems?: number; maxItems?: number; items?: unknown; properties?: Record<string, unknown> };
  if (Array.isArray(value)) {
    const outside = (typeof node.minItems === 'number' && value.length < node.minItems)
      || (typeof node.maxItems === 'number' && value.length > node.maxItems);
    return [
      ...(outside ? [`${path} has ${value.length} items`] : []),
      ...value.flatMap((item, index) => arrayBoundViolations(node.items, item, `${path}[${index}]`)),
    ];
  }
  const properties = node.properties;
  if (value && typeof value === 'object' && properties) {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => arrayBoundViolations(properties[key], item, `${path}.${key}`));
  }
  return [];
};
