import { test as base, expect, type Page } from 'playwright/test';

// Keep mock journeys independent of image CDNs, analytics and real payment services.
export const test = base.extend<{ offlineServices: void; aiConsent: 'granted' | 'ask' }>({
  // Journeys run with the one-time AI permission already given; the consent
  // journey itself sets `aiConsent: 'ask'` to exercise the dialog.
  aiConsent: ['granted', { option: true }],
  offlineServices: [async ({ context, baseURL, aiConsent }, use) => {
    if (aiConsent === 'granted') {
      await context.addInitScript(() => window.localStorage.setItem('noctalia.aiConsent.v2', 'granted'));
    }
    const billingRequests: string[] = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseURL ?? 'http://127.0.0.1:8084').origin) return route.continue();
      if (url.hostname === 'picsum.photos' || url.hostname === 'fastly.picsum.photos') {
        return route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#eee"/></svg>',
        });
      }
      if (/revenuecat|supabase|stripe|purchases|billing/i.test(url.hostname)) {
        billingRequests.push(url.hostname);
      }
      await route.abort();
    });
    await use();
    expect(billingRequests, 'No real billing/backend request is allowed').toEqual([]);
  }, { auto: true }],
});

/**
 * While the capture seal is struck, the journal asks whether to analyse a new dream when an
 * analysis is available (not for a guest's first dream, analysed at once, nor without allowance).
 * The seal holds until the question is answered.
 */
export async function answerSeal(page: Page, answer: 'now' | 'later') {
  const question = page.getByTestId(answer === 'now' ? 'btn.dreamCaptureSeal.readNow' : 'btn.dreamCaptureSeal.readLater');
  await expect(question).toBeVisible();
  await question.click();
}

/**
 * A new illustration is painted in the seal's window, then leaves it for the plate at the top
 * of the page once the seal is on the screen; the plate's picture opens it whole.
 */
export async function expectIllustrationOnPlate(page: Page) {
  await page.getByTestId('component.dreamDetail.savedMoment').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('btn.journal.illustration.expand')).toBeVisible();
}

export { expect };
