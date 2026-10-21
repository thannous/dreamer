import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { keyHeaders } from '../test-seed-users.mjs';
import { storageStateFor } from '../test-auth-setup.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const refuse = code => { throw new Error(`QA_${code}`); };
export const qaTitle = (runId, tier) => `QA:${runId}:${tier}`;

// Called only inside runGuarded, or against an identified owned native stack in
// the integration test. No admin key, provisioning, reset or user deletion here.
export async function withPersistentAccounts({ target, accounts, fetch }, config, body) {
  const runId = randomUUID();
  const states = [];
  let dir;
  let bodyError;
  let result;
  const request = async (pathname, { method = 'GET', token, data, headers = {} } = {}) => {
    let response;
    try {
      response = await fetch(`${target.url}${pathname}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: { ...keyHeaders(config.anonKey), ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json', ...headers },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    } catch { refuse('NETWORK_UNAVAILABLE'); }
    // Do not retain/print a remote error body or request payload: both can echo secrets.
    if (!response.ok) refuse(response.status === 409 && pathname.startsWith('/rest/v1/qa_account_leases') ? 'ACCOUNT_BUSY' : `HTTP_${response.status}`);
    if (response.status === 204) return null;
    const text = await response.text();
    try { return text ? JSON.parse(text) : null; } catch { refuse('INVALID_RESPONSE'); }
  };
  const privateDir = folder => {
    if (fs.existsSync(folder) && (fs.lstatSync(folder).isSymbolicLink() || !fs.statSync(folder).isDirectory())) refuse('PRIVATE_DIRECTORY');
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    fs.chmodSync(folder, 0o700);
  };
  const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  const writeFixture = async (state, pathname, options) => {
    try { return await request(pathname, options); }
    catch (error) {
      // The server may commit after the failed transport returns. An immediate
      // empty read/delete cannot establish rollback; keep recovery and ownership.
      if (error.message !== 'QA_ACCOUNT_BUSY') state.uncertainWrite = pathname;
      throw error;
    }
  };
  try {
    for (const { tier } of accounts) if (!UUID.test(config.ids[tier] ?? '')) refuse('PINNED_USER_ID_REQUIRED');
    if (new Set(accounts.map(({ tier }) => config.ids[tier])).size !== accounts.length) refuse('DISTINCT_ACCOUNTS_REQUIRED');
    await request('/auth/v1/health');
    // Confirm all identities, roles and read rights before claiming locks or writing fixtures.
    for (const { tier, email } of accounts) {
      const session = await request('/auth/v1/token?grant_type=password', { method: 'POST', data: { email, password: config.passwords[tier] } });
      const state = { tier, id: config.ids[tier], session, locked: false, requestId: randomUUID(), attempted: false };
      states.push(state);
      if (!session?.access_token || !session?.refresh_token || session.user?.id !== state.id || session.user?.email !== email) refuse('IDENTITY_MISMATCH');
      const user = await request('/auth/v1/user', { token: session.access_token });
      if (user?.id !== state.id || user?.email !== email) refuse('IDENTITY_MISMATCH');
      const actualTier = await request('/rest/v1/rpc/get_effective_subscription_tier', { method: 'POST', token: session.access_token, data: {} });
      if (actualTier !== (tier === 'premium' ? 'plus' : 'free')) refuse('TIER_MISMATCH');
      await request(`/rest/v1/dreams?select=id&user_id=eq.${state.id}&limit=1`, { token: session.access_token });
    }
    privateDir(config.authDir);
    privateDir(path.join(config.authDir, 'runs'));
    dir = path.join(config.authDir, 'runs', runId);
    privateDir(dir);
    write('manifest.json', { runId, target: target.ref, accounts: states.map(({ tier, id, requestId }) => ({ tier, id, requestId })) });
    for (const state of states) {
      state.lockAttempted = true;
      await writeFixture(state, '/rest/v1/qa_account_leases', { method: 'POST', token: state.session.access_token,
        data: { user_id: state.id, run_id: runId }, headers: { Prefer: 'return=minimal' } });
      state.locked = true;
    }
    for (const state of states) {
      write(`${state.tier}.json`, storageStateFor(target.ref, state.session, config.origin));
      // Register the exact request ID before the insert: a lost HTTP response
      // must still be cleaned up, without deleting any earlier account data.
      state.attempted = true;
      await writeFixture(state, '/rest/v1/dreams', { method: 'POST', token: state.session.access_token,
        data: { user_id: state.id, client_request_id: state.requestId, title: qaTitle(runId, state.tier),
          transcript: `${qaTitle(runId, state.tier)} synthetic reusable-account fixture`,
          interpretation: '', shareable_quote: '', dream_type: 'Symbolic Dream' },
        headers: { Prefer: 'return=minimal' } });
    }
    result = await body({ runId, dir, targetRef: target.ref, accounts: states.map(({ tier, id }) => ({ tier, id })) });
  } catch (error) { bodyError = error; }
  // A failed cleanup retains that lease and its private recovery manifest. Never
  // steal a lease by elapsed time: another machine may still own the account.
  const cleanupErrors = [];
  for (const state of [...states].reverse()) {
    const token = state.session?.access_token;
    if (!token) continue;
    if (state.uncertainWrite) { cleanupErrors.push('QA_WRITE_OUTCOME_UNCERTAIN'); continue; }
    let clean = true;
    try {
      if (state.attempted) {
        const filter = `user_id=eq.${state.id}&client_request_id=eq.${state.requestId}`;
        const rows = await request(`/rest/v1/dreams?select=id,title&${filter}`, { token });
        if (!Array.isArray(rows) || rows.some(row => row.title !== qaTitle(runId, state.tier))) refuse('CLEANUP_OWNERSHIP');
        await request(`/rest/v1/dreams?${filter}`, { method: 'DELETE', token, headers: { Prefer: 'return=minimal' } });
        const remaining = await request(`/rest/v1/dreams?select=id&${filter}`, { token });
        if (!Array.isArray(remaining) || remaining.length) refuse('CLEANUP_INCOMPLETE');
      }
      if (state.lockAttempted) {
        const rows = await request(`/rest/v1/qa_account_leases?user_id=eq.${state.id}&run_id=eq.${runId}`,
          { method: 'DELETE', token, headers: { Prefer: 'return=representation' } });
        if (!Array.isArray(rows) || (state.locked && rows.length !== 1) || rows.some(row => row.run_id !== runId)) refuse('LEASE_RELEASE');
      }
    } catch { clean = false; cleanupErrors.push('QA_CLEANUP_FAILED'); }
    if (clean) {
      try { await request('/auth/v1/logout?scope=local', { method: 'POST', token }); }
      catch { cleanupErrors.push('QA_SESSION_CLOSE_FAILED'); }
    }
  }
  if (dir && cleanupErrors.length) fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    runId, target: target.ref, status: 'recovery-required', accounts: states.map(({ tier, id, requestId, uncertainWrite }) => ({ tier, id, requestId, uncertainWrite })),
  }), { mode: 0o600 });
  if (dir && !cleanupErrors.length) fs.rmSync(dir, { recursive: true });
  if (bodyError && cleanupErrors.length) throw new AggregateError([bodyError], 'QA_RUN_FAILED_AND_CLEANUP_INCOMPLETE');
  if (bodyError) throw bodyError;
  if (cleanupErrors.length) refuse('CLEANUP_INCOMPLETE');
  return result;
}
