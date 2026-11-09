import { openNativeLink } from '../native-links';
import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';
import { meditationJourney } from '../journeys';

test('Meditation listener finds and saves a session for later', { agent: 'listener', tags: ['personas', 'persona-listener'], timeout: 300_000 }, async ({ app, screen, platform, device, agent }) => {
  await app.open();
  await app.clearState();
  await meditationJourney(app, screen, platform === 'ios');
  await agent.act('Open the session catalogue.');
  await expect(screen.getByTestId('screen.search', { visible: true })).toBeVisible();
  await agent.act('Open the session called Bringing the breath down, or Descendre le souffle in French.');
  await expect(screen.getByTestId('screen.session', { visible: true })).toBeVisible();
  await agent.act('Save this session to my favourites.');
  await expect(screen.getByRole('button', /^(Saved|Enregistrée)$/, { visible: true })).toBeVisible();
  await app.restart();
  await openNativeLink({ device, screen, platform }, 'noctaliameditation:///favorites');
  await expect(screen.getByTestId('favorites.session.sleep-descent', { visible: true })).toHaveCount(1);
  await app.screenshot('persona-meditation-saved-session');
});

test('Meditation breather controls and leaves a breathing exercise', { agent: 'breather', tags: ['personas', 'persona-breather'], timeout: 300_000 }, async ({ app, screen, platform, agent }) => {
  await app.open();
  await app.clearState();
  await meditationJourney(app, screen, platform === 'ios');
  await agent.act('Open the breathing exercises.');
  await expect(screen.getByTestId('screen.breathe', { visible: true })).toBeVisible();
  await screen.getByTestId('option.breathe.calm', { visible: true }).tap();
  await agent.act('Start this breathing exercise.');
  await expect(screen.getByRole('button', /^(Pause|Mettre en pause)$/, { visible: true })).toBeVisible();
  await agent.act('Pause the breathing exercise.');
  await expect(screen.getByRole('button', /^(Resume|Reprendre)$/, { visible: true })).toBeVisible();
  await agent.act('Leave this exercise and return to the breathing catalogue.');
  await expect(screen.getByTestId('screen.breathe', { visible: true })).toBeVisible();
  await app.screenshot('persona-meditation-breathing-control');
});
