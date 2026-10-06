import { test } from '@e2e-dev/web';
import { isolateWeb } from '../web-fixtures';
import { meditationJourney } from '../journeys';

// CI probes Metro /status before the first static route compiles. The measured
// cold app.open() took 116s; keep time for the unchanged restart/tab assertions.
test('Meditation onboarding persists and every main tab mounts', { timeout: 180_000 }, async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await meditationJourney(app, screen);
});
