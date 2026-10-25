import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isolateWeb } from '../web-fixtures';

// Unique legacy coverage: refusing consent must retain the saved story, then
// accepting a later request must produce a reading without losing that story.
test('declining AI preserves the saved dream and accepting later analyzes it once', { tags: ['consent', 'recovery'] }, async ({ app, browser, screen }) => {
  await isolateWeb(browser, app);
  await app.open();
  await screen.getByTestId('btn.onboarding.intro.next').tap();
  if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
    const stop = await browser.onDialog('accept');
    try { await screen.getByTestId('btn.onboarding.feature.close', { visible: true }).tap(); }
    finally { stop(); }
  }
  await screen.getByTestId('btn.onboarding.skip').tap();
  const story = 'E2E consent: a silver wolf by a still lake.';
  // Noctalia asks in its own modal: the browser's confirmation is only a fallback
  // without the modal host, so no browser dialog may open from here on.
  const browserDialogs: string[] = [];
  const stop = await browser.onDialog(async dialog => {
    browserDialogs.push(dialog.message);
    await dialog.dismiss();
  });
  try {
    const consent = screen.getByTestId('modal.aiConsent', { visible: true });
    await screen.getByTestId('input.dreamTranscript').fill(story);
    await screen.getByTestId('btn.saveDream').tap();
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    await expect(consent).toBeVisible();
    await expect(screen.getByTestId('btn.aiConsent.privacyPolicy', { visible: true })).toBeVisible();
    // Capture the modal once its fade-in ends; the emblem's own loops never end.
    await expect.poll(() => browser.evaluate(() => document.getAnimations().filter(animation =>
      animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity).length)).toBe(0);
    await app.screenshot('consent-asked-after-save');
    await screen.getByTestId('btn.aiConsent.decline', { visible: true }).tap();
    await expect(consent).toBeHidden();
    await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
    expect(await browser.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBeNull();
    await screen.getByTestId('btn.dream.primaryCta').tap();
    await expect(consent).toBeVisible();
    await screen.getByTestId('btn.aiConsent.accept', { visible: true }).tap();
    await expect(screen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
    await expect(consent).toBeHidden();
    expect(await browser.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBe('granted');
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    expect(browserDialogs).toEqual([]);
    await app.screenshot('consent-recovered-with-original-story');
  } finally { stop(); }
});
