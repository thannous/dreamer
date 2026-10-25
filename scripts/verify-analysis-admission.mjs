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
  const signature = 'public.claim_ai_analysis_admission(text,text,uuid,integer,integer,integer,integer)';
  const grants = (await db.query(`select has_function_privilege('anon',$1,'execute') a, has_function_privilege('authenticated',$1,'execute') u, has_function_privilege('service_role',$1,'execute') s`, [signature])).rows[0];
  assert.deepEqual(grants, { a: false, u: false, s: true });
  assert.equal((await db.query(`select relrowsecurity from pg_class where oid='private.ai_analysis_admissions'::regclass`)).rows[0].relrowsecurity, true);
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query(`select has_table_privilege($1,'private.ai_analysis_admissions','select') p`, [role])).rows[0].p, false);
    await db.query(`select set_config('test.role',$1,false)`, [role]);
    await assert.rejects(() => claim(4), error => error.code === '42501');
  }
  console.log('PASS: keyed replay, distinct requests, actor isolation, daily/window budgets, RLS and service-only grants');
} finally { await db.close(); }
