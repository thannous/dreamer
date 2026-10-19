#!/usr/bin/env node
// Measures Dreamer interaction fluidity on an exported mock web build.
//
// Same journey for every build: Plus mock profile, then scroll each main screen and
// switch tabs, under CPU throttling. Each window records React commits (DevTools hook),
// main-thread script/layout time (CDP), long tasks and requestAnimationFrame intervals.
// It compares JavaScript work between builds; it is not a native FPS measurement.
//
// Usage:
//   node scripts/perf/measure-web-fluidity.mjs --dist <web export dir> --label <name>
//     [--runs 5] [--cpu 4] [--port 8190] [--output <dir>] [--url <running server>]
//     [--chromium <executable>] [--attribute 1]
// --attribute 1 also names the components rendered in each window (use a development
// server through --url for readable names); its tree walks distort the timings.
// Build the export with:
//   EXPO_PUBLIC_MOCK_PERSISTENCE=true node ./scripts/expo-safe-runner.js --profile .env.mock \
//     export -p web --output-dir <web export dir>

import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const args = parseArgs(process.argv.slice(2));
// --url targets an already running server (for example the mock dev server) instead.
const dist = args.url ? null : path.resolve(required(args, 'dist'));
const label = required(args, 'label');
const runs = Number(args.runs ?? 5);
const cpuRate = Number(args.cpu ?? 4);
const port = Number(args.port ?? 8190);
const output = path.resolve(args.output ?? path.join('test-results', 'web-fluidity'));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument ${arg}`);
    parsed[arg.slice(2)] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function required(values, key) {
  if (!values[key]) throw new Error(`--${key} is required`);
  return values[key];
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wasm': 'application/wasm',
};

// Single-page export: unknown paths fall back to index.html, as on the hosted app.
function serve(root) {
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.join(root, pathname);
    if (!file.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = path.join(root, 'index.html');
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

// Installed before the app: React reports each commit to the DevTools hook, production
// builds included. Frames and long tasks are collected only inside a measured window.
function instrument(attribute) {
  const state = { commits: 0, frames: [], longTasks: [], rendered: {}, recording: false };
  window.__fluidity = state;
  const renderers = new Map();
  let seen = new WeakSet();
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers,
    inject(renderer) {
      const id = renderers.size + 1;
      renderers.set(id, renderer);
      return id;
    },
    onCommitFiberRoot(_id, root) {
      if (state.recording) state.commits += 1;
      if (!attribute) return;
      // Diagnostic only (slow): name every component that re-rendered in this commit.
      // A fiber left out of the render keeps its object from the previous commit; a
      // processed one is a fresh clone, and flag 1 (PerformedWork) says it really ran.
      // Readable names need a development bundle.
      const next = new WeakSet();
      const stack = [root.current];
      while (stack.length) {
        const fiber = stack.pop();
        next.add(fiber);
        if (state.recording && [0, 1, 11, 14, 15].includes(fiber.tag) && fiber.alternate
          && !seen.has(fiber) && (fiber.flags & 1)) {
          const type = fiber.type?.type ?? fiber.type?.render ?? fiber.type;
          const name = type?.displayName ?? type?.name ?? 'Anonymous';
          state.rendered[name] = (state.rendered[name] ?? 0) + 1;
        }
        if (fiber.sibling) stack.push(fiber.sibling);
        if (fiber.child) stack.push(fiber.child);
      }
      seen = next;
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };
  let last = 0;
  const tick = (now) => {
    if (state.recording) {
      if (last) state.frames.push(now - last);
      last = now;
    } else {
      last = 0;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      if (!state.recording) return;
      for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    // Long tasks are reported where the browser supports them.
  }
}

async function metrics(cdp) {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.map(({ name, value }) => [name, value]));
}

async function measure(page, cdp, name, action) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const before = await metrics(cdp);
  await page.evaluate(() => {
    const state = window.__fluidity;
    state.commits = 0;
    state.frames = [];
    state.longTasks = [];
    state.rendered = {};
    state.recording = true;
  });
  const started = Date.now();
  await action();
  // Let the last scroll event, idle timers and their renders land inside the window.
  await page.waitForTimeout(400);
  const collected = await page.evaluate(() => {
    const state = window.__fluidity;
    state.recording = false;
    return { commits: state.commits, frames: state.frames, longTasks: state.longTasks, rendered: state.rendered };
  });
  const after = await metrics(cdp);
  const frames = collected.frames.slice().sort((a, b) => a - b);
  const p95 = frames.length ? frames[Math.min(frames.length - 1, Math.floor(frames.length * 0.95))] : 0;
  return {
    name,
    wallMs: Date.now() - started,
    reactCommits: collected.commits,
    scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
    layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
    styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
    taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
    longTasks: collected.longTasks.length,
    longTaskMs: collected.longTasks.reduce((sum, value) => sum + value, 0),
    frames: frames.length,
    frameP95Ms: p95,
    // A frame over 1.5 vsyncs at 60 Hz missed at least one presentation.
    slowFrames: frames.filter((value) => value > 25).length,
    ...(args.attribute ? {
      rendered: Object.fromEntries(Object.entries(collected.rendered).sort((a, b) => b[1] - a[1]).slice(0, 80)),
    } : {}),
  };
}

async function wheelScroll(page, distance, steps = 24) {
  const box = page.viewportSize();
  await page.mouse.move(box.width / 2, box.height / 2);
  const delta = distance / steps;
  for (let step = 0; step < steps; step += 1) {
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(16);
  }
}

async function visible(page, testId) {
  const locator = page.getByTestId(testId).filter({ visible: true }).first();
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  return locator;
}

async function preparePlusProfile(page, baseURL) {
  // A development server may compile its first bundle on this request.
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await (await visible(page, 'btn.onboarding.intro.next')).click();
  await (await visible(page, 'btn.onboarding.skip')).click();
  await visible(page, 'screen.recording');
  const homeTab = page.getByTestId('tab.home').filter({ visible: true });
  if (await homeTab.isVisible()) await homeTab.click();
  else await (await visible(page, 'btn.recording.home')).click();
  await (await visible(page, 'btn.header.home.settings')).click();
  await (await visible(page, 'quick-settings.all')).click();
  await (await visible(page, 'settings-account-open-signin')).click();
  await (await visible(page, 'btn.mockProfile.plus')).click();
  await visible(page, 'screen.recording');
}

async function openTab(page, tab, screen) {
  const button = page.getByTestId(tab).filter({ visible: true });
  if (!(await button.isVisible())) await (await visible(page, 'btn.recording.home')).click();
  await (await visible(page, tab)).click();
  await visible(page, screen);
}

async function scrollScreen(page, cdp, name, tab, screen) {
  await openTab(page, tab, screen);
  await page.waitForTimeout(600);
  const down = await measure(page, cdp, `${name}.scroll`, async () => {
    await wheelScroll(page, 1600);
    await wheelScroll(page, -1600);
  });
  return down;
}

async function run(browser, baseURL, index) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => window.localStorage.setItem('noctalia.aiConsent.v2', 'granted'));
  await context.addInitScript(instrument, Boolean(args.attribute));
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL).origin) return route.continue();
    if (url.hostname.endsWith('picsum.photos')) {
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#eee"/></svg>',
      });
    }
    return route.abort();
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await preparePlusProfile(page, baseURL);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });

  const results = [];
  // Visit each tab once so the retained tabs are mounted, as after a few minutes of use.
  for (const [tab, screen] of [
    ['tab.home', 'screen.home'], ['tab.journal', 'screen.journal'],
    ['tab.stats', 'screen.trends'], ['tab.explore', 'screen.explore'],
  ]) {
    await openTab(page, tab, screen);
    await page.waitForTimeout(800);
  }
  results.push(await scrollScreen(page, cdp, 'home', 'tab.home', 'screen.home'));
  results.push(await scrollScreen(page, cdp, 'journal', 'tab.journal', 'screen.journal'));
  results.push(await scrollScreen(page, cdp, 'trends', 'tab.stats', 'screen.trends'));
  results.push(await scrollScreen(page, cdp, 'explore', 'tab.explore', 'screen.explore'));
  results.push(await measure(page, cdp, 'tabs.switch', async () => {
    for (const [tab, screen] of [
      ['tab.home', 'screen.home'], ['tab.journal', 'screen.journal'],
      ['tab.stats', 'screen.trends'], ['tab.explore', 'screen.explore'], ['tab.home', 'screen.home'],
    ]) {
      await (await visible(page, tab)).click();
      await visible(page, screen);
      await page.waitForTimeout(250);
    }
  }));
  // Resource pages opened from Explore, each with its own painted header.
  await openTab(page, 'tab.explore', 'screen.explore');
  await (await visible(page, 'btn.explorer.guides')).click();
  await page.waitForTimeout(800);
  results.push(await measure(page, cdp, 'guides.scroll', async () => {
    await wheelScroll(page, 1600);
    await wheelScroll(page, -1600);
  }));
  await page.goBack();
  await openTab(page, 'tab.explore', 'screen.explore');
  await (await visible(page, 'btn.explorer.ritual')).click();
  await page.waitForTimeout(800);
  results.push(await measure(page, cdp, 'ritual.scroll', async () => {
    await wheelScroll(page, 1600);
    await wheelScroll(page, -1600);
  }));
  await page.goBack();
  // Opening a dream and returning: a stack push and pop over the retained tabs.
  await openTab(page, 'tab.journal', 'screen.journal');
  await page.waitForTimeout(600);
  results.push(await measure(page, cdp, 'detail.open-back', async () => {
    for (let visit = 0; visit < 3; visit += 1) {
      await page.getByTestId(/^dream\.item\./).filter({ visible: true }).first().click();
      await visible(page, 'screen.dreamDetail');
      await page.waitForTimeout(400);
      await (await visible(page, 'btn.navigateJournal')).click();
      await visible(page, 'screen.journal');
      await page.waitForTimeout(400);
    }
  }));
  // Typing a search in the journal, one key at a time, then clearing it.
  const search = page.getByRole('textbox', { name: 'Search dreams…' }).filter({ visible: true }).first();
  results.push(await measure(page, cdp, 'journal.search', async () => {
    await search.focus();
    await search.pressSequentially('forest', { delay: 120 });
    await page.waitForTimeout(300);
    await search.fill('');
  }));
  // The symbol dictionary browsed by letter.
  await openTab(page, 'tab.explore', 'screen.explore');
  await (await visible(page, 'btn.explorer.symbols')).click();
  await visible(page, 'screen.symbolDictionary');
  await page.waitForTimeout(600);
  results.push(await measure(page, cdp, 'symbols.letters', async () => {
    await (await visible(page, 'symbol-mode-alphabetical')).click();
    for (const letter of ['B', 'D', 'M', 'S', 'W']) {
      const option = page.getByTestId(`symbol-letter-${letter}`).filter({ visible: true }).first();
      if (await option.isEnabled()) await option.click();
      await page.waitForTimeout(250);
    }
  }));
  await context.close();
  return results.map((result) => ({ run: index, ...result }));
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const server = dist ? await serve(dist) : null;
const baseURL = args.url ?? `http://127.0.0.1:${port}/`;
// A preinstalled Chromium can replace the version pinned by Playwright.
const browser = await chromium.launch(args.chromium ? { executablePath: args.chromium } : {});
const all = [];
try {
  for (let index = 1; index <= runs; index += 1) {
    const results = await run(browser, baseURL, index);
    all.push(...results);
    console.log(`run ${index}/${runs}: ${results.map((result) => `${result.name} ${result.reactCommits}c ${result.scriptMs.toFixed(0)}ms`).join(', ')}`);
  }
} finally {
  await browser.close();
  server?.close();
}

const names = [...new Set(all.map((result) => result.name))];
const fields = ['reactCommits', 'scriptMs', 'layoutMs', 'styleMs', 'taskMs', 'longTasks', 'longTaskMs', 'frames', 'frameP95Ms', 'slowFrames', 'wallMs'];
const summary = Object.fromEntries(names.map((name) => {
  const rows = all.filter((result) => result.name === name);
  return [name, Object.fromEntries(fields.map((field) => [field, Number(median(rows.map((row) => row[field])).toFixed(1))]))];
}));
await mkdir(output, { recursive: true });
const file = path.join(output, `${label}.json`);
await writeFile(file, `${JSON.stringify({ label, source: dist ?? baseURL, runs, cpuRate, viewport: '390x844', summary, runsDetail: all }, null, 2)}\n`);
console.table(summary);
console.log(`Saved ${file}`);
