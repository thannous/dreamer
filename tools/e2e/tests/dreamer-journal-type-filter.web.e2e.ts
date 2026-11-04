// Found by the 3.8.0 bug bash: an unanalysed dream stored with the legacy default type reads
// "Unclassified" on its card, yet the type filter kept it under "Symbolic dream". The card,
// the filter and type search now read one shown type (lib/dreamFilters.ts). The mock journal
// holds eight dreams; The Broken Mirror was never analysed.
import { expect } from 'e2e';
import { test } from '../traced-parity-test';
import { webLocale } from '../web-engine';

test('the Symbolic dream filter lists only dreams the journal labels Symbolic dream', {
  tags: ['zone-journal', 'locale-en-US'],
  skip: webLocale !== 'en-US' ? 'Run E2E_WEB_LOCALE=en-US' : false,
}, async ({ app, screen, browser }) => {
  await app.open();
  // Tall enough for the desktop grid to draw all eight dreams, so no card is virtualised away.
  await browser.setViewport({ width: 1280, height: 1600 });
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const stop = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close').tap(); }
    finally { await stop(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  await screen.getByTestId(/^(btn\.recording\.home|tab\.home)$/, { visible: true }).first().tap();
  await screen.getByTestId('btn.header.home.settings').tap();
  await screen.getByTestId('quick-settings.all').tap();
  await screen.getByTestId('settings-account-open-signin').tap();
  await screen.getByTestId('btn.mockProfile.existing').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
  await screen.getByTestId('tab.journal', { visible: true }).tap();

  const cards = screen.getByTestId(/^dream\.item\./, { visible: true });
  // Without a filter the never-analysed dream reads as Unclassified.
  await expect(cards.filter({ hasText: 'The Broken Mirror' })).toContainText('Unclassified');

  await screen.getByTestId('btn.filterMore', { visible: true }).tap();
  const sheet = screen.getByTestId('modal.advancedFilters');
  await expect(sheet).toBeVisible();
  const symbolic = sheet.getByRole('button', 'Symbolic dream', { exact: true });
  await symbolic.tap();
  await expect(symbolic).toHaveAttribute('aria-pressed', 'true');
  await sheet.getByRole('button', 'Done').tap();
  await expect(screen.getByTestId('modal.advancedFilters', { visible: true })).toHaveCount(0);
  await expect(cards.filter({ hasText: 'The Infinite Library' })).toHaveCount(1);

  // Expected: every dream kept by "Symbolic dream" says Symbolic dream on its card.
  await expect(cards.filter({ hasText: 'Unclassified' })).toHaveCount(0);
  // Keep the filter while searching for the known unclassified dream. Its absence
  // must hold even in a short viewport where the list virtualizes offscreen cards.
  await browser.setViewport({ width: 390, height: 844 });
  await screen.getByTestId('input.searchDreams', { visible: true }).fill('The Broken Mirror');
  await expect(cards.filter({ hasText: 'The Broken Mirror' })).toHaveCount(0);
});
