import { client, expect, login, restrictNetwork, test, type Account } from '../backend-fixtures';
import type { Page } from 'playwright/test';

async function openGuides(page: Page) {
  const settingsBack = page.getByTestId('settings.back');
  if (await settingsBack.isVisible()) await settingsBack.click();
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
  const visit = await owner.rpc('merge_guide_reading_progress', { ...args, p_section: 0, p_updated_at_ms: 300, p_completed_at_ms: null });
  expect(visit.error).toBeNull();
  expect(visit.data).toEqual([expect.objectContaining({ section: 1, updated_at_ms: 200, completed_at_ms: 100 })]);
  // Conversely, an older real bookmark replaces a newer visit on a fresh record.
  expect((await owner.rpc('merge_guide_reading_progress', { ...args, p_guide_id: 'remember-dreams', p_section: 0, p_updated_at_ms: 300, p_completed_at_ms: null })).error).toBeNull();
  const restored = await owner.rpc('merge_guide_reading_progress', { ...args, p_guide_id: 'remember-dreams', p_section: 3, p_updated_at_ms: 100, p_completed_at_ms: null });
  expect(restored.data).toEqual([expect.objectContaining({ section: 3, updated_at_ms: 100, completed_at_ms: null })]);
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

async function openAccountSettings(page: Page) {
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
}

async function signInExistingGuest(page: Page, account: Account, freshOnboarding = false) {
  await openAccountSettings(page);
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId('input.auth.email').fill(account.email);
  await page.getByTestId('input.auth.password').fill(account.password);
  await page.getByTestId('btn.auth.signIn').click();
  if (freshOnboarding) {
    // Only A inherits guest onboarding. B completes its own first-run flow.
    await expect(page.getByTestId('screen.onboarding')).toBeVisible();
    await page.getByTestId('btn.onboarding.intro.next').click();
    await page.getByTestId('btn.onboarding.skip').click();
  }
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await openAccountSettings(page);
  await expect(page.getByTestId('text.auth.email')).toContainText(account.email);
}

test('backend guide progress belongs to the first account even when all guides stay closed during account changes', async ({ page, accounts }) => {
  const owner = client(); const other = client();
  expect((await owner.auth.signInWithPassword(accounts.free)).error).toBeNull();
  expect((await other.auth.signInWithPassword(accounts.other)).error).toBeNull();
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await openGuides(page);
  await page.getByTestId('dream-guide-dream-journal').click();
  await page.getByTestId('guide.reading.complete').click();
  await expect(page.getByTestId('guide.reading.completed')).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page.getByTestId('screen.dreamGuides')).toHaveCount(0);
  await expect(page.getByTestId('screen.dreamGuideDetail')).toHaveCount(0);

  await signInExistingGuest(page, accounts.free);
  await expect.poll(async () => Boolean((await owner.from('guide_reading_progress').select('completed_at_ms').eq('guide_id', 'dream-journal').single()).data?.completed_at_ms)).toBe(true);
  await page.getByTestId('btn.auth.signOut').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await signInExistingGuest(page, accounts.other, true);
  await openGuides(page);
  await expect(page.getByTestId('guides.reading.summary')).toHaveText('0 of 8 guides completed');
  await expect(page.getByTestId('guide-progress-dream-journal')).toHaveText('Not opened');
  expect((await other.from('guide_reading_progress').select('guide_id')).data).toEqual([]);
  expect((await owner.from('guide_reading_progress').select('completed_at_ms').eq('guide_id', 'dream-journal').single()).data?.completed_at_ms).toBeGreaterThan(0);
});
