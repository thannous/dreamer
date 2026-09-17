import { describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const { Client } = require('pg');
const { readLocalStatus } = require('./local-config.cjs');
const local = process.env.TI528_LOCAL_STATUS;
const suite = local ? describe : describe.skip;
const transport = jest.requireActual('node-fetch') as typeof fetch;

suite('TI528 local lease recovery', () => {
  it('recovers authenticated chat attempts and rejects late completion without double messages', async () => {
    const status = readLocalStatus(local);
    const options = { global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
    const owner = createClient(status.API_URL, status.ANON_KEY, options);
    const other = createClient(status.API_URL, status.ANON_KEY, options);
    const anon = createClient(status.API_URL, status.ANON_KEY, options);
    const db = new Client({ connectionString: status.DB_URL });
    const users: string[] = [];
    await db.connect();
    try {
      for (const client of [owner, other]) {
        const email = `ti528-chat-${randomUUID()}@example.test`, password = randomUUID();
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        expect(created.error).toBeNull(); users.push(created.data.user!.id);
        expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
      }
      const dream = await db.query("insert into public.dreams(user_id,transcript,title,interpretation,shareable_quote,dream_type) values($1,'synthetic','','','','Symbolic Dream') returning id", [users[0]]);
      const id = dream.rows[0].id;
      const request = randomUUID();
      const params = { p_dream_id: id, p_request_id: request, p_user_message: { role: 'user', text: 'Synthetic question' } };
      expect((await anon.rpc('begin_authenticated_chat_turn', params)).error?.code).toBe('42501');
      const foreign = await other.rpc('begin_authenticated_chat_turn', params);
      expect(foreign.error).toBeNull(); expect(foreign.data).toMatchObject({ allowed: false, code: 'DREAM_NOT_FOUND' });
      const admissions = await Promise.all(Array.from({ length: 5 }, () => owner.rpc('begin_authenticated_chat_turn', params)));
      admissions.forEach(row => expect(row.error).toBeNull());
      expect(admissions.filter(row => row.data.allowed)).toHaveLength(1);
      expect(admissions.filter(row => row.data.code === 'CHAT_TURN_IN_PROGRESS')).toHaveLength(4);
      expect(admissions.find(row => row.data.allowed)!.data.attemptCount).toBe(1);
      await db.query("update public.dream_chat_turns set updated_at=now()-interval '4 minutes' where dream_id=$1 and request_id=$2", [id, request]);
      const recovery = await owner.rpc('begin_authenticated_chat_turn', params);
      expect(recovery.error).toBeNull(); expect(recovery.data).toMatchObject({ allowed: true, completed: false, attemptCount: 2 });
      const completion = { p_dream_id: id, p_request_id: request, p_attempt_count: 1, p_model_message: { role: 'model', text: 'Synthetic response' } };
      const late = await owner.rpc('complete_authenticated_chat_turn', completion);
      expect(late.error).toBeNull(); expect(late.data).toMatchObject({ completed: false, code: 'CHAT_TURN_LEASE_LOST' });
      const lateFailure = await owner.rpc('fail_authenticated_chat_turn', { p_dream_id: id, p_request_id: request, p_attempt_count: 1, p_error_code: 'SYNTHETIC_LATE' });
      expect(lateFailure.error).toBeNull(); expect(lateFailure.data).toBe(false);
      const foreignComplete = await other.rpc('complete_authenticated_chat_turn', { ...completion, p_attempt_count: 2 });
      expect(foreignComplete.error).toBeNull(); expect(foreignComplete.data).toMatchObject({ completed: false, code: 'CHAT_TURN_NOT_FOUND' });
      const completions = await Promise.all(Array.from({ length: 4 }, () => owner.rpc('complete_authenticated_chat_turn', { ...completion, p_attempt_count: 2 })));
      completions.forEach(row => { expect(row.error).toBeNull(); expect(row.data.completed).toBe(true); });
      expect(completions.filter(row => !row.data.duplicate)).toHaveLength(1);
      const replay = await owner.rpc('begin_authenticated_chat_turn', params);
      expect(replay.error).toBeNull(); expect(replay.data).toMatchObject({ allowed: true, completed: true, duplicate: true });
      expect((await db.query('select role,count(*)::int n from public.dream_chat_messages where dream_id=$1 group by role order by role', [id])).rows).toEqual([{ role: 'model', n: 1 }, { role: 'user', n: 1 }]);
    } finally {
      for (const id of users) expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
      await db.end();
    }
  }, 120000);

  it('skips a locked guest job and refunds each expired image claim exactly once', async () => {
    const status = readLocalStatus(local);
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { global: { fetch: transport }, auth: { persistSession: false } });
    const db = new Client({ connectionString: status.DB_URL });
    const locker = new Client({ connectionString: status.DB_URL });
    const fingerprints = [randomUUID(), randomUUID()].map(id => `ti528-lease-${id}`);
    const jobIds = [randomUUID(), randomUUID()];
    await db.connect(); await locker.connect();
    try {
      // This global RPC has no actor filter. Refuse to run if another test's
      // active row could be swept; no mutation of unrelated fixtures is allowed.
      expect((await db.query("select count(*)::int n from public.ai_jobs where status in ('queued','running')")).rows[0].n).toBe(0);
      for (let i = 0; i < 2; i++) {
        await db.query('insert into public.guest_usage(fingerprint_hash,image_count) values($1,1)', [fingerprints[i]]);
        // Future timestamps are invisible to the live cron lease cutoff.
        await db.query("insert into public.ai_jobs(id,guest_fingerprint,job_type,status,request_payload,client_request_id,quota_claimed,quota_claimed_at,created_at,started_at) values($1,$2,'generate_image','running','{\"prompt\":\"synthetic\"}', $3,true,'2100-01-01','2100-01-01','2100-01-01')", [jobIds[i], fingerprints[i], randomUUID()]);
      }
      await locker.query('begin');
      await locker.query('select id from public.ai_jobs where id=$1 for update', [jobIds[0]]);
      const sweep = async () => {
        const result = await admin.rpc('expire_abandoned_ai_jobs', { p_now: '2100-01-01T00:11:00Z', p_lease: '10 minutes', p_batch_size: 10 });
        expect(result.error).toBeNull(); return result.data;
      };
      expect((await Promise.all([sweep(), sweep()])).sort()).toEqual([0, 1]);
      expect(await sweep()).toBe(0);
      expect((await db.query('select image_count from public.guest_usage where fingerprint_hash=$1', [fingerprints[1]])).rows[0].image_count).toBe(0);
      expect((await db.query('select image_count from public.guest_usage where fingerprint_hash=$1', [fingerprints[0]])).rows[0].image_count).toBe(1);
      await locker.query('rollback');
      expect(await sweep()).toBe(1);
      expect(await sweep()).toBe(0);
      const jobs = await db.query('select status,quota_claimed,request_payload from public.ai_jobs where id=any($1::uuid[])', [jobIds]);
      jobs.rows.forEach((row: unknown) => expect(row).toMatchObject({ status: 'failed', quota_claimed: false, request_payload: { redacted: true } }));
      expect((await db.query('select image_count from public.guest_usage where fingerprint_hash=any($1::text[])', [fingerprints])).rows).toEqual([{ image_count: 0 }, { image_count: 0 }]);
    } finally {
      await locker.query('rollback');
      await db.query('delete from public.ai_jobs where id=any($1::uuid[])', [jobIds]);
      await db.query('delete from public.guest_usage where fingerprint_hash=any($1::text[])', [fingerprints]);
      await locker.end(); await db.end();
    }
  }, 120000);
});
