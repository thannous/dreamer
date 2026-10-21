import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  claimGuestAnalysisQuota,
  isAuthenticatedAnalysisQuotaRetry,
} from '../lib/analysisQuota.ts';
import { quotaBlockedResponse, runDreamCategorization } from './dreams.ts';

Deno.test('authenticated quota recognizes the same request as an idempotent retry', () => {
  assertEquals(
    isAuthenticatedAnalysisQuotaRetry({ code: 'ANALYSIS_ALREADY_CLAIMED' }),
    true
  );
  assertEquals(isAuthenticatedAnalysisQuotaRetry({ code: 'QUOTA_EXCEEDED' }), false);
});

Deno.test('a synchronous Plus analysis past its daily ceiling gets the same calm 429 as a queued one', async () => {
  const response = quotaBlockedResponse({
    allowed: false,
    code: 'DAILY_ANALYSIS_LIMIT',
    tier: 'plus',
    limit: null,
    daily_limit: 10,
    new_count: 10,
    retry_after_seconds: 59.2,
  });

  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), '60');
  assertEquals(await response.json(), {
    error: 'Daily fair use limit reached',
    code: 'DAILY_ANALYSIS_LIMIT',
    dailyLimit: 10,
    retryAfter: 60,
  });
});

Deno.test('guest quota claim forwards the stable request id to the idempotent RPC', async () => {
  const calls: { name: string; params: Record<string, unknown> }[] = [];
  const adminClient = {
    rpc: async (name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      return {
        data: {
          allowed: true,
          new_count: 1,
          claimed: false,
          duplicate: true,
        },
        error: null,
      };
    },
  };

  const result = await claimGuestAnalysisQuota({
    adminClient,
    analysisRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
    fingerprint: 'hashed-installation-id',
    limit: 1,
  });

  assertEquals(result.response, undefined);
  assertEquals(result.claim?.allowed, true);
  assertEquals(result.claim?.duplicate, true);
  assertEquals(calls, [
    {
      name: 'claim_guest_analysis_quota',
      params: {
        p_fingerprint: 'hashed-installation-id',
        p_analysis_request_id: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
        p_limit: 1,
      },
    },
  ]);
});

Deno.test('guest quota refuses provider work without a request id', async () => {
  let called = false;
  const result = await claimGuestAnalysisQuota({
    adminClient: {
      rpc: async () => {
        called = true;
        return { data: null, error: null };
      },
    },
    analysisRequestId: null,
    fingerprint: 'hashed-installation-id',
    limit: 1,
  });

  assertEquals(called, false);
  assertEquals(result.response?.status, 409);
  assertEquals(await result.response?.json(), {
    error: 'Analysis request id is required',
    code: 'ANALYSIS_CLAIM_REQUIRED',
  });
});

const claudeJson = (value: unknown, stopReason = 'end_turn') => new Response(JSON.stringify({
  id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
  content: [{ type: 'text', text: JSON.stringify(value) }],
  stop_reason: stopReason, stop_sequence: null, usage: { input_tokens: 800, output_tokens: 40 },
}), { headers: { 'Content-Type': 'application/json' } });

Deno.test('categorization runs on Claude Haiku at low effort and falls back to Gemini on a refusal', async () => {
  const originalFetch = globalThis.fetch;
  const category = { title: 'La porte', theme: 'calm', dreamType: 'Unknown', hasPerson: false, hasAnimal: false };
  const options = { apiKey: 'synthetic-gemini-key', anthropicApiKey: 'synthetic-anthropic-key', transcript: 'Une porte fermée.', truncatedForPrompt: false, lang: 'fr', themes: ['surreal', 'mystical', 'calm', 'noir'] };
  try {
    const hosts: string[] = [];
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      hosts.push(new URL(request.url).hostname);
      const body = await request.json();
      assertEquals(body.model, 'claude-haiku-5-5');
      assertEquals(body.output_config.effort, 'low');
      assertEquals(body.output_config.format.schema.additionalProperties, false);
      return claudeJson(category);
    };
    assertEquals(await runDreamCategorization(options), category);
    assertEquals(hosts, ['api.anthropic.com']);

    hosts.length = 0;
    globalThis.fetch = async (input, init) => {
      const host = new URL(new Request(input, init).url).hostname;
      hosts.push(host);
      return host === 'api.anthropic.com'
        ? claudeJson({}, 'refusal')
        : new Response(JSON.stringify({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify({ ...category, title: 'Porte Gemini' }) }] }] }), { headers: { 'Content-Type': 'application/json' } });
    };
    assertEquals((await runDreamCategorization(options)).title, 'Porte Gemini');
    assertEquals(hosts, ['api.anthropic.com', 'generativelanguage.googleapis.com']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
