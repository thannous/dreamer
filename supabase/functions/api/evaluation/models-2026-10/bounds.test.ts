import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ANALYZE_DREAM_SCHEMA } from '../../lib/schemas.ts';
import { arrayBoundViolations } from './bounds.ts';

Deno.test('a response with more quote excerpts than production accepts is flagged', () => {
  const response = { title: 'T', interpretation: 'I', quoteSourceExcerpts: ['a', 'b', 'c', 'd'], symbols: [] };
  assertEquals(arrayBoundViolations(ANALYZE_DREAM_SCHEMA, response), ['$.quoteSourceExcerpts has 4 items']);
});

Deno.test('a response within the schema bounds has no violations', () => {
  const response = { title: 'T', interpretation: 'I', quoteSourceExcerpts: ['a'], symbols: [{ name: 'n', meaning: 'm' }] };
  assertEquals(arrayBoundViolations(ANALYZE_DREAM_SCHEMA, response), []);
});
