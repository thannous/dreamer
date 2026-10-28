import { test as base } from '@e2e-dev/web';
import { expect } from 'e2e';

// Preserve the historical network guard while migrated cases use SDK locators
// and assertions. This fixture is acquired automatically for every case.
export const test = base.extend<{ parityNetwork: void }>({
  parityNetwork: async ({ app, browser }, use) => {
    const origin = new URL(app.baseUrl!).origin;
    const serviceRequests: string[] = [];
    await browser.route('**/*', async route => {
      const url = new URL(route.request.url);
      if (url.origin === origin) await route.continue();
      else if (/^(picsum\.photos|fastly\.picsum\.photos)$/.test(url.hostname)) {
        await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#eee"/></svg>' });
      } else {
        if (/revenuecat|supabase|stripe|purchases|billing/i.test(url.hostname)) serviceRequests.push(url.hostname);
        await route.abort();
      }
    });
    try { await use(undefined); }
    finally { expect.soft(serviceRequests, 'No real billing/backend request is allowed').toEqual([]); }
  },
});
