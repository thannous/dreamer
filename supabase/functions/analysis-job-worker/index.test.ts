import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { AnalysisJobRow } from '../api/services/analysisJobs.ts';
import { hashAnalysisTranscript } from '../api/lib/analysisTranscriptHash.ts';
import { claimSpecificJob, hasAuthorizedAnalysisTranscript } from './index.ts';

const queuedJob = {
  id: '11111111-1111-4111-8111-111111111111',
  job_type: 'analyze_dream',
  status: 'queued',
  attempt_count: 0,
  max_attempts: 3,
} as AnalysisJobRow;

const createClient = (current: AnalysisJobRow, claimed: AnalysisJobRow | null) => {
  const claimFilters: Record<string, unknown> = {};
  let updateCount = 0;
  const lookup = {
    select: () => lookup,
    eq: () => lookup,
    limit: () => lookup,
    maybeSingle: async () => ({ data: current, error: null }),
  };
  const update = {
    eq(column: string, value: unknown) {
      claimFilters[column] = value;
      return update;
    },
    select: () => update,
    limit: () => update,
    maybeSingle: async () => ({ data: claimed, error: null }),
  };
  const client = {
    from: () => ({
      ...lookup,
      update: () => {
        updateCount += 1;
        return update;
      },
    }),
  };
  return { client, claimFilters, get updateCount() { return updateCount; } };
};

Deno.test('a repeated worker trigger cannot process an already-running analysis', async () => {
  const running = { ...queuedJob, status: 'running', attempt_count: 1 } as AnalysisJobRow;
  const attempt = createClient(running, running);

  assertEquals(await claimSpecificJob(attempt.client as any, queuedJob.id), null);
  assertEquals(attempt.updateCount, 0);
});

Deno.test('an analysis worker processes only the queued attempt it claimed', async () => {
  const running = { ...queuedJob, status: 'running', attempt_count: 1 } as AnalysisJobRow;
  const won = createClient(queuedJob, running);

  assertEquals(await claimSpecificJob(won.client as any, queuedJob.id), running);
  assertEquals(won.claimFilters.status, 'queued');
  assertEquals(won.claimFilters.attempt_count, 0);

  const lost = createClient(queuedJob, null);
  assertEquals(await claimSpecificJob(lost.client as any, queuedJob.id), null);
});

Deno.test('an exhausted queued analysis attempt is not processed', async () => {
  const exhausted = { ...queuedJob, attempt_count: 3 } as AnalysisJobRow;
  const attempt = createClient(exhausted, null);

  assertEquals(await claimSpecificJob(attempt.client as any, queuedJob.id), null);
  assertEquals(attempt.updateCount, 0);
});

Deno.test('an async analysis cannot spend its receipt on a changed transcript', async () => {
  const bound = {
    ...queuedJob,
    request_payload: { transcript_sha256: await hashAnalysisTranscript('First dream') },
  } as AnalysisJobRow;

  assertEquals(await hasAuthorizedAnalysisTranscript(bound, 'First dream'), true);
  assertEquals(await hasAuthorizedAnalysisTranscript(bound, 'Different dream'), false);
  assertEquals(await hasAuthorizedAnalysisTranscript(bound, ' First dream'), false);
  assertEquals(await hasAuthorizedAnalysisTranscript(queuedJob, 'First dream'), false);
});
