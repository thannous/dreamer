'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readLocalStatus } = require('./local-config.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ti528-status-'));
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));
function status(db, extra = {}) {
  const file = path.join(directory, 'status.json');
  fs.writeFileSync(file, JSON.stringify({ API_URL: 'http://127.0.0.1:55321', DB_URL: db, ...extra }));
  return file;
}
test('requires explicit local status rather than silently skipping qualification', () => {
  expect(() => readLocalStatus()).toThrow('no qualification was run');
});
test.each([
  'postgresql://127.0.0.1:55322/postgres',
  'postgres://postgres:postgres@127.0.0.1:55322/postgres',
])('accepts the isolated database URL %s', url => expect(readLocalStatus(status(url)).DB_URL).toBe(url));
test.each([
  'postgresql://remote.example:5432/postgres?marker=127.0.0.1:55322/',
  'postgresql://127.0.0.1.evil.example:55322/postgres',
  'postgresql://127.0.0.1:54322/postgres',
  'postgresql://127.0.0.1:55322/other',
  'https://127.0.0.1:55322/postgres',
  'postgresql://127.0.0.1:55322/postgres?host=remote.example',
])('rejects unsafe or unrelated database URL %s', url => expect(() => readLocalStatus(status(url))).toThrow());

const managed = (extra = {}) => ({
  API_URL: 'http://127.0.0.1:20710',
  DB_URL: 'postgresql://postgres:synthetic@127.0.0.1:32102/postgres',
  ANON_KEY: 'synthetic-public-key', SERVICE_ROLE_KEY: 'synthetic-private-key',
  LOCAL_E2E_STACK: { id: 'a'.repeat(64), runtime: 'native' },
  ...extra,
});
const managedFile = (extra = {}) => {
  const receipt = managed(extra);
  return status(receipt.DB_URL, receipt);
};
test('accepts an identified owned native stack receipt', () => {
  const receipt = managed({ LOCAL_E2E_STACK: { id: 'a'.repeat(64), runtime: 'native' } });
  expect(readLocalStatus(managedFile(receipt))).toEqual(receipt);
});
test.each([
  { API_URL: 'https://example.supabase.co' },
  { API_URL: 'http://localhost:20710' },
  { API_URL: 'http://127.0.0.1.example.test:20710' },
  { API_URL: 'http://user:password@127.0.0.1:20710' },
  { API_URL: 'http://127.0.0.1:20710?target=remote' },
  { DB_URL: 'postgresql://remote.example:32102/postgres' },
  { DB_URL: 'postgresql://127.0.0.1:20710/postgres' },
  { DB_URL: 'postgresql://127.0.0.1:32102/postgres?host=remote.example' },
  { DB_URL: 'postgresql://127.0.0.1:32102/postgres#remote' },
  { LOCAL_E2E_STACK: undefined },
  { LOCAL_E2E_STACK: { id: 'unknown', runtime: 'native' } },
  { LOCAL_E2E_STACK: { id: 'a'.repeat(64), runtime: 'remote' } },
  // Docker and Podman stacks were removed (2026-10-19); only the native runtime is owned.
  { LOCAL_E2E_STACK: { id: 'a'.repeat(64), runtime: 'docker' } },
  { LOCAL_E2E_STACK: { id: 'a'.repeat(64), runtime: 'podman' } },
  { SERVICE_ROLE_KEY: '' },
])('rejects unsafe or unidentified managed status %j before database access', (extra) => {
  expect(() => readLocalStatus(managedFile(extra))).toThrow();
});


test('qualifier passes only the validated database through child environment, never npm arguments', () => {
  const { runInNewContext } = require('node:vm');
  const receipt = managed();
  const children = [];
  const fakeRequire = (name) => {
    if (name === './local-config.cjs') return {
      readLocalStatus: (file) => { expect(file).toBe('/owned-status.json'); return receipt; },
    };
    if (name === 'node:child_process') return {
      spawnSync: (binary, argv, options) => { children.push({ binary, argv, env: options.env }); return { status: 0 }; },
    };
    return require(name);
  };
  runInNewContext(fs.readFileSync(path.join(__dirname, 'qualify-local.cjs'), 'utf8'), {
    require: fakeRequire, __dirname,
    process: { env: { TI528_LOCAL_STATUS: '/owned-status.json', SUPABASE_DB_URL: 'postgresql://remote.example/other' } },
  });
  expect(children).toHaveLength(2);
  expect(children[0].argv).toEqual(['run', 'db:contract:check:local']);
  for (const child of children) {
    expect(child.env.SUPABASE_DB_URL).toBe(receipt.DB_URL);
    expect(child.argv.some((arg) => arg.includes(receipt.DB_URL))).toBe(false);
  }
});
