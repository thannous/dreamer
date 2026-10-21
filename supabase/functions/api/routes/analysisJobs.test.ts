import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { ApiContext } from '../types.ts';
import { PLUS_DAILY_LIMITS } from '../lib/plusDailyLimits.ts';
import {
  blockedAdmissionResponse,
  handleCreateAnalysisJob,
  handleGetAnalysisJobStatus,
  resolveAnalysisJobAdmissionPolicy,
  resolveReplaceExistingImageFlag,
} from './analysisJobs.ts';

Deno.test('analysis quota admission returns a typed upgrade response', async () => {
  const response = blockedAdmissionResponse({
    allowed: false,
    code: 'QUOTA_EXCEEDED',
    tier: 'free',
    limit: 3,
    new_count: 6,
  });

  assertEquals(response.status, 429);
  assertEquals(await response.json(), {
    error: 'Analysis limit reached',
    code: 'QUOTA_EXCEEDED',
    tier: 'free',
    usage: { analysis: { used: 6, limit: 3 } },
  });
});

Deno.test('a spent or transcript-mismatched receipt is a conflict, not a retryable rate limit', async () => {
  for (const code of ['ANALYSIS_ALREADY_CLAIMED', 'ANALYSIS_TRANSCRIPT_MISMATCH']) {
    const response = blockedAdmissionResponse({ allowed: false, code });
    assertEquals(response.status, 409);
    assertEquals(response.headers.get('Retry-After'), null);
    assertEquals((await response.json()).code, code);
  }
});

Deno.test('a Plus account past its daily analyses gets a calm 429 that says when to come back', async () => {
  const response = blockedAdmissionResponse({
    allowed: false,
    code: 'DAILY_ANALYSIS_LIMIT',
    tier: 'plus',
    limit: null,
    daily_limit: 10,
    new_count: 10,
    retry_after_seconds: 3600,
  });

  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), '3600');
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await response.json(), {
    error: 'Daily fair use limit reached',
    code: 'DAILY_ANALYSIS_LIMIT',
    dailyLimit: 10,
    retryAfter: 3600,
  });
});

Deno.test('the API daily analysis ceiling matches the one the database enforces', async () => {
  const migration = await Deno.readTextFile(
    new URL('../../../migrations/20261021153000_cap_plus_daily_analyses.sql', import.meta.url)
  );
  assertEquals(
    migration.match(/daily_limit constant integer := (\d+);/)?.[1],
    String(PLUS_DAILY_LIMITS.analysis)
  );
});

Deno.test('analysis admission backlog responses carry a Retry-After header with CORS', async () => {
  const busy = blockedAdmissionResponse({
    allowed: false,
    code: 'AI_GLOBAL_BACKLOG_LIMIT',
    retry_after_seconds: 12,
  });

  assertEquals(busy.status, 503);
  assertEquals(busy.headers.get('Retry-After'), '12');
  assertEquals(busy.headers.get('Content-Type'), 'application/json');
  assertEquals(busy.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await busy.json(), {
    error: 'Analysis service is temporarily busy',
    code: 'AI_GLOBAL_BACKLOG_LIMIT',
    retryAfter: 12,
  });

  const denied = blockedAdmissionResponse({ allowed: false });
  assertEquals(denied.status, 429);
  assertEquals(denied.headers.get('Retry-After'), '30');
  assertEquals(await denied.json(), {
    error: 'Too many analysis requests',
    code: 'AI_ADMISSION_DENIED',
    retryAfter: 30,
  });
});

const buildContext = (body: Record<string, unknown>, userId: string | null = 'user-1') => ({
  req: new Request('https://example.test/functions/v1/api/analysis-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  user: userId ? { id: userId } : null,
  supabase: {},
  supabaseUrl: 'https://example.test',
  supabaseServiceRoleKey: 'service-role-key',
  storageBucket: 'dream-images',
}) as unknown as ApiContext;

Deno.test('analysis job admission defaults are tier-aware and bounded', () => {
  const free = resolveAnalysisJobAdmissionPolicy('free');
  const plus = resolveAnalysisJobAdmissionPolicy('plus');

  assertEquals(free.maxActive, 1);
  assertEquals(free.maxPerWindow, 4);
  assertEquals(plus.maxActive, 2);
  assertEquals(plus.maxPerWindow, 12);
  assertEquals(free.maxAttempts, 3);
  assertEquals(free.maxGlobalActive, 200);
});

Deno.test('analysis job creation requires authentication', async () => {
  const response = await handleCreateAnalysisJob(buildContext({}, null));
  assertEquals(response.status, 401);
});

Deno.test('analysis job creation rejects malformed identifiers before database access', async () => {
  const invalidDream = await handleCreateAnalysisJob(buildContext({
    dreamId: -1,
    analysisRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
  }));
  assertEquals(invalidDream.status, 400);
  assertEquals((await invalidDream.json()).field, 'dreamId');

  const invalidRequest = await handleCreateAnalysisJob(buildContext({
    dreamId: 42,
    analysisRequestId: 'unsafe request id',
  }));
  assertEquals(invalidRequest.status, 400);
  assertEquals((await invalidRequest.json()).field, 'analysisRequestId');
});

Deno.test('analysis job creation rejects invalid flags before database access', async () => {
  const response = await handleCreateAnalysisJob(buildContext({
    dreamId: 42,
    analysisRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
    replaceExistingImage: 'yes',
  }));
  assertEquals(response.status, 400);
  assertEquals((await response.json()).field, 'replaceExistingImage');
});

Deno.test('analysis job omission does not request image replacement', () => {
  assertEquals(resolveReplaceExistingImageFlag(undefined), false);
  assertEquals(resolveReplaceExistingImageFlag(null), false);
  assertEquals(resolveReplaceExistingImageFlag(false), false);
});

Deno.test('analysis job requests image replacement only for exact true', () => {
  assertEquals(resolveReplaceExistingImageFlag(true), true);
});

Deno.test('analysis job status rejects malformed job identifiers before database access', async () => {
  const response = await handleGetAnalysisJobStatus(buildContext({ jobId: 'not-a-uuid' }));
  assertEquals(response.status, 400);
  assertEquals((await response.json()).field, 'jobId');
});
