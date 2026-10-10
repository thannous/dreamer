import path from 'node:path';
import { test as base, expect } from 'playwright/test';

export type TestAccount = 'free' | 'premium';

// The production Supabase project; any request to it fails the test.
const PRODUCTION_REF = 'usuyppgsmmowzizhaoqj';

export const authFile = (account: TestAccount) => path.join(process.cwd(), '.auth', `${account}.json`);

// Reusable fixture: test.use({ account: 'premium' }) starts the page already
// signed in with the saved session of that account.
export const test = base.extend<{ account: TestAccount; productionGuard: void }>({
  account: ['free', { option: true }],
  storageState: async ({ account }, provide) => {
    await provide(authFile(account));
  },
  productionGuard: [async ({ context }, provide) => {
    const blocked: string[] = [];
    await context.route('**/*', async (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host.includes(PRODUCTION_REF)) {
        blocked.push(host);
        return route.abort();
      }
      return route.continue();
    });
    // context.route does not see WebSockets: Realtime (wss://<ref>.supabase.co)
    // goes through routeWebSocket. Production sockets are closed, the rest
    // are connected to the real server unchanged.
    await context.routeWebSocket(/.*/, (ws) => {
      const host = new URL(ws.url()).hostname;
      if (host.includes(PRODUCTION_REF)) {
        blocked.push(`ws:${host}`);
        return ws.close({ code: 1008, reason: 'production Supabase is blocked in branch E2E' });
      }
      ws.connectToServer();
    });
    await provide();
    expect(blocked, 'No request may reach the production Supabase project').toEqual([]);
  }, { auto: true }],
});

export { expect };
