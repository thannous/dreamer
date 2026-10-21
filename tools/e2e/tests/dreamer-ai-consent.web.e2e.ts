import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('declining AI keeps the saved dream unanalyzed, accepting later analyzes it once', async ({ app, screen, browser }) => {
  const serviceRequests: string[] = [];
  await browser.route('**/*', async route => {
    const url = new URL(route.request.url);
    if (url.origin === new URL(app.baseUrl!).origin) await route.continue();
    else if (/^(picsum\.photos|fastly\.picsum\.photos)$/.test(url.hostname))
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#eee"/></svg>' });
    else {
      if (/revenuecat|supabase|stripe|purchases|billing/i.test(url.hostname)) serviceRequests.push(url.hostname);
      await route.abort();
    }
  });
  await app.open('/');
  const dialogs: string[] = [];
  let answer: 'dismiss' | 'accept' = 'dismiss';
  const off = await browser.onDialog(async dialog => {
    dialogs.push(dialog.message);
    await (answer === 'accept' ? dialog.accept() : dialog.dismiss());
  });
  try {
    await screen.getByTestId('btn.onboarding.intro.next').tap();
    if (process.env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') {
      const close = await browser.onDialog('accept');
      try { await screen.getByTestId('btn.onboarding.feature.close').tap(); }
      finally { await close(); }
    }
    await screen.getByTestId('btn.onboarding.skip').tap();
    const story = 'E2E consent: a silver wolf by a still lake.';
    await screen.getByTestId('input.dreamTranscript').fill(story);
    await screen.getByTestId('btn.saveDream').tap();
    await expect(screen.getByTestId('component.transcriptCard')).toContainText(story);
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toMatch(/third-party AI service/);
    await expect(screen.getByTestId('component.dreamDetail.readingZone')).toHaveCount(0);
    expect(await browser.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBeNull();
    answer = 'accept';
    await screen.getByTestId('btn.dream.primaryCta').tap();
    const interpretation = screen.getByTestId('component.dreamDetail.interpretation');
    await expect(interpretation).toBeVisible();
    // A reading needs substantive text, not a single unbroken 20-letter word.
    await expect.poll(async () => (await interpretation.textContent()).replace(/\s/g, '').length).toBeGreaterThanOrEqual(20);
    expect(dialogs).toHaveLength(2);
    expect(await browser.evaluate(() => localStorage.getItem('noctalia.aiConsent.v2'))).toBe('granted');
    await app.screenshot('consent-declined-then-accepted');
  } finally {
    await off();
    expect.soft(serviceRequests, 'No real billing/backend request is allowed').toEqual([]);
  }
});
