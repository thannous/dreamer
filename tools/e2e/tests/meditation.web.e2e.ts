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

test('Meditation finds a session, persists its favourite after restart and persists its removal', { tags: ['library', 'persistence'] }, async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await meditationJourney(app, screen);
  await screen.getByTestId('tab.search', { visible: true }).tap();
  await screen.getByTestId('option.session.sleep-descent', { visible: true }).tap();
  const favorite = screen.getByTestId('btn.session.favorite', { visible: true });
  await favorite.tap();
  await expect(screen.getByRole('button', 'Saved', { exact: true, visible: true })).toBeVisible();
  await app.restart();
  await app.open('/favorites');
  const saved = screen.getByTestId('favorites.session.sleep-descent', { visible: true });
  await expect(saved).toHaveCount(1);
  await saved.tap();
  await expect(screen.getByRole('button', 'Saved', { exact: true, visible: true })).toBeVisible();
  await favorite.tap();
  await expect(screen.getByRole('button', 'Save', { exact: true, visible: true })).toBeVisible();
  await app.restart();
  await app.open('/favorites');
  await expect(saved).toHaveCount(0);
  await expect(screen.getByText('Nothing saved yet', { exact: true, visible: true })).toBeVisible();
  await app.screenshot('favourite-removal-persisted');
});

test('Meditation resumes audio after restart, completes it and records history and streak only once', { tags: ['audio', 'recovery', 'persistence'], timeout: 180_000 }, async ({ app, screen, browser }) => {
  await isolateWeb(browser, app);
  await app.open();
  await meditationJourney(app, screen);
  await screen.getByTestId('tab.search', { visible: true }).tap();
  await screen.getByTestId('option.session.sleep-descent', { visible: true }).tap();
  await screen.getByTestId('btn.session.play', { visible: true }).tap();
  const position = screen.getByTestId('text.player.position', { visible: true });
  await expect(position).not.toHaveText('0:00');
  await screen.getByTestId('btn.player.toggle', { visible: true }).tap();
  await expect(screen.getByRole('button', 'Play', { exact: true, visible: true })).toBeVisible();
  const elapsed = () => position.textContent().then(text => {
    const [minutes, seconds] = (text ?? '').split(':').map(Number);
    return minutes * 60 + seconds;
  });
  const paused = await elapsed();
  await screen.getByTestId('btn.player.forward', { visible: true }).tap();
  await expect.poll(elapsed).toBe(paused + 15);
  await screen.getByTestId('btn.player.close', { visible: true }).tap();
  await app.restart();
  await app.open('/session/sleep-descent');
  await screen.getByTestId('btn.session.play', { visible: true }).tap();
  await expect.poll(elapsed).toBeGreaterThanOrEqual(paused + 15);
  await expect.poll(elapsed).toBeLessThan(paused + 30);
  // Use the actual accessible seek control; no completion/storage state injection.
  const slider = screen.getByRole('slider', 'Playback position', { exact: true, visible: true });
  const bounds = await slider.boundingBox();
  if (!bounds) throw new Error('Playback seek control is not visible.');
  // SDK pointer coordinates round to whole viewport pixels. Stay one pixel
  // inside the track; width - 0.1 rounded onto its outside edge and missed it.
  await slider.click({ position: { x: bounds.width - 1, y: bounds.height / 2 } });
  await expect(screen.getByTestId('screen.sessionComplete', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.complete.home', { visible: true }).tap();
  for (let restart = 0; restart < 2; restart++) {
    await app.restart();
    await screen.getByTestId('tab.profile', { visible: true }).tap();
    await expect(screen.getByTestId('text.profile.streak', { visible: true }).getByText('1', { exact: true })).toHaveCount(1);
    await screen.getByTestId('btn.history.open', { visible: true }).tap();
    await expect(screen.getByTestId(/^history\.entry\./, { visible: true })).toHaveCount(1);
    await expect(screen.getByTestId('history.entry.0')).toContainText('Bringing the breath down');
  }
  await app.screenshot('one-completion-history-after-two-restarts');
});
