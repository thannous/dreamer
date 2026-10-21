import { readDOM, byId, createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';
import type { ExactWebUI } from '../exact-web-fixtures';
// Exact journeys using public TesterArmy APIs.
const test = createExactWebTest({ locale: 'fr-FR', viewport: { width: 320, height: 568 } });

async function enter(ui: ExactWebUI) {
  const { app, screen, browser } = ui;
  await app.open('/');
  await screen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
  await screen.getByTestId('btn.onboarding.skip').click();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
}

async function expectReadableNavigation(ui: ExactWebUI) {
  const { screen, browser } = ui;
  for (const [id, name] of [
    ['tab.home', 'Aujourd’hui'], ['tab.journal', 'Journal'],
    ['tab.addDream', 'Capturer un rêve'], ['tab.stats', 'Tendances'], ['tab.explore', 'Explorer'],
  ]) {
    const tab = screen.getByTestId(id, { visible: true });
    await expect(tab).toHaveAccessibleName(name);
    const bounds = (await tab.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    const text = await readDOM(browser, byId(id), root => Array.from(root.querySelectorAll<HTMLElement>('[dir="auto"]'))
      .filter(el => /Outfit/.test(getComputedStyle(el).fontFamily))
      .map(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const fragments = Array.from(range.getClientRects());
        const rect = el.getBoundingClientRect();
        return {
          lines: new Set(fragments.map(fragment => Math.round(fragment.y))).size,
          fits: fragments.every(fragment => fragment.left >= rect.left - 1 && fragment.right <= rect.right + 1),
          text: el.textContent,
        };
      }));
    expect(text.length).toBeGreaterThan(0);
    expect(text.every(label => label.lines === 1 && label.fits)).toBe(true);
  }
}

test('French destinations fit one readable line on both narrow navigation bars', async (ui) => {
  const { app, screen } = ui;
  await enter(ui);
  await expectReadableNavigation(ui);
  await app.screenshot('capture-narrow-labels.png');
  await screen.getByTestId('tab.home').click();
  await expect(screen.getByTestId('screen.home')).toBeVisible();
  await expectReadableNavigation(ui);
  await app.screenshot('today-narrow-labels.png');
});

test('dark Capture keeps its scrollbar themed and its content scrollable', async (ui) => {
  const { app, screen, browser } = ui;
  await enter(ui);
  await screen.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await screen.getByTestId('quick-settings.theme.dark').click();
  await screen.getByTestId('quick-settings.close').click();
  const color = await readDOM(browser, byId('screen.recording'), el => getComputedStyle(el).scrollbarColor);
  expect(color).not.toBe('auto');
  expect(color).toContain('rgb(3, 4, 13)');
  const scroll = await readDOM(browser, byId('screen.recording'), el => {
    const available = el.scrollHeight > el.clientHeight;
    el.scrollTop = 100;
    return { available, offset: el.scrollTop };
  });
  expect(scroll.available).toBe(true);
  expect(scroll.offset).toBeGreaterThan(0);
  await app.screenshot('capture-dark-themed-scrollbar.png');
});

test('French guide punctuation stays attached to its preceding word at320px', async (ui) => {
  const { app, screen, browser } = ui;
  await enter(ui);
  await screen.getByTestId('tab.explore').click();
  await screen.getByTestId('btn.explorer.guides').click();
  const title = screen.getByTestId('dream-guide-understand-dreams').getByText(/^Pourquoi rêvons-nous/);
  await expect(title).toBeVisible();
  const geometry = await readDOM(browser, byId('dream-guide-understand-dreams'), root => {
    const el = Array.from(root.querySelectorAll<HTMLElement>('[dir="auto"]')).find(node => node.textContent?.startsWith('Pourquoi rêvons-nous'))!;
    const node = el.firstChild!;
    const text = node.textContent!;
    const punctuation = text.lastIndexOf('?');
    let preceding = punctuation - 1;
    while (/\s/.test(text[preceding])) preceding--;
    const previousRange = document.createRange();
    previousRange.setStart(node, preceding); previousRange.setEnd(node, preceding + 1);
    const punctuationRange = document.createRange();
    punctuationRange.setStart(node, punctuation); punctuationRange.setEnd(node, punctuation + 1);
    return { previousY: previousRange.getBoundingClientRect().y, punctuationY: punctuationRange.getBoundingClientRect().y };
  });
  expect(Math.abs(geometry.previousY - geometry.punctuationY)).toBeLessThan(2);
  await app.screenshot('guide-no-orphan-punctuation.png');
});
