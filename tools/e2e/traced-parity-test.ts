import { test as base } from '@e2e-dev/web';
import { expect } from 'e2e';
import { guardNetwork } from './web-fixtures';
import { webLocale } from './web-engine';

// Preserve the historical network guard while migrated cases use SDK locators
// and assertions. This fixture is acquired automatically for every case.
export const test = base.extend<{ parityNetwork: void }>({
  parityNetwork: async ({ app, browser }, provide) => {
    const serviceRequests = await guardNetwork(browser, app);
    await provide(undefined);
    // Soft collection is closed by teardown, so these fail the attempt like any expect.
    expect(serviceRequests, 'No real billing/backend request is allowed').toEqual([]);
    // web-engine.ts blocks service workers only through `headers`. The E2E app registers
    // none itself (web.output 'single' never renders app/+html.tsx), so try one: under the
    // block the registration is a no-op; an engine upgrade that drops it fails here.
    expect(await browser.evaluate(async () => {
      if (!navigator.serviceWorker) return 0;
      await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      return (await navigator.serviceWorker.getRegistrations()).length;
    }), 'Service workers stay blocked (web-engine.ts headers)').toBe(0);
  },
});

type Start = {
  locale?: 'en-US' | 'fr-FR' | 'de-DE';
  viewport?: { width: number; height: number };
  reducedMotion?: 'reduce';
  tags?: readonly string[];
};

/**
 * Registers historical journeys on the SDK surface, so trace.md numbers each tap and
 * expect with its file:line. Before the first app.open() the attempt gets its viewport
 * (Desktop Chrome 1280x720 unless the journey asks), reduced motion when asked, and the
 * AI consent these journeys predate; then '/' opens and the body starts on onboarding.
 * A journey of another locale is skipped with its rerun command, never counted as passed.
 */
export function journeyTest(start: Start = {}) {
  const locale = start.locale ?? 'en-US';
  const opened = test.extend<{ journeyStart: void }>({
    journeyStart: async ({ app, browser }, provide) => {
      await browser.setViewport(start.viewport ?? { width: 1280, height: 720 });
      if (start.reducedMotion) await browser.emulateMedia({ reducedMotion: start.reducedMotion });
      await browser.addInitScript(() => {
        try { localStorage.setItem('noctalia.aiConsent.v2', 'granted'); }
        catch { /* The blank first document has no storage; the app's documents do. */ }
      });
      await app.open();
      await provide(undefined);
    },
  });
  type Body = Parameters<typeof opened>[2];
  const skip = locale !== webLocale ? `Requires the real ${locale} browser context; run E2E_WEB_LOCALE=${locale} with --tag locale-${locale}` : false;
  return (title: string, extraOrBody: { tags?: readonly string[] } | Body, maybeBody?: Body) => {
    const extra = typeof extraOrBody === 'function' ? {} : extraOrBody;
    const body = typeof extraOrBody === 'function' ? extraOrBody : maybeBody;
    if (!body) throw new Error(`Missing body for ${title}`);
    const tags = [...new Set(['historical-parity', `locale-${locale}`, ...(start.tags ?? []), ...(extra.tags ?? [])])];
    // A fresh locale campaign compiles its first client bundle in app.open (57 s measured on Linux).
    opened(title, { skip, timeout: 180_000, tags }, body);
  };
}
