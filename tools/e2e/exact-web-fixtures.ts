import { test as base } from '@e2e-dev/web';
import type { Browser, DialogHandler } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { App, Screen } from 'e2e';
import { webLocale } from './web-engine';

export type ExactWebUI = { app: App; screen: Screen; browser: Browser };
type Options = { viewport?: { width: number; height: number }; reducedMotion?: 'reduce' | 'no-preference'; locale?: string };

/** Exact UI journeys with the historical mock boundary; no raw Page or matcher bridge. */
export function createExactWebTest(options: Options = {}) {
  const test = base.extend<{ mockBoundary: void }>({
    mockBoundary: async ({ browser, app }, provide) => {
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
      await browser.setViewport(options.viewport ?? { width: 1280, height: 720 });
      await app.open();
      // Preserve the historical fixture: consent is already granted for billing
      // and layout journeys, from the next navigation. Consent has its own test.
      await browser.addInitScript(() => localStorage.setItem('noctalia.aiConsent.v2', 'granted'));
      if (options.reducedMotion) await browser.emulateMedia({ reducedMotion: options.reducedMotion });
      try { await provide(); }
      finally { expect.soft(serviceRequests, 'No real billing/backend request is allowed').toEqual([]); }
    },
  });
  return (title: string, body: (ui: ExactWebUI) => Promise<void>) => test(title, {
    timeout: 180_000,
    tags: ['public-api', `locale-${options.locale ?? 'en-US'}`],
    skip: webLocale === (options.locale ?? 'en-US') ? false : `Requires ${options.locale ?? 'en-US'} browser locale`,
  }, body);
}

export async function withExactDialog(browser: Browser, handler: DialogHandler, action: () => Promise<unknown>) {
  const stop = await browser.onDialog(handler);
  try { await action(); } finally { await stop(); }
}
export { expect };
