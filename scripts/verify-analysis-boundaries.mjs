import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const { PGlite } = process.argv[2]
  ? await import(pathToFileURL(process.argv[2]).href)
  : createRequire(import.meta.url)('@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
create role service_role; create role authenticated; create role anon; create role supabase_admin;
create schema auth;
create schema private;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('role', current_setting('test.jwt_role', true)) $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create table public.dreams (id bigint primary key, user_id uuid, transcript text not null, analysis_request_id uuid, analysis_status text default 'none', is_analyzed boolean default false, analyzed_at timestamptz, interpretation text, exploration_started_at timestamptz, chat_history jsonb default '[]'::jsonb, client_request_id uuid);
create table public.quota_limits(tier text,period text,quota_type text,quota_limit integer);
insert into public.quota_limits values('free','monthly','analysis',3),('free','monthly','exploration',2);
create table public.quota_usage(id uuid primary key default gen_random_uuid(),user_id uuid,dream_id bigint,quota_type text,occurred_at timestamptz default now(),metadata jsonb);
create table public.ai_jobs(id uuid primary key,user_id uuid,guest_fingerprint text,dream_id bigint,job_type text,status text,request_payload jsonb,client_request_id text,max_attempts integer,quota_claimed boolean,quota_claimed_at timestamptz,created_at timestamptz default now());
create table public.guest_usage(fingerprint_hash text primary key,analysis_count integer default 0,is_upgraded boolean default false,last_seen_at timestamptz);
create table public.guest_analysis_quota_claims(fingerprint_hash text,analysis_request_id uuid,claimed_at timestamptz default now(),primary key(fingerprint_hash,analysis_request_id));
create function public.get_guest_abuse_risk(text) returns jsonb language sql as $$ select '{"risk_level":"low","risk_score":0}'::jsonb $$;
create function public.get_effective_subscription_tier(uuid) returns text language sql as $$ select coalesce(nullif(current_setting('test.tier', true), ''), 'free')::text $$;
create function public.claim_guest_analysis_quota(text,uuid,integer) returns jsonb language sql as $$ select '{}'::jsonb $$;
create table public.dream_chat_turns(dream_id bigint,user_id uuid,request_id uuid,status text,user_message jsonb,model_message jsonb,error_code text,attempt_count integer,updated_at timestamptz,finished_at timestamptz,primary key(dream_id,request_id));
create table public.dream_chat_messages(id uuid default gen_random_uuid(),dream_id bigint,user_id uuid,request_id uuid,role text,message jsonb,legacy_ordinal bigint,created_at timestamptz default now(),unique(dream_id,request_id,role));
create function public.complete_authenticated_chat_turn(bigint,uuid,integer,jsonb) returns jsonb language sql as $$ select '{}'::jsonb $$;
create function private.claim_guest_analysis_import(uuid,uuid,uuid,text,timestamptz,text) returns boolean language sql as $$ select false $$;
revoke all on public.dream_chat_messages from public, anon, authenticated;
`);
for (const name of ['20261021201021_bind_analysis_receipts_to_transcript.sql','20261021201023_trust_server_exploration_started_at.sql']) {
  try { await db.exec(readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url),'utf8')); console.log('migration parsed',name); }
  catch(error) { console.error('migration error',name,error.message); throw error; }
}
const extractFunction = (name, start) => {
  const sql = readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
  const begin = sql.indexOf(start);
  assert.ok(begin >= 0, `missing function ${start}`);
  const end = sql.indexOf('$$;', begin);
  assert.ok(end >= 0, `unterminated function ${start}`);
  return sql.slice(begin, end + 3);
};
await db.exec(extractFunction('20260928150227_claim_guest_analysis_imports.sql',
  'create or replace function public.enforce_authenticated_monthly_quota()'));
await db.exec(extractFunction('20251220000000_unify_quota_tables.sql',
  'CREATE OR REPLACE FUNCTION public.log_user_quota_event()'));
await db.exec(`
create trigger trg_10_enforce_authenticated_monthly_quota before insert or update on public.dreams
  for each row execute function public.enforce_authenticated_monthly_quota();
create trigger trg_log_quota_event_on_dreams after insert or update on public.dreams
  for each row execute function public.log_user_quota_event();
create function public.fixture_sync_marker(bigint,timestamptz) returns void language plpgsql security definer
  set search_path = '' as $$ begin update public.dreams set exploration_started_at=$2 where id=$1; end $$;
`);
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const rid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rid2='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const failedTurnRequest='99999999-9999-4999-8999-999999999999';
await db.exec(`select set_config('test.jwt_role','service_role',false); select set_config('test.uid','',false);`);
await db.query(`insert into public.dreams(id,user_id,transcript,analysis_request_id,analysis_status) values(1,$1,'dream A',$2,'pending')`,[uid,rid]);
const hashA=(await db.query(`select encode(pg_catalog.sha256(convert_to('dream A','UTF8')),'hex') h`)).rows[0].h;
const hashB=(await db.query(`select encode(pg_catalog.sha256(convert_to('dream B','UTF8')),'hex') h`)).rows[0].h;
const unicodeTranscript='  Étoile 🌙\n';
const sqlHash=(await db.query(`select encode(pg_catalog.sha256(convert_to($1::text,'UTF8')),'hex') h`,[unicodeTranscript])).rows[0].h;
assert.equal(sqlHash,createHash('sha256').update(unicodeTranscript,'utf8').digest('hex'));
const authClaim=async hash => (await db.query(`select public.claim_authenticated_analysis_quota_bound($1::uuid,1,$2::uuid,$3::text) result`,[uid,rid,hash])).rows[0].result;
assert.equal((await authClaim(hashA)).allowed,true);
assert.equal((await authClaim(hashA)).code,'ANALYSIS_ALREADY_CLAIMED');
assert.equal((await authClaim(hashB)).code,'ANALYSIS_TRANSCRIPT_MISMATCH');
const crossPathJob='11111111-1111-4111-8111-111111111111';
const crossPathAttempt=(await db.query(`select public.admit_authenticated_analysis_job($1::uuid,$2::uuid,1,$3::uuid,'en',false,3,10,600,100,1000) result`,[crossPathJob,uid,rid])).rows[0].result;
assert.equal(crossPathAttempt.allowed,false);
assert.equal(crossPathAttempt.code,'ANALYSIS_ALREADY_CLAIMED');
assert.equal((await db.query(`select count(*)::integer n from public.ai_jobs where id=$1`,[crossPathJob])).rows[0].n,0);
assert.equal((await db.query(`select analysis_status from public.dreams where id=1`)).rows[0].analysis_status,'pending');
await db.query(`insert into public.dreams(id,user_id,transcript,analysis_request_id,analysis_status) values(3,$1,'legacy receipt',$2,'pending')`,[uid,rid2]);
await db.query(`insert into public.quota_usage(user_id,dream_id,quota_type,metadata) values($1,3,'analysis',jsonb_build_object('analysis_request_id',$2::text))`,[uid,rid2]);
const legacyHash=(await db.query(`select encode(pg_catalog.sha256(convert_to('legacy receipt','UTF8')),'hex') h`)).rows[0].h;
assert.equal((await db.query(`select public.claim_authenticated_analysis_quota_bound($1::uuid,3,$2::uuid,$3::text) result`,[uid,rid2,legacyHash])).rows[0].result.code,'ANALYSIS_TRANSCRIPT_MISMATCH');
await db.query(`insert into public.dreams(id,user_id,transcript) values(4,$1,$2)`,[uid,unicodeTranscript]);
const jobRequest='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const admit=async () => (await db.query(`select public.admit_authenticated_analysis_job($1::uuid,$2::uuid,4,$3::uuid,'en',false,3,10,600,100,1000) result`,[jobRequest,uid,jobRequest])).rows[0].result;
const admitted=await admit();
assert.equal(admitted.allowed,true);
assert.equal(admitted.job.request_payload.transcript_sha256,sqlHash);
assert.equal((await admit()).duplicate,true);
await db.query(`update public.dreams set transcript='different dream' where id=4`);
assert.equal((await admit()).code,'ANALYSIS_IDEMPOTENCY_KEY_REUSED');
await db.query(`update public.dreams set transcript='dream B' where id=1`);
assert.equal((await authClaim(hashB)).code,'ANALYSIS_TRANSCRIPT_MISMATCH');
const guestClaim=async hash => (await db.query(`select public.claim_guest_analysis_quota('fingerprint',$1::uuid,1,$2::text) result`,[rid,hash])).rows[0].result;
assert.equal((await guestClaim(hashA)).allowed,true);
assert.equal((await guestClaim(hashA)).code,'ANALYSIS_ALREADY_CLAIMED');
assert.equal((await guestClaim(hashA)).allowed,false);
assert.equal((await guestClaim(hashB)).code,'ANALYSIS_TRANSCRIPT_MISMATCH');
await db.query(`insert into public.guest_analysis_quota_claims(fingerprint_hash,analysis_request_id) values('legacy',$1::uuid)`,[rid]);
assert.equal((await db.query(`select public.claim_guest_analysis_quota('legacy',$1::uuid,1,$2::text) result`,[rid,hashA])).rows[0].result.code,'ANALYSIS_TRANSCRIPT_MISMATCH');
// The transcript-binding migration must retain master's newer Plus limit of
// ten new analyses in a rolling 24-hour window, including the queued path.
await db.exec(`select set_config('test.tier','plus',false)`);
const recentCount=(await db.query(`select count(*)::integer n from public.quota_usage where user_id=$1 and quota_type='analysis' and metadata ? 'analysis_request_id' and occurred_at > now()-interval '24 hours'`,[uid])).rows[0].n;
for(let index=recentCount;index<10;index++) {
  const requestId=`eeeeeeee-eeee-4eee-8eee-${String(index).padStart(12,'0')}`;
  await db.query(`insert into public.quota_usage(user_id,dream_id,quota_type,metadata) values($1,1,'analysis',jsonb_build_object('analysis_request_id',$2::text))`,[uid,requestId]);
}
const dailyRequest='ffffffff-ffff-4fff-8fff-ffffffffffff';
await db.query(`insert into public.dreams(id,user_id,transcript,analysis_request_id,analysis_status) values(5,$1,'Plus dream',$2,'pending')`,[uid,dailyRequest]);
const dailyHash=createHash('sha256').update('Plus dream','utf8').digest('hex');
const dailyDenied=(await db.query(`select public.claim_authenticated_analysis_quota_bound($1::uuid,5,$2::uuid,$3::text) result`,[uid,dailyRequest,dailyHash])).rows[0].result;
assert.equal(dailyDenied.code,'DAILY_ANALYSIS_LIMIT');
assert.equal(dailyDenied.daily_limit,10);
assert.ok(dailyDenied.retry_after_seconds>0);
assert.equal((await db.query(`select count(*)::integer n from public.quota_usage where user_id=$1 and dream_id=5 and quota_type='analysis'`,[uid])).rows[0].n,0);
assert.equal((await authClaim(hashB)).code,'ANALYSIS_TRANSCRIPT_MISMATCH');
await db.query(`update public.quota_usage set occurred_at=now()-interval '25 hours' where user_id=$1 and dream_id=1 and metadata->>'analysis_request_id'=$2`,[uid,rid]);
assert.equal((await db.query(`select public.claim_authenticated_analysis_quota_bound($1::uuid,5,$2::uuid,$3::text) result`,[uid,dailyRequest,dailyHash])).rows[0].result.allowed,true);
await db.exec(`select set_config('test.tier','free',false)`);
await db.exec(`select set_config('test.jwt_role','authenticated',false); select set_config('test.uid','${uid}',false);`);
const permissions=(await db.query(`select
  to_regprocedure('public.complete_authenticated_chat_turn(bigint,uuid,integer,jsonb)') old_overload,
  to_regprocedure('public.fail_authenticated_chat_turn(bigint,uuid,integer,text)') old_fail_overload,
  has_function_privilege('authenticated','public.complete_authenticated_chat_turn(uuid,bigint,uuid,integer,jsonb)','EXECUTE') client_completion,
  has_function_privilege('authenticated','public.fail_authenticated_chat_turn(uuid,bigint,uuid,integer,text)','EXECUTE') client_failure,
  has_function_privilege('service_role','public.fail_authenticated_chat_turn(uuid,bigint,uuid,integer,text)','EXECUTE') service_failure,
  has_table_privilege('authenticated','public.dream_chat_messages','INSERT') client_model_insert`)).rows[0];
assert.equal(permissions.old_overload,null);
assert.equal(permissions.old_fail_overload,null);
assert.equal(permissions.client_completion,false);
assert.equal(permissions.client_failure,false);
assert.equal(permissions.service_failure,true);
assert.equal(permissions.client_model_insert,false);
await assert.rejects(() => db.query(`select public.complete_authenticated_chat_turn($1::uuid,2,$2::uuid,1,'{"role":"model","text":"forged"}'::jsonb)`,[uid,rid2]),error=>error.code==='42501');
await db.query(`insert into public.dream_chat_turns(dream_id,user_id,request_id,status,user_message,attempt_count) values(2,$1,$2,'pending','{"role":"user","text":"hi"}'::jsonb,1)`,[uid,failedTurnRequest]);
await assert.rejects(() => db.query(`select public.fail_authenticated_chat_turn($1::uuid,2,$2::uuid,1,'CLIENT_ABORT')`,[uid,failedTurnRequest]),error=>error.code==='42501');
assert.equal((await db.query(`select status from public.dream_chat_turns where request_id=$1`,[failedTurnRequest])).rows[0].status,'pending');
await db.query(`insert into public.dreams(id,user_id,transcript,exploration_started_at,chat_history) values(2,$1,'imported','2000-01-01','[{"role":"model","text":"forged"}]'::jsonb)`,[uid]);
assert.equal((await db.query(`select exploration_started_at from public.dreams where id=2`)).rows[0].exploration_started_at,null);
await db.query(`select public.fixture_sync_marker(2,'2000-01-01'::timestamptz)`);
assert.equal((await db.query(`select exploration_started_at from public.dreams where id=2`)).rows[0].exploration_started_at,null);
assert.equal((await db.query(`select count(*)::integer n from public.quota_usage where user_id=$1 and quota_type='exploration'`,[uid])).rows[0].n,0);
await db.query(`update public.dreams set exploration_started_at='2000-01-01',chat_history='[{"role":"model","text":"forged again"}]'::jsonb where id=2`);
assert.equal((await db.query(`select exploration_started_at from public.dreams where id=2`)).rows[0].exploration_started_at,null);
await db.query(`insert into public.dream_chat_turns(dream_id,user_id,request_id,status,user_message,attempt_count) values(2,$1,$2,'pending','{"role":"user","text":"hi"}'::jsonb,1)`,[uid,rid2]);
await db.exec(`select set_config('test.jwt_role','service_role',false); select set_config('test.uid','',false);`);
assert.equal((await db.query(`select public.fail_authenticated_chat_turn($1::uuid,2,$2::uuid,2,'WRONG_ATTEMPT') result`,[uid,failedTurnRequest])).rows[0].result,false);
assert.equal((await db.query(`select public.fail_authenticated_chat_turn('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,2,$1::uuid,1,'WRONG_OWNER') result`,[failedTurnRequest])).rows[0].result,false);
assert.equal((await db.query(`select public.fail_authenticated_chat_turn($1::uuid,2,$2::uuid,1,'PROVIDER_FAILED') result`,[uid,failedTurnRequest])).rows[0].result,true);
assert.equal((await db.query(`select public.fail_authenticated_chat_turn($1::uuid,2,$2::uuid,1,'REPLAY') result`,[uid,failedTurnRequest])).rows[0].result,false);
const complete=(await db.query(`select public.complete_authenticated_chat_turn($1::uuid,2,$2::uuid,1,'{"role":"model","text":"real"}'::jsonb) result`,[uid,rid2])).rows[0].result;
assert.equal(complete.completed,true);
const marker=(await db.query(`select exploration_started_at from public.dreams where id=2`)).rows[0].exploration_started_at;
assert.ok(marker); assert.ok(Math.abs(Date.now()-new Date(marker).getTime())<30_000);
const explorationUsage=(await db.query(`select occurred_at from public.quota_usage where user_id=$1 and dream_id=2 and quota_type='exploration'`,[uid])).rows;
assert.equal(explorationUsage.length,1);
assert.equal(new Date(explorationUsage[0].occurred_at).getUTCMonth(),new Date().getUTCMonth());
assert.equal((await db.query(`select public.complete_authenticated_chat_turn($1::uuid,2,$2::uuid,1,'{"role":"model","text":"real"}'::jsonb) result`,[uid,rid2])).rows[0].result.duplicate,true);
assert.equal((await db.query(`select count(*)::integer n from public.quota_usage where user_id=$1 and dream_id=2 and quota_type='exploration'`,[uid])).rows[0].n,1);
await db.exec(`select set_config('test.jwt_role','authenticated',false); select set_config('test.uid','${uid}',false);`);
await db.query(`update public.dreams set exploration_started_at='2000-01-01' where id=2`);
assert.equal(new Date((await db.query(`select exploration_started_at from public.dreams where id=2`)).rows[0].exploration_started_at).getTime(),new Date(marker).getTime());
console.log('PASS bound receipts reject changed transcripts and repeat spend; legacy receipts denied; direct backdate stripped; service-only chat failure and completion; immutable server marker');
await db.close();
