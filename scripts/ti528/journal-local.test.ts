import { describe, it, expect, jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { Client } = require('pg');
const { readLocalStatus } = require('./local-config.cjs');

// Opt-in only: ordinary CI never connects to a database or reads local credentials.
const realFetch = jest.requireActual('node-fetch');
const local = process.env.TI528_LOCAL_STATUS;
const suite = local ? describe : describe.skip;
const holder = { client: null as any };
let failNextPage = false;
const transport: typeof fetch = (input, init) => {
  if (failNextPage && String(input).includes('/rest/v1/dreams')) { failNextPage = false; return Promise.reject(new Error('TI528 injected transport failure')); }
  return realFetch(input, init);
};
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, get supabase() { return holder.client; } }));
jest.mock('@/services/dreamMediaService', () => ({ invalidateDreamMedia: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ SaveFormat: { WEBP: 'webp' } }));

suite('TI528 real local Supabase qualification', () => {
  it('qualifies production pagination contracts, ownership, replay and historical migration guards', async () => {
    const status = readLocalStatus(local);
    const db = new Client({ connectionString: status.DB_URL });
    await db.connect();
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false } });
    const clients: any[] = [];
    const users: string[] = [];
    try {
      for (let i = 0; i < 2; i++) {
        const email = `ti528-test-${randomUUID()}@example.test`, password = randomUUID();
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        expect(created.error).toBeNull(); users.push(created.data.user!.id);
        const client = createClient(status.API_URL, status.ANON_KEY, { global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false } });
        expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull(); clients.push(client);
      }
      holder.client = clients[0];
      const { fetchDreamListPage, fetchDreamFullPage, iterateDreamPages, fetchDreamFromSupabase } = jest.requireActual('@/services/supabaseDreamService') as typeof import('@/services/supabaseDreamService');
      for (const size of [0, 1, 1000, 1001, 2501]) {
        await db.query('delete from public.dreams where user_id=$1', [users[0]]);
        await db.query(`insert into public.dreams(user_id,transcript,title,interpretation,shareable_quote,dream_type,created_at,client_request_id)
          select $1, 'synthetic '||n, 'fixture '||n, '', '', 'Symbolic Dream', '2026-01-01'::timestamptz, gen_random_uuid() from generate_series(1,$2::integer) n`, [users[0], size]);
        const ids: number[] = []; let finished = false;
        for await (const page of iterateDreamPages(users[0], { pageSize: 1000 })) { ids.push(...page.items.map(d => d.remoteId!)); finished = page.complete; }
        expect(finished).toBe(true); expect(ids.length).toBe(size); expect(new Set(ids).size).toBe(size);
      }
      // Deliberately lower the real PostgREST cap below requested page size.
      await db.query("alter role authenticator set pgrst.db_max_rows = '137'");
      await db.query("notify pgrst, 'reload config'");
      // Reload is asynchronous; probe until the actual HTTP endpoint confirms the cap.
      let capped = 0;
      for (let i = 0; i < 30; i++) {
        const result = await clients[0].from('dreams').select('id').limit(1000); capped = result.data?.length ?? 0;
        if (capped === 137) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(capped).toBe(137);
      const first = await fetchDreamListPage(users[0], { pageSize: 1000 });
      expect(first.items).toHaveLength(137); expect(first.complete).toBe(false);
      const newest = first.items[0].remoteId!;
      const added = await clients[0].from('dreams').insert({ user_id: users[0], transcript: 'added during traversal', title: '', interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream' }).select('id').single();
      expect(added.error).toBeNull();
      const deleted = await clients[0].from('dreams').delete().eq('id', newest - 150); expect(deleted.error).toBeNull();
      failNextPage = true;
      await expect(fetchDreamFullPage(users[0], { cursor: first.nextCursor })).rejects.toMatchObject({ cursor: first.nextCursor });
      // Resume the same acknowledged cursor after the real HTTP transport recovers.
      const resumed: number[] = first.items.map(d => d.remoteId!);
      for await (const page of iterateDreamPages(users[0], { cursor: first.nextCursor, pageSize: 1000 })) resumed.push(...page.items.map(d => d.remoteId!));
      expect(resumed).toHaveLength(2500); expect(new Set(resumed).size).toBe(2500); expect(resumed).not.toContain(added.data!.id);
      const detail = await fetchDreamFromSupabase(newest, users[0]); expect(detail.transcript).toBe('synthetic 2501');
      holder.client = clients[1];
      await expect(fetchDreamFullPage(users[1], { cursor: first.nextCursor })).rejects.toThrow();
      const foreign = await clients[1].from('dreams').select('id').eq('user_id', users[0]); expect(foreign.error).toBeNull(); expect(foreign.data).toEqual([]);
      await expect(fetchDreamFromSupabase(newest, users[1])).rejects.toThrow();
      const foreignInsert = await clients[1].from('dreams').insert({ user_id: users[0], transcript: 'forbidden', title: '', interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream' });
      expect(foreignInsert.error).not.toBeNull();
      const foreignUpdate = await clients[1].from('dreams').update({ title: 'forbidden' }).eq('id', newest).select('id');
      expect(foreignUpdate.data).toEqual([]);
      const foreignDelete = await clients[1].from('dreams').delete().eq('id', newest).select('id');
      expect(foreignDelete.data).toEqual([]);
      const reassignment = await clients[0].from('dreams').update({ user_id: users[1] }).eq('id', newest);
      expect(reassignment.error).not.toBeNull();
      const intact = await clients[0].from('dreams').select('user_id,title').eq('id', newest).single();
      expect(intact.error).toBeNull(); expect(intact.data.user_id).toBe(users[0]); expect(intact.data.title).toBe(detail.title);

      holder.client = clients[0];
      const mutation = { mutation_id: 'ti528', client_request_id: randomUUID(), entity_key: `remote:${newest}`, operation: 'update', base_revision: detail.revisionId, payload: { remote_id: newest, title: 'updated by synthetic replay' } };
      const replay1 = await clients[0].rpc('sync_dream_mutations', { mutations: [mutation] });
      expect(replay1.error).toBeNull();
      const replay2 = await clients[0].rpc('sync_dream_mutations', { mutations: [mutation] }); expect(replay2.error).toBeNull(); expect(replay2.data).toEqual(replay1.data);
      const after = await fetchDreamFromSupabase(newest, users[0]); expect(after.title).toBe('updated by synthetic replay'); expect(after.revisionId).not.toBe(detail.revisionId);
      // Bucket provisioning is infrastructure, absent from migration history. Explicit local fixture.
      const existingBucket = await admin.storage.getBucket('dream-images');
      if (!existingBucket.data) expect((await admin.storage.createBucket('dream-images', { public: false })).error).toBeNull();
      const storage = clients[0].storage.from('dream-images'); const object = `${users[0]}/ti528-${randomUUID()}.png`;
      expect((await storage.upload(object, Buffer.from('synthetic fixture'), { contentType: 'image/png' })).error).toBeNull();
      expect((await storage.createSignedUrl(object, 60)).error).toBeNull();
      expect((await clients[1].storage.from('dream-images').createSignedUrl(object, 60)).error).not.toBeNull();
      await storage.remove([object]);
      const jobs = await clients[0].from('ai_jobs').select('id'); expect(jobs.error).not.toBeNull();
      const receipts = await clients[0].from('dream_sync_receipts').select('id'); expect(receipts.error).not.toBeNull();
      const tombstone = { ...mutation, client_request_id: randomUUID(), operation: 'delete', base_revision: after.revisionId };
      const removal = await clients[0].rpc('sync_dream_mutations', { mutations: [tombstone] }); expect(removal.error).toBeNull();
      const repeated = await clients[0].rpc('sync_dream_mutations', { mutations: [tombstone] }); expect(repeated.data).toEqual(removal.data);
      await expect(fetchDreamFromSupabase(newest, users[0])).rejects.toThrow();
      const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260723143132_remove_location_subsystem_from_noctalia.sql'), 'utf8');
      await db.query(migration); // all absent: valid no-op
      for (const setup of ['create table public.user_location (sentinel integer)', 'create view public.user_location as select 1 as sentinel', 'create function public.location_login() returns integer language sql as $$ select 1 $$']) {
        await db.query('begin'); await db.query(setup); await db.query('savepoint guard');
        await expect(db.query(migration)).rejects.toThrow('Location removal aborted');
        await db.query('rollback to savepoint guard');
        const present = setup.includes('function') ? await db.query("select count(*)::int n from pg_proc where proname='location_login'") : await db.query("select count(*)::int n from pg_class where relname='user_location'");
        expect(present.rows[0].n).toBe(1); await db.query('rollback');
      }
      console.log('TI528: real REST cap137; datasets0/1/1000/1001/2501; cursor/concurrent add/delete; JWT A/B; replay/revision; Storage A/B; migration guard passed.');
    } finally {
      await db.query('alter role authenticator reset pgrst.db_max_rows'); await db.query("notify pgrst, 'reload config'");
      for (const id of users) await admin.auth.admin.deleteUser(id);
      await db.end();
    }
  }, 120000);
});
