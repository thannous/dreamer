import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  claimGuestAnalysisQuota,
  isAuthenticatedAnalysisQuotaRetry,
} from '../lib/analysisQuota.ts';
import { handleAnalyzeDream, quotaBlockedResponse, runDreamCategorization } from './dreams.ts';

Deno.test('authenticated quota recognizes a spent request before another provider call', () => {
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

Deno.test('guest quota claim forwards the stable request id to the receipt RPC', async () => {
  const calls: { name: string; params: Record<string, unknown> }[] = [];
  const adminClient = {
    rpc: async (name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      return {
        data: {
          allowed: false,
          code: 'ANALYSIS_ALREADY_CLAIMED',
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
    transcriptSha256: 'a'.repeat(64),
  });

  assertEquals(result.response, undefined);
  assertEquals(result.claim?.allowed, false);
  assertEquals(result.claim?.code, 'ANALYSIS_ALREADY_CLAIMED');
  assertEquals(result.claim?.duplicate, true);
  assertEquals(calls, [
    {
      name: 'claim_guest_analysis_quota',
      params: {
        p_fingerprint: 'hashed-installation-id',
        p_analysis_request_id: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
        p_limit: 1,
        p_transcript_sha256: 'a'.repeat(64),
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
    transcriptSha256: 'a'.repeat(64),
  });

  assertEquals(called, false);
  assertEquals(result.response?.status, 409);
  assertEquals(await result.response?.json(), {
    error: 'Analysis request id is required',
    code: 'ANALYSIS_CLAIM_REQUIRED',
  });
});

for (const code of ['ANALYSIS_ALREADY_CLAIMED', 'ANALYSIS_TRANSCRIPT_MISMATCH']) {
  Deno.test(`/analyzeDream refuses ${code} before any provider request`, async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = Deno.env.get('GEMINI_API_KEY');
    const rpcCalls: string[] = [];
    const providerRequests: string[] = [];

    try {
      Deno.env.set('GEMINI_API_KEY', 'synthetic-test-key');
      globalThis.fetch = async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const rpcName = url.pathname.split('/rpc/')[1];
        if (url.hostname !== 'supabase.test' || !rpcName) {
          providerRequests.push(request.url);
          return new Response('Unexpected provider request', { status: 500 });
        }
        rpcCalls.push(rpcName);
        const data = rpcName === 'get_effective_subscription_tier'
          ? 'free'
          : rpcName === 'claim_authenticated_analysis_quota_bound'
            ? { allowed: false, code }
            : { allowed: true };
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const response = await handleAnalyzeDream({
        req: new Request('https://api.test/api/analyzeDream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: 'An unchanged dream',
            remoteDreamId: 42,
            analysisRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
          }),
        }),
        supabase: null,
        user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        supabaseUrl: 'https://supabase.test',
        supabaseServiceRoleKey: 'synthetic-service-role-key',
        storageBucket: 'dream-images',
      });

      assertEquals(response.status, 409);
      assertEquals((await response.json()).code, code);
      assertEquals(rpcCalls, [
        'get_effective_subscription_tier',
        'claim_ai_request_window',
        'claim_ai_daily_budget',
        'claim_authenticated_analysis_quota_bound',
      ]);
      assertEquals(providerRequests, []);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) Deno.env.delete('GEMINI_API_KEY');
      else Deno.env.set('GEMINI_API_KEY', originalApiKey);
    }
  });
}

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
