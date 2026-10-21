import { readDOM, byId, expectCSS, expectInViewport, setTestDate, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.

const test = createExactWebTest({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });

async function openExplorer(ui: ExactWebUI) {
  const { app, screen: uiScreen, browser } = ui;
  await setTestDate(browser, '2026-10-03T12:00:00+02:00');
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
  await uiScreen.getByTestId('tab.explore', { visible: true }).click();
  await expect(uiScreen.getByTestId('screen.explore', { visible: true })).toHaveCount(1);
}

async function chooseTheme(ui: ExactWebUI, theme: 'light' | 'dark' | 'auto') {
  const { screen: uiScreen, browser } = ui;
  await uiScreen.getByTestId('btn.header.explore.settings').click();
  await uiScreen.getByTestId(`quick-settings.theme.${theme}`).click();
  await uiScreen.getByTestId('quick-settings.close').click();
  // A closed button/container can be offscreen while drawer content still covers the page.
  await expectInViewport(uiScreen.getByTestId('quick-settings.profile'), browser, 0, false);
}

test('compact resources keep their descriptions and explicit or system themes', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await openExplorer(ui);
  const screen = uiScreen.getByTestId('screen.explore', { visible: true });
  // Sleep sounds are native-only; web must not invent a disabled destination.
  await expect(uiScreen.getByTestId('btn.explorer.sleepSounds')).toHaveCount(0);
  for (const theme of ['light', 'dark'] as const) {
    await chooseTheme(ui, theme);
    const background = theme === 'light' ? 'rgb(240, 228, 212)' : 'rgb(3, 4, 13)';
    await expectCSS(browser, byId('screen.explore'), 'background-color', background);
    await browser.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await expectCSS(browser, byId('screen.explore'), 'background-color', background);
    for (const id of ['btn.explorer.symbols', 'btn.explorer.guides']) {
      const row = uiScreen.getByTestId(id);
      const bounds = await row.boundingBox();
      expect(bounds?.height, 'A normal resource is compact without shrinking its tap area').toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeLessThan(110);
      expect(await readDOM(browser, byId(id), element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
    await expect(screen).toContainText('Images et thèmes de tes rêves.');
    await expect(screen).toContainText('Mieux te souvenir de tes rêves.');
    const change = await uiScreen.getByTestId('explorer-change-ritual').boundingBox();
    const navigation = await uiScreen.getByTestId('tab.explore', { visible: true }).boundingBox();
    expect(change!.y + change!.height, 'Both ritual actions stay above navigation in the nominal viewport').toBeLessThanOrEqual(navigation!.y);
    await app.screenshot(`explorer-${theme}-390.png`);
  }
  await chooseTheme(ui, 'auto');
  await browser.emulateMedia({ colorScheme: 'light' });
  await expectCSS(browser, byId('screen.explore'), 'background-color', 'rgb(240, 228, 212)');
  await browser.emulateMedia({ colorScheme: 'dark' });
  await expectCSS(browser, byId('screen.explore'), 'background-color', 'rgb(3, 4, 13)');
});

test('resource navigation and ritual cancellation, selection and return remain usable', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await openExplorer(ui);
  await chooseTheme(ui, 'light');
  await uiScreen.getByTestId('btn.explorer.symbols').click();
  await expect(browser).toHaveURL(/symbol-dictionary/);
  await expect(uiScreen.getByRole('textbox')).toBeVisible();
  await browser.back();
  await uiScreen.getByTestId('btn.explorer.guides').click();
  await expect(uiScreen.getByTestId('screen.dreamGuides')).toBeVisible();
  await browser.back();
  const open = uiScreen.getByTestId('btn.explorer.ritual');
  const change = uiScreen.getByTestId('explorer-change-ritual');
  await expect(open).toHaveAccessibleName('Continuer mon rituel : Rêver');
  await change.click();
  await uiScreen.getByTestId('ritual-choice-memory').click();
  await uiScreen.getByTestId('ritual-picker-close').click();
  await expect(change).toBeFocused();
  await expect(open).toHaveAccessibleName('Continuer mon rituel : Rêver');
  await change.click();
  await uiScreen.getByTestId('ritual-choice-memory').click();
  await uiScreen.getByTestId('ritual-picker-confirm').click();
  await expect(change).toBeFocused();
  await expect(open).toHaveAccessibleName('Continuer mon rituel : Se souvenir');
  await app.screenshot('explorer-selected-memory.png');
  await open.click();
  await expect(browser).toHaveURL(/ritual\/memory/);
  await expect(uiScreen.getByText('Préparer la mémoire', { exact: true })).toBeVisible();
  await browser.back();
  await expect(open).toHaveAccessibleName('Continuer mon rituel : Se souvenir');
  await change.click();
  await expect(uiScreen.getByTestId('ritual-choice-memory')).toHaveAttribute('aria-checked', 'true');
  await uiScreen.getByTestId('ritual-picker-confirm').click();
  await expect(change).toBeFocused();
});

test('narrow windows and doubled web text keep every action reachable', async (ui) => {
  const { app, screen: uiScreen, browser } = ui;
  await browser.setViewport({ width: 320, height: 568 });
  await openExplorer(ui);
  await chooseTheme(ui, 'dark');
  // Layout stress only: browser text doubling does not qualify native fontScale or TalkBack.
  await readDOM(browser, byId('screen.explore'), element => {
    for (const node of Array.from(element.querySelectorAll<HTMLElement>('[dir="auto"]'))) {
      if (!Array.from(node.childNodes).some(child => child.nodeType === Node.TEXT_NODE && /[a-zÀ-ÿ]/i.test(child.textContent ?? ''))) continue;
      const style = getComputedStyle(node);
      node.style.fontSize = `${parseFloat(style.fontSize) * 2}px`;
      node.style.lineHeight = `${parseFloat(style.lineHeight) * 2}px`;
    }
  });
  expect(await readDOM(browser, byId('screen.explore'), element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  for (const id of ['btn.explorer.symbols', 'btn.explorer.guides', 'btn.explorer.ritual', 'explorer-change-ritual']) {
    const control = uiScreen.getByTestId(id);
    await control.scrollIntoView();
    await expectInViewport(control, browser);
    expect(await readDOM(browser, byId(id), element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  await uiScreen.getByTestId('explorer-change-ritual').click();
  await expect(uiScreen.getByTestId('ritual-choice-lucid')).toBeVisible();
  await uiScreen.getByTestId('ritual-picker-close').click();
  await expect(uiScreen.getByTestId('explorer-change-ritual')).toBeFocused();
  await app.screenshot('explorer-dark-320-web-text-200.png');
});
