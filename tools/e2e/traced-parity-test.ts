import { test as base } from '@e2e-dev/web';
import { expect } from 'e2e';
import { guardNetwork } from './web-fixtures';

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
