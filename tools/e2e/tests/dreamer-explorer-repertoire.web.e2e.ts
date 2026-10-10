// Historical exact UI assertions executed under the guarded TesterArmy engine.
import type { Page } from 'playwright/test';
import { createParityTest, expect } from '../web-parity-fixtures';

const test = createParityTest({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });

async function openExplorer(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-03T12:00:00+02:00'));
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') await page.getByTestId('btn.onboarding.feature.close').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.getByTestId('tab.explore').filter({ visible: true }).click();
  await expect(page.getByTestId('screen.explore').filter({ visible: true })).toHaveCount(1);
}

async function chooseTheme(page: Page, theme: 'light' | 'dark' | 'auto') {
  await page.getByTestId('btn.header.explore.settings').click();
  await page.getByTestId(`quick-settings.theme.${theme}`).click();
  await page.getByTestId('quick-settings.close').click();
}

test('compact resources keep their descriptions and explicit or system themes', async ({ page }, info) => {
  await openExplorer(page);
  const screen = page.getByTestId('screen.explore').filter({ visible: true });
  // Sleep sounds are native-only; web must not invent a disabled destination.
  await expect(page.getByTestId('btn.explorer.sleepSounds')).toHaveCount(0);
  for (const theme of ['light', 'dark'] as const) {
    await chooseTheme(page, theme);
    const background = theme === 'light' ? 'rgb(240, 228, 212)' : 'rgb(3, 4, 13)';
    await expect(screen).toHaveCSS('background-color', background);
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await expect(screen).toHaveCSS('background-color', background);
    for (const id of ['btn.explorer.symbols', 'btn.explorer.guides']) {
      const row = page.getByTestId(id);
      const bounds = await row.boundingBox();
      expect(bounds?.height, 'A normal resource is compact without shrinking its tap area').toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeLessThan(110);
      expect(await row.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
    await expect(screen).toContainText('Parcours des images et des thèmes qui peuvent nourrir ta réflexion.');
    await expect(screen).toContainText('Retrouve des repères concrets pour te souvenir et noter tes rêves.');
    const change = await page.getByTestId('explorer-change-ritual').boundingBox();
    const navigation = await page.getByTestId('tab.explore').filter({ visible: true }).boundingBox();
    expect(change!.y + change!.height, 'Both ritual actions stay above navigation in the nominal viewport').toBeLessThanOrEqual(navigation!.y);
    await page.screenshot({ path: info.outputPath(`explorer-${theme}-390.png`) });
  }
  await chooseTheme(page, 'auto');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(screen).toHaveCSS('background-color', 'rgb(240, 228, 212)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(screen).toHaveCSS('background-color', 'rgb(3, 4, 13)');
});

test('resource navigation and ritual cancellation, selection and return remain usable', async ({ page }, info) => {
  await openExplorer(page);
  await chooseTheme(page, 'light');
  await page.getByTestId('btn.explorer.symbols').click();
  await expect(page).toHaveURL(/symbol-dictionary/);
  await expect(page.getByRole('textbox')).toBeVisible();
  await page.goBack();
  await page.getByTestId('btn.explorer.guides').click();
  await expect(page.getByTestId('screen.dreamGuides')).toBeVisible();
  await page.goBack();
  const open = page.getByTestId('btn.explorer.ritual');
  const change = page.getByTestId('explorer-change-ritual');
  await expect(open).toHaveAccessibleName('Continuer mon rituel : Rêver');
  await change.click();
  await page.getByTestId('ritual-choice-memory').click();
  await page.getByTestId('ritual-picker-close').click();
  await expect(change).toBeFocused();
  await expect(open).toHaveAccessibleName('Continuer mon rituel : Rêver');
  await change.click();
  await page.getByTestId('ritual-choice-memory').click();
  await page.getByTestId('ritual-picker-confirm').click();
  await expect(change).toBeFocused();
  await expect(open).toHaveAccessibleName('Continuer mon rituel : Se souvenir');
  await page.screenshot({ path: info.outputPath('explorer-selected-memory.png') });
  await open.click();
  await expect(page).toHaveURL(/ritual\/memory/);
  await expect(page.getByText('Préparer la mémoire', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(open).toHaveAccessibleName('Continuer mon rituel : Se souvenir');
  await change.click();
  await expect(page.getByTestId('ritual-choice-memory')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('ritual-picker-confirm').click();
  await expect(change).toBeFocused();
});

test('narrow windows and doubled web text keep every action reachable', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openExplorer(page);
  await chooseTheme(page, 'dark');
  const screen = page.getByTestId('screen.explore').filter({ visible: true });
  // Layout stress only: browser text doubling does not qualify native fontScale or TalkBack.
  await screen.evaluate(element => {
    for (const node of Array.from(element.querySelectorAll<HTMLElement>('[dir="auto"]'))) {
      if (!Array.from(node.childNodes).some(child => child.nodeType === Node.TEXT_NODE && /[a-zÀ-ÿ]/i.test(child.textContent ?? ''))) continue;
      const style = getComputedStyle(node);
      node.style.fontSize = `${parseFloat(style.fontSize) * 2}px`;
      node.style.lineHeight = `${parseFloat(style.lineHeight) * 2}px`;
    }
  });
  expect(await screen.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  for (const id of ['btn.explorer.symbols', 'btn.explorer.guides', 'btn.explorer.ritual', 'explorer-change-ritual']) {
    const control = page.getByTestId(id);
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
    expect(await control.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  await page.getByTestId('explorer-change-ritual').click();
  await expect(page.getByTestId('ritual-choice-lucid')).toBeVisible();
  await page.getByTestId('ritual-picker-close').click();
  await expect(page.getByTestId('explorer-change-ritual')).toBeFocused();
  await page.screenshot({ path: info.outputPath('explorer-dark-320-web-text-200.png') });
});
