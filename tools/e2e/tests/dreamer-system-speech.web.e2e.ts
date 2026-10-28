import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { test } from '../traced-parity-test';
import { webLocale } from '../web-engine';

const options = {
  tags: ['system-speech', 'locale-en-US'],
  skip: webLocale !== 'en-US' ? 'Requires the en-US browser context' : false,
  timeout: 180_000,
};

async function prepareCapture(
  { app, browser, screen }: { app: App; browser: Browser; screen: Screen },
  recognizerAvailable: boolean,
) {
  await browser.setViewport({ width: 1280, height: 720 });
  await app.open();
  await browser.addInitScript((available: boolean) => {
    localStorage.setItem('noctalia.aiConsent.v2', 'granted');
    const state = { starts: 0, stops: 0, uploads: 0, speak: (_text: string) => {} };
    (window as unknown as { speechTest: typeof state }).speechTest = state;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const address = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (new URL(address, window.location.href).pathname.endsWith('/transcribe')) {
        state.uploads += 1;
        throw new Error('Unexpected audio upload');
      }
      return originalFetch(input, init);
    };
    class TestRecognition extends EventTarget {
      start() {
        state.starts += 1;
        state.speak = text => {
          const result = Object.assign([{ transcript: text, confidence: 1 }], { isFinal: true });
          const event = Object.assign(new Event('result'), { resultIndex: 0, results: [result] });
          this.dispatchEvent(event);
        };
        this.dispatchEvent(new Event('start'));
      }
      stop() { state.stops += 1; this.dispatchEvent(new Event('end')); }
      abort() { this.dispatchEvent(new Event('end')); }
    }
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true, value: available ? TestRecognition : undefined,
    });
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true, value: undefined,
    });
  }, recognizerAvailable);
  await browser.reload();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const stop = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close').tap(); }
    finally { await stop(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  await expect(screen.getByTestId('screen.recording')).toBeVisible();
}

test('system speech adds to the draft without a Noctalia audio upload', options, async fixtures => {
  const { browser, screen } = fixtures;
  await prepareCapture(fixtures, true);
  const editor = screen.getByTestId('input.dreamTranscript');
  await editor.fill('A quiet harbor.');
  await screen.getByTestId('btn.recordToggle', { visible: true }).tap();
  const rationale = screen.getByTestId('btn.recording.micRationale.allow', { visible: true });
  if (await rationale.isVisible()) await rationale.tap();
  await expect.poll(() => browser.evaluate(() =>
    (window as unknown as { speechTest: { starts: number } }).speechTest.starts)).toBe(1);
  await browser.evaluate(() => {
    (window as unknown as { speechTest: { speak: (text: string) => void } }).speechTest.speak('A blue lighthouse.');
    return null;
  });
  await expect(editor).toHaveValue('A quiet harbor. A blue lighthouse.');
  await screen.getByTestId('btn.recordToggle', { visible: true }).tap();
  await expect.poll(() => browser.evaluate(() =>
    (window as unknown as { speechTest: { stops: number } }).speechTest.stops)).toBe(1);
  await expect(editor).toHaveValue('A quiet harbor. A blue lighthouse.');
  expect(await browser.evaluate(() =>
    (window as unknown as { speechTest: { uploads: number } }).speechTest.uploads)).toBe(0);
});

test('without system speech the draft remains editable and no audio is uploaded', options, async fixtures => {
  const { browser, screen } = fixtures;
  await prepareCapture(fixtures, false);
  const editor = screen.getByTestId('input.dreamTranscript');
  await editor.fill('A quiet harbor.');
  const stopDialog = await browser.onDialog('accept');
  try {
    await screen.getByTestId('btn.recordToggle', { visible: true }).tap();
    const rationale = screen.getByTestId('btn.recording.micRationale.allow', { visible: true });
    if (await rationale.isVisible()) await rationale.tap();
    await expect(screen.getByTestId('text.recording.fallbackNotice')).toBeVisible();
  } finally {
    await stopDialog();
  }
  await expect(editor).toHaveValue('A quiet harbor.');
  await editor.fill('A quiet harbor, remembered later.');
  await expect(screen.getByTestId('btn.saveDream')).toBeEnabled();
  expect(await browser.evaluate(() =>
    (window as unknown as { speechTest: { uploads: number } }).speechTest.uploads)).toBe(0);
});
