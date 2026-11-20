import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { completeOnboarding, openLucid } from '../lucid-web-fixtures';

const RAIN_URL = 'https://noctalia.app/audio/sleep/rain-v2.m4a';
const LOCAL_RAIN = { path: '../../assets/lucid/audio/lucid_cue_rain_very_low.wav', contentType: 'audio/wav' };

test('Lucid keeps both French ambience controls inside the Night card on an iPhone-width screen', async fixtures => {
  const { app, screen, browser } = fixtures;
  await completeOnboarding(fixtures);
  await browser.route(RAIN_URL, route => route.fulfill(LOCAL_RAIN));
  // iPhone 17 width, where the dogfooding overflow appeared; it stays above the
  // 380 pt Night reflow threshold, so the two controls share one row when they fit.
  await browser.setViewport({ width: 402, height: 874 });
  await openLucid(app, browser, '/lucid/night?ambience=dark');
  await screen.getByTestId('lucid-night-signals-toggle', { visible: true }).tap();
  const play = screen.getByTestId('lucid-night-ambience-play', { visible: true });
  const stop = screen.getByTestId('lucid-night-ambience-stop', { visible: true });
  await expect(play).toBeEnabled({ timeout: 35_000 });
  await play.tap();
  // Playing shows the longest French pair: « Mettre l’ambiance en pause » and « Arrêter l’ambiance ».
  await expect(play).toContainText('Mettre l’ambiance en pause');
  const controls = await screen.getByTestId('lucid-night-ambience-controls', { visible: true }).boundingBox();
  const playBox = await play.boundingBox();
  const stopBox = await stop.boundingBox();
  const viewportWidth = await browser.evaluate(() => document.documentElement.clientWidth);
  expect(controls && playBox && stopBox).toBeTruthy();
  for (const box of [playBox!, stopBox!]) {
    expect(box.x).toBeGreaterThanOrEqual(controls!.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(controls!.x + controls!.width + 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth);
  }
  const sameRow = Math.abs(playBox!.y - stopBox!.y) < 1;
  const apart = sameRow
    ? playBox!.x + playBox!.width <= stopBox!.x + 0.5
    : playBox!.y + playBox!.height <= stopBox!.y + 0.5;
  expect(apart).toBe(true);
  await app.screenshot('lucid-ambience-controls-iphone-width');
  await stop.tap();
  await expect(play).toContainText('Lancer l’ambiance');
});

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
