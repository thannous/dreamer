import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleFormatRecall } from './formatRecall.ts';
import { GEMINI_MODELS } from '../lib/models.ts';
import { isProductRouteAllowed } from '../lib/productAuthorization.ts';
import type { ApiContext } from '../types.ts';
const ctx = (body: unknown, user: unknown = { id: 'u1' }): ApiContext => ({
  req: new Request('https://example.test/format-recall', { method: 'POST', body: JSON.stringify(body) }),
  user, supabase: {}, supabaseUrl: 'https://example.test', supabaseServiceRoleKey: null, storageBucket: 'test',
});
const admit = async () => ({ tier: 'free', actorClass: 'FREE' } as const);
const body = { transcript: 'Une plage.\nQuestion : Sa couleur ?\nRéponse : noire, je crois.', lang: 'fr' };
Deno.test('formatting uses journal authorization, size limits and recall admission before inference', async () => {
  assertEquals(isProductRouteAllowed('journal', 'POST /format-recall'), true);
  assertEquals(isProductRouteAllowed('lucid', 'POST /format-recall'), false);
  let calls = 0;
  const deps = { apiKey: 'test', admit, generate: async () => { calls++; return { text: '{}', raw: {} }; } };
  assertEquals((await handleFormatRecall(ctx(body, null), deps)).status, 401);
  assertEquals((await handleFormatRecall(ctx({ ...body, transcript: '' }), deps)).status, 400);
  assertEquals((await handleFormatRecall(ctx({ ...body, transcript: 'a'.repeat(20001) }), deps)).status, 413);
  assertEquals((await handleFormatRecall(ctx(body), { ...deps, admit: async () => new Response('', { status: 429 }) })).status, 429);
  assertEquals(calls, 0);
});
Deno.test('formatting forwards all exchanges in one configured recall-model call and returns a proposal without persistence', async () => {
  let calls = 0;
  const response = await handleFormatRecall(ctx(body), { apiKey: 'test', admit,
    generate: async (_key, model, fallback, contents, instruction) => {
      calls++;
      assertEquals(model, GEMINI_MODELS.text.recall);
      assertEquals(fallback, model);
      assertEquals(JSON.parse(contents[0].parts[0].text!), { transcript: body.transcript });
      assertStringIncludes(instruction, 'French');
      return { text: JSON.stringify({ transcript: 'Une plage noire, je crois.' }), raw: {} };
    },
  });
  assertEquals(await response.json(), { transcript: 'Une plage noire, je crois.' });
  assertEquals(calls, 1);
});
Deno.test('formatting fails closed on malformed, empty, oversized or failed provider output', async () => {
  for (const text of ['bad JSON', '{}', '{"transcript":""}', JSON.stringify({ transcript: 'a'.repeat(20001) })]) {
    const result = await handleFormatRecall(ctx(body), { apiKey: 'test', admit, generate: async () => ({ text, raw: {} }) });
    assertEquals(result.status, 502);
  }
  const result = await handleFormatRecall(ctx(body), { apiKey: 'test', admit, generate: async () => { throw new Error('provider failed'); } });
  assertEquals(result.status, 502);
});
