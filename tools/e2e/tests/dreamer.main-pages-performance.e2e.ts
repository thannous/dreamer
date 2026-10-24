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

// The caller explicitly identifies the owned synthetic journal; no phone data is
// seeded here. Changing period changes section heights, which must invalidate
// reveal positions while keeping the same content and navigation outcomes.
if (['200', '5000'].includes(process.env.E2E_PERF_FIXTURE_COUNT ?? '')) {
  test('trends reveals every section after period layout changes and keeps period controls usable', async ({ app, screen }) => {
    await app.open();
    const count = process.env.E2E_PERF_FIXTURE_COUNT === '5000' ? /^5[\s,.]?000$/u : '200';
    await screen.getByTestId('tab.stats').tap();
    const all = screen.getByTestId('trends.period.all');
    await screen.scrollUntilVisible(all, { direction: 'up' });
    await all.tap();
    await expect(screen.getByTestId('trends.figure.dreams.value')).toHaveText(count);
    for (const section of ['nights', 'returns', 'sky']) {
      const target = screen.getByTestId(`trends.section.${section}`);
      await screen.scrollUntilVisible(target);
      await expect(target).toBeVisible();
      await app.screenshot(`trends-all-${section}`);
    }
    const week = screen.getByTestId('trends.period.7');
    await screen.scrollUntilVisible(week, { direction: 'up' });
    await week.tap();
    const calendar = screen.getByTestId('trends.nights.calendar');
    await screen.scrollUntilVisible(calendar);
    await expect(calendar).toBeVisible();
    await app.screenshot('trends-week-calendar');
    await screen.getByTestId('tab.journal').tap();
    await expect(screen.getByTestId('screen.journal')).toBeVisible();
    await screen.getByTestId('tab.stats').tap();
    await expect(calendar).toBeVisible();
    await screen.scrollUntilVisible(all, { direction: 'up' });
    await all.tap();
    await expect(screen.getByTestId('trends.figure.dreams.value')).toHaveText(count);
  });
}
