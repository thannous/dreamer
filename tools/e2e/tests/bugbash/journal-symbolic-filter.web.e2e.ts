import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../../web-fixtures';

test('the direct symbolic type filter excludes unclassified dreams', { tags: ['bugbash'] }, async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();

  // Seed the same synthetic journal as the bug-bash session, using the mock UI.
  const home = screen.getByTestId('btn.recording.home', { visible: true });
  if (await home.isVisible()) await home.tap();
  else await screen.getByTestId('tab.home', { visible: true }).tap();
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.all').tap();
  await screen.getByTestId('settings-account-open-signin').tap();
  await screen.getByTestId('btn.mockProfile.existing').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await screen.getByTestId('tab.journal', { visible: true }).tap();
  await screen.getByTestId(/^dream\.item\./, { visible: true }).first().tap();
  await screen.getByTestId('btn.dream.favorite', { visible: true }).tap();
  await expect.poll(() => browser.evaluate(() => JSON.parse(localStorage.getItem(
    'noctalia_mock_dogfood_v1:gemini_dream_journal_dreams',
  ) ?? '[]').length)).toBeGreaterThan(1);
  await browser.reload();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
  await screen.getByTestId('tab.journal', { visible: true }).tap();

  // Searching makes the last fixture card visible even when the journal virtualizes.
  const search = screen.getByTestId('input.searchDreams', { visible: true });
  const card = (title: string) => screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: title });
  await search.fill('The Broken Mirror');
  await expect(card('The Broken Mirror')).toHaveCount(1);
  await expect(card('The Broken Mirror')).toContainText('Unclassified');
  await expect(card('The Broken Mirror')).toContainText('Unanalyzed');
  await search.fill('');

  const filters = screen.getByTestId('modal.advancedFilters');
  await screen.getByTestId('btn.filterMore', { visible: true }).tap();
  await expect(filters).toBeVisible();
  const symbolic = filters.getByRole('button', 'Symbolic dream', { exact: true });
  await symbolic.tap();
  await expect(symbolic).toHaveAttribute('aria-pressed', 'true');
  await filters.getByRole('button', 'Done', { exact: true }).tap();
  await expect(filters).not.toBeVisible();
  await expect(card('The Infinite Library')).toContainText('Symbolic dream');

  // Retain the type filter while narrowing the list to the known unclassified
  // dream. This avoids confusing an unmounted virtualized card with absence.
  await search.fill('The Broken Mirror');
  await app.screenshot('symbolic-filter-unclassified-search');
  await expect(card('The Broken Mirror')).toHaveCount(0);
});
