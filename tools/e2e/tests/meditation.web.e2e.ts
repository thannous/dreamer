import { test } from '@e2e-dev/web';
import { isolateWeb } from '../web-fixtures';
import { meditationJourney } from '../journeys';

// CI probes Metro /status before the first static route compiles. The 180s test
// and config.timeout lifecycle budgets cover cold app.open() and restart;
// app methods use config.timeout, capped by the remaining test budget.
test('Meditation onboarding persists and every main tab mounts', { timeout: 180_000 }, async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await meditationJourney(app, screen);
});
