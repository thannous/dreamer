// Synthetic SQL checks for keyed anti-abuse admission; no hosted access.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create role supabase_admin;
    create schema auth; create schema private;
    create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('role',current_setting('test.role',true)) $$;
    select set_config('test.role','service_role',false);`);
  for (const name of ['20260722124500_add_ai_sync_admission_control', '20261021170000_add_daily_ai_request_budget', '20261025185137_deduplicate_analysis_admission_retries']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'));
  }
  // Compare the actual migrated catalog with the production checker's manifest.
  // Exact table parity also catches newly added columns omitted from the contract.
  const manifest = JSON.parse(await readFile(new URL('../supabase/db-contract.manifest.json', import.meta.url), 'utf8'));
  const tableContract = manifest.requiredTables.find(table => table.schema === 'private' && table.name === 'ai_analysis_admissions');
  assert.ok(tableContract, 'admission table must be in the DB contract');
  const columns = (await db.query(`select column_name from information_schema.columns
    where table_schema='private' and table_name='ai_analysis_admissions'`)).rows.map(row => row.column_name);
  assert.deepEqual([...tableContract.requiredColumns].sort(), columns.sort(), 'admission manifest columns must match migrated schema');
  const functionContract = manifest.requiredFunctions.find(fn => fn.schema === 'public' && fn.name === 'claim_ai_analysis_admission');
  assert.ok(functionContract, 'admission RPC must be in the DB contract');
  const signatures = (await db.query(`select pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as result from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='claim_ai_analysis_admission'`)).rows;
  assert.deepEqual(signatures, [{ arguments: functionContract.identityArguments, result: functionContract.result }],
    'admission manifest RPC signature must match migrated schema');
  const actor = 'a'.repeat(64);
  const key = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const claim = async (n, who = actor, daily = 20) => (await db.query(`select public.claim_ai_analysis_admission($1,'analyze_dream',$2,600,2,300,$3) r`, [who, key(n), daily])).rows[0].r;
  assert.equal((await claim(1)).allowed, true);
  assert.equal((await claim(1)).code, 'ALREADY_ADMITTED');
  assert.equal((await claim(2)).allowed, true, 'the second tap has a window slot after the first tap replays');
  assert.equal((await claim(3)).code, 'AI_ACTOR_RATE_LIMIT');
  assert.equal((await claim(1)).allowed, true, 'replay remains allowed at a full window');
  const counts = (await db.query(`select capability,request_count from public.ai_rate_limit_buckets where actor_hash=$1 order by capability`, [actor])).rows;
  assert.deepEqual(counts, [{ capability: 'analyze_dream', request_count: 2 }, { capability: 'analyze_dream_day', request_count: 2 }]);
  assert.equal((await claim(1, 'b'.repeat(64), 1)).allowed, true, 'keys are actor scoped');
  assert.equal((await claim(2, 'b'.repeat(64), 1)).code, 'AI_DAILY_LIMIT');
  assert.equal((await claim(1, 'b'.repeat(64), 1)).allowed, true, 'daily limit never blocks an admitted replay');
  assert.equal((await claim(2, 'b'.repeat(64), 1)).code, 'AI_DAILY_LIMIT', 'a denied daily claim replays without another window debit');
  assert.equal((await db.query(`select request_count from public.ai_rate_limit_buckets where actor_hash=$1 and capability='analyze_dream'`, ['b'.repeat(64)])).rows[0].request_count, 2);
  await db.query(`update public.ai_rate_limit_buckets set window_started_at=now()-interval '26 hours' where actor_hash=$1 and capability='analyze_dream_day'`, ['b'.repeat(64)]);
  assert.equal((await claim(2, 'b'.repeat(64), 1)).allowed, true, 'daily denials are rechecked when the budget becomes available');
  // A key grants only two free transport retries, even with exhausted budgets.
  const boundedActor = 'c'.repeat(64);
  assert.equal((await claim(1, boundedActor, 1)).allowed, true);
  assert.equal((await claim(1, boundedActor, 1)).code, 'ALREADY_ADMITTED');
  assert.equal((await claim(1, boundedActor, 1)).code, 'ALREADY_ADMITTED');
  assert.equal((await claim(1, boundedActor, 1)).code, 'AI_DAILY_LIMIT');
  // An old receipt cannot bypass current actor/global/daily limits.
  await db.query(`update private.ai_analysis_admissions set admitted_at=now()-interval '11 minutes' where actor_hash=$1`, [actor]);
  assert.equal((await claim(1)).code, 'AI_ACTOR_RATE_LIMIT', 'replay after the fixed window counts anew');
  await db.query(`update private.ai_analysis_admissions set admitted_at=now()-interval '30 days' where actor_hash=$1`, [actor]);
  assert.equal((await claim(1)).code, 'AI_ACTOR_RATE_LIMIT', 'old receipts never grant a pass');
  // Retention also runs on denied claims, without retaining raw request IDs.
  assert.equal((await db.query(`select count(*)::int n from private.ai_analysis_admissions where admitted_at<now()-interval '7 days'`)).rows[0].n, 0);
  assert.equal((await db.query(`select column_name from information_schema.columns where table_schema='private' and table_name='ai_analysis_admissions' and column_name='request_id'`)).rows.length, 0);

  // Real guest reserve/refund RPCs: refunds restore product quota, never the
  // anti-abuse budgets. Both synchronous capabilities must count the next try.
  await db.exec(`create table public.guest_usage(fingerprint_hash text primary key, is_upgraded boolean default false,
      analysis_count integer not null default 0, last_seen_at timestamptz);
    create table public.guest_analysis_quota_claims(fingerprint_hash text, analysis_request_id uuid, transcript_sha256 text,
      claimed_at timestamptz default now(), primary key(fingerprint_hash, analysis_request_id));
    create table public.quota_usage(id uuid primary key default gen_random_uuid(), user_id uuid, dream_id bigint, quota_type text, metadata jsonb);
    create table public.dreams(id bigint primary key, user_id uuid);
    create function public.get_guest_abuse_risk(text) returns jsonb language sql as $$ select '{"risk_level":"low","risk_score":0}'::jsonb $$;`);
  const binding = await readFile(new URL('../supabase/migrations/20261021201021_bind_analysis_receipts_to_transcript.sql', import.meta.url), 'utf8');
  const start = binding.indexOf('create or replace function public.claim_guest_analysis_quota(');
  await db.exec(binding.slice(start, binding.indexOf('$$;', start) + 3));
  const refund = await readFile(new URL('../supabase/migrations/20261025160000_refund_failed_text_analysis.sql', import.meta.url), 'utf8');
  await db.exec(refund.slice(0, refund.indexOf('-- A queued retry still owns its receipt.')));
  await db.exec('delete from public.ai_rate_limit_buckets');
  const fingerprint = 'guest-fingerprint';
  const guestActor = (await db.query(`select encode(sha256(convert_to('guest:' || $1::text,'UTF8')),'hex') hash`, [fingerprint])).rows[0].hash;
  for (const capability of ['analyze_dream', 'analyze_dream_full']) {
    const guestClaim = async () => (await db.query(`select public.claim_ai_analysis_admission($1,$2,$3,600,2,300,20) r`, [guestActor, capability, key(7)])).rows[0].r;
    for (let n = 0; n < 2; n++) {
      assert.equal((await guestClaim()).code, 'ADMITTED', 'refunded key consumes a fresh attempt');
      const reservation = (await db.query(`select public.reserve_guest_text_analysis($1,$2,2,$3) r`, [fingerprint, key(7), 'f'.repeat(64)])).rows[0].r;
      assert.equal(reservation.allowed, true);
      assert.equal((await db.query(`select public.release_guest_text_analysis($1,$2,'ANALYSIS_PROVIDER_REFUSED') r`, [fingerprint, reservation.reservation_id])).rows[0].r, true);
    }
    assert.equal((await guestClaim()).code, 'AI_ACTOR_RATE_LIMIT', 'refund/replay loop stops at the attempt limit');
    const counts = (await db.query(`select request_count from public.ai_rate_limit_buckets where actor_hash=$1 and capability in ($2,$2 || '_day') order by capability`, [guestActor, capability])).rows;
    assert.deepEqual(counts.map(row => row.request_count), [2, 2]);
  }
  // Authenticated refunds also invalidate both capability receipts for this key.
  const userId = key(9);
  const userActor = (await db.query(`select encode(sha256(convert_to('user:' || $1::text,'UTF8')),'hex') hash`, [userId])).rows[0].hash;
  assert.equal((await claim(9, userActor)).allowed, true);
  const receiptId = (await db.query(`insert into public.quota_usage(user_id,dream_id,quota_type,metadata) values ($1,1,'analysis',jsonb_build_object('source','api_pre_provider','analysis_request_id',$2::text)) returning id`, [userId,key(9)])).rows[0].id;
  assert.equal((await db.query(`select public.release_authenticated_text_analysis($1,$2,'ANALYSIS_TIMEOUT') r`, [userId,receiptId])).rows[0].r, true);
  assert.equal((await claim(9, userActor)).code, 'ADMITTED');
  assert.equal((await db.query(`select public.release_authenticated_text_analysis($1,$2,'ANALYSIS_TIMEOUT') r`, [userId,receiptId])).rows[0].r, false, 'repeated refunds cannot invalidate a later attempt');
  const signature = 'public.claim_ai_analysis_admission(text,text,uuid,integer,integer,integer,integer)';
  const grants = (await db.query(`select has_function_privilege('anon',$1,'execute') a, has_function_privilege('authenticated',$1,'execute') u, has_function_privilege('service_role',$1,'execute') s`, [signature])).rows[0];
  assert.deepEqual(grants, { a: false, u: false, s: true });
  assert.equal((await db.query(`select relrowsecurity from pg_class where oid='private.ai_analysis_admissions'::regclass`)).rows[0].relrowsecurity, true);
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query(`select has_table_privilege($1,'private.ai_analysis_admissions','select') p`, [role])).rows[0].p, false);
    await db.query(`select set_config('test.role',$1,false)`, [role]);
    await assert.rejects(() => claim(4), error => error.code === '42501');
  }
  console.log('PASS: manifest/schema parity, bounded/expired replay, guest/auth refund-replay, retention, hashed receipts, budgets, RLS and service-only grants');
} finally { await db.close(); }
