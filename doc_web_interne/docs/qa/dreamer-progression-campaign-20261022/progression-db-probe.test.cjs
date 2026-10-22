'use strict';
/* global __dirname */
// QA campaign evidence (2026-10-22), not part of the test suites: synthetic in-process PostgreSQL (PGlite) run of the
// three progression migrations of candidate 271fd2b. No hosted DB, no credentials, no
// Supabase Auth/PostgREST: auth.uid()/role come from synthetic JWT claims, ordinary
// roles (authenticated/anon) are used for RLS, never a role that bypasses it.
const { describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

// Repository root, four levels up from doc_web_interne/docs/qa/<campaign>/.
const WT = process.env.QA_WORKTREE ?? path.resolve(__dirname, '../../../..');
const req = createRequire(path.join(WT, 'package.json'));
const { PGlite } = req('@electric-sql/pglite');
const { expect } = req('expect');

const migration = (name) => fs.readFileSync(path.join(WT, 'supabase', 'migrations', `${name}.sql`), 'utf8');
const LIMITS = '20261021171000_limit_dream_sync_size_and_rate';
const BADGES = '20261022170231_badge_ledger_continuity';
const NOTES = '20261022170242_dream_personal_notes';
const GUIDES = '20261022170346_guide_reading_progress';
const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';
const uuid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const noteId = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const note = (n, text = `qa note ${n}`, createdAt = 1_000 + n, updatedAt = createdAt) => ({ id: noteId(n), text, createdAt, updatedAt });

// The real product-scope function of 20260909010000, read from the tracked migration.
const productFunction = () => {
  const sql = migration('20260909010000_scope_oauth_product_access');
  const start = sql.indexOf('create or replace function public.current_app_product()');
  const end = sql.indexOf('grant execute on function public.current_app_product()', start);
  return sql.slice(start, sql.indexOf(';', end) + 1);
};

async function boot({ withNotes = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    create schema app_authorization_private;
    create table app_authorization_private.oauth_clients(client_id text primary key, product text not null);
    insert into app_authorization_private.oauth_clients values ('qa-journal', 'journal'), ('qa-lucid', 'lucid'), ('qa-other', 'meditation');
    create table public.dreams(
      id bigint generated always as identity primary key,
      user_id uuid not null references auth.users(id) on delete cascade,
      client_request_id uuid not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
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
    -- Each write gets a new revision, as the production trigger does.
    create function public.qa_bump_revision() returns trigger language plpgsql as $$
      begin new.revision_id := gen_random_uuid(); return new; end $$;
    create trigger qa_bump_revision before update on public.dreams for each row execute function public.qa_bump_revision();
    create table public.dream_sync_receipts(
      id bigint generated always as identity primary key,
      user_id uuid not null, client_request_id uuid not null, entity_type text not null,
      entity_key text not null, operation text not null, mutation_status text not null,
      dream_id bigint, response jsonb not null, unique (user_id, client_request_id)
    );
    -- Pre-notes serializer: it knows no personal_notes, as an older server.
    create function public.serialize_dream_for_sync(dream_row public.dreams) returns jsonb
      language sql as $$ select jsonb_build_object('id', dream_row.id, 'transcript', dream_row.transcript,
        'title', dream_row.title, 'revision_id', dream_row.revision_id) $$;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  await db.exec(productFunction());
  await db.exec(migration(LIMITS));
  if (withNotes) await applyProgression(db);
  return db;
}

async function applyProgression(db) {
  await db.exec(migration(BADGES));
  await db.exec(migration(NOTES));
  await db.exec(migration(GUIDES));
}

// An ordinary session: role authenticated (or anon) with the claims PostgREST would set.
function sessions(db) {
  const claims = (value) => db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(value)]);
  const as = async (role, value, run) => {
    await claims(value);
    await db.exec(`set role ${role}`);
    try { return await run(); } finally { await db.exec('reset role'); await claims({}); }
  };
  const user = (sub, extra = {}) => (run) => as('authenticated', { role: 'authenticated', sub, ...extra }, run);
  const anon = (run) => as('anon', { role: 'anon' }, run);
  const sync = async (mutations) =>
    (await db.query('select public.sync_dream_mutations($1::jsonb) as r', [JSON.stringify(mutations)])).rows[0].r;
  const one = async (mutation) => (await sync([mutation]))[0];
  const rowOf = async (id) => (await db.query('select * from public.dreams where id = $1', [id])).rows[0];
  const receipts = async (n) =>
    (await db.query('select count(*)::int as n from public.dream_sync_receipts where client_request_id = $1', [uuid(n)])).rows[0].n;
  return { user, anon, sync, one, rowOf, receipts };
}

const errorOf = async (run) => {
  try { await run(); return null; } catch (error) { return { code: error.code, message: error.message }; }
};

describe('QA progression probe on 271fd2b migrations (synthetic PGlite)', () => {
  it('Q03/N03-P2: a notes write acknowledged by a pre-migration server keeps its stale receipt after the migration', { timeout: 60000 }, async () => {
    const db = await boot({ withNotes: false });
    const { user, one, rowOf } = sessions(db);
    const write = { mutation_id: 'm1', client_request_id: uuid(1), operation: 'create', entity_key: 'd1',
      payload: { transcript: 'QA synthetic dream', personal_notes: [note(1)] } };
    const before = await user(A)(() => one(write));
    expect(before.status).toBe('ack');
    expect(before.dream.personal_notes).toBeUndefined(); // the client turns this into failed and keeps the mutation
    await applyProgression(db); // backend migrated afterwards
    const retry = await user(A)(() => one(write)); // same mutation, same client_request_id
    const stored = await rowOf(before.remote_id);
    console.log('[Q03] retry after migration:', JSON.stringify({ status: retry.status, notesInResponse: retry.dream?.personal_notes ?? null, storedNotes: stored.personal_notes }));
    // Codex P2 finding: the old receipt is replayed, the notes never reach the row.
    expect(retry).toEqual(before);
    expect(stored.personal_notes).toEqual([]);
    // A new receipt identity would persist them.
    const fresh = await user(A)(() => one({ ...write, mutation_id: 'm2', client_request_id: uuid(2),
      payload: { ...write.payload, client_request_id: uuid(1) } }));
    expect(fresh.status).toBe('ack');
    expect((await rowOf(before.remote_id)).personal_notes).toEqual([note(1)]);
  });

  it('N03: an older client omitting personal_notes preserves them; an empty array clears them; a retried create is not a duplicate', { timeout: 60000 }, async () => {
    const db = await boot();
    const { user, one, rowOf } = sessions(db);
    const created = await user(A)(() => one({ mutation_id: 'm1', client_request_id: uuid(1), operation: 'create', entity_key: 'd1',
      payload: { transcript: 'QA dream', personal_notes: [note(1), note(2)] } }));
    expect(created.status).toBe('ack');
    const id = created.remote_id;
    const legacyTitle = await user(A)(() => one({ mutation_id: 'm2', client_request_id: uuid(2), operation: 'update', entity_key: 'd1',
      payload: { remote_id: id, title: 'Renamed by old client' } }));
    expect(legacyTitle.status).toBe('ack');
    expect((await rowOf(id)).personal_notes).toEqual([note(1), note(2)]);
    // Retried create of the same dream (new receipt, same dream identity), without notes.
    const retried = await user(A)(() => one({ mutation_id: 'm3', client_request_id: uuid(3), operation: 'create', entity_key: 'd1',
      payload: { client_request_id: uuid(1), transcript: 'QA dream' } }));
    expect(retried).toMatchObject({ status: 'ack', remote_id: id });
    expect((await rowOf(id)).personal_notes).toEqual([note(1), note(2)]);
    expect((await db.query('select count(*)::int as n from public.dreams where user_id = $1', [A])).rows[0].n).toBe(1);
    // Same receipt replayed: same answer, no second write.
    expect(await user(A)(() => one({ mutation_id: 'm3', client_request_id: uuid(3), operation: 'create', entity_key: 'd1',
      payload: { client_request_id: uuid(1), transcript: 'QA dream' } }))).toEqual(retried);
    // An explicit empty array is a deletion of every note, distinct from an omitted field.
    const cleared = await user(A)(() => one({ mutation_id: 'm4', client_request_id: uuid(4), operation: 'update', entity_key: 'd1',
      payload: { remote_id: id, personal_notes: [] } }));
    expect(cleared.status).toBe('ack');
    expect((await rowOf(id)).personal_notes).toEqual([]);
  });

  it('N04 (server part): a stale revision gets an explicit conflict for edit and delete, nothing is overwritten or deleted', { timeout: 60000 }, async () => {
    const db = await boot();
    const { user, one, rowOf } = sessions(db);
    const created = await user(A)(() => one({ mutation_id: 'm1', client_request_id: uuid(1), operation: 'create', entity_key: 'd1',
      payload: { transcript: 'QA dream', personal_notes: [note(1)] } }));
    const id = created.remote_id;
    const base = (await rowOf(id)).revision_id;
    const first = await user(A)(() => one({ mutation_id: 'm2', client_request_id: uuid(2), operation: 'update', entity_key: 'd1',
      base_revision: base, payload: { remote_id: id, personal_notes: [note(1, 'edited on device 1', 1001, 2000)] } }));
    expect(first.status).toBe('ack');
    const second = await user(A)(() => one({ mutation_id: 'm3', client_request_id: uuid(3), operation: 'update', entity_key: 'd1',
      base_revision: base, payload: { remote_id: id, personal_notes: [note(1, 'edited on device 2', 1001, 2100)] } }));
    expect(second).toMatchObject({ status: 'conflict', error: 'Dream revision conflict' });
    const removal = await user(A)(() => one({ mutation_id: 'm4', client_request_id: uuid(4), operation: 'delete', entity_key: 'd1',
      base_revision: base, payload: { remote_id: id } }));
    expect(removal).toMatchObject({ status: 'conflict' });
    expect((await rowOf(id)).personal_notes).toEqual([note(1, 'edited on device 1', 1001, 2000)]);
  });

  it('Q01: note, badge and guide bounds refuse without truncating or overwriting', { timeout: 60000 }, async () => {
    const db = await boot();
    const { user, one, sync, rowOf, receipts } = sessions(db);
    const valid = async (notes) => (await db.query('select public.valid_dream_personal_notes($1::jsonb) as ok', [JSON.stringify(notes)])).rows[0].ok;
    expect(await valid([note(1, 'x'.repeat(4000))])).toBe(true);
    expect(await valid([note(1, 'x'.repeat(4001))])).toBe(false);
    expect(await valid(Array.from({ length: 50 }, (_, i) => note(i + 1)))).toBe(true);
    expect(await valid(Array.from({ length: 51 }, (_, i) => note(i + 1)))).toBe(false);
    expect(await valid([note(1), note(1)])).toBe(false);
    expect(await valid([note(1, '   ')])).toBe(false);
    expect(await valid([note(1, 'x', 2000, 1000)])).toBe(false);

    const fifty = Array.from({ length: 50 }, (_, i) => note(i + 1));
    const created = await user(A)(() => one({ mutation_id: 'm1', client_request_id: uuid(1), operation: 'create', entity_key: 'd1',
      payload: { transcript: 'QA dream', personal_notes: fifty } }));
    expect(created.status).toBe('ack');
    const id = created.remote_id;
    // At 50, an existing note stays editable.
    const edited = fifty.map((entry, i) => (i === 0 ? { ...entry, text: 'edited at fifty', updatedAt: entry.updatedAt + 1 } : entry));
    expect((await user(A)(() => one({ mutation_id: 'm2', client_request_id: uuid(2), operation: 'update', entity_key: 'd1',
      payload: { remote_id: id, personal_notes: edited } }))).status).toBe('ack');
    // 51 notes (a merge above 50) and a 4001-character note: refused, row unchanged, no receipt.
    const over = await errorOf(() => user(A)(() => one({ mutation_id: 'm3', client_request_id: uuid(3), operation: 'update', entity_key: 'd1',
      payload: { remote_id: id, personal_notes: [...edited, note(51)] } })));
    const long = await errorOf(() => user(A)(() => one({ mutation_id: 'm4', client_request_id: uuid(4), operation: 'update', entity_key: 'd1',
      payload: { remote_id: id, personal_notes: [{ ...edited[0], text: 'y'.repeat(4001) }, ...edited.slice(1)] } })));
    console.log('[Q01] 51 notes ->', JSON.stringify(over), '| 4001 chars ->', JSON.stringify(long));
    expect(over?.code).toBe('23514');
    expect(long?.code).toBe('23514');
    expect((await rowOf(id)).personal_notes).toEqual(edited);
    expect(await receipts(3)).toBe(0);
    expect(await receipts(4)).toBe(0);
    // The refusal is raised for the whole batch: a valid mutation sent in the same batch is not applied either.
    const batch = await errorOf(() => user(A)(() => sync([
      { mutation_id: 'm5', client_request_id: uuid(5), operation: 'update', entity_key: 'd1', payload: { remote_id: id, title: 'valid title' } },
      { mutation_id: 'm6', client_request_id: uuid(6), operation: 'update', entity_key: 'd1', payload: { remote_id: id, personal_notes: [...edited, note(51)] } },
    ])));
    console.log('[Q01] mixed batch ->', JSON.stringify(batch), '| title after:', (await rowOf(id)).title);
    expect(batch?.code).toBe('23514');
    expect(await receipts(5)).toBe(0);

    // Badge ledger bounds.
    const empty = { version: 1, keys: {}, best: {}, earned: {}, revealed: {} };
    const badge = (rev, ledger) => user(A)(() => db.query('select public.sync_badge_ledger($1, $2, $3::jsonb) as r', [A, rev, ledger === undefined ? null : JSON.stringify(ledger)]));
    const r0 = (await badge(null)).rows[0].r;
    const goodLedger = { ...empty, keys: { 'symbol-explorer': ['moon'] }, earned: { 'symbol-explorer': [1_700_000_000_000] }, revealed: { 'symbol-explorer': 1 } };
    const r1 = (await badge(r0.revision, goodLedger)).rows[0].r;
    expect(r1).toMatchObject({ accepted: true, revision: r0.revision + 1 });
    const refusals = {
      unknownFamily: await errorOf(() => badge(r1.revision, { ...empty, keys: { 'pokemon-master': ['x'] } })),
      oversized: await errorOf(() => badge(r1.revision, { ...empty, keys: Object.fromEntries(['night-journal', 'gentle-rhythm', 'night-thread', 'moon-cycles', 'ink-dreamer', 'night-voice', 'memory-keeper', 'dream-reader', 'time-traveler', 'treasure-keeper', 'favorite-echoes', 'dream-weaver'].map((f) => [f, Array.from({ length: 100 }, (_, i) => `c:${'k'.repeat(500)}${i}`)])) })),
      tooManyKeys: await errorOf(() => badge(r1.revision, { ...empty, keys: { 'symbol-explorer': Array.from({ length: 101 }, (_, i) => `s${i}`) } })),
      revealedAbove3: await errorOf(() => badge(r1.revision, { ...empty, revealed: { 'symbol-explorer': 4 } })),
      extraField: await errorOf(() => badge(r1.revision, { ...empty, evil: true })),
      fourEarned: await errorOf(() => badge(r1.revision, { ...empty, earned: { 'symbol-explorer': [1, 2, 3, 4] } })),
      halfProvided: await errorOf(() => badge(r1.revision)),
    };
    console.log('[Q01] badge refusals ->', JSON.stringify(Object.fromEntries(Object.entries(refusals).map(([k, v]) => [k, v?.code ?? 'ACCEPTED']))));
    for (const [, value] of Object.entries(refusals).filter(([k]) => k !== 'halfProvided')) expect(value?.code).toBe('22023');
    const stored = (await badge(null)).rows[0].r;
    expect(stored).toMatchObject({ ledger: goodLedger, revision: r1.revision, accepted: false });

    // Guide bounds.
    const guide = (guideId, section) => user(A)(() => db.query('select * from public.merge_guide_reading_progress($1, $2, $3, $4, null)', [A, guideId, section, 10]));
    const guideRefusals = {
      unknownGuide: await errorOf(() => guide('not-a-guide', 1)),
      section101: await errorOf(() => guide('dream-journal', 101)),
      sectionNegative: await errorOf(() => guide('dream-journal', -1)),
    };
    console.log('[Q01] guide refusals ->', JSON.stringify(Object.fromEntries(Object.entries(guideRefusals).map(([k, v]) => [k, v?.code ?? 'ACCEPTED']))));
    for (const value of Object.values(guideRefusals)) expect(value?.code).toBe('23514');
    expect((await db.query('select count(*)::int as n from public.guide_reading_progress')).rows[0].n).toBe(0);
  });

  it('G03 (server part): section zero never replaces a bookmark, an older write never removes completion', { timeout: 60000 }, async () => {
    const db = await boot();
    const { user } = sessions(db);
    const merge = (section, at, completed = null) => user(A)(async () => (await db.query(
      'select section, updated_at_ms::text as at, completed_at_ms::text as done from public.merge_guide_reading_progress($1, $2, $3, $4, $5)',
      [A, 'lucid-dreaming', section, at, completed])).rows[0]);
    // Fresh device: initial visit (section 0) recorded first, then a real bookmark arrives with an older time.
    expect(await merge(0, 500)).toEqual({ section: 0, at: '500', done: null });
    expect(await merge(3, 400)).toEqual({ section: 3, at: '400', done: null });
    // A newer visit at section zero does not reset the bookmark nor its time.
    expect(await merge(0, 900)).toEqual({ section: 3, at: '400', done: null });
    // A real move to another section is newer: it wins.
    expect(await merge(5, 950)).toEqual({ section: 5, at: '950', done: null });
    // An older bookmark does not win.
    expect(await merge(2, 700)).toEqual({ section: 5, at: '950', done: null });
    // Completion is permanent: a later write without it and an older one keep the first completion.
    expect(await merge(6, 1000, 1000)).toEqual({ section: 6, at: '1000', done: '1000' });
    expect(await merge(1, 1100, null)).toEqual({ section: 1, at: '1100', done: '1000' });
    expect(await merge(1, 600, null)).toEqual({ section: 1, at: '1100', done: '1000' });
    expect(await merge(1, 1200, 1200)).toEqual({ section: 1, at: '1200', done: '1000' });
  });

  it('B03/B04 (server part): compare-and-swap refuses a stale revision; a worker bound to A cannot write with B\'s session', { timeout: 60000 }, async () => {
    const db = await boot();
    const { user } = sessions(db);
    const empty = { version: 1, keys: {}, best: {}, earned: {}, revealed: {} };
    const exchange = (who, owner, rev, ledger) => user(who)(async () => (await db.query('select public.sync_badge_ledger($1, $2, $3::jsonb) as r',
      [owner, rev, ledger ? JSON.stringify(ledger) : null])).rows[0].r);
    const start = await exchange(A, A, null, null);
    const device1 = { ...empty, keys: { 'night-scholar': ['dream-journal'] } };
    const device2 = { ...empty, keys: { 'night-scholar': ['lucid-dreaming'] } };
    const one = await exchange(A, A, start.revision, device1);
    expect(one.accepted).toBe(true);
    const two = await exchange(A, A, start.revision, device2);
    expect(two).toMatchObject({ accepted: false, ledger: device1, revision: one.revision });
    // A late worker for A that now holds B's token: refused, nothing written for either account.
    const crossed = await errorOf(() => exchange(B, A, two.revision, device2));
    expect(crossed?.code).toBe('42501');
    expect((await exchange(B, B, null, null))).toMatchObject({ ledger: empty, revision: 0 });
    expect((await exchange(A, A, null, null))).toMatchObject({ ledger: device1, revision: one.revision });
  });

  it('S01: B and anon read or change none of A\'s QA rows, and cannot reassign ownership', { timeout: 60000 }, async () => {
    const db = await boot();
    const { user, anon, one, rowOf } = sessions(db);
    const created = await user(A)(() => one({ mutation_id: 'm1', client_request_id: uuid(1), operation: 'create', entity_key: 'd1',
      payload: { transcript: 'A private dream', personal_notes: [note(1, 'A private note')] } }));
    const id = created.remote_id;
    await user(A)(() => db.query('select public.sync_badge_ledger($1, 0, $2::jsonb)', [A, JSON.stringify({ version: 1, keys: { 'night-scholar': ['dream-journal'] }, best: {}, earned: {}, revealed: {} })]));
    await user(A)(() => db.query('select * from public.merge_guide_reading_progress($1, $2, 4, 100, 100)', [A, 'dream-journal']));
    const snapshot = async () => JSON.stringify({
      dream: await rowOf(id),
      badges: (await db.query('select ledger, revision from public.badge_ledgers where user_id = $1', [A])).rows,
      guides: (await db.query('select * from public.guide_reading_progress where user_id = $1', [A])).rows,
    });
    const before = await snapshot();

    const asB = user(B);
    const results = {
      bReadBadges: (await asB(() => db.query('select * from public.badge_ledgers'))).rows.length,
      bReadGuides: (await asB(() => db.query('select * from public.guide_reading_progress'))).rows.length,
      bUpdateBadges: (await asB(() => db.query(`update public.badge_ledgers set revision = 99 where user_id = '${A}'`))).affectedRows,
      bUpdateGuides: (await asB(() => db.query(`update public.guide_reading_progress set section = 0 where user_id = '${A}'`))).affectedRows,
      bInsertGuideForA: (await errorOf(() => asB(() => db.query(`insert into public.guide_reading_progress values ('${A}', 'remember-dreams', 1, 1, null)`))))?.code ?? 'ALLOWED',
      bBadgeRpcForA: (await errorOf(() => asB(() => db.query('select public.sync_badge_ledger($1, null, null)', [A]))))?.code ?? 'ALLOWED',
      bGuideRpcForA: (await errorOf(() => asB(() => db.query('select * from public.merge_guide_reading_progress($1, $2, 1, 999, null)', [A, 'dream-journal']))))?.code ?? 'ALLOWED',
      bNotesUpdateOfA: (await asB(() => one({ mutation_id: 'b1', client_request_id: uuid(90), operation: 'update', entity_key: 'x', payload: { remote_id: id, personal_notes: [] } }))).error,
      bNotesDeleteOfA: (await asB(() => one({ mutation_id: 'b2', client_request_id: uuid(91), operation: 'delete', entity_key: 'x', payload: { remote_id: id } }))).status,
      bTakeOverBadges: (await asB(() => db.query(`update public.badge_ledgers set user_id = '${B}' where user_id = '${A}'`))).affectedRows,
      aGiveAwayGuides: (await errorOf(() => user(A)(() => db.query(`update public.guide_reading_progress set user_id = '${B}' where user_id = '${A}'`))))?.code ?? 'ALLOWED',
      anonReadBadges: (await errorOf(() => anon(() => db.query('select * from public.badge_ledgers'))))?.code ?? 'ALLOWED',
      anonReadGuides: (await errorOf(() => anon(() => db.query('select * from public.guide_reading_progress'))))?.code ?? 'ALLOWED',
      anonBadgeRpc: (await errorOf(() => anon(() => db.query('select public.sync_badge_ledger($1, null, null)', [A]))))?.code ?? 'ALLOWED',
      anonGuideRpc: (await errorOf(() => anon(() => db.query('select * from public.merge_guide_reading_progress($1, $2, 1, 1, null)', [A, 'dream-journal']))))?.code ?? 'ALLOWED',
      anonSyncDreams: (await errorOf(() => anon(() => one({ mutation_id: 'n1', client_request_id: uuid(92), operation: 'delete', entity_key: 'x', payload: { remote_id: id } }))))?.code ?? 'ALLOWED',
    };
    console.log('[S01]', JSON.stringify(results));
    expect(results).toEqual({
      bReadBadges: 0, bReadGuides: 0, bUpdateBadges: 0, bUpdateGuides: 0,
      bInsertGuideForA: '42501', bBadgeRpcForA: '42501', bGuideRpcForA: '42501',
      bNotesUpdateOfA: 'Dream not found', bNotesDeleteOfA: 'ack', // delete of an unknown id is an idempotent ack
      bTakeOverBadges: 0, aGiveAwayGuides: '42501',
      anonReadBadges: '42501', anonReadGuides: '42501', anonBadgeRpc: '42501', anonGuideRpc: '42501', anonSyncDreams: '42501',
    });
    expect(await snapshot()).toBe(before);
  });

  it('S02: only Dreamer contexts reach badges, guides and notes; user metadata grants nothing', { timeout: 60000 }, async () => {
    const db = await boot();
    const { user, one } = sessions(db);
    const ledger = JSON.stringify({ version: 1, keys: { 'night-scholar': ['dream-journal'] }, best: {}, earned: {}, revealed: {} });
    await user(A)(() => db.query('select public.sync_badge_ledger($1, 0, $2::jsonb)', [A, ledger]));
    await user(A)(() => db.query('select * from public.merge_guide_reading_progress($1, $2, 4, 100, null)', [A, 'dream-journal']));
    const probe = async (extra) => {
      const as = user(A, extra);
      return {
        badgeRpc: (await errorOf(() => as(() => db.query('select public.sync_badge_ledger($1, null, null)', [A]))))?.code ?? 'OK',
        badgeRows: (await errorOf(() => as(() => db.query('select 1 from public.badge_ledgers')))) ?? (await as(() => db.query('select 1 from public.badge_ledgers'))).rows.length,
        guideRpc: (await errorOf(() => as(() => db.query('select * from public.merge_guide_reading_progress($1, $2, 1, 999, null)', [A, 'remember-dreams']))))?.code ?? 'OK',
        guideRows: (await as(() => db.query('select 1 from public.guide_reading_progress'))).rows.length,
        dreamSync: (await errorOf(() => as(() => one({ mutation_id: `p${JSON.stringify(extra).length}`, client_request_id: uuid(500 + JSON.stringify(extra).length), operation: 'create', entity_key: 'p', payload: { transcript: 'scope probe', personal_notes: [] } }))))?.code ?? 'OK',
      };
    };
    const results = {
      legacy: await probe({}),
      journal: await probe({ client_id: 'qa-journal' }),
      lucid: await probe({ client_id: 'qa-lucid' }),
      otherProduct: await probe({ client_id: 'qa-other' }),
      unknownClient: await probe({ client_id: 'qa-unregistered' }),
      lucidWithMetadata: await probe({ client_id: 'qa-lucid', user_metadata: { product: 'journal', app: 'dreamer' }, app_metadata: { product: 'journal' } }),
    };
    console.log('[S02]', JSON.stringify(results));
    for (const allowed of ['legacy', 'journal']) {
      expect(results[allowed]).toMatchObject({ badgeRpc: 'OK', badgeRows: 1, guideRpc: 'OK', dreamSync: 'OK' });
      expect(results[allowed].guideRows).toBeGreaterThan(0);
    }
    for (const refused of ['lucid', 'otherProduct', 'unknownClient', 'lucidWithMetadata']) {
      expect(results[refused]).toEqual({ badgeRpc: '42501', badgeRows: 0, guideRpc: '42501', guideRows: 0, dreamSync: '42501' });
    }
  });

  it('S03/B05 (server part): deleting a dream takes its notes only; deleting A cascades A\'s badges and guides only', { timeout: 60000 }, async () => {
    const db = await boot();
    const { user, one, rowOf } = sessions(db);
    const make = (who, n) => user(who)(() => one({ mutation_id: `c${n}`, client_request_id: uuid(n), operation: 'create', entity_key: `d${n}`,
      payload: { transcript: `QA dream ${n}`, personal_notes: [note(n)] } }));
    const a1 = await make(A, 1);
    const a2 = await make(A, 2);
    const b1 = await make(B, 3);
    for (const who of [A, B]) {
      await user(who)(() => db.query('select public.sync_badge_ledger($1, 0, $2::jsonb)', [who, JSON.stringify({ version: 1, keys: { 'night-journal': ['c:x'] }, best: {}, earned: { 'night-journal': [1_700_000_000_000] }, revealed: {} })]));
      await user(who)(() => db.query('select * from public.merge_guide_reading_progress($1, $2, 2, 10, 10)', [who, 'dream-journal']));
    }
    const removed = await user(A)(() => one({ mutation_id: 'del', client_request_id: uuid(9), operation: 'delete', entity_key: 'd1', payload: { remote_id: a1.remote_id } }));
    expect(removed.status).toBe('ack');
    expect(await rowOf(a1.remote_id)).toBeUndefined();
    expect((await rowOf(a2.remote_id)).personal_notes).toEqual([note(2)]);
    // The badge earned before stays with its date: a dream deletion does not touch the ledger.
    expect((await db.query('select ledger->\'earned\' as e from public.badge_ledgers where user_id = $1', [A])).rows[0].e).toEqual({ 'night-journal': [1_700_000_000_000] });
    // Account deletion (owner-side, as the account deletion service would): cascades.
    await db.query('delete from auth.users where id = $1', [A]);
    const left = async (table, who) => (await db.query(`select count(*)::int as n from public.${table} where user_id = $1`, [who])).rows[0].n;
    expect({ badges: await left('badge_ledgers', A), guides: await left('guide_reading_progress', A), dreams: await left('dreams', A) })
      .toEqual({ badges: 0, guides: 0, dreams: 0 });
    expect({ badges: await left('badge_ledgers', B), guides: await left('guide_reading_progress', B), dreams: await left('dreams', B) })
      .toEqual({ badges: 1, guides: 1, dreams: 1 });
    expect((await rowOf(b1.remote_id)).personal_notes).toEqual([note(3)]);
  });
});
