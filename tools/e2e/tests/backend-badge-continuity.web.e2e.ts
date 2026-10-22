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
