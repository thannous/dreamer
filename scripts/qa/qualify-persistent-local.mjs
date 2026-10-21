// Integration contract on the outer runner's identified disposable native stack.
// Two cycles keep the same users; outer teardown still destroys the whole stack.
// This does not establish an always-available hosted identity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { assertBackendTarget } from '../lib/backend-e2e-local.cjs';
import { withPersistentAccounts } from '../lib/persistent-qa.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
let stage = 'owned-status';
async function main() {
  const workdir = process.env.E2E_QA_OWNED_WORKDIR;
  assert.ok(workdir && path.dirname(process.env.E2E_BACKEND_STATUS_FILE ?? '') === workdir, 'Owned status required');
  const status = JSON.parse(fs.readFileSync(process.env.E2E_BACKEND_STATUS_FILE, 'utf8'));
  const url = assertBackendTarget(status); // before SQL, clients or credentials are used
  stage = 'qa-schema';
  const schemaFile = fileURLToPath(new URL('account-leases.sql', import.meta.url));
  const query = spawnSync(process.env.E2E_QA_CLI, ['db', 'query', '--workdir', workdir, '--db-url', status.DB_URL,
    '--file', schemaFile, '--yes', '--output-format', 'json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (query.error || query.status !== 0) {
    // Classify known CLI/SQL failures without logging stderr, URLs or credentials.
    const diagnostic = `${query.stderr ?? ''}\n${query.stdout ?? ''}`;
    const reason = query.error ? 'CLI_SPAWN' : /multiple commands/i.test(diagnostic) ? 'MULTIPLE_COMMANDS'
      : /permission denied/i.test(diagnostic) ? 'SQL_PERMISSION'
      : /syntax error/i.test(diagnostic) ? 'SQL_SYNTAX'
      : /unknown flag|unexpected argument/i.test(diagnostic) ? 'CLI_ARGUMENT'
      : /refus|confirm|approval|read.only/i.test(diagnostic) ? 'CLI_CONFIRMATION' : 'UNCLASSIFIED';
    // Only a fixed dictionary of diagnostic words is printable, never raw output.
    const vocabulary = new Set('cannot insert multiple commands prepared statement query failed database connection connect does not exist parameter parameters sql file postgres server error protocol result set schema permission syntax unsupported notice'.split(' '));
    const hint = diagnostic.toLowerCase().split(/[^a-z]+/).filter(word => vocabulary.has(word)).slice(-24).join('-');
    stage = `qa-schema-${reason}:${hint}`;
    throw new Error('QA_LOCAL_SCHEMA_FAILED');
  }
  const admin = createClient(url.href, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const accounts = ['free', 'premium'].map(tier => ({ tier, email: `e2e+${tier}@qa.example.test` }));
  const config = { anonKey: status.ANON_KEY, passwords: {}, ids: {}, authDir: path.join(workdir, '.auth'), origin: 'http://127.0.0.1:8087' };
  const checked = result => { if (result.error) throw new Error('QA_LOCAL_API_FAILED'); return result.data; };
  // Existing native stack admin credential only, never a newly issued admin key.
  for (const { tier, email } of accounts) {
    stage = `create-${tier}`;
    config.passwords[tier] = `${randomUUID()}-Aa1!`;
    const { user } = checked(await admin.auth.admin.createUser({ email, password: config.passwords[tier], email_confirm: true }));
    config.ids[tier] = user.id;
    if (tier === 'premium') checked(await admin.rpc('apply_subscription_state_update', {
      p_user_id: user.id, p_tier: 'plus', p_is_active: true, p_source: 'local-persistent-qa', p_source_event_id: randomUUID(),
    }));
  }
  stage = 'sentinel';
  const sentinelRequest = randomUUID();
  checked(await admin.from('dreams').insert({ user_id: config.ids.free, client_request_id: sentinelRequest,
    title: 'Preserved QA team fixture', transcript: 'Synthetic pre-existing data', interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream' }));
  const context = { target: { url: url.origin, ref: 'owned-native-stack' }, accounts, fetch: globalThis.fetch };
  const cycles = [];
  for (let cycle = 0; cycle < 2; cycle++) {
    stage = `cycle-${cycle + 1}-preflight`;
    await withPersistentAccounts(context, config, async run => {
      stage = `cycle-${cycle + 1}-contention`;
      cycles.push(run.accounts);
      const leases = checked(await admin.from('qa_account_leases').select('user_id,run_id'));
      assert.equal(leases.length, 2, 'Both accounts exclusively held');
      assert.ok(leases.every(row => row.run_id === run.runId));
      await assert.rejects(withPersistentAccounts(context, config, () => assert.fail('Busy runner entered')), /QA_ACCOUNT_BUSY/);
      assert.deepEqual(checked(await admin.from('qa_account_leases').select('user_id,run_id')).sort((a,b) => a.user_id.localeCompare(b.user_id)),
        leases.sort((a,b) => a.user_id.localeCompare(b.user_id)), 'Contender did not release owner leases');
      // RLS: a normal free-user session cannot see or delete the Plus user's lock.
      stage = `cycle-${cycle + 1}-cross-account-rls`;
      const privateState = JSON.parse(fs.readFileSync(path.join(run.dir, 'free.json'), 'utf8'));
      const session = JSON.parse(privateState.origins[0].localStorage[0].value);
      const client = createClient(url.href, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${session.access_token}` } } });
      assert.equal(checked(await client.from('qa_account_leases').select('*')).length, 1);
      assert.equal(checked(await client.from('qa_account_leases').delete().eq('user_id', config.ids.premium).select()).length, 0);
      const forbidden = await client.from('qa_account_leases').insert({ user_id: config.ids.premium, run_id: randomUUID() });
      assert.ok(forbidden.error, 'Cross-account claim refused');
      assert.equal(checked(await admin.from('dreams').select('id')).length, 3, 'Sentinel and two run fixtures');
    });
    stage = `cycle-${cycle + 1}-post-cleanup`;
    assert.equal(checked(await admin.from('qa_account_leases').select('*')).length, 0, 'All leases released');
    const remaining = checked(await admin.from('dreams').select('user_id,client_request_id,title'));
    assert.equal(remaining.length, 1, 'Only pre-existing data survives');
    assert.equal(remaining[0].client_request_id, sentinelRequest);
    assert.equal(checked(await admin.auth.admin.getUserById(config.ids.free)).user.id, config.ids.free);
    assert.equal(checked(await admin.auth.admin.getUserById(config.ids.premium)).user.id, config.ids.premium);
  }
  assert.deepEqual(cycles[0], cycles[1], 'Auth identities retained across cycles');
  assert.deepEqual(fs.readdirSync(path.join(config.authDir, 'runs')), [], 'Private run files cleaned');
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (revision.status !== 0) throw new Error('QA_LOCAL_REVISION_FAILED');
  const receipt = { revision: revision.stdout.trim(), target: 'owned disposable loopback', runtime: 'native',
    cliVersion: process.env.E2E_QA_CLI_VERSION, cycles: 2, identitiesRetained: true, preExistingDataRetained: true,
    exclusiveLeaseContention: 'passed', crossAccountRls: 'passed', runDataAndSessionsCleaned: true,
    realServices: ['Supabase Auth', 'Postgres', 'PostgREST'], mockServices: [], hostedAvailability: 'unverified; stack destroyed by outer runner',
    rerun: 'npm run test:qa:local', completedAt: new Date().toISOString() };
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test-results/persistent-qa-local.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
  console.log('[persistent-qa] Native integration passed: two cycles, same identities, preserved data, exclusive leases, RLS and cleanup. Hosted availability unverified.');
}
main().catch(() => { console.error(`QA_LOCAL_QUALIFICATION_FAILED stage=${stage} (no credentials logged).`); process.exitCode = 1; });
