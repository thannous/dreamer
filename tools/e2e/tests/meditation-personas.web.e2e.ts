import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';
import { meditationJourney } from '../journeys';

test('Meditation listener finds and saves a session for later', { agent: 'listener', tags: ['personas', 'persona-listener'] }, async ({ app, screen, browser, agent }) => {
  await isolateWeb(browser, app);
  await app.open();
  await meditationJourney(app, screen);
  await agent.act('Open the session catalogue.');
  await expect(screen.getByTestId('screen.search', { visible: true })).toBeVisible();
  await agent.act('Open the session called {title}.', { params: { title: 'Bringing the breath down' } });
  await expect(screen.getByTestId('screen.session', { visible: true })).toBeVisible();
  await agent.act('Save this session to my favourites.');
  await expect(screen.getByRole('button', 'Saved', { exact: true, visible: true })).toBeVisible();
  await app.restart();
  await app.open('/favorites');
  await expect(screen.getByTestId('favorites.session.sleep-descent', { visible: true })).toHaveCount(1);
  await app.screenshot('persona-meditation-saved-session');
});

test('Meditation breather controls and leaves a breathing exercise', { agent: 'breather', tags: ['personas', 'persona-breather'] }, async ({ app, screen, browser, agent }) => {
  await isolateWeb(browser, app);
  await app.open();
  await meditationJourney(app, screen);
  await agent.act('Open the breathing exercises.');
  await expect(screen.getByTestId('screen.breathe', { visible: true })).toBeVisible();
  await screen.getByTestId('option.breathe.calm', { visible: true }).tap();
  await agent.act('Start this breathing exercise.');
  await expect(screen.getByRole('button', 'Pause', { exact: true, visible: true })).toBeVisible();
  await agent.act('Pause the breathing exercise.');
  await expect(screen.getByRole('button', 'Resume', { exact: true, visible: true })).toBeVisible();
  await agent.act('Leave this exercise and return to the breathing catalogue.');
  await expect(screen.getByTestId('screen.breathe', { visible: true })).toBeVisible();
  await app.screenshot('persona-meditation-breathing-control');
});
