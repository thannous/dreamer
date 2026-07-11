import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { canCreateImageJobForTier } from './imageJobs.ts';

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
