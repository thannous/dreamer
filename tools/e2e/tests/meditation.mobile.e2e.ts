import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';
import { meditationJourney } from '../journeys';

test('Meditation release persists onboarding and opens every main tab', async ({ app, screen, platform }) => {
  await app.open();
  await app.clearState();
  await meditationJourney(app, screen, platform === 'ios');
});

test('Meditation release breathing starts, pauses, resumes and leaves the exercise', async ({ app, screen, platform }) => {
  await app.open();
  await app.clearState();
  await meditationJourney(app, screen, platform === 'ios');
  await screen.getByTestId('tab.breathe', { visible: true }).tap();
  await screen.getByTestId('option.breathe.calm', { visible: true }).tap();
  await expect(screen.getByTestId('screen.breathe.exercise', { visible: true })).toBeVisible();
  const phase = screen.getByTestId('text.breathe.phase', { visible: true });
  await expect(phase).toBeVisible();
  const readyPhase = await phase.textContent();
  for (const option of ['sound', 'voice', 'haptic']) {
    await expect(screen.getByTestId(`btn.breathe.${option}`, { visible: true })).toBeEnabled();
  }
  const control = screen.getByTestId('btn.breathe.start', { visible: true });
  await control.tap();
  await expect(phase).not.toHaveText(readyPhase ?? '');
  await expect(screen.getByRole('button', /^(Pause|Mettre en pause)$/, { visible: true })).toBeVisible();
  await control.tap();
  await expect(screen.getByRole('button', /^(Resume|Reprendre)$/, { visible: true })).toBeVisible();
  await app.screenshot('release-breathing-paused');
  await control.tap();
  await expect(screen.getByRole('button', /^(Pause|Mettre en pause)$/, { visible: true })).toBeVisible();
  await control.tap();
  await screen.getByTestId('btn.breathe.close', { visible: true }).tap();
  await expect(screen.getByTestId('screen.breathe', { visible: true })).toBeVisible();
  await app.screenshot('release-breathing-return');
});

test('Meditation release switches languages immediately and persists the choice after restart', async ({ app, screen, platform }) => {
  await app.open();
  await app.clearState();
  await meditationJourney(app, screen, platform === 'ios');
  await screen.getByTestId('tab.profile', { visible: true }).tap();
  await screen.scrollUntilVisible(screen.getByTestId('btn.profile.settings', { visible: true }));
  await screen.getByTestId('btn.profile.settings', { visible: true }).tap();
  await expect(screen.getByTestId('screen.settings', { visible: true })).toBeVisible();
  await screen.scrollUntilVisible(screen.getByTestId('btn.settings.language', { visible: true }));
  await screen.getByTestId('btn.settings.language', { visible: true }).tap();
  await screen.getByTestId('lang.de', { visible: true }).tap();
  await expect(screen.getByText('Sprache', { visible: true })).toBeVisible();
  await screen.getByTestId('lang.fr', { visible: true }).tap();
  await expect(screen.getByText('Langue', { visible: true })).toBeVisible();
  await app.screenshot('release-language-french');
  await app.restart();
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  await screen.getByTestId('tab.profile', { visible: true }).tap();
  await screen.scrollUntilVisible(screen.getByTestId('btn.profile.settings', { visible: true }));
  await screen.getByTestId('btn.profile.settings', { visible: true }).tap();
  await screen.scrollUntilVisible(screen.getByTestId('btn.settings.language', { visible: true }));
  await screen.getByTestId('btn.settings.language', { visible: true }).tap();
  await expect(screen.getByText('Langue', { visible: true })).toBeVisible();
  await app.screenshot('release-language-persisted');
});

test('Meditation release plays a bundled session, seeks exactly fifteen seconds and keeps its resume position', async ({ app, screen, platform }) => {
  await app.open();
  await app.clearState();
  await meditationJourney(app, screen, platform === 'ios');
  await screen.getByTestId('tab.search', { visible: true }).tap();
  const session = screen.getByTestId('option.session.sleep-descent', { visible: true });
  await screen.scrollUntilVisible(session);
  // UIKit reports a partially visible card whose centre is under the floating tabs.
  if (platform === 'ios') await screen.swipe({ direction: 'down' });
  await session.tap();
  await expect(screen.getByTestId('screen.session', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.session.play', { visible: true }).tap();
  await expect(screen.getByTestId('screen.player', { visible: true })).toBeVisible();
  await expect(screen.getByRole('button', 'Pause', { visible: true })).toBeVisible();
  const position = screen.getByTestId('text.player.position', { visible: true });
  await expect(position).not.toHaveText('0:00');
  await screen.getByTestId('btn.player.toggle', { visible: true }).tap();
  await expect(screen.getByRole('button', /^(Play|Lecture)$/, { visible: true })).toBeVisible();
  const elapsed = () => position.textContent().then(text => {
    const parts = (text ?? '').split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : Number.NaN;
  });
  const paused = await elapsed();
  await screen.getByTestId('btn.player.forward', { visible: true }).tap();
  await expect.poll(elapsed).toBe(paused + 15);
  await app.screenshot('release-audio-paused-after-seek');
  await screen.getByTestId('btn.player.close', { visible: true }).tap();
  await expect(screen.getByTestId('screen.session', { visible: true })).toBeVisible();
  await app.restart();
  await expect(screen.getByTestId('screen.home', { visible: true })).toBeVisible();
  await screen.getByTestId('tab.search', { visible: true }).tap();
  await screen.scrollUntilVisible(session);
  // UIKit reports a partially visible card whose centre is under the floating tabs.
  if (platform === 'ios') await screen.swipe({ direction: 'down' });
  await session.tap();
  await screen.getByTestId('btn.session.play', { visible: true }).tap();
  await expect(screen.getByRole('button', 'Pause', { visible: true })).toBeVisible();
  await expect.poll(elapsed).toBeGreaterThanOrEqual(paused + 15);
  await expect.poll(elapsed).toBeLessThan(paused + 30);
  await app.screenshot('release-audio-resumed');
});
