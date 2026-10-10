// Historical exact UI assertions executed under the guarded TesterArmy engine.
import type { Locator, Page } from 'playwright/test';
import { createParityTest, expect, type ParityInfo } from '../web-parity-fixtures';

const test = createParityTest({ locale: 'fr-FR', viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris' });

async function openDictionary(page: Page, theme: 'light' | 'dark' | 'auto' = 'light') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('btn.onboarding.feature.close').click();
  }
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.getByTestId('tab.explore').filter({ visible: true }).click();
  await page.getByTestId('btn.header.explore.settings').click();
  await page.getByTestId(`quick-settings.theme.${theme}`).click();
  await page.getByTestId('quick-settings.close').click();
  await expect(page.getByTestId('quick-settings.drawer')).not.toBeInViewport();
  await page.getByTestId('btn.explorer.symbols').click();
  await expect(page.getByTestId('screen.symbolDictionary').filter({ visible: true })).toBeVisible();
}

async function completeTitle(title: Locator, row: Locator) {
  await expect(title).toBeVisible();
  const box = (await row.boundingBox())!;
  const text = await title.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = Array.from(range.getClientRects());
    return { left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)),
      bottom: Math.max(...rects.map(r => r.bottom)), width: innerWidth };
  });
  expect(text.left).toBeGreaterThanOrEqual(0);
  expect(text.right).toBeLessThanOrEqual(text.width);
  expect(text.bottom).toBeLessThanOrEqual(box.y + box.height + 1);
}

for (const theme of ['light', 'dark'] as const) {
  test(`dictionary hierarchy, long titles and destinations in ${theme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await openDictionary(page, theme);
    const screen = page.getByTestId('screen.symbolDictionary').filter({ visible: true });
    await expect(screen).toHaveCSS('background-color', theme === 'light' ? 'rgb(240, 228, 212)' : 'rgb(3, 4, 13)');
    const search = page.getByPlaceholder('Rechercher un symbole...');
    const popular = page.getByTestId('symbol-popular');
    const modes = page.getByTestId('symbol-browse-modes');
    const searchBox = (await search.boundingBox())!;
    expect(searchBox.y).toBeLessThan((await popular.boundingBox())!.y);
    expect(searchBox.y).toBeLessThan((await modes.boundingBox())!.y);
    await page.getByTestId('symbol-letter-D').click();
    await expect(page.getByTestId('symbol-letter-D')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('symbol-list').getByTestId(/^symbol\.item\./)).toHaveCount(6);
    for (const [id, name] of [['deceased-person', 'Défunt / Personne décédée'], ['teeth', 'Dents (perdre ses dents)']]) {
      const row = page.getByTestId(`symbol.item.${id}`);
      await completeTitle(row.getByText(name, { exact: true }), row);
      await expect(row).toHaveRole('button');
    }
    await page.screenshot({ path: info.outputPath(`dictionary-${theme}-390-D.png`) });
    await page.getByTestId('symbol.item.deceased-person').click();
    await expect(page).toHaveURL(/symbol-detail\/deceased-person.*source=dictionary/);
    await expect(page.getByText('Interprétation', { exact: true })).toBeVisible();
    await page.goBack();
    await page.getByTestId('symbol-letter-D').click();
    await expect(page.getByTestId('symbol-letter-D')).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('symbol-popular').getByTestId('symbol.popular.water').click();
    await expect(page).toHaveURL(/symbol-detail\/water/);
    await page.goBack();
    await page.getByTestId('btn.symbolDictionary.guides').click();
    await expect(page.getByTestId('screen.dreamGuides')).toBeVisible();
    await page.getByTestId('btn.dreamGuides.dictionary').click();
    await expect(screen).toBeVisible();
    await page.getByTestId('symbol-dictionary-back').filter({ visible: true }).click();
    await expect(page.getByTestId('screen.dreamGuides')).toBeVisible();
  });
}

test('search matches accents and excerpts, resets unavailable letters and recovers from empty filters', async ({ page }, info) => {
  await openDictionary(page);
  const search = page.getByPlaceholder('Rechercher un symbole...');
  const rows = page.getByTestId('symbol-list').getByTestId(/^symbol\.item\./);
  await page.getByTestId('symbol-letter-D').click();
  await search.fill('poursuivi');
  await expect(rows).toHaveCount(2);
  await expect(page.getByTestId('symbol-letter-D')).toBeDisabled();
  await expect(page.getByTestId('symbol.item.police')).toBeVisible();
  await expect(page.getByTestId('symbol.item.chase')).toBeVisible();
  await page.getByTestId('symbol.item.police').click();
  await expect(page).toHaveURL(/symbol-detail\/police.*source=search/);
  await page.goBack();
  await expect(search).toHaveValue('poursuivi');
  await search.fill('defunt');
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId('symbol.item.deceased-person')).toBeVisible();
  await search.fill('astronaute');
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('Aucun symbole trouvé', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('dictionary-empty.png') });
  await page.getByTestId('symbol-search').getByRole('button').click();
  await expect(search).toHaveValue('');
  await expect(page.getByTestId('symbol.item.abandonment')).toBeVisible();
  await page.getByTestId('symbol-mode-theme').click();
  await page.getByTestId('symbol-category-actions').click();
  await expect(page.getByTestId('symbol.item.falling')).toBeVisible();
  await search.fill('poursuivi');
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId('symbol.item.chase')).toBeVisible();
  await page.getByTestId('symbol-category-nature').click();
  await expect(page.getByText('Aucun symbole trouvé', { exact: true })).toBeVisible();
  await page.getByTestId('symbol-search').getByRole('button').click();
  await expect(page.getByTestId('symbol.item.water')).toBeVisible();
  await page.getByTestId('symbol-category-nature').click();
  await expect(page.getByTestId('symbol-category-all')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('symbol-mode-alphabetical').click();
  await expect(page.getByTestId('symbol.item.abandonment')).toBeVisible();
  await page.screenshot({ path: info.outputPath('dictionary-recovered.png') });
});

test('system theme changes while dictionary is open', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openDictionary(page, 'auto');
  const screen = page.getByTestId('screen.symbolDictionary').filter({ visible: true });
  await expect(screen).toHaveCSS('background-color', 'rgb(240, 228, 212)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(screen).toHaveCSS('background-color', 'rgb(3, 4, 13)');
});

test('short viewports and doubled browser text keep filters and long results reachable', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openDictionary(page, 'dark');
  await page.getByTestId('symbol-letter-D').click();
  const screen = page.getByTestId('screen.symbolDictionary').filter({ visible: true });
  // Layout stress only: this does not qualify native Dynamic Type or screen-reader gestures.
  await screen.evaluate(root => {
    const texts = Array.from(root.querySelectorAll<HTMLElement>('[dir="auto"]'))
      .map(element => ({ element, style: getComputedStyle(element) }))
      .filter(({ style }) => /Fraunces|SpaceGrotesk/.test(style.fontFamily));
    for (const { element, style } of texts) {
      element.style.fontSize = `${parseFloat(style.fontSize) * 2}px`;
      element.style.lineHeight = `${parseFloat(style.lineHeight) * 2}px`;
    }
  });
  const long = page.getByTestId('symbol.item.deceased-person');
  await long.scrollIntoViewIfNeeded();
  await completeTitle(long.getByText('Défunt / Personne décédée', { exact: true }), long);
  await expect(long).toBeInViewport();
  await page.screenshot({ path: info.outputPath('dictionary-320-large-text.png') });
  await page.getByTestId('symbol-mode-theme').scrollIntoViewIfNeeded();
  await page.getByTestId('symbol-mode-theme').click();
  await page.getByTestId('symbol-category-actions').click();
  await expect(page.getByTestId('symbol.item.falling')).toBeVisible();
  await testInfoGeometry(page, info);
});

async function testInfoGeometry(page: Page, info: ParityInfo) {
  const bounds = await page.getByTestId('symbol-list').boundingBox();
  await info.attach('dictionary-layout', { body: JSON.stringify({ viewport: page.viewportSize(), list: bounds }), contentType: 'application/json' });
}

test('dictionary entered from onboarding returns to the main app', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('btn.onboarding.feature.close').click();
  }
  await page.getByTestId('btn.onboarding.path.dictionary').click();
  await page.getByTestId('btn.onboarding.primary').click();
  await expect(page).toHaveURL(/symbol-dictionary\?source=onboarding/);
  await expect(page.getByTestId('screen.symbolDictionary').filter({ visible: true })).toBeVisible();
  await page.getByTestId('symbol-dictionary-back').filter({ visible: true }).click();
  await expect(page.getByTestId('tab.explore').filter({ visible: true })).toBeVisible();
  await expect(page).not.toHaveURL(/symbol-dictionary/);
});
