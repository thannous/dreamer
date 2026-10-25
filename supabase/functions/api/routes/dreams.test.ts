import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

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
      name: 'reserve_guest_text_analysis',
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
    const originalApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const rpcCalls: string[] = [];
    const providerRequests: string[] = [];

    try {
      Deno.env.set('ANTHROPIC_API_KEY', 'synthetic-test-key');
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
      if (originalApiKey === undefined) Deno.env.delete('ANTHROPIC_API_KEY');
      else Deno.env.set('ANTHROPIC_API_KEY', originalApiKey);
    }
  });
}

const claudeJson = (value: unknown, stopReason = 'end_turn') => new Response(JSON.stringify({
  id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
  content: [{ type: 'text', text: JSON.stringify(value) }],
  stop_reason: stopReason, stop_sequence: null, usage: { input_tokens: 800, output_tokens: 40 },
}), { headers: { 'Content-Type': 'application/json' } });

Deno.test('categorization runs on Claude Haiku at low effort and fails closed on a refusal', async () => {
  const originalFetch = globalThis.fetch;
  const category = { title: 'La porte', theme: 'calm', dreamType: 'Unknown', hasPerson: false, hasAnimal: false };
  const options = { anthropicApiKey: 'synthetic-anthropic-key', transcript: 'Une porte fermée.', truncatedForPrompt: false, lang: 'fr', themes: ['surreal', 'mystical', 'calm', 'noir'] };
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
    await assertRejects(() => runDreamCategorization(options), Error, 'please retry');
    assertEquals(hosts, ['api.anthropic.com']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('a Claude failure releases only its synchronous analysis reservation; missing key spends none', async () => {
  const originalFetch = globalThis.fetch;
  const previous = Deno.env.get('ANTHROPIC_API_KEY');
  const calls: string[] = [];
  const claimId = '11111111-1111-4111-8111-111111111111';
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === 'api.anthropic.com') {
      calls.push('claude');
      return new Response('{}', { status: 529, headers: { 'Content-Type': 'application/json' } });
    }
    assertEquals(url.hostname, 'supabase.test'); // any Gemini request fails this control
    const rpc = url.pathname.split('/rpc/')[1];
    calls.push(rpc);
    if (rpc === 'release_authenticated_text_analysis') assertEquals(await request.json(), { p_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', p_claim_id: claimId, p_failure_code: 'ANALYSIS_PROVIDER_OVERLOADED' });
    const data = rpc === 'get_effective_subscription_tier' ? 'free'
      : rpc === 'claim_authenticated_analysis_quota_bound' ? { allowed: true, claimed: true, claim_id: claimId, new_count: 1 }
      : { allowed: true };
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  };
  const context = () => ({
    req: new Request('https://api.test/api/analyzeDream', { method: 'POST', body: JSON.stringify({ transcript: 'A door.', remoteDreamId: 42, analysisRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e' }) }),
    supabase: null, user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    supabaseUrl: 'https://supabase.test', supabaseServiceRoleKey: 'synthetic-service-role-key', storageBucket: 'dream-images',
  });
  try {
    Deno.env.delete('ANTHROPIC_API_KEY');
    const missing = await handleAnalyzeDream(context());
    assertEquals(missing.status, 503);
    assertEquals(calls.includes('claim_authenticated_analysis_quota_bound'), false);
    calls.length = 0;
    Deno.env.set('ANTHROPIC_API_KEY', 'synthetic-key');
    const failed = await handleAnalyzeDream(context());
    assertEquals(failed.status, 502);
    assertEquals(calls.slice(-3), ['claim_authenticated_analysis_quota_bound', 'claude', 'release_authenticated_text_analysis']);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) Deno.env.delete('ANTHROPIC_API_KEY'); else Deno.env.set('ANTHROPIC_API_KEY', previous);
  }
});

Deno.test('a failed guest analysis refunds its exact reservation token without a Gemini request', async () => {
  const { createGuestToken } = await import('../lib/guestToken.ts');
  const originalFetch = globalThis.fetch;
  const names = ['ANTHROPIC_API_KEY', 'GUEST_SESSION_SECRET'] as const;
  const saved = names.map(name => Deno.env.get(name));
  const reservationId = '11111111-1111-4111-8111-111111111111';
  const fingerprint = 'a'.repeat(64);
  const calls: string[] = [];
  try {
    Deno.env.set('ANTHROPIC_API_KEY', 'synthetic-key');
    Deno.env.set('GUEST_SESSION_SECRET', 'synthetic-secret-with-sufficient-entropy');
    const { token } = await createGuestToken(fingerprint, 'android');
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (url.hostname === 'api.anthropic.com') {
        calls.push('claude');
        return new Response('{}', { status: 529, headers: { 'Content-Type': 'application/json' } });
      }
      assertEquals(url.hostname, 'supabase.test');
      const rpc = url.pathname.split('/rpc/')[1];
      calls.push(rpc);
      if (rpc === 'release_guest_text_analysis') assertEquals(await request.json(), { p_fingerprint: fingerprint, p_reservation_id: reservationId, p_failure_code: 'ANALYSIS_PROVIDER_OVERLOADED' });
      const data = rpc === 'reserve_guest_text_analysis' ? { allowed: true, claimed: true, reservation_id: reservationId, new_count: 1 } : { allowed: true };
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    };
    const response = await handleAnalyzeDream({
      req: new Request('https://api.test/api/analyzeDream', {
        method: 'POST', headers: { 'x-guest-fingerprint': fingerprint, 'x-guest-token': token, 'x-guest-platform': 'android' },
        body: JSON.stringify({ transcript: 'A door.', analysisRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e' }),
      }),
      user: null, supabase: null, supabaseUrl: 'https://supabase.test', supabaseServiceRoleKey: 'synthetic-key', storageBucket: 'dream-images',
    });
    assertEquals(response.status, 502);
    assertEquals(calls.slice(-3), ['reserve_guest_text_analysis', 'claude', 'release_guest_text_analysis']);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => { const value = saved[index]; if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value); });
  }
});

for (const mode of ['account', 'guest', 'full'] as const) {
  for (const clientCancelled of [false, true]) {
  Deno.test(`${mode} admission ${clientCancelled ? 'retains quota after client cancellation' : 'refunds a service failure'}`, async () => {
    const { createGuestToken } = await import('../lib/guestToken.ts');
    const { handleAnalyzeDreamFull } = await import('./dreams.ts');
    const originalFetch = globalThis.fetch;
    const names = ['ANTHROPIC_API_KEY', 'GUEST_SESSION_SECRET', 'GEMINI_API_KEY'] as const;
    const saved = names.map(name => Deno.env.get(name));
    const calls: string[] = [];
    const controller = new AbortController();
    const fingerprint = 'a'.repeat(64);
    try {
      Deno.env.set('ANTHROPIC_API_KEY', 'synthetic-key');
      Deno.env.set('GEMINI_API_KEY', 'synthetic-key');
      Deno.env.set('GUEST_SESSION_SECRET', 'synthetic-secret-with-sufficient-entropy');
      const { token } = await createGuestToken(fingerprint, 'android');
      globalThis.fetch = async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        if (url.hostname === 'api.anthropic.com') {
          calls.push('claude');
          if (clientCancelled) controller.abort(); // after its reservation
          return new Response('{}', { status: 529, headers: { 'Content-Type': 'application/json' } });
        }
        assertEquals(url.hostname, 'supabase.test');
        const rpc = url.pathname.split('/rpc/')[1];
        calls.push(rpc);
        const data = rpc === 'get_effective_subscription_tier' ? 'free'
          : { allowed: true, claimed: true, claim_id: '11111111-1111-4111-8111-111111111111', reservation_id: '11111111-1111-4111-8111-111111111111', new_count: 1 };
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
      };
      const response = await (mode === 'full' ? handleAnalyzeDreamFull : handleAnalyzeDream)({
        req: new Request('https://api.test/api/analyzeDream', {
          method: 'POST', signal: controller.signal,
          headers: { 'x-guest-fingerprint': fingerprint, 'x-guest-token': token, 'x-guest-platform': 'android' },
          body: JSON.stringify({ transcript: 'A door.', remoteDreamId: 42, analysisRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e' }),
        }),
        user: mode === 'guest' ? null : { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        supabase: null, supabaseUrl: 'https://supabase.test', supabaseServiceRoleKey: 'synthetic-key', storageBucket: 'dream-images',
      });
      assertEquals(response.status, 502);
      assertEquals(calls.includes(mode === 'guest' ? 'reserve_guest_text_analysis' : 'claim_authenticated_analysis_quota_bound'), true);
      assertEquals(calls.at(-1), clientCancelled ? 'claude'
        : mode === 'guest' ? 'release_guest_text_analysis' : 'release_authenticated_text_analysis');
      assertEquals(calls.some(call => call.startsWith('release_')), !clientCancelled);
    } finally {
      globalThis.fetch = originalFetch;
      names.forEach((name, index) => { const value = saved[index]; if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value); });
    }
  });
}
}
