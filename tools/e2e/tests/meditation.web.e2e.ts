import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';
import { meditationJourney } from '../journeys';

// CI probes Metro /status before the first static route compiles. The 180s test
// and config.timeout lifecycle budgets cover cold app.open() and restart;
// app methods use config.timeout, capped by the remaining test budget.
test('Meditation onboarding persists and tabs, editorial path, history and world settings remain reachable', { timeout: 180_000 }, async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await meditationJourney(app, screen);
  // The merged editorial path and supporting pages must remain reachable.
  await screen.getByTestId('btn.journey.open', { visible: true }).tap();
  await expect(screen.getByTestId('screen.journey', { visible: true })).toBeVisible();
  await expect(screen.getByTestId('journey.step.sleep-descent')).toBeVisible();
  await screen.getByTestId('btn.journey.session.sleep-descent').tap();
  await expect(screen.getByTestId('screen.session', { visible: true })).toBeVisible();
  await app.open('/');
  await screen.getByTestId('tab.profile', { visible: true }).tap();
  await screen.getByTestId('btn.history.open').tap();
  await expect(screen.getByTestId('screen.history', { visible: true })).toBeVisible();
  await app.open('/settings');
  await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.settings.world').tap();
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  await app.screenshot('editorial-path-history-and-world-settings');
});
