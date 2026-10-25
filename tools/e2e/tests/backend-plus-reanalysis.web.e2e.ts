import { createHash, randomUUID } from 'node:crypto';
import { test, expect, admin } from '../backend-fixtures';

// Admission and completion use the real service-only RPCs, with synthetic
// analysis output. No worker/provider is dispatched; UI recovery covers those.
test('Plus reanalysis keeps ownership, idempotency, Free and daily quota boundaries', {
  tags: ['plus-reanalysis'], timeout: 90_000,
}, async ({ accounts }) => {
  const seedAnalyzed = async (userId: string, transcript: string) => {
    const result = await admin.from('dreams').insert({
      user_id: userId, title: 'Reanalysis admission fixture', transcript,
      interpretation: 'The previous reading remains available.', shareable_quote: '',
      dream_type: 'Everyday Dream', theme: 'calm', client_request_id: randomUUID(),
      analysis_request_id: randomUUID(), analysis_status: 'done', is_analyzed: true,
      analyzed_at: new Date().toISOString(),
    }).select('id').single();
    expect(result.error).toBeNull();
    return result.data!.id as number;
  };
  const admit = async (userId: string, dreamId: number, requestId: string, maxCreatedInWindow = 100) => {
    const result = await admin.rpc('admit_authenticated_analysis_job', {
      p_job_id: randomUUID(), p_user_id: userId, p_dream_id: dreamId,
      p_analysis_request_id: requestId, p_lang: 'en', p_replace_existing_image: false,
      p_max_attempts: 3, p_max_active_per_actor: 10, p_window_seconds: 600,
      p_max_created_in_window: maxCreatedInWindow, p_max_global_active: 1000,
    });
    expect(result.error).toBeNull();
    return result.data;
  };
  const usage = async (userId: string) => {
    const result = await admin.from('quota_usage').select('id,metadata')
      .eq('user_id', userId).eq('quota_type', 'analysis').order('id');
    expect(result.error).toBeNull();
    return result.data!;
  };
  const jobs = async (userId: string) => {
    const result = await admin.from('ai_jobs').select('id,client_request_id')
      .eq('user_id', userId).eq('job_type', 'analyze_dream');
    expect(result.error).toBeNull();
    return result.data!;
  };
  const failTerminally = async (jobId: string) => {
    const result = await admin.from('ai_jobs').update({
      status: 'failed', attempt_count: 3, error_code: 'LOCAL_PROVIDER_FAILURE',
    }).eq('id', jobId);
    expect(result.error).toBeNull();
  };
  const complete = async (jobId: string) => {
    const result = await admin.rpc('complete_authenticated_analysis_job', {
      p_job_id: jobId,
      p_analysis_result: {
        title: 'The lighthouse and its blue door', interpretation: 'A synthetic completed reading.',
        shareableQuote: '', theme: 'calm', dreamType: 'Everyday Dream',
        imagePrompt: 'A lighthouse with a blue door', symbols: [], emotions: [], reflectionQuestions: [],
      },
      p_image_job_id: randomUUID(), p_image_max_attempts: 3, p_image_max_active_per_actor: 10,
      p_image_window_seconds: 600, p_image_max_created_in_window: 100, p_max_global_active: 1000,
    });
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ completed: true, job: { id: jobId, status: 'succeeded' } });
    expect(result.data.image_job).toBeNull();
    return result.data;
  };
  const start = async (jobId: string, attempt: number) => {
    const result = await admin.from('ai_jobs').update({ status: 'running', attempt_count: attempt })
      .eq('id', jobId).eq('status', 'queued').select('id').single();
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(jobId);
  };

  const transcript = 'The lighthouse has a new blue door in the revised dream.';
  const plusDream = await seedAnalyzed(accounts.plus.id, transcript);
  const requestId = randomUUID();
  const foreignUsageBefore = await usage(accounts.other.id);
  expect(await admit(accounts.other.id, plusDream, randomUUID())).toMatchObject({
    allowed: false, code: 'DREAM_NOT_FOUND',
  });
  expect(await jobs(accounts.other.id)).toHaveLength(0);
  expect(await usage(accounts.other.id)).toEqual(foreignUsageBefore);

  const freeDream = await seedAnalyzed(accounts.free.id, transcript);
  const freeUsageBefore = await usage(accounts.free.id);
  expect(await admit(accounts.free.id, freeDream, randomUUID())).toMatchObject({
    allowed: false, code: 'ANALYSIS_ALREADY_COMPLETE',
  });
  expect(await jobs(accounts.free.id)).toHaveLength(0);
  expect(await usage(accounts.free.id)).toEqual(freeUsageBefore);

  const plusUsageBefore = await usage(accounts.plus.id);
  const admitted = await admit(accounts.plus.id, plusDream, requestId);
  expect(admitted).toMatchObject({
    allowed: true, job: {
      dream_id: plusDream, client_request_id: requestId, job_type: 'analyze_dream',
      request_payload: { transcript_sha256: createHash('sha256').update(transcript).digest('hex') },
    },
  });
  const repeated = await admit(accounts.plus.id, plusDream, requestId);
  expect(repeated).toMatchObject({ allowed: true, duplicate: true, job: { id: admitted.job.id } });
  expect(await jobs(accounts.plus.id)).toHaveLength(1);
  const initialReceipts = (await usage(accounts.plus.id)).filter(row => row.metadata?.analysis_request_id === requestId);
  expect(initialReceipts).toHaveLength(1);
  expect(initialReceipts[0].metadata.transcript_sha256).toBe(createHash('sha256').update(transcript).digest('hex'));
  const dream = await admin.from('dreams').select('is_analyzed,interpretation,analysis_status').eq('id', plusDream).single();
  expect(dream.error).toBeNull();
  expect(dream.data).toMatchObject({
    is_analyzed: false, interpretation: 'The previous reading remains available.', analysis_status: 'pending',
  });
  // A transient failure requeues the same job and keeps its exact reservation.
  const reservedUsage = await usage(accounts.plus.id);
  await start(admitted.job.id, 1);
  const requeued = await admin.from('ai_jobs').update({ status: 'queued', error_code: 'ANALYSIS_TRANSIENT' })
    .eq('id', admitted.job.id).eq('status', 'running').select('id,status,attempt_count').single();
  expect(requeued.error).toBeNull();
  expect(requeued.data).toMatchObject({ id: admitted.job.id, status: 'queued', attempt_count: 1 });
  expect(await usage(accounts.plus.id)).toEqual(reservedUsage);
  expect(await admit(accounts.plus.id, plusDream, requestId)).toMatchObject({
    allowed: true, duplicate: true, job: { id: admitted.job.id, status: 'queued', attempt_count: 1 },
  });
  await start(admitted.job.id, 3);
  await failTerminally(admitted.job.id);
  expect(await usage(accounts.plus.id)).toEqual(plusUsageBefore);
  const failedDream = await admin.from('dreams').select('analysis_status,interpretation')
    .eq('id', plusDream).single();
  expect(failedDream.error).toBeNull();
  expect(failedDream.data).toMatchObject({ analysis_status: 'failed', interpretation: 'The previous reading remains available.' });
  expect(await admit(accounts.plus.id, plusDream, requestId)).toMatchObject({
    allowed: true, duplicate: true, job: { id: admitted.job.id, status: 'failed' },
  });
  expect(await usage(accounts.plus.id)).toEqual(plusUsageBefore);
  expect(await jobs(accounts.plus.id)).toHaveLength(1);

  // Refunding user quota never erases a failed admission from the abuse budget.
  expect(await admit(accounts.plus.id, plusDream, randomUUID(), 1)).toMatchObject({
    allowed: false, code: 'AI_ACTOR_RATE_LIMIT',
  });
  expect(await jobs(accounts.plus.id)).toHaveLength(1);
  expect(await usage(accounts.plus.id)).toEqual(plusUsageBefore);

  // Ten successful completions, rather than failed fixtures, spend the daily quota.
  let firstSuccess: { jobId: string; requestId: string; dreamId: number } | undefined;
  for (let index = 1; index <= 10; index += 1) {
    const dreamId = await seedAnalyzed(accounts.plus.id, `${transcript} Success ${index}.`);
    const successRequestId = randomUUID();
    const next = await admit(accounts.plus.id, dreamId, successRequestId);
    expect(next).toMatchObject({ allowed: true });
    const successReservation = await usage(accounts.plus.id);
    if (index === 1) {
      firstSuccess = { jobId: next.job.id, requestId: successRequestId, dreamId };
      // Repeating the old failure must not refund this different live reservation.
      await failTerminally(admitted.job.id);
      expect(await usage(accounts.plus.id)).toEqual(successReservation);
    }
    await start(next.job.id, 1);
    await complete(next.job.id);
    expect(await usage(accounts.plus.id)).toEqual(successReservation);
    const saved = await admin.from('dreams').select('is_analyzed,analysis_status,interpretation').eq('id', dreamId).single();
    expect(saved.error).toBeNull();
    expect(saved.data).toMatchObject({ is_analyzed: true, analysis_status: 'done', interpretation: 'A synthetic completed reading.' });
    expect((await usage(accounts.plus.id)).filter(row => typeof row.metadata?.analysis_request_id === 'string')).toHaveLength(index);
  }
  expect((await usage(accounts.plus.id)).filter(row => typeof row.metadata?.analysis_request_id === 'string')).toHaveLength(10);
  const cappedDream = await seedAnalyzed(accounts.plus.id, `${transcript} Attempt eleven.`);
  const receiptsBeforeLimit = await usage(accounts.plus.id);
  expect(await admit(accounts.plus.id, cappedDream, randomUUID())).toMatchObject({
    allowed: false, code: 'DAILY_ANALYSIS_LIMIT', daily_limit: 10, claimed: false,
  });
  expect(await jobs(accounts.plus.id)).toHaveLength(11);
  expect(await usage(accounts.plus.id)).toEqual(receiptsBeforeLimit);
  // Both admission and completion remain idempotent at the daily ceiling.
  expect(firstSuccess).toBeDefined();
  expect(await admit(accounts.plus.id, firstSuccess!.dreamId, firstSuccess!.requestId)).toMatchObject({
    allowed: true, duplicate: true, job: { id: firstSuccess!.jobId, status: 'succeeded' },
  });
  expect(await complete(firstSuccess!.jobId)).toMatchObject({ duplicate: true });
  expect(await usage(accounts.plus.id)).toEqual(receiptsBeforeLimit);
  expect(await jobs(accounts.plus.id)).toHaveLength(11);
});
