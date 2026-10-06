import { test as base, surfaceOf } from '@e2e-dev/web';
import { expect as e2eExpect } from 'e2e';
import type { Page, BrowserContext } from 'playwright/test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { webEngine, webLocale } from './web-engine';

// Keep the matcher library out of the test module bundler, as in SkillCodex's
// existing baseline adapter. Resolve this isolated package's pinned version.
const matchers: typeof import('playwright/test') = createRequire(import.meta.url)('playwright/test');
// Match the15-second assertion timeout of playwright.config.ts exactly.
export const expect = matchers.expect.configure({ timeout: 15_000 });

export type ParityInfo = {
  outputPath(name: string): string;
  attach(name: string, artifact: { body: string | Buffer; contentType: string }): Promise<void>;
};

type Fixtures = { page: Page; context: BrowserContext };
type Body = (fixtures: Fixtures, info: ParityInfo) => Promise<void>;
type Hook = (fixtures: Fixtures) => Promise<void>;

type Options = { locale?: string; viewport?: { width: number; height: number }; reducedMotion?: 'reduce' | 'no-preference'; contextOptions?: { reducedMotion?: 'reduce' | 'no-preference' }; timezoneId?: 'Europe/Paris' };

// Keep historical CSS, clock, accessibility and geometry assertions on the
// pinned web engine. TesterArmy owns attempts, isolation, tracing and reports;
// no second Playwright runner or model/provider is involved.
export function createParityTest(initial: Options = {}) {
  let options = initial;
  let hooks: Hook[] = [];
  let skipped = false;
  let running = false;
  const register = (title: string, body: Body) => {
  const active = { ...options };
  const setup = [...hooks];
  const locale = active.locale ?? 'en-US';
  const skip = skipped || (locale !== webLocale ? `Requires the real ${locale} browser context; run E2E_WEB_LOCALE=${locale} with --tag locale-${locale}` : false);
  const parity = base.extend<{ page: Page }>({
    page: async ({ app, browser }, provide) => {
      const origin = new URL(app.baseUrl!).origin;
      const serviceRequests: string[] = [];
      await browser.route('**/*', async route => {
        const url = new URL(route.request.url);
        if (url.origin === origin) await route.continue();
        else if (/^(picsum\.photos|fastly\.picsum\.photos)$/.test(url.hostname))
          await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#eee"/></svg>' });
        else {
          if (/revenuecat|supabase|stripe|purchases|billing/i.test(url.hostname)) serviceRequests.push(url.hostname);
          await route.abort();
        }
      });
      await browser.setViewport(active.viewport ?? { width: 1280, height: 720 });
      await app.open();
      const page = surfaceOf(webEngine)!.page() as unknown as Page;
      page.setDefaultTimeout(30_000);
      // The engine resolves app URLs itself; its raw page has no baseURL.
      // Preserve the historical relative goto contract on this attempt only.
      const goto = page.goto;
      page.goto = (url, options) => goto.call(page, new URL(url, app.baseUrl!).href, options);
      const reducedMotion = active.reducedMotion ?? active.contextOptions?.reducedMotion;
      if (reducedMotion) await page.emulateMedia({ reducedMotion });
      try { await provide(page); }
      finally {
        page.goto = goto;
        e2eExpect.soft(serviceRequests, 'No real billing/backend request is allowed').toEqual([]);
      }
    },
  });
  return parity(title, { skip, timeout: 60_000, tags: ['historical-parity', `locale-${locale}`] }, async ({ page, app }) => {
    const captures: string[] = [];
    const folder = join(process.env.E2E_OUTPUT!, 'parity-artifacts', `${createHash('sha256').update(title).digest('hex').slice(0, 12)}-${Date.now()}`);
    mkdirSync(folder, { recursive: true });
    const info: ParityInfo = {
      outputPath(name) { const path = join(folder, name); captures.push(path); return path; },
      async attach(name, artifact) {
        const path = info.outputPath(`${name}.${artifact.contentType === 'image/png' ? 'png' : 'json'}`);
        writeFileSync(path, artifact.body);
      },
    };
    try {
      running = true;
      const fixtures = { page, context: page.context() };
      await info.attach('browser-context', { contentType: 'application/json', body: JSON.stringify({ requestedLocale: locale, actual: await page.evaluate(() => ({ language: navigator.language, intlLocale: Intl.DateTimeFormat().resolvedOptions().locale, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, width: innerWidth, height: innerHeight })) }, null, 2) });
      for (const hook of setup) await hook(fixtures);
      await body(fixtures, info);
      await app.screenshot('parity-final');
    }
    finally { running = false; writeFileSync(join(folder, 'artifacts.json'), JSON.stringify(captures, null, 2) + '\n'); }
  });
  };
  return Object.assign(register, {
    use(next: Options) { options = { ...options, ...next }; },
    beforeEach(hook: Hook) { hooks.push(hook); },
    describe(title: string, body: () => void) {
      base.describe(title, () => {
        const previous = { options, hooks: [...hooks], skipped };
        try { body(); } finally { options = previous.options; hooks = previous.hooks; skipped = previous.skipped; }
      });
    },
    skip(condition: boolean, reason?: string) {
      if (running) base.skip(condition, reason);
      else if (condition) skipped = true;
    },
  });
}
