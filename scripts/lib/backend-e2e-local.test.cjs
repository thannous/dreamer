'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assertBackendTarget, normalizeStackStatus, prepareLocalMigrations } = require('./backend-e2e-local.cjs');

const local = () => ({
  API_URL: 'http://127.0.0.1:20710', DB_URL: 'postgresql://postgres:postgres@127.0.0.1:32102/postgres',
  ANON_KEY: 'synthetic-public-key', SERVICE_ROLE_KEY: 'synthetic-private-key',
  LOCAL_E2E_STACK: { id: 'a'.repeat(64), runtime: 'native' },
});

// Exercising these mistakes against a real hosted backend would violate the local-only boundary.
test('hosted, ambiguous and unidentified targets fail before any privileged client is created', () => {
  for (const API_URL of ['https://example.supabase.co', 'http://127.0.0.1.example.test:20710',
    'https://127.0.0.1:20710', 'http://localhost:20710', 'http://127.0.0.1:20710/path',
    'http://127.0.0.1:20710?target=remote', 'http://127.0.0.1:8085']) {
    assert.throws(() => assertBackendTarget({ ...local(), API_URL }));
  }
  assert.throws(() => assertBackendTarget({ ...local(), LOCAL_E2E_STACK: undefined }));
  assert.throws(() => assertBackendTarget({ ...local(), LOCAL_E2E_STACK: { id: 'unknown', runtime: 'native' } }));
  assert.throws(() => assertBackendTarget({ ...local(), SERVICE_ROLE_KEY: '' }));
  assert.throws(() => assertBackendTarget({ ...local(), DB_URL: 'postgresql://postgres:postgres@example.test:32102/postgres' }));
});

test('a runtime exposing a non-loopback service cannot qualify as a local-only stack', () => {
  assert.throws(() => normalizeStackStatus({ id: 'a'.repeat(64), runtime: 'native', env: local(),
    endpoints: { 'database.sql': { address: '0.0.0.0' } } }));
});

// The UI suite cannot safely prove that an unattended scheduler never calls production.
test('fixture replay neutralizes external URLs and disables schedules without editing source migrations', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-local-migrations-test-'));
  try {
    const source = path.join(dir, 'source');
    const target = path.join(dir, 'target');
    fs.mkdirSync(source);
    const sql = "select cron.schedule('remote', '0 3 * * *', $$select net.http_post(url := 'https://example.test/production')$$);\n";
    fs.writeFileSync(path.join(source, 'migration.sql'), sql);
    assert.deepEqual(prepareLocalMigrations(source, target), { neutralizedUrls: 1, disabledSchedules: 1 });
    assert.equal(fs.readFileSync(path.join(source, 'migration.sql'), 'utf8'), sql);
    const fixture = fs.readFileSync(path.join(target, 'migration.sql'), 'utf8');
    assert.equal(fixture.includes('https://example.test'), false);
    assert.match(fixture, /http:\/\/127\.0\.0\.1:9\/local-e2e-disabled/);
    assert.match(fixture, /cron\.alter_job\(job_id := jobid, active := false\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
