// Historical exact UI assertions executed under the guarded TesterArmy engine.
import type { Locator, Page } from 'playwright/test';
import { createParityTest, expect, type ParityInfo } from '../web-parity-fixtures';
import { PRACTICAL_DREAM_GUIDES } from '../../../data/practicalDreamGuides';
import curation from '../../../docs-src/static/data/curation-pages.json';
import dictionary from '../../../data/dream-symbols.json';

const test = createParityTest({ locale: 'fr-FR', viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris' });

const symbolIds = ['most-common-dream-symbols', 'scary-dream-symbols', 'animal-dream-symbols', 'water-dream-symbols'];
const guides = [
  ...PRACTICAL_DREAM_GUIDES.map((guide) => ({
    id: guide.id, ...guide.fr, metadata: `${guide.readingMinutes} min de lecture`,
  })),
  ...symbolIds.map((id) => {
    const guide = curation.pages.find((entry) => entry.id === id)!;
    return { id, ...guide.fr, metadata: `${guide.symbols.length} symboles` };
  }),
];

async function openGuides(page: Page, preference: 'light' | 'dark' | 'auto') {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  const appearance = page.getByTestId(`quick-settings.theme.${preference}`);
  await appearance.click();
  await page.getByTestId('quick-settings.close').click();
  await page.getByRole('tab', { name: 'Explorer', exact: true }).click();
  await expect(page.getByTestId('screen.explore')).toBeVisible();
  await page.getByTestId('btn.explorer.guides').click();
  await expect(page.getByTestId('screen.dreamGuides')).toBeVisible();
}

async function expectCompleteText(text: Locator, row: Locator) {
  await expect(text).toBeVisible();
  const rowBounds = (await row.boundingBox())!;
  const geometry = await text.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const fragments = Array.from(range.getClientRects());
    return {
      left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, viewportWidth: innerWidth,
      textLeft: Math.min(...fragments.map((rect) => rect.left)),
      textRight: Math.max(...fragments.map((rect) => rect.right)),
      textTop: Math.min(...fragments.map((rect) => rect.top)),
      textBottom: Math.max(...fragments.map((rect) => rect.bottom)),
    };
  });
  expect(geometry.textLeft).toBeGreaterThanOrEqual(0);
  // Visible serif glyphs and trailing spaces may overhang their line box.
  expect(geometry.textRight).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.textTop).toBeGreaterThanOrEqual(rowBounds.y - 1);
  expect(geometry.textBottom).toBeLessThanOrEqual(geometry.bottom + 1);
  expect(geometry.textBottom).toBeLessThanOrEqual(rowBounds.y + rowBounds.height + 1);
}

async function checkReading(page: Page) {
  const screen = page.getByTestId('screen.dreamGuides');
  await expect(screen.getByTestId(/^dream-guide-/)).toHaveCount(guides.length);
  const geometry = [];
  for (const guide of guides) {
    const row = screen.getByTestId(`dream-guide-${guide.id}`);
    await expect(row).toHaveRole('button');
    await expect(row).toContainText(guide.metadata);
    await expectCompleteText(row.getByText(guide.title, { exact: true }), row);
    await expectCompleteText(row.getByText(guide.metaDescription, { exact: true }), row);
    const bounds = (await row.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    geometry.push({ id: guide.id, ...bounds });
  }
  for (let i = 1; i < geometry.length; i++) {
    expect(geometry[i].y).toBeGreaterThanOrEqual(geometry[i - 1].y + geometry[i - 1].height);
  }
  await expect(screen).toContainText(`${dictionary.symbols.length} symboles`);
  const dictionaryButton = screen.getByTestId('btn.dreamGuides.dictionary');
  await expectCompleteText(dictionaryButton.getByText('Ouvrir le dictionnaire', { exact: true }), dictionaryButton);
  return geometry;
}

for (const theme of ['light', 'dark'] as const) {
  test(`guides preserve complete French promises and destinations in ${theme}`, async ({ page }, testInfo) => {
    await page.clock.setFixedTime(new Date('2026-10-03T12:00:00+02:00'));
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await openGuides(page, theme);
    const screen = page.getByTestId('screen.dreamGuides');
    const report = [{ viewport: '390', rows: await checkReading(page) }];
    await expect(screen).toHaveCSS('background-color', theme === 'light' ? 'rgb(240, 228, 212)' : 'rgb(3, 4, 13)');
    await page.screenshot({ path: testInfo.outputPath(`${theme}-390.png`) });

    if (theme === 'light') {
      for (const guide of guides) {
        await screen.getByTestId(`dream-guide-${guide.id}`).click();
        await expect(page).toHaveURL(new RegExp(`/dream-guide/${guide.id}$`));
        const detail = page.getByTestId('screen.dreamGuideDetail');
        await expect(detail.getByText(guide.title, { exact: true })).toBeVisible();
        await detail.getByRole('button', { name: 'Retour', exact: true }).click();
        await expect(screen).toBeVisible();
      }
      await screen.getByTestId('btn.dreamGuides.dictionary').click();
      await expect(page).toHaveURL(/\/symbol-dictionary$/);
      await expect(page.getByPlaceholder('Rechercher un symbole...')).toBeVisible();
      await page.getByRole('button', { name: 'Retour', exact: true }).filter({ visible: true }).click();
      await expect(screen).toBeVisible();
    }

    await page.setViewportSize({ width: 320, height: 568 });
    report.push({ viewport: '320', rows: await checkReading(page) });
    await page.screenshot({ path: testInfo.outputPath(`${theme}-320.png`) });
    // Browser-only enlargement stress: not proof of native Dynamic Type.
    const enlarged = await screen.evaluate((root) => {
      const text = Array.from(root.querySelectorAll<HTMLElement>('[dir="auto"]'))
        .map((element) => ({ element, style: getComputedStyle(element) }))
        .filter(({ style }) => /Fraunces|SpaceGrotesk/.test(style.fontFamily))
        .map(({ element, style }) => ({ element, size: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) }));
      text.forEach(({ element, size, lineHeight }) => {
        element.style.fontSize = `${size * 2}px`;
        element.style.lineHeight = `${lineHeight * 2}px`;
      });
      return text.length;
    });
    expect(enlarged).toBeGreaterThan(16);
    report.push({ viewport: '320, text 200%', rows: await checkReading(page) });
    const last = screen.getByTestId('dream-guide-water-dream-symbols');
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-320-large-text.png`) });
    await testInfo.attach('reading-geometry', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  });
}

test('guides follow the system preference and keep explicit appearance choices', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openGuides(page, 'auto');
  const screen = page.getByTestId('screen.dreamGuides');
  await expect(screen).toHaveCSS('background-color', 'rgb(240, 228, 212)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(screen).toHaveCSS('background-color', 'rgb(3, 4, 13)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(screen).toHaveCSS('background-color', 'rgb(240, 228, 212)');
});
