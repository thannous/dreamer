#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { DOCS_DIR, ROOT_DIR, siteConfig } = require('./lib/docs-site-config');
const { assertDocsBuildReady } = require('./lib/docs-check-helpers');
const { normalizePrettyPath, readJson, walkFiles } = require('./lib/docs-source-utils');

const SITE_MANIFEST_PATH = path.join(ROOT_DIR, 'data', 'site-manifest.json');
const DOMAIN = siteConfig.domain;
const BLOG_IMAGE_MAX_BYTES = 250_000;

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

function resolveInternalPathname(currentPath, href) {
  if (!href || href.startsWith('#')) return null;
  if (/^(mailto:|tel:|sms:|javascript:|data:)/i.test(href)) return null;

  try {
    const resolved = new URL(href, `${DOMAIN}${currentPath}`);
    if (resolved.origin !== DOMAIN) return null;
    return resolved.pathname || '/';
  } catch {
    return null;
  }
}

function decodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function parseTagAttributes(rawTag) {
  const attributes = new Map();
  const pattern = /([:@\w.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = pattern.exec(rawTag))) {
    attributes.set(match[1].toLowerCase(), decodeHtmlAttribute(match[2] ?? match[3] ?? match[4] ?? ''));
  }

  return attributes;
}

function matchTags(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) || [];
}

function findMetaContent(html, attr, value) {
  const expected = String(value).toLowerCase();
  for (const tag of matchTags(html, 'meta')) {
    const attrs = parseTagAttributes(tag);
    if (String(attrs.get(attr) || '').toLowerCase() === expected) {
      return attrs.get('content') || '';
    }
  }
  return '';
}

function extractHrefValues(html) {
  return matchTags(html, 'a')
    .map((tag) => parseTagAttributes(tag).get('href'))
    .filter(Boolean);
}

function extractSrcsetCandidates(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function extractBlogImageReferenceValues(html) {
  const refs = [];

  const pushAttr = (tagName, attr) => {
    for (const tag of matchTags(html, tagName)) {
      const value = parseTagAttributes(tag).get(attr);
      if (!value) continue;

      if (attr === 'srcset') {
        refs.push(...extractSrcsetCandidates(value));
      } else {
        refs.push(value);
      }
    }
  };

  pushAttr('img', 'src');
  pushAttr('img', 'srcset');
  pushAttr('source', 'src');
  pushAttr('source', 'srcset');

  for (const tag of matchTags(html, 'link')) {
    const attrs = parseTagAttributes(tag);
    if (String(attrs.get('as') || '').toLowerCase() !== 'image') continue;
    const href = attrs.get('href');
    if (href) refs.push(href);
  }

  for (const tag of matchTags(html, 'meta')) {
    const attrs = parseTagAttributes(tag);
    const property = attrs.get('property');
    const name = attrs.get('name');
    const content = attrs.get('content');
    if (!content) continue;
    if (property === 'og:image' || name === 'twitter:image') refs.push(content);
  }

  for (const match of html.matchAll(/url\((['"]?)([^'")]+)\1\)/gi)) {
    refs.push(match[2]);
  }

  return refs.filter((ref) => ref.includes('/img/blog/'));
}

function countTagsWithAttribute(html, tagName, attr, value) {
  const expected = String(value).toLowerCase();
  return matchTags(html, tagName).filter((tag) => {
    const attrs = parseTagAttributes(tag);
    return String(attrs.get(attr) || '').toLowerCase() === expected;
  }).length;
}

function loadIndexablePages() {
  const htmlFiles = walkFiles(DOCS_DIR, (filePath) => filePath.endsWith('.html'));
  const pages = [];

  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const robots = findMetaContent(html, 'name', 'robots').toLowerCase();
    if (robots.includes('noindex')) continue;

    pages.push({
      filePath,
      path: htmlFileToPath(filePath),
      hrefs: extractHrefValues(html),
    });
  }

  return pages;
}

function assertNoDuplicateCriticalMeta() {
  const files = walkFiles(DOCS_DIR, (filePath) => filePath.endsWith('.html'));
  const selectors = [
    { label: 'meta[name="robots"]', tag: 'meta', attr: 'name', value: 'robots' },
    { label: 'link[rel="canonical"]', tag: 'link', attr: 'rel', value: 'canonical' },
    { label: 'meta[property="og:title"]', tag: 'meta', attr: 'property', value: 'og:title' },
    { label: 'meta[property="og:description"]', tag: 'meta', attr: 'property', value: 'og:description' },
    { label: 'meta[property="og:image"]', tag: 'meta', attr: 'property', value: 'og:image' },
    { label: 'meta[name="twitter:title"]', tag: 'meta', attr: 'name', value: 'twitter:title' },
    { label: 'meta[name="twitter:description"]', tag: 'meta', attr: 'name', value: 'twitter:description' },
    { label: 'meta[name="twitter:image"]', tag: 'meta', attr: 'name', value: 'twitter:image' },
  ];

  const errors = [];

  for (const filePath of files) {
    const html = fs.readFileSync(filePath, 'utf8');

    for (const selector of selectors) {
      const count = countTagsWithAttribute(html, selector.tag, selector.attr, selector.value);
      if (count > 1) {
        errors.push(`[duplicate critical meta] ${path.relative(ROOT_DIR, filePath)} selector=${selector.label} count=${count}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

function assertCanonicalOrganizationIdentity() {
  const files = walkFiles(DOCS_DIR, (filePath) => {
    if (!filePath.endsWith('.html')) return false;
    const relativePath = path.relative(DOCS_DIR, filePath).split(path.sep).join('/');
    return !relativePath.startsWith('templates/');
  });
  const organizationId = `${DOMAIN}/#organization`;
  const expected = siteConfig.organization;
  const errors = [];
  let organizationCount = 0;

  function visit(node, relativePath) {
    if (Array.isArray(node)) {
      for (const child of node) visit(child, relativePath);
      return;
    }
    if (!node || typeof node !== 'object') return;

    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (
      types.includes('Organization') &&
      (node['@id'] === organizationId || node.name === expected.name)
    ) {
      organizationCount += 1;
      const address = node.address || {};
      if (
        node['@id'] !== organizationId ||
        node.name !== expected.name ||
        node.legalName !== expected.legalName ||
        node.taxID !== expected.taxID ||
        node.url !== expected.url ||
        node.brand?.name !== expected.name ||
        address.streetAddress !== expected.address?.streetAddress ||
        address.postalCode !== expected.address?.postalCode ||
        address.addressLocality !== expected.address?.addressLocality ||
        address.addressCountry !== expected.address?.addressCountry
      ) {
        errors.push(`[canonical organization] ${relativePath}: incomplete or conflicting Noctalia identity`);
      }
    }

    for (const value of Object.values(node)) visit(value, relativePath);
  }

  for (const filePath of files) {
    const html = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(ROOT_DIR, filePath);
    for (const match of html.matchAll(
      /<script\b[^>]*type=(['"])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi
    )) {
      try {
        visit(JSON.parse(match[2]), relativePath);
      } catch (error) {
        errors.push(`[canonical organization] ${relativePath}: invalid JSON-LD (${error.message})`);
      }
    }
  }

  if (organizationCount === 0) {
    errors.push('[canonical organization] no Noctalia Organization nodes found');
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function loadExactRedirectSources() {
  const redirectsPath = path.join(DOCS_DIR, '_redirects');
  if (!fs.existsSync(redirectsPath)) return new Set();

  const exactSources = new Set();
  const lines = fs.readFileSync(redirectsPath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [source, target, status] = line.split(/\s+/);
    if (!source || !target || !/^30[1278]$/.test(String(status || ''))) continue;
    if (!source.startsWith('/')) continue;
    if (/[:*]/.test(source)) continue;

    exactSources.add(source);
  }

  return exactSources;
}

function assertNoLinksToExactRedirects() {
  const redirectSources = loadExactRedirectSources();
  if (redirectSources.size === 0) return;

  const errors = [];

  for (const page of loadIndexablePages()) {
    for (const href of page.hrefs) {
      const pathname = resolveInternalPathname(page.path, href);
      if (!pathname || !redirectSources.has(pathname)) continue;

      errors.push(
        `[internal link to redirect] ${path.relative(ROOT_DIR, page.filePath)} href="${href}" redirectSource="${pathname}"`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

function assertReferencedBlogImagesOptimized() {
  const htmlFiles = walkFiles(DOCS_DIR, (filePath) => filePath.endsWith('.html'));
  const errors = [];

  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const currentPath = htmlFileToPath(filePath);
    const refs = new Set(extractBlogImageReferenceValues(html));

    for (const ref of refs) {
      const pathname = resolveInternalPathname(currentPath, ref);
      if (!pathname || !pathname.startsWith('/img/blog/')) continue;

      const imagePath = path.join(DOCS_DIR, pathname.replace(/^\/+/, ''));
      if (!fs.existsSync(imagePath)) continue;

      const size = fs.statSync(imagePath).size;
      if (size > BLOG_IMAGE_MAX_BYTES) {
        errors.push(
          `[blog image too large] ${path.relative(ROOT_DIR, filePath)} ref="${ref}" size=${size} max=${BLOG_IMAGE_MAX_BYTES}`
        );
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
    for (const href of page.hrefs) {
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
  runNodeScript(path.join('scripts', 'check-content-release-gates.js'));
  runNodeScript(path.join('scripts', 'build-content-manifest.js'), ['--check']);
  runNodeScript(path.join('scripts', 'build-site-manifest.js'), ['--check']);
  runNodeScript(path.join('scripts', 'validate-i18n-seo.js'));
  runNodeScript(path.join('scripts', 'check-symbol-illustration-parity.js'));
  runNodeScript(path.join('scripts', 'check-docs-links.js'));
  runNodeScript(path.join('scripts', 'check-docs-shell.js'));
  runNodeScript(path.join('scripts', 'check-article-date-contract.js'));
  runNodeScript(path.join('scripts', 'check-intent-ownership.js'));
  runNodeScript(path.join('scripts', 'check-web-performance-contract.js'));
  runNodeScript(path.join('docs', 'scripts', 'check-site.js'));

  const manifest = readJson(SITE_MANIFEST_PATH);
  assertNoDuplicateCriticalMeta();
  assertCanonicalOrganizationIdentity();
  assertNoLinksToExactRedirects();
  assertReferencedBlogImagesOptimized();
  assertManifestParity(manifest);
  assertNoOrphans(manifest);
  assertSitemapCoverage(manifest);

  console.log('[docs-check] All docs checks passed.');
}

main();
