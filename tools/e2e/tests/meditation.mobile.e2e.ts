import { openNativeLink } from '../native-links';
import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';
import { meditationJourney } from '../journeys';
import { setTimeout as elapse } from 'node:timers/promises';

test('Meditation release persists saving and removing a favourite across restarts', { tags: ['library', 'persistence'] }, async ({ app, screen, platform, device }) => {
  await app.open();
  await app.clearState();
  await meditationJourney(app, screen, platform === 'ios');
  await openNativeLink({ device, screen, platform }, 'noctaliameditation:///session/sleep-descent');
  const favorite = screen.getByTestId('btn.session.favorite', { visible: true });
  await favorite.tap();
  await expect(screen.getByRole('button', /^(Saved|Enregistrée)$/, { visible: true })).toBeVisible();
  await app.restart();
  await openNativeLink({ device, screen, platform }, 'noctaliameditation:///favorites');
  const saved = screen.getByTestId('favorites.session.sleep-descent', { visible: true });
  await expect(saved).toHaveCount(1);
  await saved.tap();
  await expect(screen.getByRole('button', /^(Saved|Enregistrée)$/, { visible: true })).toBeVisible();
  await favorite.tap();
  await expect(screen.getByRole('button', /^(Save|Enregistrer)$/, { visible: true })).toBeVisible();
  await app.restart();
  await openNativeLink({ device, screen, platform }, 'noctaliameditation:///favorites');
  await expect(screen.getByText(/^(Nothing saved yet|Rien d’enregistré)$/, { visible: true }).first()).toBeVisible();
  await expect(saved).toHaveCount(0);
  await app.screenshot('meditation-native-favourite-removal');
});

test('Meditation release keeps playback across background and records one completed session', { tags: ['audio', 'recovery', 'persistence'], timeout: 240_000 }, async ({ app, screen, platform, device }) => {
  await app.open();
  await app.clearState();
  await meditationJourney(app, screen, platform === 'ios');
  await screen.getByTestId('home.journey.cta', { visible: true }).tap();
  await screen.getByTestId('btn.session.play', { visible: true }).tap();
  const position = screen.getByTestId('text.player.position', { visible: true });
  await expect(position).not.toHaveText('0:00');
  const seconds = (text: string | null) => {
    const [minutes, remainder] = (text ?? '').split(':').map(Number);
    return minutes * 60 + remainder;
  };
  const before = seconds(await position.textContent());
  const started = performance.now();
  await device.home();
  // This interval is the behavior under test, not a readiness sleep: a player
  // that pauses in background and resumes in foreground must fail this check.
  await elapse(8_000);
  await device.openApp('com.noctalia.meditation');
  await expect(screen.getByTestId('screen.player', { visible: true })).toBeVisible();
  await expect(screen.getByRole('button', 'Pause', { visible: true })).toBeVisible();
  const after = seconds(await position.textContent());
  const elapsedSeconds = Math.floor((performance.now() - started) / 1_000);
  expect(after - before).toBeGreaterThanOrEqual(elapsedSeconds - 2);
  // UIKit reports this adjustable Pressable as "other"; its label is shared.
  const slider = screen.getByLabel(/^(Playback position|Position de lecture)$/, { visible: true });
  const bounds = await slider.boundingBox();
  if (!bounds) throw new Error('Playback position control is unavailable.');
  await slider.tap({ position: { x: bounds.width - 1, y: bounds.height / 2 } });
  await expect(screen.getByTestId('screen.sessionComplete', { visible: true })).toBeVisible();
  await screen.getByTestId('btn.complete.home', { visible: true }).tap();
  for (let restart = 0; restart < 2; restart++) {
    await app.restart();
    await screen.getByTestId('tab.profile', { visible: true }).tap();
    const streak = screen.getByTestId('text.profile.streak', { visible: true });
    await screen.scrollUntilVisible(streak);
    await expect(streak.getByText('1', { exact: true }).first()).toBeVisible();
    const history = screen.getByTestId('btn.history.open', { visible: true });
    // History is above the statistics; reading the streak can scroll it away.
    await screen.scrollUntilVisible(history, { direction: 'up' });
    await history.tap();
    await expect(screen.getByTestId(/^history\.entry\./, { visible: true })).toHaveCount(1);
  }
  await app.screenshot('meditation-native-completion-once');
});

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

// Erase cleared storage only: the saved session stayed in memory, showed again
// right after a new onboarding and was written back by the next change.
test('Meditation release erases its data and a new onboarding starts from nothing', { tags: ['persistence'] }, async ({ app, screen, platform }) => {
  await app.open();
  await app.clearState();
  await meditationJourney(app, screen, platform === 'ios');
  await screen.getByTestId('tab.search', { visible: true }).tap();
  const session = screen.getByTestId('option.session.sleep-descent', { visible: true });
  await screen.scrollUntilVisible(session);
  // UIKit reports a partially visible card whose centre is under the floating tabs.
  if (platform === 'ios') await screen.swipe({ direction: 'down' });
  await session.tap();
  await screen.getByTestId('btn.session.favorite', { visible: true }).tap();
  // The iOS Simulator runs Méditation in French, the Android emulator in English.
  await expect(screen.getByRole('button', /^(Saved|Enregistrée)$/, { visible: true })).toBeVisible();
  await app.restart();
  await screen.getByTestId('tab.profile', { visible: true }).tap();
  const savedLabel = /^(Saved sessions|Séances enregistrées)$/;
  const saved = screen.getByRole('button', /^(Saved sessions|Séances enregistrées)/, { visible: true });
  await screen.scrollUntilVisible(saved);
  await expect(saved).toHaveText(/^(Saved sessions|Séances enregistrées) · 1$/);
  await screen.scrollUntilVisible(screen.getByTestId('btn.profile.settings', { visible: true }));
  await screen.getByTestId('btn.profile.settings', { visible: true }).tap();
  await screen.getByRole('button', /^(Your profile|Votre profil)/, { visible: true }).tap();
  const erase = screen.getByRole('button', /^(Erase my data|Effacer mes données)$/, { visible: true });
  await screen.scrollUntilVisible(erase);
  await erase.tap();
  await expect(screen.getByText(/^(Erase everything\?|Tout effacer\s\?)$/, { visible: true })).toBeVisible();
  await screen.getByRole('button', /^(erase|effacer)$/i, { visible: true }).tap();
  await expect(screen.getByTestId('screen.welcome', { visible: true })).toBeVisible();
  // No restart: what the app still holds in memory is the point.
  await meditationJourney(app, screen, platform === 'ios', false);
  await screen.getByTestId('tab.profile', { visible: true }).tap();
  await screen.scrollUntilVisible(saved);
  await expect(saved).toHaveText(savedLabel);
  await app.restart();
  await screen.getByTestId('tab.profile', { visible: true }).tap();
  await screen.scrollUntilVisible(saved);
  await expect(saved).toHaveText(savedLabel);
  await app.screenshot('release-erase-starts-from-nothing');
});
