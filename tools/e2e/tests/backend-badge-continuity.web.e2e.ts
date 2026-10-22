import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { assertBackendTarget } from '../../../scripts/lib/backend-e2e-local.cjs';
import { randomUUID } from 'node:crypto';
import { admin, test, expect, login, client, restrictNetwork } from '../backend-fixtures';

const empty = () => ({ version: 1, keys: {}, best: {}, earned: {}, revealed: {} });
const facts = (ids: string[], acquired = 12345) => ({
  ...empty(), keys: { 'symbol-explorer': ids },
  earned: ids.length >= 3 ? { 'symbol-explorer': [acquired] } : {},
});

test('badge RPC rejects foreign accounts and stale writes, bounds data and erases with its owner',
  { tags: ['badges', 'security', 'sync'] }, async ({ accounts }) => {
    const owner = client();
    const other = client();
    expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
    expect((await other.auth.signInWithPassword(accounts.other)).error).toBeNull();
    const args = { p_user_id: accounts.free.id, p_revision: null, p_ledger: null };
    const initial = await owner.rpc('sync_badge_ledger', args);
    expect(initial.error).toBeNull();
    expect(initial.data.revision).toBe(0);
    const first = await owner.rpc('sync_badge_ledger', { ...args, p_revision: 0, p_ledger: facts(['water', 'moon', 'sun']) });
    expect(first.error).toBeNull();
    expect(first.data.accepted).toBe(true);
    // A second device with the old revision gets the winning facts, without replacing them.
    const stale = await owner.rpc('sync_badge_ledger', { ...args, p_revision: 0, p_ledger: facts(['forest']) });
    expect(stale.error).toBeNull();
    expect(stale.data.accepted).toBe(false);
    expect(stale.data.ledger.earned['symbol-explorer']).toEqual([12345]);
    const merged = await owner.rpc('sync_badge_ledger', { ...args, p_revision: 1, p_ledger: facts(['water', 'moon', 'sun', 'forest']) });
    expect(merged.data.accepted).toBe(true);
    expect(merged.data.revision).toBe(2);
    for (const caller of [other, client()]) {
      const denied = await caller.rpc('sync_badge_ledger', args);
      expect(denied.error?.code).toBe('42501');
      const read = await caller.from('badge_ledgers').select('ledger').eq('user_id', accounts.free.id);
      if (read.error) expect(read.error.code).toBe('42501');
      expect(read.data ?? []).toEqual([]);
      const update = await caller.from('badge_ledgers').update({ ledger: empty() }).eq('user_id', accounts.free.id).select('user_id');
      if (update.error) expect(update.error.code).toBe('42501');
      expect(update.data ?? []).toEqual([]);
    }
    expect((await owner.from('badge_ledgers').update({ user_id: accounts.other.id }).eq('user_id', accounts.free.id)).error?.code).toBe('42501');
    for (const invalid of [
      { ...empty(), transcript: 'Private words must never be in badge storage' },
      { ...empty(), keys: { unknown: ['water'] } },
      { ...empty(), keys: { 'symbol-explorer': ['a'.repeat(513)] } },
      { ...empty(), keys: { 'symbol-explorer': Array.from({ length: 101 }, (_, i) => `entry-${i}`) } },
      { ...empty(), earned: { 'symbol-explorer': [1, 2, 3, 4] } },
    ]) {
      const rejected = await owner.rpc('sync_badge_ledger', { ...args, p_revision: 2, p_ledger: invalid });
      expect(rejected.error?.code).toBe('22023');
    }
    expect((await owner.rpc('sync_badge_ledger', args)).data.ledger.earned['symbol-explorer']).toEqual([12345]);

    // Dedicated disposable owner for the actual auth.users cascade, not an app reset.
    const extra = await admin.auth.admin.createUser({ email: `badge-delete-${randomUUID()}@example.test`, password: `E2e!${randomUUID()}`, email_confirm: true });
    expect(extra.error).toBeNull();
    const id = extra.data.user!.id;
    try {
      expect((await admin.from('badge_ledgers').insert({ user_id: id, ledger: facts(['water']) })).error).toBeNull();
    } finally {
      expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
    }
    expect((await admin.from('badge_ledgers').select('user_id').eq('user_id', id)).data).toEqual([]);
    await owner.auth.signOut();
    await other.auth.signOut();
  });

test('saved and reading badges restore on an empty browser with their original acquisition dates',
  { tags: ['badges', 'sync', 'restoration'] }, async ({ page, browserSurface, accounts }) => {
    const owner = client();
    expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
    await login(page, accounts.free);
    await page.getByTestId('settings.back').click();
    await page.getByRole('button', { name: 'Capture', exact: true }).click();
    await page.getByTestId('input.dreamTranscript').fill(`Badge continuity ${randomUUID()}: a quiet blue sea.`);
    await page.getByTestId('btn.saveDream').click();
    await page.getByTestId('btn.dreamCaptureSeal.readLater').click();
    await page.getByTestId('btn.navigateJournal').click();
    await page.getByTestId('tab.explore').filter({ visible: true }).click();
    await page.getByTestId('btn.explore.collection').filter({ visible: true }).click();
    // Simulate an unavailable backup service while the real journal/backend remain reachable.
    const backupRoute = '**/rest/v1/rpc/sync_badge_ledger';
    await page.route(backupRoute, route => route.abort());
    await page.getByTestId('collection.card.symbol-explorer').click();
    await page.getByTestId('collection.detail.action').filter({ visible: true }).click();
    await page.getByTestId('symbol.popular.water').filter({ visible: true }).click();
    await expect(page.getByTestId('screen.symbolDetail').filter({ visible: true })).toBeVisible();
    const remote = async () => {
      const result = await owner.rpc('sync_badge_ledger', { p_user_id: accounts.free.id, p_revision: null, p_ledger: null });
      expect(result.error).toBeNull();
      return result.data.ledger;
    };
    await expect.poll(() => page.evaluate((key: string) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw).keys['symbol-explorer'] : null;
    }, `noctalia_badge_ledger_v1:user:${accounts.free.id}`)).toEqual(['water']);
    // Reload exercises durable pending state, rather than relying on a still-live closure.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('screen.recording')).toBeVisible();
    await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
    await page.getByTestId('tab.explore').filter({ visible: true }).click();
    await page.getByTestId('btn.explore.collection').filter({ visible: true }).click();
    await expect(page.getByTestId('collection.sync-status')).toContainText('Account backup is pending');
    await page.unroute(backupRoute);
    // Reopening after connectivity recovers retries the durable local facts.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(async () => (await remote()).keys['symbol-explorer'], { timeout: 45_000 }).toEqual(['water']);
    await expect.poll(async () => (await remote()).earned['night-journal']?.length).toBe(1);
    const acquired = (await remote()).earned['night-journal'];

    const fresh = await browserSurface.newContext({ locale: 'en-US', serviceWorkers: 'block' });
    await restrictNetwork(fresh);
    const second = await fresh.newPage();
    try {
      await login(second, accounts.free);
      await second.getByTestId('settings.back').click();
      await second.getByTestId('tab.explore').filter({ visible: true }).click();
      await second.getByTestId('btn.explore.collection').filter({ visible: true }).click();
      await expect(second.getByTestId('collection.card.symbol-explorer'))
        .toHaveAttribute('aria-label', 'Symbol Explorer. Not earned yet. 1 of 3 toward Bronze');
      await expect(second.getByTestId('collection.card.night-journal')).toHaveAttribute('aria-label', /Bronze/);
      await expect(second.getByTestId('collection.sync-status')).toHaveText('Collection backed up to your account.');
      expect((await remote()).earned['night-journal']).toEqual(acquired);
    } finally {
      await fresh.close();
      await owner.auth.signOut();
    }
  });

// Auth signatures are tested by the existing login journeys. This transaction exercises
// the exact PostgreSQL authenticated role and signed-claim interpretation against real RLS;
// no OAuth provider, external identity or production registry is changed.
test('Dreamer badge and guide state reject other product scopes on the same account',
  { tags: ['badges', 'guides', 'security', 'product-scope'] }, async ({ accounts }) => {
    const status = JSON.parse(readFileSync(process.env.E2E_BACKEND_STATUS_FILE!, 'utf8'));
    assertBackendTarget(status);
    const { Client } = createRequire(import.meta.url)('pg');
    const db = new Client({ connectionString: status.DB_URL });
    const journalClient = `e2e-journal-${randomUUID()}`;
    const lucidClient = `e2e-lucid-${randomUUID()}`;
    await db.connect();
    try {
      await db.query('begin');
      await db.query('insert into app_authorization_private.oauth_clients(client_id, product) values ($1, $2), ($3, $4)',
        [journalClient, 'journal', lucidClient, 'lucid']);
      await db.query('insert into public.badge_ledgers(user_id, ledger) values ($1, $2)', [accounts.free.id, facts(['water'])]);
      await db.query('insert into public.guide_reading_progress(user_id,guide_id,section,updated_at_ms,completed_at_ms) values ($1,$2,2,100,100)',
        [accounts.free.id, 'dream-journal']);
      await db.query('set local role authenticated');
      const scopes = [
        { claims: {}, allowed: true, product: 'legacy' },
        { claims: { client_id: journalClient }, allowed: true, product: 'journal' },
        { claims: { client_id: lucidClient }, allowed: false, product: 'lucid' },
        { claims: { client_id: `e2e-meditation-${randomUUID()}` }, allowed: false, product: 'unknown' },
        { claims: { client_id: `e2e-unknown-${randomUUID()}` }, allowed: false, product: 'unknown' },
        { claims: { client_id: '' }, allowed: false, product: 'unknown' },
        // Editable app hints cannot turn a non-journal OAuth token into a journal token.
        { claims: { client_id: lucidClient, user_metadata: { product: 'journal', app_product: 'journal' } }, allowed: false, product: 'lucid' },
      ];
      for (const scope of scopes) {
        await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: accounts.free.id, role: 'authenticated', ...scope.claims })]);
        expect((await db.query('select public.current_app_product() as product')).rows[0].product).toBe(scope.product);
        for (const table of ['badge_ledgers', 'guide_reading_progress']) {
          const read = await db.query(`select user_id from public.${table} where user_id = $1`, [accounts.free.id]);
          expect(read.rowCount).toBe(scope.allowed ? 1 : 0);
          const update = await db.query(`update public.${table} set user_id = user_id where user_id = $1 returning user_id`, [accounts.free.id]);
          expect(update.rowCount).toBe(scope.allowed ? 1 : 0);
        }
        const calls = [
          { sql: 'insert into public.badge_ledgers(user_id) values ($1) on conflict (user_id) do nothing', args: [accounts.free.id] },
          { sql: 'insert into public.guide_reading_progress(user_id,guide_id,section,updated_at_ms,completed_at_ms) values ($1,$2,2,100,100) on conflict (user_id,guide_id) do nothing', args: [accounts.free.id, 'dream-journal'] },
          { sql: 'select public.sync_badge_ledger($1, null, null) as result', args: [accounts.free.id] },
          { sql: 'select public.merge_guide_reading_progress($1,$2,2,100,100) as result', args: [accounts.free.id, 'dream-journal'] },
        ];
        for (const call of calls) {
          await db.query('savepoint product_call');
          let code: string | undefined;
          try { await db.query(call.sql, call.args); }
          catch (error) { code = (error as { code?: string }).code; }
          await db.query('rollback to savepoint product_call');
          expect(code).toBe(scope.allowed ? undefined : '42501');
        }
      }
    } finally {
      await db.query('rollback');
      await db.end();
    }
  });
