import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';
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
  assertEquals(guest, { windowSeconds: 600, actorLimit: 3, globalLimit: 200 });

  const plus = resolveSynchronousAiAdmissionPolicy('chat', 'PLUS', (name) => {
    if (name === 'AI_SYNC_RATE_WINDOW_SECONDS') return '120';
    if (name === 'AI_CHAT_MAX_PER_WINDOW_PLUS') return '999999';
    if (name === 'AI_CHAT_GLOBAL_MAX_PER_WINDOW') return '2500';
    return undefined;
  });
  assertEquals(plus, { windowSeconds: 120, actorLimit: 10000, globalLimit: 2500 });
});

Deno.test('AI actors are hashed deterministically before database admission', async () => {
  const first = await hashAiActor('guest:private-fingerprint');
  const second = await hashAiActor('guest:private-fingerprint');

  assertEquals(first, second);
  assertMatch(first, /^[a-f0-9]{64}$/);
  assertEquals(first.includes('private-fingerprint'), false);
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
  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].name, 'claim_ai_request_window');
  assertMatch(String(rpcCalls[0].args.p_actor_hash), /^[a-f0-9]{64}$/);
  assertEquals(JSON.stringify(rpcCalls[0]).includes('private-fingerprint'), false);
  assertEquals(rpcCalls[0].args.p_actor_limit, 4);
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
