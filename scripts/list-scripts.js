#!/usr/bin/env node
'use strict';

const packageJson = require('../package.json');

const FAMILY_DESCRIPTIONS = {
  Development: 'Expo development servers and native project runs',
  Quality: 'lint, type checks, unit tests, and performance tests',
  'Android E2E': 'Maestro flows and release-device scenarios',
  Android: 'device, Play, build, and release gates',
  Subscriptions: 'RevenueCat and Google Play QA evidence',
  Site: 'generated marketing-site build, validation, preview, and deploy',
  Content: 'content manifests and multilingual parity',
  Backend: 'Supabase startup and database contract checks',
  Security: 'mobile security checks',
  SEO: 'Search Console exports and SEO audits',
  Builds: 'reproducible application build entrypoints',
  Other: 'specialized project tooling',
};

function classifyScript(name) {
  if (name.startsWith('test:e2e')) return 'Android E2E';
  if (name.startsWith('android:')) return 'Android';
  if (name.startsWith('subscription:')) return 'Subscriptions';
  if (name.startsWith('docs:') || name === 'serve:docs' || name === 'generate-sitemap' || name === 'validate-seo') return 'Site';
  if (name.startsWith('content:')) return 'Content';
  if (name.startsWith('db:') || name === 'start:supabase') return 'Backend';
  if (name.startsWith('security:')) return 'Security';
  if (name.startsWith('seo:')) return 'SEO';
  if (name.startsWith('build:')) return 'Builds';
  if (name === 'lint' || name.startsWith('lint:') || name === 'test' || name.startsWith('test:') || name.startsWith('typecheck:')) return 'Quality';
  if (name === 'start' || name.startsWith('start:') || ['android', 'ios', 'web'].includes(name)) return 'Development';
  return 'Other';
}

function scriptSafety(name) {
  if (/^docs:deploy:/.test(name)) return 'publishes';
  if (/^(docs:(build|build-guides|dev|release-check)|generate-sitemap|content:build-manifest$|content:build-site-manifest$)/.test(name)) return 'writes generated files';
  if (/^(subscription:qa:(evidence|play-state|revenuecat-subscriber-expiry|google-play-state)|android:.*-state)$/.test(name)) return 'writes QA evidence';
  if (/^(android:release:local|build:(apk:|web$))/.test(name)) return 'builds artifacts';
  if (name === 'seo:gsc:export') return 'writes an external-data report';
  return 'read-only or runtime';
}

function buildCatalog(scripts = packageJson.scripts) {
  return Object.entries(scripts)
    .map(([name, command]) => ({
      command,
      family: classifyScript(name),
      name,
      safety: scriptSafety(name),
    }))
    .sort((left, right) => left.family.localeCompare(right.family) || left.name.localeCompare(right.name));
}

function main(args = process.argv.slice(2)) {
  const catalog = buildCatalog();
  if (args.includes('--json')) {
    console.log(JSON.stringify(catalog, null, 2));
    return;
  }

  for (const family of Object.keys(FAMILY_DESCRIPTIONS)) {
    const entries = catalog.filter((entry) => entry.family === family);
    if (entries.length === 0) continue;
    console.log(`\n${family} — ${FAMILY_DESCRIPTIONS[family]}`);
    for (const entry of entries) {
      console.log(`  ${entry.name.padEnd(56)} ${entry.safety}`);
    }
  }
}

if (require.main === module) main();

module.exports = { buildCatalog, classifyScript, scriptSafety };
