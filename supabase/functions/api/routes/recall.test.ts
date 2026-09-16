import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleRecallQuestion } from './recall.ts';
import type { ApiContext } from '../types.ts';
import { isProductRouteAllowed } from '../lib/productAuthorization.ts';

const ctx = (body: unknown, user: unknown = { id: 'u1' }): ApiContext => ({
  req: new Request('https://example.test/recall-question', { method: 'POST', body: JSON.stringify(body) }),
  user, supabase: {}, supabaseUrl: 'https://example.test', supabaseServiceRoleKey: null, storageBucket: 'test',
});
const admit = async () => ({ tier: 'free', actorClass: 'FREE' } as const);
const body = { transcript: 'Je marchais dans un jardin.', lang: 'fr', previousQuestions: [] };

Deno.test('recall is limited to the journal product scope', () => {
  assertEquals(isProductRouteAllowed('journal', 'POST /recall-question'), true);
  assertEquals(isProductRouteAllowed('lucid', 'POST /recall-question'), false);
  assertEquals(isProductRouteAllowed('unknown', 'POST /recall-question'), false);
});

Deno.test('recall rejects anonymous, invalid and oversized input without invoking Gemini', async () => {
  let calls = 0;
  const generate = async () => { calls++; return { text: '{}', raw: {} }; };
  const deps = { apiKey: 'test-key', admit, generate };
  assertEquals((await handleRecallQuestion(ctx(body, null), deps)).status, 401);
  assertEquals((await handleRecallQuestion(ctx({ ...body, transcript: '' }), deps)).status, 400);
  assertEquals((await handleRecallQuestion(ctx({ ...body, transcript: 'a'.repeat(20001) }), deps)).status, 413);
  assertEquals((await handleRecallQuestion(ctx({ ...body, previousQuestions: [null] }), deps)).status, 400);
  assertEquals(calls, 0);
});

Deno.test('recall enforces admission before any provider call', async () => {
  let calls = 0;
  const response = await handleRecallQuestion(ctx(body), {
    apiKey: 'test-key', admit: async () => new Response('', { status: 429 }),
    generate: async () => { calls++; return { text: '{}', raw: {} }; },
  });
  assertEquals(response.status, 429);
  assertEquals(calls, 0);
});

Deno.test('recall uses Gemini 3.5 Flash-Lite with a bounded, non-interpretive JSON contract', async () => {
  const response = await handleRecallQuestion(ctx(body), {
    apiKey: 'test-key', admit,
    generate: async (_key, model, _fallback, contents, instruction, config) => {
      assertEquals(model, 'gemini-3.5-flash-lite');
      assertEquals(config.thinkingLevel, 'minimal');
      assertStringIncludes(instruction, 'Do not interpret');
      assertStringIncludes(instruction, 'French');
      assertEquals(JSON.parse(contents[0].parts[0].text!).transcript, body.transcript);
      assertEquals(config.maxOutputTokens, 256);
      return { text: JSON.stringify({ question: 'Que te revient-il de ce jardin ?', anchor: 'un jardin' }), raw: {} };
    },
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { question: 'Que te revient-il de ce jardin ?', done: false });
});

Deno.test('recall rejects ungrounded, repeated and malformed model responses', async () => {
  for (const output of [
    { question: 'Que faisait le dragon ?', anchor: 'dragon' },
    { question: 'Où étais-tu ? Qui était là ?', anchor: 'jardin' },
    { question: 'Où étais-tu ?', anchor: 'jardin' },
  ]) {
    const response = await handleRecallQuestion(ctx({ ...body, previousQuestions: ['Où étais-tu ?'] }), {
      apiKey: 'test-key', admit, generate: async () => ({ text: JSON.stringify(output), raw: {} }),
    });
    assertEquals(response.status, 502);
  }
});

Deno.test('recall stops after five questions without provider work', async () => {
  const response = await handleRecallQuestion(ctx({ ...body, previousQuestions: Array(5).fill('Une question ?') }));
  assertEquals(await response.json(), { question: null, done: true });
});
