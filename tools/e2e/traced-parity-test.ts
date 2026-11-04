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
    // web-engine.ts blocks the app's service worker only through `headers`; an engine
    // upgrade that stops doing so must fail here rather than bypass the routes.
    expect(await browser.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(registrations => registrations.length) : 0),
      'Service workers stay blocked (web-engine.ts headers)').toBe(0);
  },
});
