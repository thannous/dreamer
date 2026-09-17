import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { createGuestToken } from '../lib/guestToken.ts';
import type { ApiContext } from '../types.ts';
import {
  buildGuestQuotaStatus,
  handleAuthMarkUpgrade,
  handleQuotaStatus,
} from './quota.ts';

const createContext = (options: {
  path: string;
  body: Record<string, unknown>;
  user: { id: string } | null;
  supabase?: ApiContext['supabase'];
  headers?: Record<string, string>;
}): ApiContext => ({
  req: new Request(`https://example.test/functions/v1/api${options.path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    body: JSON.stringify(options.body),
  }),
  user: options.user,
  supabase: options.supabase ?? ({} as ApiContext['supabase']),
  supabaseUrl: 'https://example.test',
  supabaseServiceRoleKey: 'service-role-key',
  storageBucket: 'dream-images',
});

Deno.test('/quota/status uses the single authenticated quota snapshot RPC', async () => {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const supabase = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return {
        data: {
          tier: 'free',
          usage: {
            analysis: { used: 1, limit: 3, remaining: 2 },
            exploration: { used: 0, limit: 2, remaining: 2 },
            messages: { used: 4, limit: 20, remaining: 16 },
          },
          canAnalyze: true,
          canExplore: true,
          targetFound: true,
        },
        error: null,
      };
    },
  } as unknown as ApiContext['supabase'];

  const response = await handleQuotaStatus(createContext({
    path: '/quota/status',
    body: { targetDreamId: 42 },
    user: { id: '11111111-1111-4111-8111-111111111111' },
    supabase,
  }));

  assertEquals(response.status, 200);
  assertEquals(rpcCalls, [{
    name: 'get_authenticated_quota_snapshot',
    args: { p_target_dream_id: 42 },
  }]);
  const body = await response.json();
  assertEquals(body.targetFound, true);
  assertEquals(body.canGenerateImage, false);
  assertEquals(body.usage.image, { used: 0, limit: 0, remaining: 0 });
});

Deno.test('/quota/status plus snapshot is unlimited for illustrations without a monthly credit pool', async () => {
  const supabase = {
    rpc: async () => ({
      data: {
        tier: 'plus',
        usage: {
          analysis: { used: 4, limit: null, remaining: null },
          exploration: { used: 2, limit: null, remaining: null },
          messages: { used: 3, limit: 20, remaining: 17 },
        },
        canAnalyze: true,
        canExplore: true,
      },
      error: null,
    }),
  } as unknown as ApiContext['supabase'];

  const response = await handleQuotaStatus(createContext({
    path: '/quota/status',
    body: {},
    user: { id: '11111111-1111-4111-8111-111111111111' },
    supabase,
  }));

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.canGenerateImage, true);
  assertEquals(body.usage.image, { used: 0, limit: null, remaining: null });
});

Deno.test('guest quota status allows illustrations when analysis is exhausted', () => {
  const status = buildGuestQuotaStatus({
    analysis_count: 2,
    exploration_count: 0,
    image_count: 1,
    effective_analysis_limit: 2,
    effective_message_limit: 10,
    effective_image_limit: 2,
  }, 0);

  assertEquals(status.canAnalyze, false);
  assertEquals(status.canGenerateImage, true);
  assertEquals(status.usage, {
    analysis: { used: 2, limit: 2, remaining: 0 },
    exploration: { used: 0, limit: null, remaining: null },
    messages: { used: 0, limit: 10, remaining: 10 },
    image: { used: 1, limit: 2, remaining: 1 },
  });
});

Deno.test('guest quota status denies illustrations when the image pool is exhausted', () => {
  const status = buildGuestQuotaStatus({
    analysis_count: 1,
    image_count: 2,
    effective_analysis_limit: 2,
    effective_image_limit: 2,
    effective_message_limit: 10,
  }, 0);

  assertEquals(status.canAnalyze, true);
  assertEquals(status.canGenerateImage, false);
  assertEquals((status.usage as { image: { remaining: number } }).image.remaining, 0);
  assertEquals(
    (status.reasons as string[]).some((reason) => reason.toLowerCase().includes('illustration')),
    true,
  );
  assertEquals(
    (status.reasons as string[]).some((reason) => reason.toLowerCase().includes('interpretation')),
    false,
  );
});

Deno.test('guest quota status defaults missing older image fields to the existing pool', () => {
  const status = buildGuestQuotaStatus({
    analysis_count: 2,
    effective_analysis_limit: 2,
    effective_message_limit: 10,
  }, 0);

  assertEquals(status.canAnalyze, false);
  assertEquals(status.canGenerateImage, true);
  assertEquals((status.usage as { image: unknown }).image, { used: 0, limit: 2, remaining: 2 });
});

Deno.test('/quota/status guest path surfaces image_count independently of analysis', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'test-only-secret-with-sufficient-entropy');
  try {
    const fingerprint = 'guest-device-fingerprint';
    const session = await createGuestToken(fingerprint, 'ios');
    const rpcCalls: string[] = [];
    const response = await handleQuotaStatus(
      createContext({
        path: '/quota/status',
        body: { fingerprint },
        user: null,
        headers: {
          'x-guest-token': session.token,
          'x-guest-fingerprint': fingerprint,
          'x-guest-platform': 'ios',
        },
      }),
      {
        createAdminClient: () => ({
          rpc: async (name: string) => {
            rpcCalls.push(name);
            if (name === 'get_guest_quota_status') {
              return {
                data: {
                  analysis_count: 2,
                  exploration_count: 0,
                  image_count: 1,
                  effective_analysis_limit: 2,
                  effective_message_limit: 10,
                  effective_image_limit: 2,
                  risk_score: 0,
                  risk_level: 'low',
                },
                error: null,
              };
            }
            return { data: 0, error: null };
          },
        }),
      },
    );

    assertEquals(response.status, 200);
    assertEquals(rpcCalls.includes('get_guest_quota_status'), true);
    const body = await response.json();
    assertEquals(body.canAnalyze, false);
    assertEquals(body.canGenerateImage, true);
    assertEquals(body.usage.image, { used: 1, limit: 2, remaining: 1 });
  } finally {
    if (previous == null) Deno.env.delete('GUEST_SESSION_SECRET');
    else Deno.env.set('GUEST_SESSION_SECRET', previous);
  }
});

Deno.test('/quota/status rejects an unverified guest fingerprint', async () => {
  const response = await handleQuotaStatus(createContext({
    path: '/quota/status',
    body: { fingerprint: 'attacker-controlled-fingerprint' },
    user: null,
  }));

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: 'Invalid guest session' });
});

Deno.test('/quota/status rejects coercible non-numeric dream identifiers', async () => {
  let rpcCalled = false;
  const supabase = {
    rpc: async () => {
      rpcCalled = true;
      return { data: null, error: null };
    },
  } as unknown as ApiContext['supabase'];

  const response = await handleQuotaStatus(createContext({
    path: '/quota/status',
    body: { targetDreamId: [42] },
    user: { id: '11111111-1111-4111-8111-111111111111' },
    supabase,
  }));

  assertEquals(response.status, 400);
  assertEquals(rpcCalled, false);
  assertEquals(await response.json(), { error: 'Invalid targetDreamId' });
});

Deno.test('/auth/mark-upgrade requires the prior signed guest session', async () => {
  const response = await handleAuthMarkUpgrade(createContext({
    path: '/auth/mark-upgrade',
    body: { fingerprint: 'device-fingerprint' },
    user: { id: '11111111-1111-4111-8111-111111111111' },
  }));

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: 'Invalid guest session' });
});
