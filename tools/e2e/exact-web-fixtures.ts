import { test as base } from '@e2e-dev/web';
import type { Browser, DialogHandler } from '@e2e-dev/web';
import { expect } from 'e2e';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { App, Screen, Locator, JsonValue } from 'e2e';
import { webLocale } from './web-engine';

export type ExactWebUI = { app: App; screen: Screen; browser: Browser; artifacts: { attach(name: string, artifact: { body: string | Buffer; contentType: string }): Promise<void> } };
type Options = { viewport?: { width: number; height: number }; reducedMotion?: 'reduce' | 'no-preference'; locale?: string; setup?: (ui: ExactWebUI) => Promise<void>; skip?: boolean };

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
    skip: options.skip ? true : webLocale === (options.locale ?? 'en-US') ? false : `Requires ${options.locale ?? 'en-US'} browser locale`,
  }, async (ui) => {
    const folder = join(process.env.E2E_OUTPUT!, 'exact-artifacts', randomUUID());
    const artifacts = { async attach(name: string, artifact: { body: string | Buffer; contentType: string }) {
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, `${name}.${artifact.contentType === 'application/json' ? 'json' : 'bin'}`), artifact.body);
    } };
    const exact = { app: ui.app, screen: ui.screen, browser: ui.browser, artifacts };
    await artifacts.attach('browser-context', { contentType: 'application/json', body: JSON.stringify(await ui.browser.evaluate(() => ({ language: navigator.language, locale: Intl.DateTimeFormat().resolvedOptions().locale, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, width: innerWidth, height: innerHeight }))) });
    if (options.setup) await options.setup(exact);
    await body(exact);
  });
}

export async function withExactDialog(browser: Browser, handler: DialogHandler, action: () => Promise<unknown>) {
  const stop = await browser.onDialog(handler);
  try { await action(); } finally { await stop(); }
}
export { expect };

/** Trusted DOM assertions through the public browser evaluation boundary. */
export async function readDOM<T extends JsonValue | void, Arg extends JsonValue = null>(browser: Browser, selector: string,
  read: (element: HTMLElement, arg: Arg) => T | Promise<T>, arg: Arg = null as Arg, match: 'unique' | 'last' = 'unique'): Promise<T extends void ? null : T> {
  return browser.evaluate(`(async () => {
    const matches = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const visible = matches.filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const element = ${JSON.stringify(match)} === 'last' ? matches.at(-1)
      : visible.length === 1 ? visible[0] : matches.length === 1 ? matches[0] : null;
    if (!element) throw new Error('DOM assertion requires one element: ' + ${JSON.stringify(selector)});
    return await (${read.toString()})(element, ${JSON.stringify(arg)}) ?? null;
  })()`);
}
export const byId = (id: string) => `[data-testid=${JSON.stringify(id)}]`;
export async function expectCSS(browser: Browser, selector: string, property: string, value: string) {
  await expect.poll(() => browser.evaluate(({ selector, property }) => {
    const element = document.querySelector(selector);
    return element ? getComputedStyle(element).getPropertyValue(property) : null;
  }, { selector, property }), { timeout: 15_000 }).toBe(value);
}
export async function expectInViewport(target: Locator, browser: Browser, ratio = 0, expected = true, selector?: string | { selector: string; text: string }) {
  await expect.poll(async () => {
    if (await target.count() === 0) return false;
    const id = selector ? null : await target.getAttribute('data-testid');
    if (!selector && !id) throw new Error('Viewport assertion needs a stable selector for a node without a test ID');
    // IntersectionObserver, like the old matcher, includes clipping by scroll
    // containers and overflow ancestors, not only the outer window rectangle.
    const query = typeof selector === 'object' ? selector : { selector: selector ?? byId(id!), text: null };
    const intersection = await browser.evaluate(async ({ selector, text }) => {
      const matches = Array.from(document.querySelectorAll(selector)).filter(node => text === null || node.textContent === text);
      const visible = matches.filter(node => node.getClientRects().length);
      const node = visible.length === 1 ? visible[0] : matches.length === 1 ? matches[0] : null;
      if (!node) return 0;
      return new Promise<number>(resolve => {
        const observer = new IntersectionObserver(entries => {
          observer.disconnect(); resolve(entries[0].intersectionRatio);
        });
        observer.observe(node);
        requestAnimationFrame(() => {});
      });
    }, query);
    // Same floating-point tolerance as the pinned Playwright matcher.
    return intersection > 0 && intersection > ratio - 1e-9;
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
export async function expectEditable(browser: Browser, selector: string) {
  await expect.poll(() => readDOM(browser, selector, element => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return !element.matches(':disabled') && !element.readOnly && !element.closest('[aria-disabled="true"]');
    return element.isContentEditable;
  }), { timeout: 15_000 }).toBe(true);
}

/** Consume the public screenshot artifact, whose returned path is attempt-relative. */
export async function screenshotBytes(app: App, label: string) {
  const artifact = await app.screenshot(`${randomUUID()}-${label}`);
  const root = resolve(process.env.E2E_OUTPUT!);
  if (isAbsolute(artifact)) {
    if (!artifact.startsWith(root + '/')) throw new Error('Screenshot escaped the owned evidence directory');
    return readFileSync(artifact);
  }
  const candidates = readdirSync(root, { recursive: true }).map(String)
    .filter(path => path.endsWith('/' + artifact) || path === artifact);
  if (candidates.length !== 1) throw new Error(`Expected one owned screenshot artifact, found ${candidates.length}: ${artifact}`);
  return readFileSync(join(root, candidates[0]));
}
/** Fixed Date values with native timers left intact; no private engine clock. */
export async function setTestDate(browser: Browser, iso: string, mode: 'fixed' | 'elapsed' = 'fixed') {
  function install(options: { iso: string; mode: 'fixed' | 'elapsed'; anchor?: number } | null) {
    if (!options) return null;
    const scope = window as unknown as { __dreamerQANativeDate?: DateConstructor };
    const NativeDate = scope.__dreamerQANativeDate ?? Date;
    scope.__dreamerQANativeDate = NativeDate;
    const state = { ...options, anchor: options.anchor ?? NativeDate.now() };
    sessionStorage.setItem('dreamer.qa.date', JSON.stringify(state));
    const timestamp = NativeDate.parse(state.iso);
    const now = () => timestamp + (state.mode === 'elapsed' ? NativeDate.now() - state.anchor : 0);
    window.Date = new Proxy(NativeDate, {
      construct(target, args, receiver) { return Reflect.construct(target, args.length ? args : [now()], receiver); },
      apply() { return new NativeDate(now()).toString(); },
      get(target, key, receiver) { return key === 'now' ? now : Reflect.get(target, key, receiver); },
    });
    return null;
  }
  // Every registered init script reads the current state. Switching light/night
  // before reload therefore does not depend on init-script registration order.
  await browser.addInitScript(`(${install.toString()})(JSON.parse(sessionStorage.getItem('dreamer.qa.date') || 'null'))`);
  await browser.evaluate(install, { iso, mode });
}
export async function observeElapsed(browser: Browser, milliseconds: number) {
  await browser.evaluate(async milliseconds => {
    const start = performance.now();
    await new Promise(resolve => setTimeout(resolve, milliseconds));
    if (performance.now() - start < milliseconds - 1) throw new Error('Observation ended before its full interval');
    return null;
  }, milliseconds);
}
