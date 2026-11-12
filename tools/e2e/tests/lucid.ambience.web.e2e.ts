import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { completeOnboarding, openLucid } from '../lucid-web-fixtures';

test('Lucid recovers a blocked ambience with a playable retry and no unhandled rejection', async fixtures => {
  const { app, screen, browser } = fixtures;
  await completeOnboarding(fixtures);
  await browser.addInitScript(() => {
    const observed = window as Window & { __lucidAudioErrors?: string[] };
    const errors: string[] = [];
    observed.__lucidAudioErrors = errors;
    // Observe browser errors without cancelling or filtering the app's error events.
    window.addEventListener('error', event => errors.push(event.message));
    window.addEventListener('unhandledrejection', event => {
      errors.push(String(event.reason));
    });
  });
  let audioRequests = 0;
  let retry = false;
  let releaseRetry!: () => void;
  const retryResponse = new Promise<void>(resolve => { releaseRetry = resolve; });
  await browser.route('https://noctalia.app/audio/sleep/rain-v2.m4a', async route => {
    audioRequests += 1;
    if (!retry) {
      // Keep the existing cross-origin network refusal for the initial load.
      await route.abort();
      return;
    }
    // Hold the local response until the UI proves that it is preparing the retry.
    await retryResponse;
    await route.fulfill({
      path: '../../assets/lucid/audio/lucid_cue_rain_very_low.wav',
      contentType: 'audio/wav',
    });
  });
  try {
    await openLucid(app, browser, '/lucid/night?ambience=dark');
    await screen.getByTestId('lucid-night-signals-toggle', { visible: true }).tap();
    const play = screen.getByTestId('lucid-night-ambience-play', { visible: true });
    const failure = screen.getByTestId('lucid-night-ambience-error', { visible: true });
    // This is the player's real load deadline, not an arbitrary test sleep.
    await expect(failure).toContainText('Ce son n’a pas pu être téléchargé', { timeout: 35_000 });
    await expect(play).toContainText('Réessayer');
    await expect(play).toBeEnabled();
    expect(audioRequests).toBeGreaterThan(0);
    const errors = () => browser.evaluate(() =>
      (window as Window & { __lucidAudioErrors?: string[] }).__lucidAudioErrors ?? ['Error observer missing']);
    // The positive fallback above gives the failed request time to report its rejection.
    expect(await errors()).toEqual([]);
    await app.screenshot('lucid-ambience-blocked-fallback');
    const requestsBeforeRetry = audioRequests;
    retry = true;
    await play.tap();
    await expect(play).toBeDisabled();
    await expect(failure).toBeHidden();
    await expect.poll(() => audioRequests).toBeGreaterThan(requestsBeforeRetry);
    releaseRetry();
    // A retry must actually start the sound; clearing the error alone misses a lost play request.
    await expect(play).toContainText('Mettre l’ambiance en pause');
    await expect(play).toBeEnabled();
    await app.screenshot('lucid-ambience-retry-playing');
    await screen.getByTestId('lucid-night-ambience-stop', { visible: true }).tap();
    await expect(play).toContainText('Lancer l’ambiance');
    expect(await errors()).toEqual([]);
  } finally {
    releaseRetry();
  }
});
