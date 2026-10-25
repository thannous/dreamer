import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { AnalysisJobRow } from '../api/services/analysisJobs.ts';
import { hashAnalysisTranscript } from '../api/lib/analysisTranscriptHash.ts';
import { claimSpecificJob, failJob, requeueJob, hasAuthorizedAnalysisTranscript } from './index.ts';

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

Deno.test('Claude configuration and generation failures keep the worker retryable', async () => {
  const { serializeAnalysisJobError } = await import('./index.ts');
  const { ClaudeConfigurationError, ClaudeRequestError } = await import('../api/services/claude.ts');
  for (const error of [new ClaudeConfigurationError(), new ClaudeRequestError(502), new ClaudeRequestError(504)]) {
    const result = serializeAnalysisJobError(error);
    assertEquals(result.retryable, true);
    assertEquals(result.errorCode, 'ANALYSIS_TRANSIENT');
  }
});

// Exercise the actual catch-path mutations with a conditional-update client.
// The job snapshot is still running when completion commits but its reply is lost.
const createStatusClient = (status: string) => {
  const rows: Record<string, Record<string, unknown>> = {
    ai_jobs: { id: queuedJob.id, status },
    dreams: { id: 1, user_id: 'owner', analysis_request_id: 'request', analysis_status: status === 'succeeded' ? 'done' : 'pending' },
  };
  const client = {
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => {
        const filters: Record<string, unknown> = {};
        const query = {
          eq: (key: string, value: unknown) => { filters[key] = value; return query; },
          then: (resolve: (result: { error: null }) => unknown) => {
            const row = rows[table];
            if (Object.entries(filters).every(([key, value]) => row[key] === value)) Object.assign(row, values);
            return Promise.resolve(resolve({ error: null }));
          },
        };
        return query;
      },
    }),
  };
  return { client, rows };
};
const runningSnapshot = { ...queuedJob, user_id: 'owner', dream_id: 1, client_request_id: 'request', status: 'running' } as AnalysisJobRow;

Deno.test('lost completion replies cannot fail or requeue a succeeded job through worker catch paths', async () => {
  for (const mutate of [failJob, requeueJob]) {
    const { client, rows } = createStatusClient('succeeded');
    await mutate(client as any, runningSnapshot, 'LOST_REPLY', 'Reply lost');
    assertEquals(rows.ai_jobs.status, 'succeeded');
    assertEquals(rows.dreams.analysis_status, 'done');
  }
});

Deno.test('worker failure and retry still transition a running attempt', async () => {
  const failed = createStatusClient('running');
  await failJob(failed.client as any, runningSnapshot, 'PROVIDER_FAILED', 'Failed');
  assertEquals(failed.rows.ai_jobs.status, 'failed');
  assertEquals(failed.rows.dreams.analysis_status, 'failed');
  const retry = createStatusClient('running');
  await requeueJob(retry.client as any, runningSnapshot, 'TRANSIENT', 'Retry');
  assertEquals(retry.rows.ai_jobs.status, 'queued');
  assertEquals(retry.rows.dreams.analysis_status, 'pending');
});
