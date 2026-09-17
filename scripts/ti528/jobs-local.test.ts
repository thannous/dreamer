import { describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
const { Client } = require('pg');
const { readLocalStatus } = require('./local-config.cjs');
const local = process.env.TI528_LOCAL_STATUS;
const suite = local ? describe : describe.skip;
const transport = jest.requireActual('node-fetch') as typeof fetch;

suite('TI528 durable jobs and quota on isolated real database', () => {
  it('bounds concurrent guest claims and replay without double charging', async () => {
    const status = readLocalStatus(local);
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { global: { fetch: transport }, auth: { persistSession: false } });
    const db = new Client({ connectionString: status.DB_URL });
    const fingerprint = `ti528-${randomUUID()}`;
    await db.connect();
    try {
      for (const kind of ['analysis', 'chat']) {
        const requests = Array.from({ length: 7 }, () => randomUUID());
        const call = async (id: string) => {
          const result = await admin.rpc(kind === 'analysis' ? 'claim_guest_analysis_quota' : 'claim_guest_chat_message', kind === 'analysis'
            ? { p_fingerprint: fingerprint, p_analysis_request_id: id, p_limit: 3 }
            : { p_fingerprint: fingerprint, p_dream_key: 'synthetic', p_request_id: id, p_limit: 3 });
          expect(result.error).toBeNull(); return result.data;
        };
        const results = await Promise.all(requests.map(call));
        expect(results.filter(row => row.allowed)).toHaveLength(3);
        expect(results.filter(row => !row.allowed)).toHaveLength(4);
        const accepted = requests[results.findIndex(row => row.allowed)];
        const replays = await Promise.all(Array.from({ length: 5 }, () => call(accepted)));
        replays.forEach(row => expect(row).toMatchObject({ allowed: true, duplicate: true, claimed: false, new_count: 3 }));
      }
    } finally {
      await db.query('delete from public.guest_chat_quota_claims where fingerprint_hash=$1', [fingerprint]);
      await db.query('delete from public.guest_analysis_quota_claims where fingerprint_hash=$1', [fingerprint]);
      await db.query('delete from public.guest_usage where fingerprint_hash=$1', [fingerprint]);
      await db.end();
    }
  }, 120000);

  it('admits exactly one replayed job, preserves retry budget, denies client access and enforces monthly analysis quota', async () => {
    const status = readLocalStatus(local);
    const makeClient = (key: string) => createClient(status.API_URL, key, { global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false } });
    const admin = makeClient(status.SERVICE_ROLE_KEY);
    const anon = makeClient(status.ANON_KEY);
    const db = new Client({ connectionString: status.DB_URL });
    const deniedFingerprint = `ti528-denied-${randomUUID()}`;
    const users: string[] = [];
    const clients: SupabaseClient[] = [];
    await db.connect();
    try {
      for (let i = 0; i < 2; i++) {
        const email = `ti528-jobs-${randomUUID()}@example.test`, password = randomUUID();
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        expect(created.error).toBeNull(); users.push(created.data.user!.id);
        const client = makeClient(status.ANON_KEY);
        expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull(); clients.push(client);
      }
      const request = randomUUID();
      const params = { p_job_id: randomUUID(), p_user_id: users[0], p_guest_fingerprint: null, p_dream_id: null, p_job_type: 'generate_image', p_request_payload: { prompt: 'synthetic' }, p_client_request_id: request, p_max_attempts: 3, p_max_active_per_actor: 3, p_window_seconds: 600, p_max_created_in_window: 100, p_max_global_active: 10000 };
      for (const client of [anon, ...clients]) {
        expect((await client.rpc('admit_ai_job', params)).error?.code).toBe('42501');
      }
      const results = await Promise.all(Array.from({ length: 6 }, () => admin.rpc('admit_ai_job', { ...params, p_job_id: randomUUID() })));
      results.forEach(row => expect(row.error).toBeNull());
      expect(results.filter(row => !row.data.duplicate)).toHaveLength(1);
      expect(new Set(results.map(row => row.data.job.id)).size).toBe(1);
      const jobId = results[0].data.job.id;
      expect((await admin.rpc('admit_ai_job', { ...params, p_request_payload: { prompt: 'different' } })).data.code).toBe('AI_IDEMPOTENCY_KEY_REUSED');
      await db.query("update public.ai_jobs set status='failed', attempt_count=2, quota_claimed=true where id=$1", [jobId]);
      const retry = await admin.rpc('admit_ai_job', params);
      expect(retry.error).toBeNull(); expect(retry.data.job).toMatchObject({ id: jobId, status: 'queued', attempt_count: 2, quota_claimed: true });
      // Same conditional update as the worker: competing dispatches may spend
      // the remaining attempt only once. No provider or worker is invoked.
      const starts = await Promise.all(Array.from({ length: 5 }, () => admin.from('ai_jobs')
        .update({ status: 'running', attempt_count: 3, started_at: new Date().toISOString() })
        .eq('id', jobId).eq('status', 'queued').eq('attempt_count', 2).select('id')));
      starts.forEach(row => expect(row.error).toBeNull());
      expect(starts.reduce((count, row) => count + (row.data?.length ?? 0), 0)).toBe(1);
      // Historical clock and an uncommitted fixture keep this global sweeper
      // away from every existing qualification row and the live cron clock.
      await db.query('begin');
      try {
        const unrelated = await db.query("select count(*)::int n from public.ai_jobs where id<>$1 and status in ('queued','running') and coalesce(started_at,created_at)<='1990-01-01'::timestamptz - interval '10 minutes'", [jobId]);
        expect(unrelated.rows[0].n).toBe(0);
        await db.query("update public.ai_jobs set started_at='1989-12-31' where id=$1", [jobId]);
        await db.query('set local role service_role');
        expect((await db.query("select public.expire_abandoned_ai_jobs('1990-01-01','10 minutes',1) n")).rows[0].n).toBe(1);
        expect((await db.query('select status,error_code,attempt_count,request_payload from public.ai_jobs where id=$1', [jobId])).rows[0]).toMatchObject({ status: 'failed', error_code: 'AI_JOB_LEASE_EXPIRED', attempt_count: 3, request_payload: { redacted: true } });
        expect((await db.query("select public.expire_abandoned_ai_jobs('1990-01-01','10 minutes',1) n")).rows[0].n).toBe(0);
      } finally { await db.query('rollback'); }
      for (const client of [anon, ...clients]) {
        expect((await client.from('ai_jobs').select('id,result_payload').eq('id', jobId)).error?.code).toBe('42501');
        expect((await client.from('ai_jobs').delete().eq('id', jobId)).error?.code).toBe('42501');
      }
      const actorAdmissions = await Promise.all(Array.from({ length: 6 }, () => admin.rpc('admit_ai_job', { ...params, p_job_id: randomUUID(), p_client_request_id: randomUUID() })));
      actorAdmissions.forEach(row => expect(row.error).toBeNull());
      expect(actorAdmissions.filter(row => row.data.allowed)).toHaveLength(2); // one running fixture already occupies a slot
      expect(actorAdmissions.filter(row => row.data.code === 'AI_ACTOR_CONCURRENCY_LIMIT')).toHaveLength(4);
      const quota = await db.query("select quota_limit from public.quota_limits where tier='free' and period='monthly' and quota_type='analysis'");
      const limit = Number(quota.rows[0].quota_limit); expect(limit).toBeGreaterThan(0); expect(limit).toBeLessThan(8);
      const dreams = await db.query(`insert into public.dreams(user_id,transcript,title,interpretation,shareable_quote,dream_type) select $1,'synthetic','','','','Symbolic Dream' from generate_series(1,$2::integer) returning id`, [users[0], limit + 2]);
      // Current policy is account ownership, not an app boundary. Spoofing
      // client metadata must not be presented as obtaining a trusted app scope.
      const ownBefore = await clients[0].from('dreams').select('id').eq('id', dreams.rows[0].id);
      expect(ownBefore.error).toBeNull(); expect(ownBefore.data).toHaveLength(1);
      expect((await clients[0].auth.updateUser({ data: { appId: 'lucid', app_id: 'meditation' } })).error).toBeNull();
      const ownAfter = await clients[0].from('dreams').select('id').eq('id', dreams.rows[0].id);
      expect(ownAfter.error).toBeNull(); expect(ownAfter.data).toEqual(ownBefore.data);
      const foreignAfter = await clients[1].from('dreams').select('id').eq('id', dreams.rows[0].id);
      expect(foreignAfter.error).toBeNull(); expect(foreignAfter.data).toEqual([]);
      const analysisParams = (dreams.rows as { id: number }[]).map((row: { id: number }) => ({ p_job_id: randomUUID(), p_user_id: users[0], p_dream_id: row.id, p_analysis_request_id: randomUUID(), p_lang: 'en', p_replace_existing_image: false, p_max_attempts: 3, p_max_active_per_actor: 10, p_window_seconds: 600, p_max_created_in_window: 100, p_max_global_active: 10000 }));
      for (const client of [anon, ...clients]) {
        expect((await client.rpc('admit_authenticated_analysis_job', analysisParams[0])).error?.code).toBe('42501');
        expect((await client.rpc('claim_guest_chat_message', { p_fingerprint: deniedFingerprint, p_dream_key: 'synthetic', p_request_id: randomUUID(), p_limit: 3 })).error?.code).toBe('42501');
        expect((await client.rpc('claim_guest_analysis_quota', { p_fingerprint: deniedFingerprint, p_analysis_request_id: randomUUID(), p_limit: 3 })).error?.code).toBe('42501');
      }
      const admissions = await Promise.all(analysisParams.map(p => admin.rpc('admit_authenticated_analysis_job', p)));
      admissions.forEach(row => expect(row.error).toBeNull());
      expect(admissions.filter(row => row.data.allowed)).toHaveLength(limit);
      expect(admissions.filter(row => row.data.code === 'QUOTA_EXCEEDED')).toHaveLength(2);
      const accepted = admissions.findIndex(row => row.data.allowed);
      const replay = await admin.rpc('admit_authenticated_analysis_job', analysisParams[accepted]);
      expect(replay.error).toBeNull(); expect(replay.data).toMatchObject({ allowed: true, duplicate: true });
      expect((await db.query("select count(*)::int n from public.quota_usage where user_id=$1 and quota_type='analysis'", [users[0]])).rows[0].n).toBe(limit);
      const foreign = await admin.rpc('admit_authenticated_analysis_job', { ...analysisParams[0], p_job_id: randomUUID(), p_user_id: users[1], p_analysis_request_id: randomUUID() });
      expect(foreign.error).toBeNull(); expect(foreign.data).toMatchObject({ allowed: false, code: 'DREAM_NOT_FOUND' });
    } finally {
      await db.query('delete from public.guest_chat_quota_claims where fingerprint_hash=$1', [deniedFingerprint]);
      await db.query('delete from public.guest_analysis_quota_claims where fingerprint_hash=$1', [deniedFingerprint]);
      await db.query('delete from public.guest_usage where fingerprint_hash=$1', [deniedFingerprint]);
      for (const id of users) expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
      await db.end();
    }
  }, 120000);
});
