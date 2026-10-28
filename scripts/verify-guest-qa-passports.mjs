// Synthetic SQL checks for guest QA passports without daily caps; no hosted access.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const db = new PGlite();
const migration = name => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');
const OPERATOR = '11111111-1111-4111-8111-111111111111';
const DEVICE = 'a'.repeat(64);
const requestId = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const one = async (sql, params) => (await db.query(sql, params)).rows[0].r;
const enroll = (n, policy = '') => one(
  `select public.enroll_guest_qa_passport($1::uuid,$2,$3::uuid${policy}) r`, [OPERATOR, DEVICE, requestId(n)]);
const claim = (subject, key) => one(
  `select public.claim_guest_qa_paid_call($1,'analyze_dream',$2) r`, [subject, key]);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('${OPERATOR}');`);
  await db.exec(await migration('20260722152059_add_guest_qa_passports'));

  // A passport enrolled under the capped policy is running when the caps are lifted.
  const running = await enroll(1, ',24');
  assert.equal(running.resetLimit, 3);
  for (let n = 0; n < 10; n += 1) await claim(`qa:${running.passportId}`, `before-${n}`);
  assert.equal((await claim(`qa:${running.passportId}`, 'before-cap')).code, 'QA_DAILY_BUDGET_EXCEEDED');

  await db.exec(await migration('20261028090000_lift_guest_qa_daily_caps'));
  assert.equal((await claim(`qa:${running.passportId}`, 'after-lift')).allowed, true,
    'a passport running at migration time loses its paid-call cap');

  // The app enrolls with the 24h validity only: resets and paid calls are uncapped.
  let latest;
  for (let n = 2; n <= 15; n += 1) {
    latest = await one(`select public.enroll_guest_qa_passport(p_operator_user_id=>$1::uuid,p_fingerprint=>$2,
      p_request_id=>$3::uuid,p_valid_hours=>24) r`, [OPERATOR, DEVICE, requestId(n)]);
    assert.equal(latest.allowed, true, `reset ${n} is allowed`);
  }
  assert.equal(latest.resetsUsed, 15);
  assert.equal(latest.resetLimit, null);
  assert.equal(latest.paidCallLimit, null);
  const subject = `qa:${latest.passportId}`;
  for (let n = 0; n < 150; n += 1) {
    assert.equal((await claim(subject, `call-${n}`)).allowed, true, `paid call ${n} is allowed`);
  }
  const replay = await claim(subject, 'call-0');
  assert.equal(replay.duplicate, true, 'a replayed request key stays idempotent');
  assert.equal(replay.used, 150);
  assert.equal((await db.query(`select count(*)::int n from qa_private.guest_paid_call_claims
    where passport_id=$1`, [latest.passportId])).rows[0].n, 150, 'every paid call stays audited');

  const status = await one(`select public.get_guest_qa_operator_status($1::uuid,$2) r`, [OPERATOR, DEVICE]);
  assert.deepEqual([status.active, status.resetLimit, status.paidCallLimit, status.paidCallsUsed], [true, null, null, 150]);
  await one(`select public.revoke_guest_qa_passport($1::uuid,$2) r`, [OPERATOR, DEVICE]);
  const idle = await one(`select public.get_guest_qa_operator_status($1::uuid,$2) r`, [OPERATOR, DEVICE]);
  assert.deepEqual([idle.active, idle.resetLimit, idle.paidCallLimit], [false, null, null]);

  // The other guards are unchanged.
  assert.equal((await claim(subject, 'after-revoke')).code, 'QA_PASSPORT_EXPIRED');
  await enroll(16, ',24');
  const otherDevice = await one(`select public.enroll_guest_qa_passport($1::uuid,$2,$3::uuid) r`,
    [OPERATOR, 'b'.repeat(64), requestId(17)]);
  assert.equal(otherDevice.code, 'QA_DEVICE_LIMIT');
  assert.equal((await enroll(18, ',49')).code, 'QA_INVALID_POLICY');
  assert.equal((await enroll(19, ',null')).code, 'QA_INVALID_POLICY');

  // An explicit cap is still honored, for a deployment that sets one again.
  assert.equal((await enroll(20, ',24,1')).code, 'QA_DAILY_RESET_LIMIT');
  const capped = await enroll(16, ',24');
  assert.equal(capped.duplicate, true);
  await db.query(`update qa_private.guest_passports set paid_call_daily_limit=1 where id=$1`, [capped.passportId]);
  assert.equal((await claim(`qa:${capped.passportId}`, 'capped-1')).allowed, true);
  assert.equal((await claim(`qa:${capped.passportId}`, 'capped-2')).code, 'QA_DAILY_BUDGET_EXCEEDED');

  const grants = (await db.query(`select p.proname, has_function_privilege('anon', p.oid, 'execute') anon,
    has_function_privilege('service_role', p.oid, 'execute') service from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    and p.proname in ('enroll_guest_qa_passport','get_guest_qa_operator_status','claim_guest_qa_paid_call')
    order by p.proname`)).rows;
  assert.deepEqual(grants.map(row => [row.proname, row.anon, row.service]), [
    ['claim_guest_qa_paid_call', false, true],
    ['enroll_guest_qa_passport', false, true],
    ['get_guest_qa_operator_status', false, true],
  ], 'replaced RPCs keep service-role-only access');
  console.log('guest QA passport SQL checks passed');
} finally {
  await db.close();
}
