import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { ApiContext } from '../types.ts';
import { AI_REQUEST_LIMITS } from '../lib/aiRequestPolicy.ts';
import { DREAM_CONTEXT_TRANSCRIPT_MAX_CHARS } from '../lib/prompts.ts';
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

Deno.test('image job creation allows recovery of a completed free analysis image', () => {
  assertEquals(
    canCreateImageJobForTier({
      tier: 'free',
      userId: 'free-user',
      dream: { ...pendingDream, analysis_status: 'done', is_analyzed: true },
      clientRequestId: 'analysis-request-1',
    }),
    true
  );
});

Deno.test('image job creation rejects unlinked free generation', () => {
  assertEquals(
    canCreateImageJobForTier({
      tier: 'free',
      userId: 'free-user',
      dream: {
        ...pendingDream,
        analysis_status: 'done',
        is_analyzed: true,
        image_url: 'https://example.test/existing.webp',
      },
      clientRequestId: 'analysis-request-1',
    }),
    false
  );
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
      clientRequestId: 'analysis-request-1',
    }),
    false
  );
});

Deno.test('image job creation rejects request-abuse transcripts before database admission', async () => {
  let rpcCalls = 0;
  const context = {
    req: new Request('https://example.test/functions/v1/api/image-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
        transcript: 'x'.repeat(AI_REQUEST_LIMITS.transcriptRequestChars + 1),
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
  const body = await response.json();
  assertEquals(body.code, 'INPUT_TOO_LARGE');
  assertEquals(body.maxChars, AI_REQUEST_LIMITS.transcriptRequestChars);
});

Deno.test('standalone image jobs accept a 601-character transcript and bound the image context', async () => {
  const payloads: Record<string, unknown>[] = [];
  const transcript = 'x'.repeat(601);
  const response = await handleCreateImageJob(
    createAuthenticatedImageContext({
      clientRequestId: BUNDLED_REQUEST_ID,
      dreamId: 42,
      transcript,
    }),
    {
      createAdminClient: (() => ({
        rpc: async (name: string, args: Record<string, unknown>) => {
          if (name === 'admit_ai_job') {
            payloads.push(args.p_request_payload as Record<string, unknown>);
            return {
              data: {
                allowed: true,
                duplicate: false,
                requeued: false,
                job: {
                  id: EXISTING_IMAGE_JOB_ID,
                  status: 'queued',
                  client_request_id: BUNDLED_REQUEST_ID,
                },
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      })) as any,
      triggerImageJobWorker: async () => true,
    }
  );

  assertEquals(response.status, 202);
  assertEquals(payloads.length, 1);
  assertEquals(payloads[0].transcript, transcript);
  assertEquals(String(payloads[0].transcript).length, 601);
  assertEquals(String(payloads[0].transcript).length > 600, true);
});

Deno.test('standalone image jobs keep the long stored request and bound the model transcript copy', async () => {
  const payloads: Record<string, unknown>[] = [];
  const stored = 'y'.repeat(10_000);
  const response = await handleCreateImageJob(
    createAuthenticatedImageContext({
      clientRequestId: BUNDLED_REQUEST_ID,
      dreamId: 42,
      transcript: stored,
    }),
    {
      createAdminClient: (() => ({
        rpc: async (name: string, args: Record<string, unknown>) => {
          if (name === 'admit_ai_job') {
            payloads.push(args.p_request_payload as Record<string, unknown>);
            return {
              data: {
                allowed: true,
                duplicate: false,
                requeued: false,
                job: {
                  id: EXISTING_IMAGE_JOB_ID,
                  status: 'queued',
                  client_request_id: BUNDLED_REQUEST_ID,
                },
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      })) as any,
      triggerImageJobWorker: async () => true,
    }
  );

  assertEquals(response.status, 202);
  assertEquals(payloads.length, 1);
  assertEquals(String(payloads[0].transcript).length, DREAM_CONTEXT_TRANSCRIPT_MAX_CHARS);
  assertEquals(payloads[0].transcript, stored.slice(0, DREAM_CONTEXT_TRANSCRIPT_MAX_CHARS));
  assertEquals(stored.length, 10_000);
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

const BUNDLED_REQUEST_ID = '3f73ab45-9a14-4db9-94a3-d24724457d9e';
const EXISTING_IMAGE_JOB_ID = '11111111-1111-4111-8111-111111111111';

const bundledImageBody = {
  clientRequestId: BUNDLED_REQUEST_ID,
  dreamId: 42,
  prompt: 'moonlit forest',
};

const createAuthenticatedImageContext = (
  body: Record<string, unknown>,
  tier: 'free' | 'plus' = 'plus'
): ApiContext => ({
  req: new Request('https://example.test/functions/v1/api/image-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  user: { id: 'user-1' },
  supabase: {
    rpc: async (name: string) => {
      if (name === 'get_effective_subscription_tier') {
        return { data: tier, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 42,
              analysis_request_id: BUNDLED_REQUEST_ID,
              analysis_status: 'done',
              is_analyzed: true,
              image_url: null,
            },
            error: null,
          }),
        }),
      }),
    }),
  },
  supabaseUrl: 'https://example.test',
  supabaseServiceRoleKey: 'service-role-key',
  storageBucket: 'dream-images',
}) as unknown as ApiContext;

Deno.test('failed image job retry with the same request id returns queued and retriggers the worker', async () => {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const triggeredJobIds: string[] = [];

  const response = await handleCreateImageJob(
    createAuthenticatedImageContext(bundledImageBody),
    {
      createAdminClient: (() => ({
        rpc: async (name: string, args: Record<string, unknown>) => {
          rpcCalls.push({ name, args });
          if (name === 'admit_ai_job') {
            return {
              data: {
                allowed: true,
                duplicate: true,
                requeued: true,
                job: {
                  id: EXISTING_IMAGE_JOB_ID,
                  status: 'queued',
                  client_request_id: BUNDLED_REQUEST_ID,
                },
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      })) as any,
      triggerImageJobWorker: async (options) => {
        triggeredJobIds.push(options.jobId);
        return true;
      },
    }
  );

  const admitCalls = rpcCalls.filter((call) => call.name === 'admit_ai_job');
  assertEquals(response.status, 202);
  assertEquals(await response.json(), {
    jobId: EXISTING_IMAGE_JOB_ID,
    status: 'queued',
    clientRequestId: BUNDLED_REQUEST_ID,
    duplicate: true,
    requeued: true,
  });
  assertEquals(triggeredJobIds, [EXISTING_IMAGE_JOB_ID]);
  assertEquals(admitCalls.length, 1);
  assertEquals(admitCalls[0].args.p_client_request_id, BUNDLED_REQUEST_ID);
  assertEquals(admitCalls[0].args.p_dream_id, 42);
  assertEquals(admitCalls[0].args.p_job_type, 'generate_image');
  assertEquals(admitCalls[0].args.p_job_id !== EXISTING_IMAGE_JOB_ID, true);
  assertEquals(rpcCalls.some((call) => call.name === 'increment_guest_quota'), false);
  assertEquals(admitCalls[0].args.p_request_payload, {
    prompt: 'moonlit forest',
    transcript: null,
    previousImageUrl: null,
  });
  assertEquals(
    Object.prototype.hasOwnProperty.call(admitCalls[0].args.p_request_payload, '_retryPayloadHash'),
    false
  );
});

Deno.test('image job retry with a mismatched payload returns AI_IDEMPOTENCY_KEY_REUSED', async () => {
  const rpcCalls: string[] = [];
  const triggeredJobIds: string[] = [];

  const response = await handleCreateImageJob(
    createAuthenticatedImageContext({
      ...bundledImageBody,
      transcript: 'a different dream transcript',
    }),
    {
      createAdminClient: (() => ({
        rpc: async (name: string) => {
          rpcCalls.push(name);
          if (name === 'admit_ai_job') {
            return {
              data: {
                allowed: false,
                code: 'AI_IDEMPOTENCY_KEY_REUSED',
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      })) as any,
      triggerImageJobWorker: async (options) => {
        triggeredJobIds.push(options.jobId);
        return true;
      },
    }
  );

  assertEquals(response.status, 409);
  assertEquals((await response.json()).code, 'AI_IDEMPOTENCY_KEY_REUSED');
  assertEquals(triggeredJobIds, []);
  assertEquals(rpcCalls.filter((name) => name === 'admit_ai_job'), ['admit_ai_job']);
});

Deno.test('failed image retry reuses the existing job id and does not open a second quota claim', async () => {
  const admitJobIds: unknown[] = [];
  const quotaRpcs: string[] = [];

  const response = await handleCreateImageJob(
    createAuthenticatedImageContext(bundledImageBody),
    {
      createAdminClient: (() => ({
        rpc: async (name: string, args: Record<string, unknown>) => {
          if (name === 'admit_ai_job') {
            admitJobIds.push(args.p_job_id);
            return {
              data: {
                allowed: true,
                duplicate: true,
                requeued: true,
                job: {
                  id: EXISTING_IMAGE_JOB_ID,
                  status: 'queued',
                  client_request_id: BUNDLED_REQUEST_ID,
                },
              },
              error: null,
            };
          }
          quotaRpcs.push(name);
          return { data: null, error: null };
        },
      })) as any,
      triggerImageJobWorker: async () => true,
    }
  );

  const body = await response.json();
  assertEquals(response.status, 202);
  assertEquals(body.jobId, EXISTING_IMAGE_JOB_ID);
  assertEquals(admitJobIds.length, 1);
  assertEquals(admitJobIds[0] !== EXISTING_IMAGE_JOB_ID, true);
  assertEquals(quotaRpcs, []);
});

Deno.test('failed-image retry migration fingerprints payloads and defaults replaceExistingImage to false', async () => {
  const migration = await Deno.readTextFile(
    new URL(
      '../../../migrations/20260829120000_requeue_failed_generate_image_jobs.sql',
      import.meta.url
    )
  );

  assertEquals(migration.includes("incoming_hash := md5(incoming_payload::text);"), true);
  assertEquals(
    migration.includes("jsonb_build_object('_retryPayloadHash', incoming_hash)"),
    true
  );
  assertEquals(migration.includes('existing_hash is distinct from incoming_hash'), true);
  assertEquals(
    migration.includes(
      "(existing_job.request_payload - '_retryPayloadHash'::text) is distinct from incoming_payload"
    ),
    true
  );
  assertEquals(migration.includes('request_payload = stored_payload'), true);
  assertEquals(
    migration.includes("'replaceExistingImage', coalesce(p_replace_existing_image, false)"),
    true
  );
  assertEquals(
    migration.includes("'replaceExistingImage', coalesce(p_replace_existing_image, true)"),
    false
  );
  assertEquals(migration.includes('create or replace function public.complete_authenticated_analysis_job('), true);
  assertEquals(migration.includes('replace_existing_image boolean := false;'), true);
  assertEquals(migration.includes('replace_existing_image boolean := true;'), false);
  assertEquals(
    migration.includes(
      "(analysis_job.request_payload ->> 'replaceExistingImage')::boolean,\n    false"
    ),
    true
  );
  assertEquals(
    migration.includes(
      "(analysis_job.request_payload ->> 'replaceExistingImage')::boolean,\n    true"
    ),
    false
  );
  const hashedRedactedBranch = migration.indexOf(
    'and existing_hash is not null then\n        existing_hash is distinct from incoming_hash'
  );
  const legacyPresenceBranch = migration.indexOf(
    "when coalesce((existing_job.request_payload ->> 'redacted')::boolean, false) then"
  );
  assertEquals(hashedRedactedBranch > 0, true);
  assertEquals(legacyPresenceBranch > hashedRedactedBranch, true);
});

Deno.test('later image-retry migration keeps attempt_count and quota_claimed on requeue', async () => {
  const previous = await Deno.readTextFile(
    new URL(
      '../../../migrations/20260829120000_requeue_failed_generate_image_jobs.sql',
      import.meta.url
    )
  );
  const migration = await Deno.readTextFile(
    new URL(
      '../../../migrations/20260829160000_preserve_image_job_retry_budget.sql',
      import.meta.url
    )
  );

  assertEquals(previous.includes('attempt_count = 0'), true);
  assertEquals(migration.includes('attempt_count = 0'), false);
  assertEquals(migration.includes('Keep attempt_count and quota_claimed as-is'), true);
  assertEquals(
    migration.includes('without resetting attempt_count or quota_claimed'),
    true
  );

  const requeueUpdates = [...migration.matchAll(/update public\.ai_jobs\s+set([\s\S]*?)where id = existing_job.id/g)];
  assertEquals(requeueUpdates.length, 2);
  for (const match of requeueUpdates) {
    const assignment = match[1] ?? '';
    assertEquals(assignment.includes('attempt_count'), false);
    assertEquals(assignment.includes('quota_claimed'), false);
    assertEquals(assignment.includes("status = 'queued'"), true);
  }
});
