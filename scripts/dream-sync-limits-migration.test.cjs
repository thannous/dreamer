'use strict';
/* global __dirname */
const { describe, it } = require('node:test');
const { expect } = require('expect');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migration = (name) =>
  fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', `${name}.sql`), 'utf8');
const writer = '00000000-0000-4000-8000-0000000000a1';
const busy = '00000000-0000-4000-8000-0000000000b2';
const uuid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const text = (length) => 'r'.repeat(length);

// Synthetic PostgreSQL run of the journal write limits: no hosted DB, no credentials.
describe('dream sync limits migration', () => {
  it('caps dream length and new dreams per day: sync refusals keep no receipt, deletes free no place, direct writes meet the same limits', { timeout: 30000 }, async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create role anon; create role authenticated; create role service_role;
        create schema auth;
        create table auth.users(id uuid primary key);
        create function auth.jwt() returns jsonb language sql as $$
          select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
        $$;
        create function auth.role() returns text language sql as $$ select auth.jwt() ->> 'role' $$;
        create function auth.uid() returns uuid language sql as $$ select (auth.jwt() ->> 'sub')::uuid $$;
        create function public.current_app_product() returns text language sql as $$ select 'legacy' $$;
        create table public.dreams(
          id bigint generated always as identity primary key,
          user_id uuid not null,
          client_request_id uuid not null,
          created_at timestamptz not null default now(),
          revision_id uuid not null default gen_random_uuid(),
          transcript text not null default '', title text default '', interpretation text default '',
          shareable_quote text default '', image_url text, chat_history jsonb default '[]', theme text,
          precise_theme text, dream_type text, is_favorite boolean default false,
          image_generation_failed boolean default false, is_analyzed boolean default false,
          analyzed_at timestamptz, analysis_status text, analysis_request_id uuid,
          exploration_started_at timestamptz, has_person boolean, has_animal boolean,
          memory jsonb default '{}', analysis_details jsonb, client_updated_at timestamptz,
          unique (user_id, client_request_id)
        );
        create table public.dream_sync_receipts(
          id bigint generated always as identity primary key,
          user_id uuid not null, client_request_id uuid not null, entity_type text not null,
          entity_key text not null, operation text not null, mutation_status text not null,
          dream_id bigint, response jsonb not null, unique (user_id, client_request_id)
        );
        create function public.serialize_dream_for_sync(dream_row public.dreams) returns jsonb
          language sql as $$ select jsonb_build_object('id', dream_row.id, 'transcript', dream_row.transcript) $$;
        insert into auth.users values ('${writer}'), ('${busy}');
      `);
      await db.exec(migration('20261021171000_limit_dream_sync_size_and_rate'));

      let caller = null;
      const claims = (value) => db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(value)]);
      const as = (user) => { caller = user; return claims({ role: 'authenticated', sub: user }); };
      // Fixtures are written by the service role, which the table guard does not hold.
      const asService = async (write) => {
        await claims({ role: 'service_role' });
        try { return await write(); } finally { await as(caller); }
      };
      const syncBatch = async (mutations) =>
        (await db.query('select public.sync_dream_mutations($1::jsonb) as result', [JSON.stringify(mutations)])).rows[0].result;
      const sync = async (mutation) => (await syncBatch([mutation]))[0];
      const create = (n, transcript, payload = {}) =>
        sync({ mutation_id: `m${n}`, client_request_id: uuid(n), operation: 'create', entity_key: `d${n}`, payload: { transcript, ...payload } });
      const update = (n, remoteId, payload) =>
        sync({ mutation_id: `m${n}`, client_request_id: uuid(n), operation: 'update', entity_key: `d${n}`, payload: { remote_id: remoteId, ...payload } });
      const receipts = async (n) =>
        (await db.query('select count(*)::integer as n from public.dream_sync_receipts where client_request_id = $1', [uuid(n)])).rows[0].n;
      const transcriptOf = async (id) =>
        (await db.query('select char_length(transcript) as n from public.dreams where id = $1', [id])).rows[0].n;
      const seed = (user, n, length, age) => asService(async () =>
        (await db.query(`insert into public.dreams(user_id, client_request_id, transcript, created_at)
          values ($1, $2, $3, now() - $4::interval) returning id`, [user, uuid(n), text(length), age])).rows[0].id);
      // New dreams already counted for an account, `hours` hours before the current one.
      const bucket = (user, hours, count) => asService(() => db.query(`insert into public.dream_creation_buckets(user_id, hour_start, created_count)
        values ($1, date_trunc('hour', now()) - $2::interval, $3)`, [user, `${hours} hours`, count]));
      const counted = async (user) => (await db.query(
        'select coalesce(sum(created_count), 0)::integer as n from public.dream_creation_buckets where user_id = $1', [user])).rows[0].n;
      // A direct Data API write: the caller's own row, past sync_dream_mutations.
      const direct = (n, transcript, createdAt = null) => db.query(`insert into public.dreams(user_id, client_request_id, transcript, created_at)
        values ($1, $2, $3, coalesce($4::timestamptz, now())) returning id, created_at`, [caller, uuid(n), transcript, createdAt]);

      // Length: 20,000 characters pass, one more is refused without a receipt.
      await as(writer);
      const full = await create(1, text(20000));
      expect(full).toMatchObject({ status: 'ack' });
      const tooLong = await create(2, text(20001));
      expect(tooLong).toMatchObject({ status: 'failed', error: 'DREAM_TRANSCRIPT_TOO_LONG' });
      expect(await receipts(2)).toBe(0);
      expect((await create(2, text(100))).status).toBe('ack');

      expect(await update(3, full.remote_id, { transcript: text(20001) }))
        .toMatchObject({ status: 'failed', error: 'DREAM_TRANSCRIPT_TOO_LONG', remote_id: full.remote_id });
      expect(await receipts(3)).toBe(0);
      expect(await transcriptOf(full.remote_id)).toBe(20000);
      expect((await update(3, full.remote_id, { transcript: text(19000) })).status).toBe('ack');

      // A longer dream stored before the limit stays editable without growing.
      const legacy = await seed(writer, 4, 30000, '2 days');
      expect((await update(5, legacy, { title: 'renamed' })).status).toBe('ack');
      expect((await update(6, legacy, { transcript: text(29000) })).status).toBe('ack');
      expect((await update(7, legacy, { transcript: text(29001) })).error).toBe('DREAM_TRANSCRIPT_TOO_LONG');
      expect(await transcriptOf(legacy)).toBe(29000);
      // A create retried under a new mutation for that stored dream is not refused.
      expect((await sync({ mutation_id: 'm8', client_request_id: uuid(8), operation: 'create', entity_key: 'd4',
        payload: { client_request_id: uuid(4), transcript: text(29000) } })).status).toBe('ack');

      // Rate: 50 new dreams per rolling 24 hours, counted per hour; older hours do not count.
      for (let n = 100; n < 149; n += 1) await seed(busy, n, 10, '1 hour');
      const oldest = await seed(busy, 149, 10, '23 hours');
      await bucket(busy, 1, 49);
      await bucket(busy, 23, 1);
      await bucket(busy, 26, 5);
      await as(busy);
      const limited = await create(200, 'one more');
      expect(limited).toMatchObject({ status: 'failed', error: 'DAILY_DREAM_LIMIT' });
      expect(await receipts(200)).toBe(0);
      // Edits and a retried create of a stored dream are not new dreams.
      expect((await update(201, oldest, { title: 'still editable' })).status).toBe('ack');
      expect((await sync({ mutation_id: 'm202', client_request_id: uuid(202), operation: 'create', entity_key: 'd100',
        payload: { client_request_id: uuid(100), transcript: 'same dream' } })).status).toBe('ack');
      // In one batch, a refused create does not stop the mutations after it.
      const batch = await syncBatch([
        { mutation_id: 'm210', client_request_id: uuid(210), operation: 'create', entity_key: 'd210', payload: { transcript: 'over' } },
        { mutation_id: 'm211', client_request_id: uuid(211), operation: 'update', entity_key: 'd149', payload: { remote_id: oldest, title: 'kept' } },
      ]);
      expect(batch.map((entry) => entry.error ?? entry.status)).toEqual(['DAILY_DREAM_LIMIT', 'ack']);
      expect(await receipts(210)).toBe(0);
      expect(await receipts(211)).toBe(1);
      // Once the oldest hour of the window leaves it, the same mutation passes.
      await asService(() => db.query(`update public.dream_creation_buckets set hour_start = hour_start - interval '4 hours'
        where user_id = $1 and hour_start = date_trunc('hour', now()) - interval '23 hours'`, [busy]));
      const admitted = await create(200, 'one more');
      expect(admitted.status).toBe('ack');
      expect(await counted(busy)).toBe(56);
      expect((await create(203, 'and another')).error).toBe('DAILY_DREAM_LIMIT');
      // Deleting dreams, in the same batch or before, never frees a place.
      const deleted = await syncBatch([
        { mutation_id: 'm212', client_request_id: uuid(212), operation: 'delete', entity_key: 'd200', payload: { remote_id: admitted.remote_id } },
        { mutation_id: 'm213', client_request_id: uuid(213), operation: 'create', entity_key: 'd213', payload: { transcript: 'again' } },
      ]);
      expect(deleted.map((entry) => entry.error ?? entry.status)).toEqual(['ack', 'DAILY_DREAM_LIMIT']);
      await db.query('delete from public.dreams where id = $1', [oldest]);
      expect((await create(214, 'once more')).error).toBe('DAILY_DREAM_LIMIT');

      // A direct write past the sync function meets the same limits.
      await expect(direct(205, 'a script dream')).rejects.toMatchObject({ code: '23514', message: 'DAILY_DREAM_LIMIT' });
      // Nor can it age its dreams out of the window.
      await db.query(`update public.dreams set created_at = now() - interval '3 days' where user_id = $1`, [busy]);
      await expect(direct(205, 'a script dream')).rejects.toMatchObject({ message: 'DAILY_DREAM_LIMIT' });

      // The other account was never limited by this one.
      await as(writer);
      expect((await create(204, 'calm night')).status).toBe('ack');

      await expect(direct(206, text(20001))).rejects.toMatchObject({ code: '23514', message: 'DREAM_TRANSCRIPT_TOO_LONG' });
      // An old date does not take a direct write out of the day's count.
      const before = await counted(writer);
      const backdated = (await direct(207, 'an old date', '2000-01-01')).rows[0];
      expect(await counted(writer)).toBe(before + 1);
      await expect(db.query('update public.dreams set transcript = $1 where id = $2', [text(20001), backdated.id]))
        .rejects.toMatchObject({ message: 'DREAM_TRANSCRIPT_TOO_LONG' });
      await expect(db.query('update public.dreams set transcript = $1 where id = $2', [text(29001), legacy]))
        .rejects.toMatchObject({ message: 'DREAM_TRANSCRIPT_TOO_LONG' });
      await db.query('update public.dreams set transcript = $1 where id = $2', [text(28000), legacy]);
      expect(await transcriptOf(legacy)).toBe(28000);
      // The service role is not held, nor counted.
      expect(await asService(async () => (await db.query(
        `insert into public.dreams(user_id, client_request_id, transcript) values ($1, $2, $3) returning id`,
        [writer, uuid(208), text(25000)])).rows.length)).toBe(1);
      expect(await counted(writer)).toBe(before + 1);

      const privileges = await db.query(`select role,
        has_function_privilege(role, 'public.sync_dream_mutations(jsonb)', 'execute') as can_execute
        from (values ('anon'), ('authenticated'), ('service_role')) roles(role) order by role`);
      expect(privileges.rows).toEqual([
        { role: 'anon', can_execute: false },
        { role: 'authenticated', can_execute: true },
        { role: 'service_role', can_execute: true },
      ]);
      // No caller can read or rewrite the count of new dreams.
      const buckets = await db.query(`select role,
        has_table_privilege(role, 'public.dream_creation_buckets', 'select, insert, update, delete') as can_touch
        from (values ('anon'), ('authenticated'), ('service_role')) roles(role) order by role`);
      expect(buckets.rows.every((row) => row.can_touch === false)).toBe(true);
    } finally {
      await db.close();
    }
  });
});
