import { expectInViewport, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
const test = createExactWebTest({ locale: 'fr-FR', reducedMotion: 'reduce' });

// Native Dynamic Type is qualified separately. This journey protects the shared
// responsive header from obscuring actions or remounting the search field.

test('journal search and settings remain reachable and preserve the query across widths', async (ui) => {
  const { app, screen, browser } = ui;
  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/');
  await screen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
  await screen.getByTestId('btn.onboarding.skip').click();
  await screen.getByTestId(/^(btn.recording.home|tab.home)$/, { visible: true }).click();
  await screen.getByTestId('btn.header.home.settings').click();
  await screen.getByTestId('quick-settings.all').click();
  await screen.getByTestId('settings-account-open-signin').click();
  await screen.getByTestId('btn.mockProfile.plus').click();
  await expectInViewport(screen.getByTestId('quick-settings.drawer'), browser, 0, false);
  await browser.setViewport({ width: 390, height: 844 });
  await screen.getByTestId('tab.journal', { visible: true }).click();

  const query = screen.getByTestId('input.searchDreams');
  const search = screen.getByTestId('component.searchBar');
  const settings = screen.getByTestId('btn.header.journal.settings');
  await query.fill('The Infinite Library');
  for (const width of [390, 320, 600, 390]) {
    await browser.setViewport({ width, height: 844 });
    await expect(query).toHaveValue('The Infinite Library');
    const header = screen.getByTestId('journal-search-controls');
    await expect(header.getByText('Noctalia', { exact: true })).toBeVisible();
    await expect(header.getByText('Journal', { exact: true })).toBeVisible();
    for (const control of [search, settings]) {
      await expectInViewport(control, browser);
      await expect.poll(async () => {
        const bounds = await control.boundingBox();
        return Boolean(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1
          && bounds.height >= 44);
      }).toBe(true);
    }
    await settings.click();
    await expect(screen.getByTestId('quick-settings.close')).toBeVisible();
    await screen.getByTestId('quick-settings.close').click();
    await expectInViewport(screen.getByTestId('quick-settings.drawer'), browser, 0, false);
    await expect(query).toHaveValue('The Infinite Library');
    await expect(screen.getByTestId(/^dream\.item\.\d+$/, { visible: true })).toHaveCount(1);
  }
  await app.screenshot('journal-search-settings-mobile.png');
});
