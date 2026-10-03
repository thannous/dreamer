import { test, expect } from './fixtures';
import type { Page } from 'playwright/test';

test.use({ locale: 'fr-FR', viewport: { width: 320, height: 568 } });

async function enter(page: Page) {
  await page.goto('/');
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

async function expectReadableNavigation(page: Page) {
  for (const [id, name] of [
    ['tab.home', 'Aujourd’hui'], ['tab.journal', 'Journal'],
    ['tab.addDream', 'Capturer un rêve'], ['tab.stats', 'Tendances'], ['tab.explore', 'Explorer'],
  ]) {
    const tab = page.getByTestId(id).filter({ visible: true });
    await expect(tab).toHaveAccessibleName(name);
    const bounds = (await tab.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    const text = await tab.evaluate(root => Array.from(root.querySelectorAll<HTMLElement>('[dir="auto"]'))
      .filter(el => /SpaceGrotesk/.test(getComputedStyle(el).fontFamily))
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

test('French destinations fit one readable line on both narrow navigation bars', async ({ page }, info) => {
  await enter(page);
  await expectReadableNavigation(page);
  await page.screenshot({ path: info.outputPath('capture-narrow-labels.png') });
  await page.getByTestId('tab.home').click();
  await expect(page.getByTestId('screen.home')).toBeVisible();
  await expectReadableNavigation(page);
  await page.screenshot({ path: info.outputPath('today-narrow-labels.png') });
});

test('dark Capture keeps its scrollbar themed and its content scrollable', async ({ page }, info) => {
  await enter(page);
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await page.getByTestId('quick-settings.theme.dark').click();
  await page.getByTestId('quick-settings.close').click();
  const recording = page.getByTestId('screen.recording');
  const color = await recording.evaluate(el => getComputedStyle(el).scrollbarColor);
  expect(color).not.toBe('auto');
  expect(color).toContain('rgb(3, 4, 13)');
  const scroll = await recording.evaluate(el => {
    const available = el.scrollHeight > el.clientHeight;
    el.scrollTop = 100;
    return { available, offset: el.scrollTop };
  });
  expect(scroll.available).toBe(true);
  expect(scroll.offset).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('capture-dark-themed-scrollbar.png') });
});

test('French guide punctuation stays attached to its preceding word at320px', async ({ page }, info) => {
  await enter(page);
  await page.getByTestId('tab.explore').click();
  await page.getByTestId('btn.explorer.guides').click();
  const title = page.getByTestId('dream-guide-understand-dreams').getByText(/^Pourquoi rêvons-nous/);
  const geometry = await title.evaluate(el => {
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
  await page.screenshot({ path: info.outputPath('guide-no-orphan-punctuation.png') });
});
