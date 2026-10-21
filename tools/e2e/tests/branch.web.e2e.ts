import { readFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, surfaceOf } from '@e2e-dev/web';
import { expect } from 'e2e';
import { webEngine } from '../web-engine';
import { assertTestSupabaseTarget, readTestEnv, FORBIDDEN_PROJECT_REFS } from '../branch-target';
import type { BrowserContext } from 'playwright/test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const test = base.extend<{ openAccount: (account: string) => Promise<void> }>({
  openAccount: async ({ app }, provide) => {
    // Refuse before navigation; no production account or request can be used.
    assertTestSupabaseTarget(readTestEnv());
    const runId = process.env.E2E_QA_RUN_ID;
    const dir = join(root, '.auth', 'runs', runId ?? '');
    if (!runId || !/^[0-9a-f-]{36}$/.test(runId) || process.env.E2E_QA_RUN_DIR !== dir || lstatSync(dir).isSymbolicLink())
      throw new Error('Use the guarded persistent QA runner with its exclusive account leases.');
    const context = surfaceOf(webEngine)!.context() as unknown as BrowserContext;
    const blocked: string[] = [];
    const production = (url: string) => FORBIDDEN_PROJECT_REFS.some((ref: string) => new URL(url).hostname.includes(ref));
    await context.route('**/*', route => {
      if (production(route.request().url())) { blocked.push('http'); return route.abort(); }
      return route.continue();
    });
    await context.routeWebSocket(/.*/, ws => {
      if (production(ws.url())) { blocked.push('websocket'); return ws.close({ code: 1008, reason: 'Production refused' }); }
      ws.connectToServer();
    });
    try {
      await provide(async account => {
        if (!['free', 'premium'].includes(account)) throw new Error('Unknown guarded account.');
        const file = join(dir, `${account}.json`);
        const stat = lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error('Private QA session permissions are required.');
        const state = JSON.parse(readFileSync(file, 'utf8'));
        const appOrigin = new URL(app.baseUrl!).origin;
        const origin = state.origins.find((entry: { origin: string }) => entry.origin === appOrigin);
        if (!origin) throw new Error('Saved branch session has the wrong origin.');
        // Raw public browser surface keeps private token values out of SDK step
        // arguments. Only SDK Markdown steps are retained; no network trace or model.
        await context.addInitScript(({ origin, items }) => {
          if (location.origin === origin) for (const item of items) localStorage.setItem(item.name, item.value);
        }, { origin: appOrigin, items: origin.localStorage as { name: string; value: string }[] });
        await app.open();
      });
    } finally {
      expect(blocked, 'No request may reach the production Supabase project').toEqual([]);
    }
  },
});

for (const account of ['free', 'premium']) {
  test(`${account} opens signed in from the guarded saved session`, async ({ openAccount, screen, app }) => {
    await openAccount(account);
    const intro = screen.getByTestId('btn.onboarding.intro.next', { visible: true });
    const home = screen.getByTestId('btn.recording.home', { visible: true });
    await expect.poll(async () => await intro.isVisible() || await home.isVisible()).toBe(true);
    if (await intro.isVisible()) {
      await intro.tap();
      await screen.getByTestId('btn.onboarding.skip').tap();
    }
    await home.tap();
    await screen.getByTestId('btn.header.home.settings').tap();
    await screen.getByTestId('quick-settings.all').tap();
    await expect(screen.getByTestId('text.auth.email')).toContainText(`e2e+${account}@`);
    await app.open('/journal');
    await expect(screen.getByTestId('screen.journal', { visible: true })).toBeVisible();
    await expect(screen.getByTestId(/^dream\.item\./, { visible: true }).filter({ hasText: `QA:${process.env.E2E_QA_RUN_ID}:${account}` })).toHaveCount(1);
  });
}
