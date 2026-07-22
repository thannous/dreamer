import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { ApiContext } from '../types.ts';
import { handleAuthMarkUpgrade, handleQuotaStatus } from './quota.ts';

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
  assertEquals((await response.json()).targetFound, true);
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
