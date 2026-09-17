import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { verifyAnalysisImageAuthorization } from './analysisAuthorization.ts';

const input = { userId: 'owner', dreamId: 42, requestId: 'analysis-request' };
Deno.test('image authorization uses the same receipt regardless of the current subscription', async () => {
  const filters: Record<string, unknown> = {};
  const q = {
    select: () => q, limit: () => q,
    eq: (key: string, value: unknown) => { filters[key] = value; return q; },
    contains: (key: string, value: unknown) => { filters[key] = value; return q; },
    maybeSingle: async () => ({ data: { id: 'plus-receipt' }, error: null }),
  };
  const client = { from: (table: string) => { assertEquals(table, 'quota_usage'); return q; } };
  assertEquals(await verifyAnalysisImageAuthorization(client as any, input), { allowed: true });
  assertEquals(filters, { user_id: 'owner', dream_id: 42, quota_type: 'analysis', metadata: { analysis_request_id: 'analysis-request' } });
});

Deno.test('missing claims wait only for the same pending analysis, never for a completed or superseded one', async () => {
  for (const [status, requestId, code, retryable] of [
    ['pending', input.requestId, 'FREE_IMAGE_ANALYSIS_CLAIM_PENDING', true],
    ['done', input.requestId, 'FREE_IMAGE_ANALYSIS_REQUIRED', false],
    ['failed', input.requestId, 'FREE_IMAGE_ANALYSIS_REQUIRED', false],
    ['pending', 'other-request', 'FREE_IMAGE_ANALYSIS_REQUIRED', false],
  ] as const) {
    const client = { from: (table: string) => {
      const q = { select: () => q, eq: () => q, contains: () => q, limit: () => q,
        maybeSingle: async () => ({ data: table === 'dreams' ? { analysis_status: status, analysis_request_id: requestId } : null, error: null }) };
      return q;
    } };
    const result = await verifyAnalysisImageAuthorization(client as any, input);
    assertEquals(result.allowed, false);
    if (!result.allowed) {
      assertEquals(result.errorCode, code);
      assertEquals(result.retryable, retryable);
    }
  }
});

Deno.test('authorization outages do not turn into entitlement denials', async () => {
  const result = await verifyAnalysisImageAuthorization({ from: () => { throw new Error('offline'); } } as any, input);
  assertEquals(result.allowed, false);
  if (!result.allowed) {
    assertEquals(result.errorCode, 'FREE_IMAGE_ANALYSIS_CLAIM_UNAVAILABLE');
    assertEquals(result.retryable, true);
  }
});
