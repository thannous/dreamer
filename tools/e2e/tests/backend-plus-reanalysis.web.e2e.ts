import { createHash, randomUUID } from 'node:crypto';
import { test, expect, admin } from '../backend-fixtures';

// Admission through the real service-only RPC. No worker or paid provider is
// dispatched; the separate UI recovery journey covers execution and restart.
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
  const admit = async (userId: string, dreamId: number, requestId: string) => {
    const result = await admin.rpc('admit_authenticated_analysis_job', {
      p_job_id: randomUUID(), p_user_id: userId, p_dream_id: dreamId,
      p_analysis_request_id: requestId, p_lang: 'en', p_replace_existing_image: false,
      p_max_attempts: 3, p_max_active_per_actor: 10, p_window_seconds: 600,
      p_max_created_in_window: 100, p_max_global_active: 1000,
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
  const releaseAdmissionSlot = async (jobId: string) => {
    // A failed admitted job still spends its daily receipt. Release concurrency
    // without pretending a provider ran or an analysis succeeded.
    const result = await admin.from('ai_jobs').update({
      status: 'failed', error_code: 'LOCAL_ADMISSION_TEST_FINISHED',
    }).eq('id', jobId);
    expect(result.error).toBeNull();
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
  await releaseAdmissionSlot(admitted.job.id);

  // Nine more fresh receipts reach the unchanged rolling-24h ceiling of ten.
  for (let index = 2; index <= 10; index += 1) {
    const dreamId = await seedAnalyzed(accounts.plus.id, `${transcript} Attempt ${index}.`);
    const next = await admit(accounts.plus.id, dreamId, randomUUID());
    expect(next).toMatchObject({ allowed: true });
    await releaseAdmissionSlot(next.job.id);
  }
  expect((await usage(accounts.plus.id)).filter(row => typeof row.metadata?.analysis_request_id === 'string')).toHaveLength(10);
  const cappedDream = await seedAnalyzed(accounts.plus.id, `${transcript} Attempt eleven.`);
  const receiptsBeforeLimit = await usage(accounts.plus.id);
  expect(await admit(accounts.plus.id, cappedDream, randomUUID())).toMatchObject({
    allowed: false, code: 'DAILY_ANALYSIS_LIMIT', daily_limit: 10, claimed: false,
  });
  expect(await jobs(accounts.plus.id)).toHaveLength(10);
  expect(await usage(accounts.plus.id)).toEqual(receiptsBeforeLimit);
  // A repeat remains the same admitted job even when the daily ceiling is full.
  expect(await admit(accounts.plus.id, plusDream, requestId)).toMatchObject({
    allowed: true, duplicate: true, job: { id: admitted.job.id },
  });
});
