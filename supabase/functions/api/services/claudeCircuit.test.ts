import { deepStrictEqual as equal, rejects } from 'node:assert';
import { claudeProviderCircuit, requestClaudeJson, requestClaudeText, startClaudeTextStream, isProviderAvailabilityFailure, ClaudeStopError } from './claude.ts';
import { TEXT_PROVIDER_CIRCUIT } from '../lib/models.ts';
import { ProviderCircuitOpenError } from '../lib/providerCircuit.ts';
import { isRefundableTextAnalysisFailure } from '../lib/textAnalysisRefund.ts';
import { handleRecallQuestion } from '../routes/recall.ts';
import type { ApiContext } from '../types.ts';

Deno.test('JSON, text and streaming share one fast availability breaker with the existing refundable code', async () => {
  const original = globalThis.fetch;
  claudeProviderCircuit.reset();
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'synthetic outage' } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }));
  };
  const base = { apiKey: 'synthetic', model: 'claude-haiku-5-5', effort: 'low' as const, system: 'test', timeoutMs: 1000 };
  const json = () => requestClaudeJson({ ...base, prompt: 'test', schema: { type: 'object', properties: {}, additionalProperties: false } });
  const text = () => requestClaudeText({ ...base, messages: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }] });
  const stream = () => startClaudeTextStream({ ...base, messages: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }] });
  try {
    const callsToMake = [json, text, stream];
    for (let i = 0; i < TEXT_PROVIDER_CIRCUIT.failureThreshold; i++) await rejects(callsToMake[i % 3]());
    equal(calls, 5);
    for (const request of callsToMake) await rejects(request(), ProviderCircuitOpenError);
    const ctx = {
      req: new Request('https://example.test/recall-question', { method: 'POST', body: JSON.stringify({ transcript: 'A door.', lang: 'en' }) }),
      user: { id: 'synthetic-user' }, supabase: {}, supabaseUrl: 'https://supabase.test', supabaseServiceRoleKey: null, storageBucket: 'test',
    } as ApiContext;
    const response = await handleRecallQuestion(ctx, { anthropicApiKey: 'synthetic', admit: () => Promise.resolve({ tier: 'free', actorClass: 'FREE' } as const) });
    equal(response.status, 503);
    const body = await response.json();
    equal(body.code, 'ANALYSIS_PROVIDER_UNAVAILABLE');
    equal(isRefundableTextAnalysisFailure(body.code), true);
    equal(body.retryAfter > 0 && body.retryAfter <= 10, true);
    equal(typeof body.error, 'string');
    equal(calls, 5); // every blocked entry point made zero transport calls
  } finally { globalThis.fetch = original; claudeProviderCircuit.reset(); }
});

Deno.test('only availability failures affect provider health', () => {
  for (const error of [{ status: 429 }, { status: 503 }, { name: 'TimeoutError' }, new TypeError('fetch failed')]) {
    equal(isProviderAvailabilityFailure(error), true);
  }
  for (const error of [{ status: 400 }, { status: 401 }, { status: 403 }, new ClaudeStopError('refusal'), new SyntaxError('invalid JSON')]) {
    equal(isProviderAvailabilityFailure(error), false);
  }
});
