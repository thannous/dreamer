import { test } from '@e2e-dev/mobile';
import { meditationJourney } from '../journeys';

test('Meditation release persists onboarding and opens every main tab', async ({ app, screen }) => {
  await app.open();
  await app.clearState();
  await meditationJourney(app, screen);
});
