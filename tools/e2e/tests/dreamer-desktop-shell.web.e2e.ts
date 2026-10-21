// Desktop web shell: the night sidebar stays on every journal route, tab pages
// keep a reading width and Capture saves right under its editor.
import type { ExactWebUI } from '../exact-web-fixtures';
import { createExactWebTest, expect, withExactDialog } from '../exact-web-fixtures';

const sidebar = (ui: ExactWebUI) => ui.screen.getByTestId('component.desktopSidebar');

async function startGuest(ui: ExactWebUI) {
  const { app, screen, browser } = ui;
  await app.open('/');
  await expect(screen.getByTestId('btn.onboarding.intro.next')).toBeVisible();
  // First-run flows own the whole window.
  await expect(sidebar(ui)).toHaveCount(0);
  await screen.getByTestId('btn.onboarding.intro.next').click();
  // With feature sheets, "Commencer" first tells the three stories; the cross moves on.
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    await withExactDialog(browser, 'accept', () => screen.getByTestId('btn.onboarding.feature.close').click());
  }
  await screen.getByTestId('btn.onboarding.skip').click();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
}

const test = createExactWebTest({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

test('desktop sidebar leads to every destination and Capture saves under its editor', async (ui) => {
  const { app, screen, browser } = ui;
  await startGuest(ui);

  // Capture sits above the tabs in the root stack and still shows the sidebar.
  await expect(sidebar(ui)).toBeVisible();
  await expect(screen.getByTestId('tab.addDream')).toHaveAttribute('aria-current', 'page');
  await expect(screen.getByTestId('component.recording.draftProgress.count')).toHaveCount(0);
  const editor = (await screen.getByTestId('input.dreamTranscript').boundingBox())!;
  const save = (await screen.getByTestId('btn.saveDream').boundingBox())!;
  expect(save.y - (editor.y + editor.height)).toBeLessThan(120);
  expect(save.y + save.height).toBeLessThan(900 / 1.4);
  await screen.getByTestId('input.dreamTranscript').fill('A lantern floats over a quiet lake.');
  await expect(screen.getByTestId('component.recording.draftProgress.count')).toHaveText('35 characters');
  await app.screenshot('desktop-capture.png');

  for (const [tab, marker] of [['tab.journal', 'screen.journal'], ['tab.stats', 'screen.trends'], ['tab.explore', 'screen.explore'], ['tab.home', 'screen.home']]) {
    await screen.getByTestId(tab, { visible: true }).click();
    const content = screen.getByTestId(marker, { visible: true });
    await expect(content).toHaveCount(1);
    await expect(screen.getByTestId(tab, { visible: true })).toHaveAttribute('aria-current', 'page');
    await expect(browser.locator('[aria-current="page"]')).toHaveCount(1);
    // Tab pages keep a reading width beside the 264px sidebar.
    expect((await content.boundingBox())!.width).toBeLessThanOrEqual(960);
  }
  await app.screenshot('desktop-today.png');

  await screen.getByTestId('tab.settings').click();
  await expect(screen.getByTestId('screen.settings')).toBeVisible();
  await expect(sidebar(ui)).toBeVisible();
  await expect(screen.getByTestId('tab.settings')).toHaveAttribute('aria-current', 'page');
  // The sidebar carries the wordmark; the shared page header does not repeat it.
  await expect(screen.getByText('Noctalia', { exact: true, visible: true })).toHaveCount(1);
  await app.screenshot('desktop-settings.png');

  // Below the desktop breakpoint the bottom navigation returns.
  await browser.setViewport({ width: 390, height: 844 });
  await screen.getByTestId('settings.back').click();
  await expect(sidebar(ui)).toHaveCount(0);
  await expect(screen.getByTestId('tab.journal', { visible: true })).toHaveCount(1);
  await app.screenshot('mobile-after-resize.png');
});
