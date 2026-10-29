import { expect } from 'e2e';
import { test } from '../traced-parity-test';
import { webLocale } from '../web-engine';

const journalKey = 'noctalia_mock_dogfood_v1:gemini_dream_journal_dreams';
const draftKey = 'noctalia_mock_dogfood_v1:gemini_dream_journal_recording_transcript:guest';

test('capture keeps its draft after a storage failure, then saves it once across reload', {
  tags: ['capture-save', 'locale-en-US', 'smoke', 'zone-sauvegarde'],
  skip: webLocale !== 'en-US' ? 'Run E2E_WEB_LOCALE=en-US' : false,
  timeout: 180_000,
}, async ({ app, screen, browser }) => {
  await app.open();
  await browser.setViewport({ width: 390, height: 844 });
  await browser.addInitScript(() => localStorage.setItem('noctalia.aiConsent.v2', 'granted'));
  await browser.reload();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const stop = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close').tap(); }
    finally { await stop(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  const editor = screen.getByTestId('input.dreamTranscript');
  const save = screen.getByTestId('btn.saveDream', { visible: true });
  const story = 'A blue door stood beside the lake. I kept the brass key in my hand.';
  await editor.fill(story);
  await expect.poll(() => browser.evaluate(key => localStorage.getItem(key), draftKey)).toBe(story);

  // Fail only this disposable browser's journal write; draft persistence stays real.
  await browser.evaluate(key => {
    const original = Storage.prototype.setItem;
    (window as Window & { restoreCaptureStorage?: () => void }).restoreCaptureStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Synthetic journal storage failure', 'QuotaExceededError');
      original.call(this, name, value);
    };
    return null;
  }, journalKey);
  let errors = 0;
  const stop = await browser.onDialog(async dialog => {
    errors += 1;
    await dialog.accept();
  });
  try {
    await save.tap();
    await expect.poll(() => errors).toBe(1);
    await expect(editor).toHaveValue(story);
    await expect(save).toBeEnabled();
    await expect.poll(() => browser.evaluate(key => localStorage.getItem(key), draftKey)).toBe(story);
    expect(await browser.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]').length, journalKey)).toBe(0);
  } finally {
    await stop();
    await browser.evaluate(() => {
      const target = window as Window & { restoreCaptureStorage?: () => void };
      target.restoreCaptureStorage?.();
      delete target.restoreCaptureStorage;
      return null;
    });
  }

  await save.tap();
  const saved = screen.getByTestId('component.transcriptCard');
  const later = screen.getByTestId('btn.dreamCaptureSeal.readLater');
  await expect(saved.or(later)).toBeVisible({ timeout: 60_000 });
  if (await later.isVisible()) await later.tap();
  await expect(saved).toContainText(story);
  await expect.poll(() => browser.evaluate(key => localStorage.getItem(key), draftKey)).toBe('');
  const persisted = await browser.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]') as {
    transcript: string; clientRequestId: string;
  }[], journalKey);
  expect(persisted).toHaveLength(1);
  expect(persisted[0].transcript).toBe(story);
  expect(persisted[0].clientRequestId).toBeTruthy();

  await browser.reload();
  await expect(saved).toContainText(story);
  const reopened = await browser.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]') as {
    transcript: string; clientRequestId: string;
  }[], journalKey);
  expect(reopened).toHaveLength(1);
  expect(reopened[0]).toMatchObject({ transcript: story, clientRequestId: persisted[0].clientRequestId });
  await app.screenshot('capture-save-recovered-once');
});
