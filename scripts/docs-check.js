#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { JSDOM } = require('jsdom');
const { DOCS_DIR, ROOT_DIR, siteConfig } = require('./lib/docs-site-config');
const { assertDocsBuildReady } = require('./lib/docs-check-helpers');
const { normalizePrettyPath, readJson, walkFiles } = require('./lib/docs-source-utils');

const SITE_MANIFEST_PATH = path.join(ROOT_DIR, 'data', 'site-manifest.json');
const DOMAIN = siteConfig.domain;

function runNodeScript(relativeScriptPath, args = []) {
  const scriptPath = path.join(ROOT_DIR, relativeScriptPath);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Script failed: ${relativeScriptPath}`);
  }
}

function htmlFileToPath(filePath) {
  const relativePath = path.relative(DOCS_DIR, filePath).split(path.sep).join('/');
  return normalizePrettyPath(`/${relativePath}`);
}

function resolveInternalHref(currentPath, href) {
  if (!href || href.startsWith('#')) return null;
  if (/^(mailto:|tel:|sms:|javascript:|data:)/i.test(href)) return null;

  try {
    const resolved = new URL(href, `${DOMAIN}${currentPath}`);
    if (resolved.origin !== DOMAIN) return null;
    return normalizePrettyPath(resolved.pathname);
  } catch {
    return null;
  }
}

function loadIndexablePages() {
  const htmlFiles = walkFiles(DOCS_DIR, (filePath) => filePath.endsWith('.html'));
  const pages = [];

  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const robots = (document.querySelector('meta[name="robots"]')?.getAttribute('content') || '').toLowerCase();
    if (robots.includes('noindex')) continue;

    pages.push({
      filePath,
      path: htmlFileToPath(filePath),
      document,
    });
  }

  return pages;
}

function assertNoDuplicateCriticalMeta() {
  const files = walkFiles(DOCS_DIR, (filePath) => filePath.endsWith('.html'));
  const selectors = [
    'meta[name="robots"]',
    'link[rel="canonical"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:image"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[name="twitter:image"]',
  ];

  const errors = [];

  for (const filePath of files) {
    const dom = new JSDOM(fs.readFileSync(filePath, 'utf8'));
    const document = dom.window.document;

    for (const selector of selectors) {
      const count = document.querySelectorAll(selector).length;
      if (count > 1) {
        errors.push(`[duplicate critical meta] ${path.relative(ROOT_DIR, filePath)} selector=${selector} count=${count}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

function assertManifestParity(manifest) {
  const errors = [];

  for (const collection of Object.values(manifest.collections || {})) {
    for (const entry of Object.values(collection.entries || {})) {
      for (const lang of siteConfig.languages) {
        if (!entry.locales?.[lang]) {
          errors.push(`[missing locale] ${entry.id} language=${lang}`);
          continue;
        }

        if (entry.id !== 'blog.index' && entry.id !== 'guide.index' && entry.id !== 'page.home') {
          const slug = entry.locales[lang].slug;
          if (typeof slug !== 'string' || slug.trim() === '') {
            errors.push(`[empty slug] ${entry.id} language=${lang}`);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

function assertNoOrphans(manifest) {
  const pages = loadIndexablePages();
  const knownPaths = new Set();
  for (const collection of Object.values(manifest.collections || {})) {
    for (const entry of Object.values(collection.entries || {})) {
      for (const locale of Object.values(entry.locales || {})) {
        knownPaths.add(locale.path);
      }
    }
  }

  const inbound = new Map();
  for (const page of pages) {
    inbound.set(page.path, inbound.get(page.path) || new Set());
  }

  for (const page of pages) {
    const hrefs = Array.from(page.document.querySelectorAll('a[href]')).map((node) =>
      node.getAttribute('href')
    );

    for (const href of hrefs) {
      const resolved = resolveInternalHref(page.path, href);
      if (!resolved || !knownPaths.has(resolved) || resolved === page.path) continue;
      if (!inbound.has(resolved)) inbound.set(resolved, new Set());
      inbound.get(resolved).add(page.path);
    }
  }

  const orphanPaths = [...inbound.entries()]
    .filter(([pagePath, sources]) => pagePath !== '/' && pagePath !== '/en/' && sources.size === 0)
    .map(([pagePath]) => pagePath)
    .sort();

  if (orphanPaths.length > 0) {
    throw new Error(`[orphan pages]\n${orphanPaths.join('\n')}`);
  }
}

function assertSitemapCoverage(manifest) {
  const sitemapPath = path.join(DOCS_DIR, 'sitemap.xml');
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const locs = new Set(
    Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi), (match) =>
      normalizePrettyPath(new URL(match[1]).pathname)
    )
  );

  const missing = [];
  for (const collection of Object.values(manifest.collections || {})) {
    for (const entry of Object.values(collection.entries || {})) {
      for (const locale of Object.values(entry.locales || {})) {
        if (!locs.has(locale.path)) {
          missing.push(`${entry.id} -> ${locale.path}`);
        }
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`[manifest missing from sitemap]\n${missing.join('\n')}`);
  }
}

function main() {
  assertDocsBuildReady(ROOT_DIR);
  runNodeScript(path.join('scripts', 'build-content-manifest.js'), ['--check']);
  runNodeScript(path.join('scripts', 'build-site-manifest.js'), ['--check']);
  runNodeScript(path.join('scripts', 'validate-i18n-seo.js'));
  runNodeScript(path.join('scripts', 'check-docs-links.js'));
  runNodeScript(path.join('docs', 'scripts', 'check-site.js'));

  const manifest = readJson(SITE_MANIFEST_PATH);
  assertNoDuplicateCriticalMeta();
  assertManifestParity(manifest);
  assertNoOrphans(manifest);
  assertSitemapCoverage(manifest);

  console.log('[docs-check] All docs checks passed.');
}

main();
