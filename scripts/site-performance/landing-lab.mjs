#!/usr/bin/env node
// Report-only landing lab: Lighthouse (simulated throttling) on the mobile and
// desktop presets, plus the main-thread cost of an idle landing after the
// intro. Real phones are coarse-pointer, 8-core, 4 GB devices (light tier);
// desktops are 8-core, 8 GB (full tier). The harness pins those hints because
// a CI container would otherwise land on another tier.
//
// Usage (install the tools outside the repository):
//   npm install --prefix /tmp/landing-lab lighthouse@13.4.1 puppeteer-core@24
//   node scripts/site-performance/serve-compressed.cjs docs 8530
//   LAB_TOOLS=/tmp/landing-lab CHROME_PATH=/path/to/chrome \
//     node scripts/site-performance/landing-lab.mjs /tmp/landing-evidence [runs]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const tools = process.env.LAB_TOOLS;
const chrome = process.env.CHROME_PATH;
const [output, runsArg] = process.argv.slice(2);
if (!tools || !chrome || !output) throw new Error('Usage: LAB_TOOLS=<dir> CHROME_PATH=<chrome> node landing-lab.mjs <output-dir> [runs]');
const base = process.env.SITE_BASE_URL || 'http://localhost:8530';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Only loopback URLs are supported');
const runs = Number(runsArg || 5);
const paths = (process.env.LAB_PATHS || '/,/fr/').split(',');

const requireTool = createRequire(path.join(path.resolve(tools), 'package.json'));
const load = async (name) => import(pathToFileURL(requireTool.resolve(name)).href);
const { default: lighthouse } = await load('lighthouse');
const { default: desktopConfig } = await load('lighthouse/core/config/desktop-config.js');
const { default: puppeteer } = await load('puppeteer-core');

const profiles = {
  mobile: { config: undefined, cores: 8, ram: 4 },
  desktop: { config: desktopConfig, cores: 8, ram: 8 },
};
const launch = () => puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const pinHardware = (page, { cores, ram }) => page.evaluateOnNewDocument((c, r) => {
  Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => c });
  Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => r });
}, cores, ram);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

fs.mkdirSync(output, { recursive: true });
const rows = [];
for (const pathname of paths) {
  for (const [formFactor, profile] of Object.entries(profiles)) {
    for (let run = 0; run < runs; run++) {
      const browser = await launch();
      const page = await browser.newPage();
      await pinHardware(page, profile);
      const result = await lighthouse(base + pathname, { output: 'json', logLevel: 'error', onlyCategories: ['performance'] }, profile.config, page);
      const audits = result.lhr.audits;
      const requests = audits['network-requests'].details.items;
      const row = {
        pathname, formFactor, run, tier: await page.evaluate(() => document.documentElement.dataset.expTier),
        score: Math.round(result.lhr.categories.performance.score * 100),
        fcp: audits['first-contentful-paint'].numericValue, lcp: audits['largest-contentful-paint'].numericValue,
        tbt: audits['total-blocking-time'].numericValue, cls: audits['cumulative-layout-shift'].numericValue,
        si: audits['speed-index'].numericValue, bytes: audits['total-byte-weight'].numericValue, requests: requests.length,
        media: requests.filter((r) => r.resourceType === 'Media').map((r) => ({ url: r.url.replace(base, ''), bytes: r.transferSize })),
      };
      rows.push(row);
      if (run === 0) fs.writeFileSync(path.join(output, `lhr-${formFactor}-${pathname.replace(/\W+/g, '_')}.json`), JSON.stringify(result.lhr));
      console.log(JSON.stringify({ ...row, media: undefined }));
      await browser.close();
    }
  }
}

// Idle cost: after the intro, 5 s at the hero and 5 s at the footer, CPU 4x.
const idle = [];
for (let run = 0; run < Math.min(runs, 3); run++) {
  const browser = await launch();
  const page = await browser.newPage();
  await pinHardware(page, profiles.mobile);
  await page.emulate({ viewport: { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' });
  await page.goto(`${base}${paths.at(-1)}`, { waitUntil: 'load' });
  await new Promise((resolve) => setTimeout(resolve, 14000));
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Performance.enable');
  const sample = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const phases = {};
  for (const [name, y] of [['hero', 0], ['footer', 1e6]]) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const before = await sample();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const after = await sample();
    phases[name] = Math.round((after.TaskDuration - before.TaskDuration) * 1000);
  }
  idle.push(phases);
  console.log(JSON.stringify({ idle: phases }));
  await browser.close();
}

const summary = {};
for (const pathname of paths) {
  for (const formFactor of Object.keys(profiles)) {
    const group = rows.filter((row) => row.pathname === pathname && row.formFactor === formFactor);
    summary[`${pathname} ${formFactor}`] = Object.fromEntries(['score', 'fcp', 'lcp', 'tbt', 'cls', 'si', 'bytes'].map((key) => [key, median(group.map((row) => row[key]))]));
  }
}
summary.idleMainThreadMsPer5s = { hero: median(idle.map((p) => p.hero)), footer: median(idle.map((p) => p.footer)) };
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ base, runs, summary, rows, idle }, null, 2));
console.log(JSON.stringify(summary, null, 2));
