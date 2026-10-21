import { readDOM, byId, expectCSS, expectInViewport, setTestDate, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
import { PRACTICAL_DREAM_GUIDES } from '../../../data/practicalDreamGuides';
import curation from '../../../docs-src/static/data/curation-pages.json';
import dictionary from '../../../data/dream-symbols.json';

const test = createExactWebTest({ locale: 'fr-FR', viewport: { width: 390, height: 844 } });

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

async function openGuides(ui: ExactWebUI, preference: 'light' | 'dark' | 'auto') {
  const { app, screen: uiScreen, browser } = ui;
  await app.open('/');
  await uiScreen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => uiScreen.getByTestId('btn.onboarding.feature.close').click());
  }
  await uiScreen.getByTestId('btn.onboarding.skip').click();
  await expect(uiScreen.getByTestId('screen.recording')).toBeVisible();
  await uiScreen.getByRole('button', { name: 'Paramètres', exact: true }).click();
  const appearance = uiScreen.getByTestId(`quick-settings.theme.${preference}`);
  await appearance.click();
  await uiScreen.getByTestId('quick-settings.close').click();
  await uiScreen.getByRole('tab', { name: 'Explorer', exact: true }).click();
  await expect(uiScreen.getByTestId('screen.explore')).toBeVisible();
  await uiScreen.getByTestId('btn.explorer.guides').click();
  await expect(uiScreen.getByTestId('screen.dreamGuides')).toBeVisible();
}

async function expectCompleteText(browser: ExactWebUI['browser'], rowId: string, text: string) {
  await expect(browser.locator(byId(rowId)).getByText(text, { exact: true })).toBeVisible();
  const fits = () => browser.evaluate(({ rowId, text }) => {
    const row = document.querySelector(`[data-testid="${rowId}"]`)!;
    const element = Array.from(row.querySelectorAll<HTMLElement>('[dir="auto"]')).find(node => node.textContent === text)!;
    const bounds = element.getBoundingClientRect();
    const rowBounds = row.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(element);
    const fragments = Array.from(range.getClientRects());
    const bottom = Math.max(...fragments.map(rect => rect.bottom));
    return { startsOnScreen: Math.min(...fragments.map(rect => rect.left)) >= 0,
      endsOnScreen: Math.max(...fragments.map(rect => rect.right)) <= innerWidth,
      startsInRow: Math.min(...fragments.map(rect => rect.top)) >= rowBounds.top - 1,
      endsInBox: bottom <= bounds.bottom + 1, endsInRow: bottom <= rowBounds.bottom + 1 };
  }, { rowId, text });
  await expect.poll(fits, { timeout: 15_000 }).toEqual({ startsOnScreen: true, endsOnScreen: true, startsInRow: true, endsInBox: true, endsInRow: true });
}

async function checkReading(ui: ExactWebUI) {
  const { screen: uiScreen, browser } = ui;
  const screen = uiScreen.getByTestId('screen.dreamGuides');
  await expect(screen.getByTestId(/^dream-guide-/)).toHaveCount(guides.length);
  const geometry = [];
  for (const guide of guides) {
    const row = screen.getByTestId(`dream-guide-${guide.id}`);
    await expect(row).toHaveAttribute('role', 'button');
    await expect(row).toContainText(guide.metadata);
    await expectCompleteText(browser, `dream-guide-${guide.id}`, guide.title);
    await expectCompleteText(browser, `dream-guide-${guide.id}`, guide.metaDescription);
    const bounds = (await row.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual((await browser.evaluate(() => innerWidth)));
    geometry.push({ id: guide.id, ...bounds });
  }
  // The rows settle after the theme or locale changes their text: read them once laid out.
  await expect.poll(async () => {
    const boxes = await Promise.all(guides.map(guide => screen.getByTestId(`dream-guide-${guide.id}`).boundingBox()));
    return boxes.every((box, i) => i === 0 || box!.y >= boxes[i - 1]!.y + boxes[i - 1]!.height);
  }).toBe(true);
  await expect(screen).toContainText(`${dictionary.symbols.length} symboles`);
  await expectCompleteText(browser, 'btn.dreamGuides.dictionary', 'Ouvrir le dictionnaire');
  return geometry;
}

for (const theme of ['light', 'dark'] as const) {
  test(`guides preserve complete French promises and destinations in ${theme}`, async (ui) => {
  const { app, screen: uiScreen, browser, artifacts } = ui;
    await setTestDate(browser, '2026-10-03T12:00:00+02:00');
    await browser.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
    await openGuides(ui, theme);
    const screen = uiScreen.getByTestId('screen.dreamGuides');
    const report = [{ viewport: '390', rows: await checkReading(ui) }];
    await expectCSS(browser, byId('screen.dreamGuides'), 'background-color', theme === 'light' ? 'rgb(240, 228, 212)' : 'rgb(3, 4, 13)');
    await app.screenshot(`${theme}-390.png`);

    if (theme === 'light') {
      for (const guide of guides) {
        await screen.getByTestId(`dream-guide-${guide.id}`).click();
        await expect(browser).toHaveURL(new RegExp(`/dream-guide/${guide.id}$`));
        const detail = uiScreen.getByTestId('screen.dreamGuideDetail');
        await expect(detail.getByText(guide.title, { exact: true })).toBeVisible();
        await detail.getByRole('button', { name: 'Retour', exact: true }).click();
        await expect(screen).toBeVisible();
      }
      await screen.getByTestId('btn.dreamGuides.dictionary').click();
      await expect(browser).toHaveURL(/\/symbol-dictionary$/);
      await expect(uiScreen.getByPlaceholder('Rechercher un symbole...')).toBeVisible();
      await uiScreen.getByRole('button', { name: 'Retour', exact: true, visible: true }).click();
      await expect(screen).toBeVisible();
    }

    await browser.setViewport({ width: 320, height: 568 });
    report.push({ viewport: '320', rows: await checkReading(ui) });
    await app.screenshot(`${theme}-320.png`);
    // Browser-only enlargement stress: not proof of native Dynamic Type.
    const enlarged = await readDOM(browser, byId('screen.dreamGuides'), (root) => {
      const text = Array.from(root.querySelectorAll<HTMLElement>('[dir="auto"]'))
        .map((element) => ({ element, style: getComputedStyle(element) }))
        .filter(({ style }) => /Fraunces|Outfit/.test(style.fontFamily))
        .map(({ element, style }) => ({ element, size: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) }));
      text.forEach(({ element, size, lineHeight }) => {
        element.style.fontSize = `${size * 2}px`;
        element.style.lineHeight = `${lineHeight * 2}px`;
      });
      return text.length;
    });
    expect(enlarged).toBeGreaterThan(16);
    report.push({ viewport: '320, text 200%', rows: await checkReading(ui) });
    const last = screen.getByTestId('dream-guide-water-dream-symbols');
    await last.scrollIntoView();
    await expectInViewport(last, browser);
    await app.screenshot(`${theme}-320-large-text.png`);
    await artifacts.attach('reading-geometry', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  });
}

test('guides follow the system preference and keep explicit appearance choices', async (ui) => {
  const { browser } = ui;
  await browser.emulateMedia({ colorScheme: 'light' });
  await openGuides(ui, 'auto');
  await expectCSS(browser, byId('screen.dreamGuides'), 'background-color', 'rgb(240, 228, 212)');
  await browser.emulateMedia({ colorScheme: 'dark' });
  await expectCSS(browser, byId('screen.dreamGuides'), 'background-color', 'rgb(3, 4, 13)');
  await browser.emulateMedia({ colorScheme: 'light' });
  await expectCSS(browser, byId('screen.dreamGuides'), 'background-color', 'rgb(240, 228, 212)');
});
