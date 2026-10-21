import { readDOM, byId, expectCSS, expectInViewport, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
import type { Locator } from 'e2e';

const test = createExactWebTest({ locale: 'fr-FR', viewport: { width: 390, height: 844 } });

async function openDictionary(ui: ExactWebUI, theme: 'light' | 'dark' | 'auto' = 'light') {
  const { app, screen: uiScreen, browser } = ui;
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
  await uiScreen.getByTestId('tab.explore', { visible: true }).click();
  await uiScreen.getByTestId('btn.header.explore.settings').click();
  await uiScreen.getByTestId(`quick-settings.theme.${theme}`).click();
  await uiScreen.getByTestId('quick-settings.close').click();
  await expectInViewport(uiScreen.getByTestId('quick-settings.drawer'), browser, 0, false);
  await uiScreen.getByTestId('btn.explorer.symbols').click();
  await expect(uiScreen.getByTestId('screen.symbolDictionary', { visible: true })).toBeVisible();
}

async function completeTitle(browser: ExactWebUI['browser'], title: Locator, row: Locator, id: string, name: string) {
  await expect(title).toBeVisible();
  const box = (await row.boundingBox())!;
  const text = await browser.evaluate(({ id, name }) => {
    const row = document.querySelector(`[data-testid="${id}"]`)!;
    const element = Array.from(row.querySelectorAll<HTMLElement>('[dir="auto"]')).find(node => node.textContent === name)!;
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = Array.from(range.getClientRects());
    return { left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)),
      bottom: Math.max(...rects.map(r => r.bottom)), width: innerWidth };
  }, { id, name });
  expect(text.left).toBeGreaterThanOrEqual(0);
  expect(text.right).toBeLessThanOrEqual(text.width);
  expect(text.bottom).toBeLessThanOrEqual(box.y + box.height + 1);
}

for (const theme of ['light', 'dark'] as const) {
  test(`dictionary hierarchy, long titles and destinations in ${theme}`, async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
    await browser.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await openDictionary(ui, theme);
      await expectCSS(browser, byId('screen.symbolDictionary'), 'background-color', theme === 'light' ? 'rgb(240, 228, 212)' : 'rgb(3, 4, 13)');
    const search = uiScreen.getByPlaceholder('Rechercher un symbole...');
    const popular = uiScreen.getByTestId('symbol-popular');
    const modes = uiScreen.getByTestId('symbol-browse-modes');
    const searchBox = (await search.boundingBox())!;
    expect(searchBox.y).toBeLessThan((await popular.boundingBox())!.y);
    expect(searchBox.y).toBeLessThan((await modes.boundingBox())!.y);
    await uiScreen.getByTestId('symbol-letter-D').click();
    await expect(uiScreen.getByTestId('symbol-letter-D')).toHaveAttribute('aria-pressed', 'true');
    await expect(uiScreen.getByTestId('symbol-list').getByTestId(/^symbol\.item\./)).toHaveCount(9);
    for (const [id, name] of [['deceased-person', 'Défunt / Personne décédée'], ['teeth', 'Dents (perdre ses dents)']]) {
      const row = uiScreen.getByTestId(`symbol.item.${id}`);
      await completeTitle(browser, row.getByText(name, { exact: true }), row, `symbol.item.${id}`, name);
      // A row opens the sheet through its href, so the web reads it as a link (Enter opens it).
      await expect.poll(() => readDOM(browser, byId(`symbol.item.${id}`), element => element.getAttribute('role') ?? (element.tagName === 'A' && element.hasAttribute('href') ? 'link' : null))).toBe('link');
    }
    await app.screenshot(`dictionary-${theme}-390-D.png`);
    await uiScreen.getByTestId('symbol.item.deceased-person').click();
    await expect(browser).toHaveURL(/symbol-detail\/deceased-person.*source=dictionary/);
    await expect(uiScreen.getByText('Interprétation', { exact: true })).toBeVisible();
    await browser.back();
    await uiScreen.getByTestId('symbol-letter-D').click();
    await expect(uiScreen.getByTestId('symbol-letter-D')).toHaveAttribute('aria-pressed', 'false');
    await uiScreen.getByTestId('symbol-popular').getByTestId('symbol.popular.water').click();
    await expect(browser).toHaveURL(/symbol-detail\/water/);
    await browser.back();
    await uiScreen.getByTestId('btn.symbolDictionary.guides').click();
    await expect(uiScreen.getByTestId('screen.dreamGuides')).toBeVisible();
    await uiScreen.getByTestId('btn.dreamGuides.dictionary').click();
    await expect(uiScreen.getByTestId('screen.symbolDictionary', { visible: true })).toBeVisible();
    await uiScreen.getByTestId('symbol-dictionary-back', { visible: true }).click();
    await expect(uiScreen.getByTestId('screen.dreamGuides')).toBeVisible();
  });
}

test('search matches accents and excerpts, resets unavailable letters and recovers from empty filters', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await openDictionary(ui);
  const search = uiScreen.getByPlaceholder('Rechercher un symbole...');
  const rows = uiScreen.getByTestId('symbol-list').getByTestId(/^symbol\.item\./);
  await uiScreen.getByTestId('symbol-letter-D').click();
  await search.fill('poursuivi');
  await expect(rows).toHaveCount(2);
  await expect(uiScreen.getByTestId('symbol-letter-D')).toBeDisabled();
  await expect(uiScreen.getByTestId('symbol.item.police')).toBeVisible();
  await expect(uiScreen.getByTestId('symbol.item.chase')).toBeVisible();
  await uiScreen.getByTestId('symbol.item.police').click();
  await expect(browser).toHaveURL(/symbol-detail\/police.*source=search/);
  await browser.back();
  await expect(search).toHaveValue('poursuivi');
  await search.fill('defunt');
  await expect(rows).toHaveCount(1);
  await expect(uiScreen.getByTestId('symbol.item.deceased-person')).toBeVisible();
  await search.fill('astronaute');
  await expect(rows).toHaveCount(0);
  await expect(uiScreen.getByText('Aucun symbole trouvé', { exact: true })).toBeVisible();
  await app.screenshot('dictionary-empty.png');
  await uiScreen.getByTestId('symbol-search').getByRole('button').click();
  await expect(search).toHaveValue('');
  await expect(uiScreen.getByTestId('symbol.item.abandonment')).toBeVisible();
  await uiScreen.getByTestId('symbol-mode-theme').click();
  await uiScreen.getByTestId('symbol-category-actions').click();
  await expect(uiScreen.getByTestId('symbol.item.falling')).toBeVisible();
  await search.fill('poursuivi');
  await expect(rows).toHaveCount(1);
  await expect(uiScreen.getByTestId('symbol.item.chase')).toBeVisible();
  await uiScreen.getByTestId('symbol-category-nature').click();
  await expect(uiScreen.getByText('Aucun symbole trouvé', { exact: true })).toBeVisible();
  await uiScreen.getByTestId('symbol-search').getByRole('button').click();
  await expect(uiScreen.getByTestId('symbol.item.water')).toBeVisible();
  await uiScreen.getByTestId('symbol-category-nature').click();
  await expect(uiScreen.getByTestId('symbol-category-all')).toHaveAttribute('aria-pressed', 'true');
  await uiScreen.getByTestId('symbol-mode-alphabetical').click();
  await expect(uiScreen.getByTestId('symbol.item.abandonment')).toBeVisible();
  await app.screenshot('dictionary-recovered.png');
});

test('system theme changes while dictionary is open', async (ui) => {
  const { browser } = ui;
  await browser.emulateMedia({ colorScheme: 'light' });
  await openDictionary(ui, 'auto');
  await expectCSS(browser, byId('screen.symbolDictionary'), 'background-color', 'rgb(240, 228, 212)');
  await browser.emulateMedia({ colorScheme: 'dark' });
  await expectCSS(browser, byId('screen.symbolDictionary'), 'background-color', 'rgb(3, 4, 13)');
});

test('short viewports and doubled browser text keep filters and long results reachable', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await browser.setViewport({ width: 320, height: 568 });
  await openDictionary(ui, 'dark');
  await uiScreen.getByTestId('symbol-letter-D').click();
  // Layout stress only: this does not qualify native Dynamic Type or screen-reader gestures.
  await readDOM(browser, byId('screen.symbolDictionary'), root => {
    const texts = Array.from(root.querySelectorAll<HTMLElement>('[dir="auto"]'))
      .map(element => ({ element, style: getComputedStyle(element) }))
      .filter(({ style }) => /Fraunces|Outfit/.test(style.fontFamily));
    for (const { element, style } of texts) {
      element.style.fontSize = `${parseFloat(style.fontSize) * 2}px`;
      element.style.lineHeight = `${parseFloat(style.lineHeight) * 2}px`;
    }
  });
  const long = uiScreen.getByTestId('symbol.item.deceased-person');
  await long.scrollIntoView();
  await completeTitle(browser, long.getByText('Défunt / Personne décédée', { exact: true }), long, 'symbol.item.deceased-person', 'Défunt / Personne décédée');
  await expectInViewport(long, browser);
  await app.screenshot('dictionary-320-large-text.png');
  await uiScreen.getByTestId('symbol-mode-theme').scrollIntoView();
  await uiScreen.getByTestId('symbol-mode-theme').click();
  await uiScreen.getByTestId('symbol-category-actions').click();
  await expect(uiScreen.getByTestId('symbol.item.falling')).toBeVisible();
  await testInfoGeometry(ui);
});

async function testInfoGeometry(ui: ExactWebUI) {
  const { screen: uiScreen, browser, artifacts } = ui;
  const bounds = await uiScreen.getByTestId('symbol-list').boundingBox();
  await artifacts.attach('dictionary-layout', { body: JSON.stringify({ viewport: await browser.evaluate(() => ({ width: innerWidth, height: innerHeight })), list: bounds }), contentType: 'application/json' });
}

test('dictionary entered from onboarding returns to the main app', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.path.dictionary').click();
  await uiScreen.getByTestId('btn.onboarding.primary').click();
  await expect(browser).toHaveURL(/symbol-dictionary\?source=onboarding/);
  await expect(uiScreen.getByTestId('screen.symbolDictionary', { visible: true })).toBeVisible();
  await uiScreen.getByTestId('symbol-dictionary-back', { visible: true }).click();
  await expect(uiScreen.getByTestId('tab.explore', { visible: true })).toBeVisible();
  await expect(browser).not.toHaveURL(/symbol-dictionary/);
});
