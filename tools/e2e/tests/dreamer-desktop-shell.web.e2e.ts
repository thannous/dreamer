// Desktop web shell: the night sidebar stays on every journal route, tab pages
// keep a reading width and Capture saves right under its editor.
import type { Page } from 'playwright/test';
import { createParityTest, expect } from '../web-parity-fixtures';

const sidebar = (page: Page) => page.getByTestId('component.desktopSidebar');

async function startGuest(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('btn.onboarding.intro.next')).toBeVisible();
  // First-run flows own the whole window.
  await expect(sidebar(page)).toHaveCount(0);
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  await expect(page.getByTestId('screen.recording')).toBeVisible();
}

const test = createParityTest({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

test('desktop sidebar leads to every destination and Capture saves under its editor', async ({ page }, info) => {
  await startGuest(page);

  // Capture sits above the tabs in the root stack and still shows the sidebar.
  await expect(sidebar(page)).toBeVisible();
  await expect(page.getByTestId('tab.addDream')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('component.recording.draftProgress.count')).toHaveCount(0);
  const editor = (await page.getByTestId('input.dreamTranscript').boundingBox())!;
  const save = (await page.getByTestId('btn.saveDream').boundingBox())!;
  expect(save.y - (editor.y + editor.height)).toBeLessThan(120);
  expect(save.y + save.height).toBeLessThan(900 / 1.4);
  await page.getByTestId('input.dreamTranscript').fill('A lantern floats over a quiet lake.');
  await expect(page.getByTestId('component.recording.draftProgress.count')).toHaveText('35 characters');
  await page.screenshot({ path: info.outputPath('desktop-capture.png') });

  for (const [tab, marker] of [['tab.journal', 'screen.journal'], ['tab.stats', 'trends.section.week'], ['tab.explore', 'screen.explore'], ['tab.home', 'screen.home']]) {
    await page.getByTestId(tab).filter({ visible: true }).click();
    const content = page.getByTestId(marker).filter({ visible: true });
    await expect(content).toHaveCount(1);
    await expect(page.getByTestId(tab).filter({ visible: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
    // Tab pages keep a reading width beside the 264px sidebar.
    expect((await content.boundingBox())!.width).toBeLessThanOrEqual(960);
  }
  await page.screenshot({ path: info.outputPath('desktop-today.png') });

  await page.getByTestId('tab.settings').click();
  await expect(page.getByTestId('screen.settings')).toBeVisible();
  await expect(sidebar(page)).toBeVisible();
  await expect(page.getByTestId('tab.settings')).toHaveAttribute('aria-current', 'page');
  // The sidebar carries the wordmark; the shared page header does not repeat it.
  await expect(page.getByText('Noctalia', { exact: true }).filter({ visible: true })).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('desktop-settings.png') });

  // Below the desktop breakpoint the bottom navigation returns.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('settings.back').click();
  await expect(sidebar(page)).toHaveCount(0);
  await expect(page.getByTestId('tab.journal').filter({ visible: true })).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('mobile-after-resize.png') });
});
