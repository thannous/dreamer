import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { PLUS_DAILY_LIMITS } from '../lib/plusDailyLimits.ts';
import type { ApiContext } from '../types.ts';
import {
  admitSynchronousAiRequest,
  hashAiActor,
  resolveSynchronousAiAdmissionPolicy,
} from './aiAdmission.ts';

const buildContext = (overrides: Partial<ApiContext> = {}): ApiContext => ({
  req: new Request('https://example.test/api/chat', { method: 'POST' }),
  supabase: {},
  user: null,
  supabaseUrl: 'https://project.supabase.co',
  supabaseServiceRoleKey: 'service-role-key',
  storageBucket: 'dream-images',
  ...overrides,
});

Deno.test('synchronous AI admission defaults are tier-aware and environment-bounded', () => {
  const guest = resolveSynchronousAiAdmissionPolicy('transcribe', 'GUEST', () => undefined);
  assertEquals(guest, { windowSeconds: 600, actorLimit: 3, globalLimit: 200, dailyLimit: 30 });

  const plus = resolveSynchronousAiAdmissionPolicy('chat', 'PLUS', (name) => {
    if (name === 'AI_SYNC_RATE_WINDOW_SECONDS') return '120';
    if (name === 'AI_CHAT_MAX_PER_WINDOW_PLUS') return '999999';
    if (name === 'AI_CHAT_GLOBAL_MAX_PER_WINDOW') return '2500';
    return undefined;
  });
  assertEquals(plus, { windowSeconds: 120, actorLimit: 10000, globalLimit: 2500, dailyLimit: null });

  const recall = resolveSynchronousAiAdmissionPolicy('recall_question', 'FREE', (name) =>
    name === 'AI_RECALL_QUESTION_MAX_PER_DAY' ? '20000' : undefined);
  assertEquals(recall.dailyLimit, 10000);
  assertEquals(resolveSynchronousAiAdmissionPolicy('analyze_dream_full', 'PLUS', () => undefined).dailyLimit, 10);
  // Keyed retries count once; the daily budget retains room above 10 new Plus analyses.
  const analysis = resolveSynchronousAiAdmissionPolicy('analyze_dream', 'PLUS', () => undefined).dailyLimit;
  assertEquals(analysis, 20);
  assert(analysis! > PLUS_DAILY_LIMITS.analysis);
});

Deno.test('AI actors are hashed deterministically before database admission', async () => {
  const first = await hashAiActor('guest:private-fingerprint');
  const second = await hashAiActor('guest:private-fingerprint');

  assertEquals(first, second);
  assertMatch(first, /^[a-f0-9]{64}$/);
  assertEquals(first.includes('private-fingerprint'), false);
  // The seed CLI clears buckets with Node's SHA-256 of `user:<id>`: keep stored keys compatible.
  const user = await hashAiActor('user:00000000-0000-4000-8000-000000000001');
  assertEquals(user, 'ddbc0cfe34ed0fd0c414497e8b06b19223215c8e3db348b42fb5415dd1761ea7');
  assertEquals(user === await hashAiActor('guest:00000000-0000-4000-8000-000000000001'), false);
});

Deno.test('guest admission sends only a hashed actor and capability policy', async () => {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const fakeClient = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return { data: { allowed: true }, error: null };
    },
  };

  const result = await admitSynchronousAiRequest(
    {
      ctx: buildContext(),
      capability: 'categorize_dream',
      guestFingerprint: 'private-fingerprint',
    },
    {
      createAdminClient: (() => fakeClient) as any,
      readEnv: () => undefined,
    }
  );

  assertEquals(result, { tier: 'free', actorClass: 'GUEST' });
  assertEquals(rpcCalls.map((call) => call.name), ['claim_ai_request_window', 'claim_ai_daily_budget']);
  assertMatch(String(rpcCalls[0].args.p_actor_hash), /^[a-f0-9]{64}$/);
  assertEquals(JSON.stringify(rpcCalls).includes('private-fingerprint'), false);
  assertEquals(rpcCalls[0].args.p_actor_limit, 4);
  assertEquals(rpcCalls[1].args, {
    p_actor_hash: rpcCalls[0].args.p_actor_hash,
    p_capability: 'categorize_dream',
    p_daily_limit: 30,
  });
});

Deno.test('an actor past its daily budget gets a 429 that says when to come back, before any paid call', async () => {
  const rpcCalls: string[] = [];
  const fakeClient = {
    rpc: async (name: string) => {
      rpcCalls.push(name);
      if (name === 'claim_ai_daily_budget') {
        return { data: { allowed: false, code: 'AI_DAILY_LIMIT', retry_after_seconds: 3599.2 }, error: null };
      }
      return { data: { allowed: true }, error: null };
    },
  };

  const result = await admitSynchronousAiRequest(
    {
      ctx: buildContext(),
      capability: 'transcribe',
      guestFingerprint: 'qa:11111111-1111-4111-8111-111111111111',
    },
    {
      createAdminClient: (() => fakeClient) as any,
      readEnv: () => undefined,
    }
  );

  if (!(result instanceof Response)) throw new Error('Expected a daily budget response');
  // A refused request never reaches the QA paid-call budget.
  assertEquals(rpcCalls, ['claim_ai_request_window', 'claim_ai_daily_budget']);
  assertEquals(result.status, 429);
  assertEquals(result.headers.get('Retry-After'), '3600');
  assertEquals(await result.json(), {
    error: 'Daily AI limit reached',
    code: 'AI_DAILY_LIMIT',
    dailyLimit: 30,
    retryAfter: 3600,
  });
});

Deno.test('a daily budget claim with no answer is an outage, not a spent budget', async () => {
  for (const answer of [
    { data: null, error: null },
    { data: {}, error: null },
    { data: { allowed: 'yes' }, error: null },
    { data: null, error: { code: '42883' } },
  ]) {
    const fakeClient = {
      rpc: async (name: string) =>
        name === 'claim_ai_daily_budget' ? answer : { data: { allowed: true }, error: null },
    };
    const result = await admitSynchronousAiRequest(
      {
        ctx: buildContext(),
        capability: 'categorize_dream',
        guestFingerprint: 'qa:11111111-1111-4111-8111-111111111111',
      },
      {
        createAdminClient: (() => fakeClient) as any,
        readEnv: () => undefined,
      }
    );

    if (!(result instanceof Response)) throw new Error('Expected an unavailable response');
    assertEquals(result.status, 503);
    assertEquals((await result.json()).code, 'AI_ADMISSION_UNAVAILABLE');
  }
});

Deno.test('authenticated admission resolves server tier and returns a bounded 429', async () => {
  const rpcCalls: string[] = [];
  const fakeClient = {
    rpc: async (name: string) => {
      rpcCalls.push(name);
      if (name === 'get_effective_subscription_tier') {
        return { data: 'plus', error: null };
      }
      return {
        data: {
          allowed: false,
          code: 'AI_ACTOR_RATE_LIMIT',
          retry_after_seconds: 41,
        },
        error: null,
      };
    },
  };

  const result = await admitSynchronousAiRequest(
    {
      ctx: buildContext({ user: { id: '01fd2cb9-93c8-4ac8-a2d2-f1d851e8e8f4' } }),
      capability: 'chat',
      guestFingerprint: null,
    },
    {
      createAdminClient: (() => fakeClient) as any,
      readEnv: () => undefined,
    }
  );

  if (!(result instanceof Response)) {
    throw new Error('Expected an admission response');
  }
  assertEquals(rpcCalls, ['get_effective_subscription_tier', 'claim_ai_request_window']);
  assertEquals(result.status, 429);
  assertEquals(result.headers.get('Retry-After'), '41');
  assertEquals((await result.json()).code, 'AI_ACTOR_RATE_LIMIT');
});

Deno.test('QA guest admission claims the daily paid-call budget after rate admission', async () => {
  const rpcCalls: string[] = [];
  const fakeClient = {
    rpc: async (name: string) => {
      rpcCalls.push(name);
      if (name === 'claim_ai_request_window') {
        return { data: { allowed: true }, error: null };
      }
      return {
        data: {
          qa: true,
          allowed: false,
          code: 'QA_DAILY_BUDGET_EXCEEDED',
          retryAfter: 300,
        },
        error: null,
      };
    },
  };

  const result = await admitSynchronousAiRequest(
    {
      ctx: buildContext(),
      capability: 'chat',
      guestFingerprint: 'qa:11111111-1111-4111-8111-111111111111',
    },
    {
      createAdminClient: (() => fakeClient) as any,
      readEnv: () => undefined,
    }
  );

  if (!(result instanceof Response)) throw new Error('Expected QA budget response');
  assertEquals(rpcCalls, ['claim_ai_request_window', 'claim_guest_qa_paid_call']);
  assertEquals(result.status, 429);
  assertEquals((await result.json()).code, 'QA_DAILY_BUDGET_EXCEEDED');
});

Deno.test('keyed analysis admission claims window and day once through the atomic RPC', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const requestId = '11111111-1111-4111-8111-111111111111';
  for (const capability of ['analyze_dream', 'analyze_dream_full'] as const) {
    const result = await admitSynchronousAiRequest({ ctx: buildContext(), capability, guestFingerprint: 'guest', analysisRequestId: requestId }, {
      createAdminClient: (() => ({ rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args }); return { data: { allowed: true }, error: null };
      } })) as any,
    });
    assert(!(result instanceof Response));
  }
  assertEquals(calls.map(call => call.name), ['claim_ai_analysis_admission', 'claim_ai_analysis_admission']);
  assertEquals(calls[0].args.p_request_id, requestId);
  assertEquals(calls[0].args.p_daily_limit, 20);
  assertEquals(calls[0].args.p_actor_limit, 2);
});
