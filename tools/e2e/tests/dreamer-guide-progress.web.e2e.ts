import { test, type Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { isolateWeb } from '../web-fixtures';

const KEY = 'noctalia_guide_reading_v1:guest';
const LEDGER = 'noctalia_badge_ledger_v1:guest';
async function start(app: App, screen: Screen, browser: Browser) {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const unsubscribe = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
    finally { await unsubscribe(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
}
async function guides(screen: Screen) {
  await screen.getByTestId('tab.explore', { visible: true }).tap();
  await screen.getByTestId('btn.explorer.guides', { visible: true }).tap();
  await expect(screen.getByTestId('screen.dreamGuides', { visible: true })).toBeVisible();
}

test('guide reading resumes after reload and only explicit completion earns a unique badge event',
  { tags: ['guide-progress', 'persistence'] }, async ({ app, screen, browser }) => {
    await start(app, screen, browser);
    await guides(screen);
    await expect(screen.getByTestId('guides.reading.summary')).toHaveText('0 of 8 guides completed');
    await screen.getByTestId('dream-guide-dream-journal').tap();
    await expect(screen.getByTestId('guide.reading.status')).toHaveText('Visited');
    await screen.getByTestId('guide.section.3').scrollIntoView();
    await expect.poll(() => browser.evaluate((key: string) => JSON.parse(localStorage.getItem(key) ?? '{}')['dream-journal']?.section ?? 0, KEY)).toBeGreaterThan(0);
    await expect.poll(() => browser.evaluate((key: string) => JSON.parse(localStorage.getItem(key) ?? '{}').keys?.['night-scholar']?.length ?? 0, LEDGER)).toBe(0);
    await browser.reload();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await guides(screen);
    await expect(screen.getByTestId('guide-progress-dream-journal')).toHaveText('In progress');
    // One tap from the list lands on the stored bookmark, with no second step on the guide.
    await screen.getByTestId('guides.reading.resume').tap();
    await expect.poll(() => browser.evaluate((key: string) => {
      const section = JSON.parse(localStorage.getItem(key) ?? '{}')['dream-journal']?.section ?? 0;
      const element = document.querySelector(`[data-testid="guide.section.${section}"]`);
      if (!element) return `no section ${section}`;
      const { top } = element.getBoundingClientRect();
      return top >= 0 && top < innerHeight / 2 ? 'at bookmark' : `section ${section} at ${Math.round(top)}`;
    }, KEY)).toBe('at bookmark');
    await screen.getByTestId('guide.reading.complete').scrollIntoView();
    await screen.getByTestId('guide.reading.complete').tap();
    await expect(screen.getByTestId('guide.reading.completed')).toBeVisible();
    await app.screenshot('guide-explicit-completion-and-optional-exercise');
    // The reading goes on with the next guide still to finish, in the order of the list.
    await expect(screen.getByTestId('guide.reading.next')).toContainText('Lucid dreaming for beginners');
    await expect.poll(() => browser.evaluate((key: string) => JSON.parse(localStorage.getItem(key) ?? '{}').keys?.['night-scholar'] ?? [], LEDGER)).toEqual(['dream-journal']);
    await screen.getByTestId('guide.reading.next').tap();
    await expect(screen.getByTestId('screen.dreamGuideDetail', { visible: true })).toContainText('Lucid dreaming for beginners');
    await expect(screen.getByTestId('guide.reading.status', { visible: true })).toHaveText('Visited');
    // The next guide replaced the finished one: back returns to the list.
    await app.back();
    await expect(screen.getByTestId('guides.reading.summary')).toHaveText('1 of 8 guides completed');
    await screen.getByTestId('dream-guide-remember-dreams').tap();
    await screen.getByTestId('guide.reading.complete').scrollIntoView();
    await screen.getByTestId('guide.reading.complete').tap();
    await expect(screen.getByTestId('guide.reading.completed')).toBeVisible();
    await screen.getByTestId('guide.reading.exercise.action').tap();
    await expect(browser).toHaveURL('/ritual/memory');
    await browser.reload();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await guides(screen);
    await expect(screen.getByTestId('guides.reading.summary')).toHaveText('2 of 8 guides completed');
    await screen.getByTestId('dream-guide-dream-journal').tap();
    await screen.getByTestId('guide.reading.completed').scrollIntoView();
    await expect(screen.getByTestId('guide.reading.complete')).toHaveCount(0);
    await expect.poll(() => browser.evaluate((key: string) => JSON.parse(localStorage.getItem(key) ?? '{}').keys?.['night-scholar']?.length ?? 0, LEDGER)).toBe(2);
    await app.back(); await app.back();
    await screen.getByTestId('btn.explore.collection', { visible: true }).tap();
    await expect(screen.getByTestId('collection.card.night-scholar')).toHaveAttribute('aria-label', /New Bronze card/);
    await app.screenshot('guide-progress-bronze-earned');
  });
