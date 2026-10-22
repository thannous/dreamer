import { client, expect, journal, login, restrictNetwork, test } from '../backend-fixtures';
import type { Page } from 'playwright/test';

async function openGuides(page: Page) {
  await journal(page);
  await page.getByTestId('tab.explore').filter({ visible: true }).click();
  await page.getByTestId('btn.explorer.guides').filter({ visible: true }).click();
  await expect(page.getByTestId('screen.dreamGuides')).toBeVisible();
}

test('backend guide progress enforces ownership and preserves completion across stale writes', async ({ accounts }) => {
  const owner = client(); const other = client(); const anonymous = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  expect((await other.auth.signInWithPassword(accounts.other)).error).toBeNull();
  const args = { p_user_id: accounts.free.id, p_guide_id: 'dream-journal', p_section: 3, p_updated_at_ms: 100, p_completed_at_ms: 100 };
  expect((await owner.rpc('merge_guide_reading_progress', args)).error).toBeNull();
  const stale = await owner.rpc('merge_guide_reading_progress', { ...args, p_section: 1, p_updated_at_ms: 50, p_completed_at_ms: null });
  expect(stale.error).toBeNull();
  expect(stale.data).toEqual([expect.objectContaining({ section: 3, updated_at_ms: 100, completed_at_ms: 100 })]);
  const newer = await owner.rpc('merge_guide_reading_progress', { ...args, p_section: 1, p_updated_at_ms: 200, p_completed_at_ms: null });
  expect(newer.data).toEqual([expect.objectContaining({ section: 1, updated_at_ms: 200, completed_at_ms: 100 })]);
  expect((await other.rpc('merge_guide_reading_progress', args)).error?.code).toBe('42501');
  expect((await anonymous.rpc('merge_guide_reading_progress', args)).error).not.toBeNull();
  expect((await other.from('guide_reading_progress').select('*').eq('user_id', accounts.free.id)).data).toEqual([]);
  expect((await owner.rpc('merge_guide_reading_progress', { ...args, p_guide_id: 'invented-guide' })).error?.code).toBe('23514');
  expect((await owner.rpc('merge_guide_reading_progress', { ...args, p_section: -1 })).error?.code).toBe('23514');
  expect((await other.from('guide_reading_progress').insert({ user_id: accounts.free.id, guide_id: 'remember-dreams', section: 0, updated_at_ms: 1 })).error?.code).toBe('42501');
  expect((await owner.from('guide_reading_progress').update({ user_id: accounts.other.id }).eq('guide_id', 'dream-journal')).error?.code).toBe('42501');
});

test('backend guide progress restores bookmarks and explicit completion in a fresh browser', async ({ page, accounts, browserSurface }) => {
  const owner = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  await login(page, accounts.free);
  await openGuides(page);
  await page.getByTestId('dream-guide-dream-journal').click();
  await page.getByTestId('guide.section.3').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('guide.reading.status')).toHaveText('In progress');
  await page.goBack();
  await expect.poll(async () => (await owner.from('guide_reading_progress').select('section').eq('guide_id', 'dream-journal').single()).data?.section ?? 0).toBeGreaterThan(0);
  await page.getByTestId('dream-guide-remember-dreams').click();
  await page.getByTestId('guide.reading.complete').click();
  await expect(page.getByTestId('guide.reading.completed')).toBeVisible();
  await expect.poll(async () => Boolean((await owner.from('guide_reading_progress').select('completed_at_ms').eq('guide_id', 'remember-dreams').single()).data?.completed_at_ms)).toBe(true);

  const fresh = await browserSurface.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  try {
    await restrictNetwork(fresh);
    const next = await fresh.newPage();
    await login(next, accounts.free);
    await openGuides(next);
    await expect(next.getByTestId('guides.reading.summary')).toHaveText('1 of 8 guides completed');
    await expect(next.getByTestId('guide-progress-dream-journal')).toHaveText('In progress');
    await expect(next.getByTestId('guide-progress-remember-dreams')).toHaveText('Completed');
    await next.getByTestId('guides.reading.resume').click();
    await expect(next.getByTestId('guide.reading.resume')).toBeVisible();
    await next.getByTestId('guide.reading.resume').click();
    await expect(next.getByTestId('guide.section.3')).toBeInViewport();
  } finally { await fresh.close(); }
});
