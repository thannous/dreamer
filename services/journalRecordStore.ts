/** Incremental records with an atomic scope commit; no native imports in the engine. */
export type RecordTransaction = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
};
export type RecordDatabase = RecordTransaction & {
  withExclusiveTransactionAsync(task: (transaction: RecordTransaction) => Promise<void>): Promise<void>;
};
type Scope = { version: number; revision: number; present: number; record_count: number };
type Row = { identity: string; position: number; value: string };

export function createJournalRecordStore<T extends object>({ database, keyOf, encode, validate }: {
  database: () => Promise<RecordDatabase>;
  keyOf: (value: T) => string;
  encode: (value: T) => Promise<string>;
  validate: (value: unknown) => boolean;
}) {
  let ready: Promise<RecordDatabase> | undefined;
  let tail: Promise<unknown> = Promise.resolve();
  const snapshots = new Map<string, { revision: number; values: T[] }>();
  const remember = (scope: string, revision: number, values: T[]) => {
    snapshots.delete(scope);
    snapshots.set(scope, { revision, values });
    while (snapshots.size > 3) snapshots.delete(snapshots.keys().next().value!);
  };
  const serial = <R>(task: () => Promise<R>): Promise<R> => {
    const run = tail.catch(() => undefined).then(task);
    tail = run;
    return run;
  };
  const open = () => ready ??= database().then(async db => {
    await db.execAsync(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS journal_scopes (
        scope TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL,
        revision INTEGER NOT NULL, present INTEGER NOT NULL, record_count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS journal_records (
        scope TEXT NOT NULL, identity TEXT NOT NULL, position INTEGER NOT NULL,
        value TEXT NOT NULL, PRIMARY KEY(scope, identity));`);
    return db;
  }).catch(error => { ready = undefined; throw error; });
  const check = (values: T[]) => {
    const keys = new Set<string>();
    for (const value of values) {
      if (!validate(value)) throw new Error('Invalid journal record');
      const key = keyOf(value);
      if (!key || keys.has(key)) throw new Error('Duplicate or invalid journal identity');
      keys.add(key);
    }
  };
  const getScope = async (tx: RecordTransaction, scope: string) => {
    const [info] = await tx.getAllAsync<Scope>('SELECT version, revision, present, record_count FROM journal_scopes WHERE scope=?', scope);
    if (info && (info.version !== 1 || !Number.isSafeInteger(info.revision) || ![0, 1].includes(info.present))) {
      throw new Error('Unsupported journal record schema');
    }
    return info;
  };
  const ensureScope = async (tx: RecordTransaction, scope: string, legacy: () => Promise<T[] | null>) => {
    const existing = await getScope(tx, scope);
    if (existing) return existing;
    const values = await legacy(); // Read errors abort migration; never interpret them as empty.
    if (values !== null && !Array.isArray(values)) throw new Error('Invalid legacy journal');
    check(values ?? []);
    for (const [position, value] of (values ?? []).entries()) {
      await tx.runAsync('INSERT INTO journal_records(scope, identity, position, value) VALUES (?, ?, ?, ?)',
        scope, keyOf(value), position, await encode(value));
    }
    const info = { version: 1, revision: 0, present: values === null ? 0 : 1, record_count: values?.length ?? 0 };
    await tx.runAsync('INSERT INTO journal_scopes(scope, version, revision, present, record_count) VALUES (?, 1, 0, ?, ?)', scope, info.present, info.record_count);
    return info;
  };
  return {
    read: (scope: string, legacy: () => Promise<T[] | null>): Promise<T[] | null> => serial(async () => {
      const db = await open();
      let result: T[] | null = null;
      let revision = 0;
      await db.withExclusiveTransactionAsync(async tx => {
        const info = await ensureScope(tx, scope, legacy);
        revision = info.revision;
        if (!info.present) return;
        const rows = await tx.getAllAsync<Row>('SELECT identity, position, value FROM journal_records WHERE scope=? ORDER BY position', scope);
        if (rows.length !== info.record_count) throw new Error('Incomplete journal records');
        result = rows.map(row => {
          const value = JSON.parse(row.value) as T;
          if (!validate(value) || keyOf(value) !== row.identity) throw new Error('Corrupt journal record');
          return value;
        });
        check(result);
      });
      if (result !== null) remember(scope, revision, result);
      return result;
    }),
    write: (scope: string, values: T[], legacy: () => Promise<T[] | null>): Promise<void> => serial(async () => {
      check(values);
      const db = await open();
      let revision = 0;
      await db.withExclusiveTransactionAsync(async tx => {
        const info = await ensureScope(tx, scope, legacy);
        const snapshot = snapshots.get(scope);
        const previous = new Map(snapshot?.revision === info.revision
          ? snapshot.values.map((value, position) => [keyOf(value), { value, position }] as const) : []);
        const stored = await tx.getAllAsync<{ identity: string }>('SELECT identity FROM journal_records WHERE scope=?', scope);
        const remaining = new Set(stored.map(row => row.identity));
        for (const [position, value] of values.entries()) {
          const identity = keyOf(value);
          remaining.delete(identity);
          const old = previous.get(identity);
          if (old?.value === value) {
            if (old.position !== position) await tx.runAsync('UPDATE journal_records SET position=? WHERE scope=? AND identity=?', position, scope, identity);
          } else {
            await tx.runAsync(`INSERT INTO journal_records(scope, identity, position, value) VALUES (?, ?, ?, ?)
              ON CONFLICT(scope, identity) DO UPDATE SET position=excluded.position, value=excluded.value`,
            scope, identity, position, await encode(value));
          }
        }
        for (const identity of remaining) await tx.runAsync('DELETE FROM journal_records WHERE scope=? AND identity=?', scope, identity);
        revision = info.revision + 1;
        await tx.runAsync('UPDATE journal_scopes SET revision=?, present=1, record_count=? WHERE scope=?', revision, values.length, scope);
      });
      // Publish only after COMMIT. Failed writes cannot poison the reference cache.
      remember(scope, revision, values);
    }),
    clear: (scope: string): Promise<void> => serial(async () => {
      const db = await open();
      await db.withExclusiveTransactionAsync(async tx => {
        await tx.runAsync('DELETE FROM journal_records WHERE scope=?', scope);
        await tx.runAsync(`INSERT INTO journal_scopes(scope, version, revision, present, record_count) VALUES (?, 1, 0, 1, 0)
          ON CONFLICT(scope) DO UPDATE SET revision=revision+1, present=1, record_count=0`, scope);
      });
      snapshots.delete(scope);
    }),
  };
}
