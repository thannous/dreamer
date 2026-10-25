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
  const dialogs: string[] = [];
  let answer: 'dismiss' | 'accept' = 'dismiss';
  const stop = await browser.onDialog(async dialog => {
    dialogs.push(dialog.message);
    await dialog[answer]();
  });
  try {
    await screen.getByTestId('input.dreamTranscript').fill(story);
    await screen.getByTestId('btn.saveDream').tap();
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('To explore and illustrate your dream, Noctalia relies on artificial intelligence.');
    await expect(screen.getByTestId('component.dreamDetail.readingZone')).toBeHidden();
    expect(await browser.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBeNull();
    answer = 'accept';
    await screen.getByTestId('btn.dream.primaryCta').tap();
    await expect(screen.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S[\s\S]{80}/);
    expect(dialogs).toHaveLength(2);
    expect(await browser.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBe('granted');
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    await app.screenshot('consent-recovered-with-original-story');
  } finally { stop(); }
});
