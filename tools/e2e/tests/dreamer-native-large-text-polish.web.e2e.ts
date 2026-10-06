// Historical UI assertions, run on the public TesterArmy web surface.
import { createParityTest, expect } from '../web-parity-fixtures';
const test = createParityTest();

// Native Dynamic Type is qualified separately. This journey protects the shared
// responsive header from obscuring actions or remounting the search field.
test.use({ locale: 'fr-FR', contextOptions: { reducedMotion: 'reduce' } });

test('journal search and settings remain reachable and preserve the query across widths', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await page.getByTestId('btn.recording.home').or(page.getByTestId('tab.home')).filter({ visible: true }).click();
  await page.getByTestId('btn.header.home.settings').click();
  await page.getByTestId('quick-settings.all').click();
  await page.getByTestId('settings-account-open-signin').click();
  await page.getByTestId('btn.mockProfile.plus').click();
  await expect(page.getByTestId('quick-settings.drawer')).not.toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('tab.journal').filter({ visible: true }).click();

  const query = page.getByTestId('input.searchDreams');
  const search = page.getByTestId('component.searchBar');
  const settings = page.getByTestId('btn.header.journal.settings');
  await query.fill('The Infinite Library');
  for (const width of [390, 320, 600, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(query).toHaveValue('The Infinite Library');
    const header = page.getByTestId('journal-search-controls');
    await expect(header.getByText('Noctalia', { exact: true })).toBeVisible();
    await expect(header.getByText('Journal', { exact: true })).toBeVisible();
    for (const control of [search, settings]) {
      await expect(control).toBeInViewport();
      await expect.poll(async () => {
        const bounds = await control.boundingBox();
        return Boolean(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1
          && bounds.height >= 44);
      }).toBe(true);
    }
    await settings.click();
    await expect(page.getByTestId('quick-settings.close')).toBeVisible();
    await page.getByTestId('quick-settings.close').click();
    await expect(page.getByTestId('quick-settings.drawer')).not.toBeInViewport();
    await expect(query).toHaveValue('The Infinite Library');
    await expect(page.getByTestId(/^dream\.item\.\d+$/).filter({ visible: true })).toHaveCount(1);
  }
  await page.screenshot({ path: info.outputPath('journal-search-settings-mobile.png') });
});
