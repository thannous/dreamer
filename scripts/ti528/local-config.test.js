'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readLocalStatus } = require('./local-config.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ti528-status-'));
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));
function status(db) {
  const file = path.join(directory, 'status.json');
  fs.writeFileSync(file, JSON.stringify({ API_URL: 'http://127.0.0.1:55321', DB_URL: db }));
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
