import { test } from '@e2e-dev/web';
import { isolateWeb } from '../web-fixtures';
import { meditationJourney } from '../journeys';

test('Meditation onboarding persists and every main tab mounts', async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await meditationJourney(app, screen);
});
