'use strict';
const fs = require('node:fs');
const path = require('node:path');

function assertBackendTarget(status) {
  const url = new URL(status.API_URL);
  const stack = status.LOCAL_E2E_STACK;
  const managed = stack && /^[a-f0-9]{64}$/.test(stack.id) && stack.runtime === 'native';
  const port = Number(url.port);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      // Only an identified native stack qualifies (the fixed-port supplied VM mode was removed).
      !managed || port < 20000 || port > 32767 ||
      typeof status.ANON_KEY !== 'string' || !status.ANON_KEY.trim() ||
      typeof status.SERVICE_ROLE_KEY !== 'string' || !status.SERVICE_ROLE_KEY.trim()) {
    throw new Error('Backend E2E requires an identified disposable loopback API, never a hosted backend');
  }
  const db = new URL(status.DB_URL);
  const dbPort = Number(db.port);
  if (db.protocol !== 'postgresql:' || db.hostname !== '127.0.0.1' || db.pathname !== '/postgres' ||
      db.search || db.hash || dbPort < 20000 || dbPort > 32767 || dbPort === port) {
    throw new Error('Managed backend E2E requires a separate loopback database port');
  }
  return url;
}

function normalizeStackStatus(payload) {
  const status = {
    API_URL: payload.env?.API_URL,
    DB_URL: payload.env?.DB_URL,
    ANON_KEY: payload.env?.ANON_KEY,
    SERVICE_ROLE_KEY: payload.env?.SERVICE_ROLE_KEY,
    LOCAL_E2E_STACK: { id: payload.id, runtime: payload.runtime },
  };
  assertBackendTarget(status);
  for (const endpoint of Object.values(payload.endpoints ?? {})) {
    if (endpoint.address !== '127.0.0.1') throw new Error('Local stack has a non-loopback endpoint');
  }
  return status;
}

function prepareLocalMigrations(source, target) {
  fs.cpSync(source, target, { recursive: true });
  let neutralizedUrls = 0;
  let disabledSchedules = 0;
  for (const file of fs.readdirSync(target)) {
    if (!file.endsWith('.sql')) continue;
    const fullPath = path.join(target, file);
    let sql = fs.readFileSync(fullPath, 'utf8');
    // Fixture copies only: historical reconciliation jobs contain a production URL.
    // Neutralize it before replay, even though a fresh local Vault has no credential.
    sql = sql.replace(/https?:\/\/[^'\s]+/g, () => {
      neutralizedUrls++;
      return 'http://127.0.0.1:9/local-e2e-disabled';
    });
    if (sql.includes('cron.schedule(')) {
      disabledSchedules++;
      sql += '\n-- Disposable backend E2E: disable scheduled work before this migration commits.\n' +
        'select cron.alter_job(job_id := jobid, active := false) from cron.job where active;\n';
    }
    fs.writeFileSync(fullPath, sql, { mode: 0o600 });
  }
  return { neutralizedUrls, disabledSchedules };
}

module.exports = { assertBackendTarget, normalizeStackStatus, prepareLocalMigrations };
