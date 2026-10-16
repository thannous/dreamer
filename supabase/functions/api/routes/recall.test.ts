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

Deno.test('recall forwards contextual answers and question history in one bounded Gemini 3.8 Flash call', async () => {
  const contextualBody = {
    ...body,
    transcript: 'Une cabane en bois.\nQuestion : Que remarques-tu sur ce bois ?\nRéponse : Le bois ne compte pas, la forme de la cabane est importante.',
    previousQuestions: ['Que remarques-tu sur ce bois ?'],
  };
  let calls = 0;
  const response = await handleRecallQuestion(ctx(contextualBody), {
    apiKey: 'test-key', admit,
    generate: async (_key, model, _fallback, contents, instruction, config) => {
      calls++;
      assertEquals(model, 'gemini-3.8-flash');
      assertEquals(config.thinkingLevel, 'minimal');
      assertStringIncludes(instruction, 'Do not interpret');
      assertStringIncludes(instruction, 'French');
      assertEquals(JSON.parse(contents[0].parts[0].text!), { transcript: contextualBody.transcript, previousQuestions: contextualBody.previousQuestions });
      assertEquals(config.maxOutputTokens, 256);
      return { text: JSON.stringify({ question: 'Que te revient-il de la forme de la cabane ?', anchor: 'la forme de la cabane' }), raw: {} };
    },
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { question: 'Que te revient-il de la forme de la cabane ?', done: false });
  assertEquals(calls, 1);
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

Deno.test('recall stops after three questions without provider work', async () => {
  const response = await handleRecallQuestion(ctx({ ...body, previousQuestions: Array(3).fill('Une question ?') }));
  assertEquals(await response.json(), { question: null, done: true });
});


Deno.test('recall accepts a useful scene-level follow-up after an appearance answer in one call', async () => {
  const appearance = {
    ...body,
    transcript: 'Des oiseaux étaient dans la cour.\nQuestion : À quoi ressemblaient-ils ?\nRéponse : Ils étaient grands, bleus et jaunes.',
    previousQuestions: ['À quoi ressemblaient-ils ?'],
  };
  let calls = 0;
  const response = await handleRecallQuestion(ctx(appearance), {
    apiKey: 'test-key', admit,
    generate: async (_key, _model, _fallback, contents) => {
      calls++;
      assertEquals(JSON.parse(contents[0].parts[0].text!), {
        transcript: appearance.transcript, previousQuestions: appearance.previousQuestions,
      });
      return { text: JSON.stringify({ question: 'Que faisaient ces oiseaux ?', anchor: 'oiseaux' }), raw: {} };
    },
  });
  assertEquals(await response.json(), { question: 'Que faisaient ces oiseaux ?', done: false });
  assertEquals(calls, 1);
});

Deno.test('recall accepts an early stop without filling the remaining question allowance', async () => {
  let calls = 0;
  const response = await handleRecallQuestion(ctx({ ...body, transcript: 'Une cour. Je ne me souviens de rien de plus.' }), {
    apiKey: 'test-key', admit,
    generate: async () => { calls++; return { text: JSON.stringify({ question: null, anchor: '' }), raw: {} }; },
  });
  assertEquals(await response.json(), { question: null, done: true });
  assertEquals(calls, 1);
});

Deno.test('recall asks Claude Haiku at low effort and falls back to Gemini on an ungrounded answer', async () => {
  const originalFetch = globalThis.fetch;
  let geminiCalls = 0;
  try {
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      assertEquals(new URL(request.url).hostname, 'api.anthropic.com');
      const sent = await request.json();
      assertEquals(sent.model, 'claude-haiku-5-5');
      assertEquals(sent.output_config.effort, 'low');
      // Claude receives the nullable question as anyOf, not a JSON type array.
      assertEquals(sent.output_config.format.schema.properties.question, { anyOf: [{ type: 'string' }, { type: 'null' }] });
      return new Response(JSON.stringify({
        id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
        content: [{ type: 'text', text: JSON.stringify({ question: 'Que faisait le dragon ?', anchor: 'dragon' }) }],
        stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 900, output_tokens: 30 },
      }), { headers: { 'Content-Type': 'application/json' } });
    };
    const response = await handleRecallQuestion(ctx(body), {
      apiKey: 'test-key', anthropicApiKey: 'synthetic-anthropic-key', admit,
      generate: async () => { geminiCalls++; return { text: JSON.stringify({ question: 'Comment était ce jardin ?', anchor: 'un jardin' }), raw: {} }; },
    });
    assertEquals(await response.json(), { question: 'Comment était ce jardin ?', done: false });
    assertEquals(geminiCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
