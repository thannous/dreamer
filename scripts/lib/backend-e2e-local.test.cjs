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

async function runnerFixture(args, qualifyStatus = 0, startStatus = 0) {
  const { runInNewContext } = require('node:vm');
  const ownedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-backend-runner-test-'));
  const calls = [];
  const receipt = local();
  let failure;
  let qualifierReceipt;
  let config = '';
  try {
    fs.mkdirSync(path.join(ownedRoot, 'supabase'));
    fs.writeFileSync(path.join(ownedRoot, 'supabase/config.toml'), 'project_id = "fixture"\n[api]\nport = 54321\n[db]\nport = 54322\nsql_paths = ["./seed.sql"]\n[experimental]\nstack = true\n');
    const spawnSync = (binary, argv, options) => {
      calls.push({ binary, argv: [...argv], env: options.env });
      let stdout = '';
      if (argv[0] === '--version') stdout = '2.121.0';
      if (argv[0] === 'stack' && argv[1] === 'start') {
        config = fs.readFileSync(path.join(argv[argv.indexOf('--workdir') + 1], 'supabase/config.toml'), 'utf8');
        if (startStatus) return { status: startStatus, stdout: '' };
      }
      if (argv[0] === 'stack' && argv[1] === 'start') stdout = JSON.stringify({
        id: receipt.LOCAL_E2E_STACK.id, runtime: 'native', env: receipt,
        endpoints: { api: { address: '127.0.0.1' } },
      });
      if (argv[0] === 'db' && argv[1] === 'query') stdout = JSON.stringify({ rows: [{ active_jobs: 0 }] });
      if (argv[0] === '--run' && argv[1] === 'db:qualify:local') {
        qualifierReceipt = JSON.parse(fs.readFileSync(options.env.TI528_LOCAL_STATUS, 'utf8'));
      }
      return { status: argv[0] === '--run' || argv[0] === 'scripts/qa/qualify-persistent-local.mjs' ? qualifyStatus : 0, stdout };
    };
    const fakeRequire = (name) => {
      if (name === 'node:os') return { ...os, tmpdir: () => ownedRoot };
      if (name === 'node:child_process') return { spawnSync };
      if (name === './lib/backend-e2e-process.cjs') return {
        withOwnedProcess: action => action(async (binary, argv, options) => {
          const result = spawnSync(binary, argv, options);
          if (result.status !== 0) throw new Error(`${path.basename(binary)} failed (${result.status})`);
        }),
      };
      if (name === './lib/backend-e2e-local.cjs') return {
        assertBackendTarget, normalizeStackStatus,
        prepareLocalMigrations: () => ({ neutralizedUrls: 1, disabledSchedules: 1 }),
      };
      return require(name);
    };
    try {
      const entry = { exports: {} };
      runInNewContext(fs.readFileSync(path.join(__dirname, '../run-backend-e2e.cjs'), 'utf8'), {
        module: entry, require: fakeRequire, __dirname: path.join(ownedRoot, 'scripts'), console,
        process: { argv: [process.execPath, 'run-backend-e2e.cjs', ...args], execPath: process.execPath,
          platform: process.platform, env: { TI528_LOCAL_STATUS: '/unowned-status.json' } },
      });
      await entry.exports();
    } catch (error) { failure = error; }
    const leftovers = fs.readdirSync(ownedRoot).filter((name) => name.startsWith('noctalia-backend-e2e-'));
    return { calls, failure, qualifierReceipt, receipt, config, leftovers };
  } finally { fs.rmSync(ownedRoot, { recursive: true, force: true }); }
}

test('ordinary native backend run retains browser qualification without adding TI528', async () => {
  const result = await runnerFixture(['--runtime', 'native']);
  assert.equal(result.failure, undefined);
  assert.equal(result.calls.filter(({ argv }) => argv[0] === 'tools/e2e/run.mjs' && argv[1] === 'backend' && argv[2] === 'web').length, 1);
  assert.equal(result.calls.filter(({ argv }) => argv[0] === '--run').length, 0);
});

test('without --runtime the runner owns a native stack, never a container runtime, and leaves no temp workdir', async () => {
  const result = await runnerFixture([]);
  assert.equal(result.failure, undefined);
  const start = result.calls.find(({ argv }) => argv[0] === 'stack' && argv[1] === 'start');
  assert.deepEqual(start.argv.slice(start.argv.indexOf('--runtime'), start.argv.indexOf('--runtime') + 2), ['--runtime', 'native']);
  assert.equal(result.calls.some(({ binary }) => /^(docker|podman)/.test(path.basename(binary))), false);
  const browser = result.calls.find(({ argv }) => argv[0] === 'tools/e2e/run.mjs' && argv[1] === 'backend' && argv[2] === 'web');
  assert.equal(browser.env.E2E_BACKEND_RUNTIME, 'native');
  assert.deepEqual(result.leftovers, []);
});

for (const runtime of ['docker', 'podman']) test(`--runtime ${runtime} is refused before starting a process`, async () => {
  const result = await runnerFixture(['--runtime', runtime]);
  assert.match(result.failure?.message ?? '', /accepts only native/);
  assert.equal(result.calls.length, 0);
});

test('a failed native start is a failed run, and the browser journeys never run', async () => {
  const result = await runnerFixture([], 0, 1);
  assert.match(result.failure?.message ?? '', /failed \(1\)/);
  assert.equal(result.calls.some(({ argv }) => argv[0] === 'tools/e2e/run.mjs' && argv[1] === 'backend' && argv[2] === 'web'), false);
});

test('a committed stack setting is not duplicated in the disposable config', async () => {
  const result = await runnerFixture([]);
  assert.equal(result.failure, undefined);
  assert.equal((result.config.match(/^stack = true$/gm) ?? []).length, 1);
  assert.doesNotMatch(result.config, /^\s*port\s*=/m);
});

test('TI528 qualification uses this invocation receipt after browser journeys and before exact cleanup', async () => {
  const result = await runnerFixture(['--runtime', 'native', '--qualify-ti528']);
  assert.equal(result.failure, undefined);
  const browser = result.calls.findIndex(({ argv }) => argv[0] === 'tools/e2e/run.mjs' && argv[1] === 'backend' && argv[2] === 'web');
  const qualification = result.calls.findIndex(({ argv }) => argv[0] === '--run' && argv[1] === 'db:qualify:local');
  const cleanup = result.calls.findIndex(({ argv }) => argv[0] === 'stack' && argv[1] === 'destroy');
  assert.ok(browser >= 0 && qualification > browser && cleanup > qualification);
  assert.ok(!result.calls[browser].argv.includes('--qualify-ti528'));
  assert.match(result.calls[browser].env.E2E_BACKEND_RERUN, /--qualify-ti528/);
  assert.deepEqual(result.qualifierReceipt, result.receipt);
  assert.notEqual(result.calls[qualification].env.TI528_LOCAL_STATUS, '/unowned-status.json');
  assert.ok(result.calls[cleanup].argv.includes(result.receipt.LOCAL_E2E_STACK.id));
});

// The supplied VM mode ran the CLI's default container stack in a VM; it is gone with Docker.
for (const args of [
  ['--prepare-only'],
  ['--status-file', '/unowned-status.json'],
  ['--runtime', 'native', '--qualify-ti528', '--prepare-only'],
  ['--qualify-ti528', '--status-file', '/unowned-status.json'],
]) test(`removed VM mode option in ${args.join(' ')} is refused before starting a process`, async () => {
  const result = await runnerFixture(args);
  assert.match(result.failure?.message ?? '', /removed with the Docker VM mode/);
  assert.equal(result.calls.length, 0);
  assert.deepEqual(result.leftovers, []);
});

test('the former VM port 56321 is no longer an accepted backend target', () => {
  const { LOCAL_E2E_STACK, DB_URL, ...unidentified } = local();
  assert.throws(() => assertBackendTarget({ ...unidentified, API_URL: 'http://127.0.0.1:56321' }));
  assert.throws(() => assertBackendTarget({ ...local(), API_URL: 'http://127.0.0.1:56321' }));
  assert.ok(LOCAL_E2E_STACK && DB_URL);
});

test('TI528 failure remains a failed run and destroys only this invocation stack', async () => {
  const result = await runnerFixture(['--runtime', 'native', '--qualify-ti528'], 23);
  assert.match(result.failure?.message ?? '', /failed \(23\)/);
  const cleanups = result.calls.filter(({ argv }) => argv[0] === 'stack' && argv[1] === 'destroy');
  assert.equal(cleanups.length, 1);
  assert.ok(cleanups[0].argv.includes(result.receipt.LOCAL_E2E_STACK.id));
});

test('persistent QA qualification follows browser cases on the same owned native stack; failure still destroys it', async () => {
  for (const code of [0, 23]) {
    const result = await runnerFixture(['--qualify-persistent-qa'], code);
    if (code) assert.match(result.failure?.message ?? '', /failed \(23\)/);
    else assert.equal(result.failure, undefined);
    const browser = result.calls.findIndex(({ argv }) => argv[0] === 'tools/e2e/run.mjs');
    const qualifier = result.calls.findIndex(({ argv }) => argv[0] === 'scripts/qa/qualify-persistent-local.mjs');
    const cleanup = result.calls.findIndex(({ argv }) => argv[0] === 'stack' && argv[1] === 'destroy');
    assert.ok(qualifier > browser && cleanup > qualifier);
    assert.ok(!result.calls[browser].argv.includes('--qualify-persistent-qa'));
    assert.match(result.calls[browser].env.E2E_BACKEND_RERUN, /--qualify-persistent-qa/);
    assert.equal(path.dirname(result.calls[qualifier].env.E2E_BACKEND_STATUS_FILE), result.calls[qualifier].env.E2E_QA_OWNED_WORKDIR);
    assert.ok(result.calls[cleanup].argv.includes(result.receipt.LOCAL_E2E_STACK.id));
    assert.deepEqual(result.leftovers, []);
  }
});
