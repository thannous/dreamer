#!/usr/bin/env node
'use strict';
// Report-only Lighthouse corpus. Install the pinned CLI outside the repository.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const pages = {
  home: '/fr/',
  product: '/fr/application-analyse-de-reve-android',
  dictionary: '/fr/guides/dictionnaire-symboles-reves',
  article: '/fr/blog/comment-se-souvenir-de-ses-reves',
  media: '/fr/blog/',
};
const cli = process.env.LIGHTHOUSE_CLI;
const output = process.argv[2];
if (!cli || !output) throw new Error('Usage: LIGHTHOUSE_CLI=/absolute/lighthouse/cli/index.js node scripts/site-performance/measure.cjs /absolute/output-directory');
const base = process.env.SITE_BASE_URL || 'http://localhost:8530';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Only loopback preview URLs are supported');
fs.mkdirSync(output, { recursive: true });
const summary = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.version, base, runs: [] };
for (let run = 1; run <= 3; run++) {
  for (const [name, pathname] of Object.entries(pages)) {
    const file = path.resolve(output, `${name}-${run}.json`);
    const result = spawnSync(process.execPath, [cli, new URL(pathname, base).href,
      '--only-categories=performance,accessibility,best-practices,seo', '--chrome-flags=--headless',
      '--output=json', `--output-path=${file}`, '--quiet'], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`Lighthouse failed: ${name}, run ${run}`);
    const report = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (report.runtimeError) throw new Error(JSON.stringify(report.runtimeError));
    const numeric = (key) => report.audits[key]?.numericValue ?? null;
    summary.runs.push({ name, run, url: report.finalDisplayedUrl, lighthouse: report.lighthouseVersion,
      userAgent: report.environment.hostUserAgent, settings: report.configSettings,
      scores: Object.fromEntries(Object.entries(report.categories).map(([k,v]) => [k,v.score])),
      fcpMs: numeric('first-contentful-paint'), lcpMs: numeric('largest-contentful-paint'),
      cls: numeric('cumulative-layout-shift'), tbtMs: numeric('total-blocking-time'),
      mainThreadMs: numeric('mainthread-work-breakdown'), bytes: numeric('total-byte-weight'),
      resources: report.audits['resource-summary']?.details?.items,
      blockingResources: report.audits['render-blocking-insight']?.details,
      warnings: report.runWarnings,
    });
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(`${name} run ${run}: LCP ${numeric('largest-contentful-paint')} ms`);
  }
}
