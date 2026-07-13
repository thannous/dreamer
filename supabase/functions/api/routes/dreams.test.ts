import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  claimGuestAnalysisQuota,
  isAuthenticatedAnalysisQuotaRetry,
} from '../lib/analysisQuota.ts';

Deno.test('authenticated quota recognizes the same request as an idempotent retry', () => {
  assertEquals(
    isAuthenticatedAnalysisQuotaRetry({ code: 'ANALYSIS_ALREADY_CLAIMED' }),
    true
  );
  assertEquals(isAuthenticatedAnalysisQuotaRetry({ code: 'QUOTA_EXCEEDED' }), false);
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
