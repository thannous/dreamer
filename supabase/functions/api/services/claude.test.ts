import { assertEquals, assertRejects, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { CLAUDE_MODELS } from '../lib/models.ts';
import { classifyClaudeError, ClaudeConfigurationError, runClaudeOnly } from './claude.ts';
import { handleRecallQuestion } from '../routes/recall.ts';
import { handleFormatRecall } from '../routes/formatRecall.ts';
import type { ApiContext } from '../types.ts';

Deno.test('missing Claude configuration fails before any transport, even with a Gemini key', async () => {
  let calls = 0;
  await assertRejects(() => runClaudeOnly({
    route: '/test', anthropicApiKey: ' ', config: CLAUDE_MODELS.recall,
    claude: async () => { calls++; return { value: 'unexpected', usage: null }; },
  }), ClaudeConfigurationError, 'ANTHROPIC_API_KEY');
  assertEquals(calls, 0);
  assertEquals(classifyClaudeError(new ClaudeConfigurationError()).status, 503);
});

for (const handler of [handleRecallQuestion, handleFormatRecall]) {
  Deno.test(`${handler.name} reports missing config and retryable transport failure without Gemini`, async () => {
    const originalFetch = globalThis.fetch;
    const hosts: string[] = [];
    globalThis.fetch = async (input, init) => {
      const host = new URL(new Request(input, init).url).hostname;
      hosts.push(host);
      assertEquals(host, 'api.anthropic.com');
      return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Unavailable' } }), { status: 529, headers: { 'Content-Type': 'application/json' } });
    };
    const context = (): ApiContext => ({
      req: new Request('https://example.test/text', { method: 'POST', body: JSON.stringify({ transcript: 'Un jardin.', lang: 'fr' }) }),
      user: { id: 'synthetic-user' }, supabase: {}, supabaseUrl: 'https://example.test', supabaseServiceRoleKey: null, storageBucket: 'test',
    });
    const admit = async () => ({ tier: 'free', actorClass: 'FREE' } as const);
    try {
      const missing = await handler(context(), { anthropicApiKey: null, admit });
      assertEquals(missing.status, 503);
      assertStringIncludes((await missing.json()).error, 'ANTHROPIC_API_KEY');
      assertEquals(hosts, []);
      const failed = await handler(context(), { anthropicApiKey: 'synthetic-key', admit });
      assertEquals(failed.status, 502);
      assertStringIncludes((await failed.json()).error, 'please retry');
      assertEquals(hosts, ['api.anthropic.com']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
