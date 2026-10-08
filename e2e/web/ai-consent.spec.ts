import { test, expect } from './fixtures';

// The one-time permission before a dream is sent to the third-party AI provider.
test.use({ aiConsent: 'ask' });

test('declining AI keeps the saved dream unanalyzed, accepting later analyzes it once', async ({ page }) => {
  const dialogs: string[] = [];
  let answer: 'dismiss' | 'accept' = 'dismiss';
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await (answer === 'accept' ? dialog.accept() : dialog.dismiss());
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('btn.onboarding.intro.next').click();
  await page.getByTestId('btn.onboarding.skip').click();
  const story = 'E2E consent: a silver wolf by a still lake.';
  await page.getByTestId('input.dreamTranscript').fill(story);
  await page.getByTestId('btn.saveDream').click();

  await expect(page.getByTestId('component.transcriptCard')).toContainText(story);
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toMatch(/third-party AI service/);
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem('noctalia.aiConsent.v1'))).toBeNull();

  answer = 'accept';
  await page.getByTestId('btn.dream.primaryCta').click();
  await expect(page.getByTestId('component.dreamDetail.readingZone')).toContainText(/\S{20}/);
  expect(dialogs).toHaveLength(2);
  expect(await page.evaluate(() => window.localStorage.getItem('noctalia.aiConsent.v1'))).toBe('granted');
});
