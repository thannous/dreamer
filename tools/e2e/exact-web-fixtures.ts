import { test as base } from '@e2e-dev/web';
import type { Browser, DialogHandler } from '@e2e-dev/web';
import { expect } from 'e2e';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { App, Screen, Locator, JsonValue } from 'e2e';
import { webLocale } from './web-engine';

export type ExactWebUI = { app: App; screen: Screen; browser: Browser; artifacts: { attach(name: string, artifact: { body: string | Buffer; contentType: string }): Promise<void> } };
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
  }, async (ui) => {
    const folder = join(process.env.E2E_OUTPUT!, 'exact-artifacts', randomUUID());
    const artifacts = { async attach(name: string, artifact: { body: string | Buffer; contentType: string }) {
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, `${name}.${artifact.contentType === 'application/json' ? 'json' : 'bin'}`), artifact.body);
    } };
    await body({ ...ui, artifacts });
  });
}

export async function withExactDialog(browser: Browser, handler: DialogHandler, action: () => Promise<unknown>) {
  const stop = await browser.onDialog(handler);
  try { await action(); } finally { await stop(); }
}
export { expect };

/** Trusted DOM assertions through the public browser evaluation boundary. */
export async function readDOM<T extends JsonValue | void>(browser: Browser, selector: string, read: (element: HTMLElement) => T): Promise<T extends void ? null : T> {
  return browser.evaluate(`(() => {
    const matches = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const visible = matches.filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const element = visible.length === 1 ? visible[0] : matches.length === 1 ? matches[0] : null;
    if (!element) throw new Error('DOM assertion requires one element: ' + ${JSON.stringify(selector)});
    return (${read.toString()})(element) ?? null;
  })()`);
}
export const byId = (id: string) => `[data-testid=${JSON.stringify(id)}]`;
export async function expectCSS(browser: Browser, selector: string, property: string, value: string) {
  await expect.poll(() => browser.evaluate(({ selector, property }) => {
    const element = document.querySelector(selector);
    return element ? getComputedStyle(element).getPropertyValue(property) : null;
  }, { selector, property }), { timeout: 15_000 }).toBe(value);
}
export async function expectInViewport(target: Locator, browser: Browser, ratio = 0, expected = true) {
  await expect.poll(async () => {
    const box = await target.boundingBox();
    const viewport = await browser.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    if (!box || box.width <= 0 || box.height <= 0) return false;
    const intersection = Math.max(0, Math.min(box.x + box.width, viewport.width) - Math.max(box.x, 0))
      * Math.max(0, Math.min(box.y + box.height, viewport.height) - Math.max(box.y, 0));
    return intersection > 0 && intersection / (box.width * box.height) >= ratio;
  }, { timeout: 15_000 }).toBe(expected);
}
export async function expectCaptureDraftSaved(browser: Browser, text: string) {
  await expect.poll(() => browser.evaluate(() => localStorage.getItem('noctalia_mock_dogfood_v1:gemini_dream_journal_recording_transcript')),
    { timeout: 15_000, message: 'capture draft kept for a reload' }).toContain(text);
}
export async function answerSeal(screen: Screen, answer: 'now' | 'later') {
  const question = screen.getByTestId(answer === 'now' ? 'btn.dreamCaptureSeal.readNow' : 'btn.dreamCaptureSeal.readLater');
  await expect(question).toBeVisible();
  await question.click();
}
export async function expectIllustrationOnPlate(screen: Screen) {
  await screen.getByTestId('component.dreamDetail.savedMoment').scrollIntoView();
  await expect(screen.getByTestId('btn.journal.illustration.expand')).toBeVisible();
}
export async function addCSS(browser: Browser, content: string, id = 'e2e-layout-stress') {
  await browser.evaluate(({ content, id }) => {
    const style = document.createElement('style'); style.id = id; style.textContent = content; document.head.append(style); return null;
  }, { content, id });
}
export async function expectInnerText(browser: Browser, selector: string, text: string) {
  await expect.poll(() => readDOM(browser, selector, element => element.innerText.replace(/\s+/g, ' ').trim()), { timeout: 15_000 })
    .toBe(text.replace(/\s+/g, ' ').trim());
}
