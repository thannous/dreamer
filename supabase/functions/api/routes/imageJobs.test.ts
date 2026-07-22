import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { ApiContext } from '../types.ts';
import {
  canCreateImageJobForTier,
  handleCreateImageJob,
} from './imageJobs.ts';

const pendingDream = {
  id: 42,
  analysis_request_id: 'analysis-request-1',
  analysis_status: 'pending',
  is_analyzed: false,
};

Deno.test('image job creation allows Plus and guest generation', () => {
  assertEquals(
    canCreateImageJobForTier({
      tier: 'plus',
      userId: 'plus-user',
      clientRequestId: 'manual-regeneration',
    }),
    true
  );
  assertEquals(
    canCreateImageJobForTier({
      tier: 'free',
      userId: null,
      clientRequestId: 'guest-request',
    }),
    true
  );
});

Deno.test('image job creation allows a free initial image linked to a pending analysis', () => {
  assertEquals(
    canCreateImageJobForTier({
      tier: 'free',
      userId: 'free-user',
      dream: pendingDream,
      clientRequestId: 'analysis-request-1',
    }),
    true
  );
});

Deno.test('image job creation rejects unlinked or completed free generation', () => {
  assertEquals(
    canCreateImageJobForTier({
      tier: 'free',
      userId: 'free-user',
      dream: pendingDream,
      clientRequestId: 'different-request',
    }),
    false
  );
  assertEquals(
    canCreateImageJobForTier({
      tier: 'free',
      userId: 'free-user',
      dream: { ...pendingDream, analysis_status: 'done', is_analyzed: true },
      clientRequestId: 'analysis-request-1',
    }),
    false
  );
  assertEquals(
    canCreateImageJobForTier({
      tier: 'free',
      userId: 'free-user',
      clientRequestId: 'analysis-request-1',
    }),
    false
  );
});

Deno.test('image job creation rejects oversized input before database admission', async () => {
  let rpcCalls = 0;
  const context = {
    req: new Request('https://example.test/functions/v1/api/image-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
        transcript: 'x'.repeat(601),
      }),
    }),
    user: { id: 'user-1' },
    supabase: {
      rpc: async () => {
        rpcCalls += 1;
        return { data: null, error: null };
      },
    },
    supabaseUrl: 'https://example.test',
    supabaseServiceRoleKey: 'service-role-key',
    storageBucket: 'dream-images',
  } as unknown as ApiContext;

  const response = await handleCreateImageJob(context);

  assertEquals(response.status, 413);
  assertEquals(rpcCalls, 0);
  assertEquals((await response.json()).code, 'INPUT_TOO_LARGE');
});

Deno.test('image job creation rejects unsafe idempotency keys before database admission', async () => {
  const context = {
    req: new Request('https://example.test/functions/v1/api/image-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientRequestId: 'unsafe request id',
        prompt: 'moonlit forest',
      }),
    }),
    user: { id: 'user-1' },
    supabase: { rpc: async () => ({ data: null, error: null }) },
    supabaseUrl: 'https://example.test',
    supabaseServiceRoleKey: 'service-role-key',
    storageBucket: 'dream-images',
  } as unknown as ApiContext;

  const response = await handleCreateImageJob(context);

  assertEquals(response.status, 400);
  assertEquals((await response.json()).field, 'clientRequestId');
});
