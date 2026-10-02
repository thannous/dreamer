import { test as base, expect } from 'playwright/test';

// Keep mock journeys independent of image CDNs, analytics and real payment services.
export const test = base.extend<{ offlineServices: void }>({
  offlineServices: [async ({ context, baseURL }, use) => {
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

export { expect };
