import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

// Read-only on the owned side-by-side QA app. The caller identifies its installed
// Release and existing data before running; this journey never resets or seeds it.
test('main pages remain navigable across repeated visits', async ({ app, screen }) => {
  await app.open();
  const goHome = async () => {
    const home = screen.getByTestId('btn.recording.home');
    if (await home.isVisible()) await home.tap();
    else await screen.getByTestId('tab.home').tap();
    await expect(screen.getByTestId('screen.home')).toBeVisible();
  };
  await goHome();
  for (let cycle = 1; cycle <= 2; cycle += 1) {
    for (const [tab, page] of [['tab.journal', 'screen.journal'], ['tab.stats', 'screen.trends'], ['tab.explore', 'screen.explore']] as const) {
      await screen.getByTestId(tab).tap();
      await expect(screen.getByTestId(page)).toBeVisible();
      if (cycle === 1) await app.screenshot(`${page}-entry`);
    }
    await screen.getByTestId('tab.addDream').tap();
    await expect(screen.getByTestId('screen.recording')).toBeVisible();
    if (cycle === 1) await app.screenshot('capture-entry');
    await goHome();
  }
  await app.screenshot('home-return');
});
