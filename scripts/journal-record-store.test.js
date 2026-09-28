'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const Module = require('node:module');
function loadStore() {
  const file = path.join(__dirname, '../services/journalRecordStore.ts');
  const mod = new Module(file, module);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return mod.exports.createJournalRecordStore;
}
describe('journal records on real SQLite', () => {
  let dir, db, store, fail, encode;
  function open() {
    db = new DatabaseSync(path.join(dir, 'journal.db'));
    const adapter = {
      execAsync: async sql => db.exec(sql),
      getAllAsync: async (sql, ...args) => db.prepare(sql).all(...args),
      runAsync: async (sql, ...args) => {
        if (fail && sql.startsWith('INSERT INTO journal_records')) throw new Error('injected disk failure');
        return db.prepare(sql).run(...args);
      },
      withExclusiveTransactionAsync: async task => {
        db.exec('BEGIN IMMEDIATE');
        try { await task(adapter); db.exec('COMMIT'); }
        catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    };
    encode = jest.fn(async value => JSON.stringify(value));
    store = loadStore()({ database: async () => adapter, keyOf: row => row.key, encode,
      validate: row => typeof row?.key === 'string' });
  }
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamer-records-')); fail = false; open(); });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const legacy = async () => [{ key: 'a', text: 'original' }, { key: 'b', text: 'retained' }];
  it('rolls back interrupted migration and retries without consuming legacy data', async () => {
    fail = true;
    await expect(store.read('A', legacy)).rejects.toThrow('disk failure');
    fail = false; db.close(); open();
    expect(await store.read('A', legacy)).toEqual(await legacy());
    await store.write('A', [], legacy);
    db.close(); open();
    expect(await store.read('A', legacy)).toEqual([]);
  });
  it('acknowledges only committed changes, preserves other accounts and serializes only changed entities', async () => {
    const rows = await store.read('A', legacy);
    await store.read('B', legacy);
    encode.mockClear();
    const changed = [{ ...rows[0], text: 'new' }, rows[1]];
    await store.write('A', changed, legacy);
    expect(encode).toHaveBeenCalledTimes(1);
    fail = true;
    await expect(store.write('A', [{ key: 'c', text: 'uncommitted' }], legacy)).rejects.toThrow();
    fail = false; db.close(); open();
    expect(await store.read('A', legacy)).toEqual(changed);
    expect(await store.read('B', legacy)).toEqual(await legacy());
    await store.write('A', [changed[0]], legacy);
    expect(await store.read('A', legacy)).toEqual([changed[0]]);
  });
  it('keeps references across unchanged reads and invalidates on another committed revision', async () => {
    const first = await store.read('A', legacy);
    const second = await store.read('A', legacy);
    expect(second[0]).toBe(first[0]);
    encode.mockClear();
    await store.write('A', [{ ...first[0], text: 'edited' }, first[1]], legacy);
    expect(encode).toHaveBeenCalledTimes(1);
    db.prepare('UPDATE journal_records SET value=? WHERE scope=? AND identity=?')
      .run(JSON.stringify({ key: 'b', text: 'external' }), 'A', 'b');
    db.prepare('UPDATE journal_scopes SET revision=revision+1 WHERE scope=?').run('A');
    const refreshed = await store.read('A', legacy);
    expect(refreshed[1]).toEqual({ key: 'b', text: 'external' });
    expect(refreshed[1]).not.toBe(first[1]);
  });
  it('rejects corrupt rows and duplicate identities instead of falling back or truncating', async () => {
    await expect(store.write('A', [{ key: 'a' }, { key: 'a' }], legacy)).rejects.toThrow();
    await store.read('A', legacy);
    db.prepare('UPDATE journal_records SET value=? WHERE scope=?').run('broken json', 'A');
    db.close(); open();
    await expect(store.read('A', legacy)).rejects.toThrow();
  });
  it('keeps absence distinct from an explicitly empty journal and clears without resurrecting legacy', async () => {
    expect(await store.read('guest', async () => null)).toBeNull();
    await store.write('guest', [], async () => null);
    expect(await store.read('guest', async () => null)).toEqual([]);
    await store.clear('A');
    expect(await store.read('A', legacy)).toEqual([]);
  });
});
