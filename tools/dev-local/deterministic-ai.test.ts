import { assert, assertEquals, assertNotEquals, assertThrows } from 'jsr:@std/assert@1';
import { answerProviderRequest, promptContext, synthesize } from './deterministic-ai.ts';
import { parseDevLocalManifest } from './manifest.ts';

const RECALL_SCHEMA = {
  type: 'object', properties: { question: { type: ['string', 'null'] }, anchor: { type: 'string' } },
  required: ['question', 'anchor'], additionalProperties: false,
};

Deno.test('a recall answer quotes the dream and asks one new question', () => {
  const transcript = 'Je marchais  dans un jardin la nuit, une lampe restait allumée.';
  const first = synthesize(RECALL_SCHEMA, '', 0, promptContext(JSON.stringify({ transcript, previousQuestions: [] }))) as
    { question: string; anchor: string };
  // The route refuses an anchor that is not a verbatim excerpt, or a question without exactly one "?".
  assert(transcript.includes(first.anchor) && first.anchor.length > 0);
  assertEquals(first.question.match(/\?/g)?.length, 1);
  const next = synthesize(RECALL_SCHEMA, '', 0, promptContext(JSON.stringify({ transcript, previousQuestions: [first.question] }))) as
    { question: string };
  assertNotEquals(next.question, first.question);
});

Deno.test('schemas get values of their declared shape without randomness', () => {
  const schema = {
    type: 'object', required: ['title', 'theme', 'count', 'tags', 'done'],
    properties: {
      title: { type: 'string', maxLength: 5 }, theme: { enum: ['calm', 'dark'] },
      count: { type: 'integer', minimum: 2 }, tags: { type: 'array', items: { type: 'string' }, minItems: 2 },
      done: { type: 'boolean' }, optional: { type: 'string' },
    },
  };
  const value = synthesize(schema) as Record<string, unknown>;
  assertEquals(value, { title: 'Rêve ', theme: 'calm', count: 2, tags: ['Réponse locale fixe.', 'Réponse locale fixe.'], done: false });
  assertEquals(synthesize(schema), value);
});

Deno.test('model calls get local answers and other destinations are left to the caller', async () => {
  const claude = await answerProviderRequest(new Request('https://api.anthropic.com/v1/messages', {
    method: 'POST', body: JSON.stringify({
      model: 'claude-test', messages: [{ role: 'user', content: '{"transcript":"Un phare bleu."}' }],
      output_config: { format: { type: 'json_schema', schema: RECALL_SCHEMA } },
    }),
  }));
  const message = await claude!.json();
  assertEquals(JSON.parse(message.content[0].text).anchor, 'Un phare bleu');
  const image = await answerProviderRequest(new Request('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', body: JSON.stringify({ model: 'gemini-image', response_format: { type: 'image' } }),
  }));
  assertEquals((await image!.json()).steps[0].content[0].mime_type, 'image/png');
  assertEquals(await answerProviderRequest(new Request('https://api.revenuecat.com/v1/subscribers/x')), null);
});

const stack = {
  API_URL: 'http://127.0.0.1:24321', DB_URL: 'postgresql://postgres:postgres@127.0.0.1:24322/postgres',
  ANON_KEY: 'anon', SERVICE_ROLE_KEY: 'service', LOCAL_E2E_STACK: { id: 'a'.repeat(64), runtime: 'native' },
};
const manifest = {
  kind: 'noctalia-dev-local', schemaVersion: 1, status: stack, publicOrigin: 'http://192.168.1.9:31300', port: 31300,
  guestSessionSecret: 'x'.repeat(64), iosAppAttest: { teamId: '27BLU7U28W', bundleIds: ['com.tanuki75.noctalia'] },
};

Deno.test('the local verifiers only ever front a native stack on this machine', () => {
  assertEquals(parseDevLocalManifest(manifest).publicOrigin, 'http://192.168.1.9:31300');
  // A hosted backend, an HTTPS or public origin, or a stack without identity is refused before anything listens.
  const refused = [
    { ...manifest, status: { ...stack, API_URL: 'https://abcdefghijklmnop.supabase.co' } },
    { ...manifest, status: { ...stack, LOCAL_E2E_STACK: { id: 'prod', runtime: 'native' } } },
    { ...manifest, publicOrigin: 'https://192.168.1.9:31300' },
    { ...manifest, publicOrigin: 'http://203.0.113.4:31300' },
    { ...manifest, kind: 'other' },
  ];
  for (const value of refused) assertThrows(() => parseDevLocalManifest(value));
});
