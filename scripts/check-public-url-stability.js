#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { assertDocsBuildReady, readDocsBuildState } = require('./lib/docs-check-helpers');

const ROOT_DIR = path.resolve(__dirname, '..');
const BASELINE_RELATIVE_PATH = 'data/seo-url-contract-baseline.json';
const INITIAL_SOURCE_REVISION = 'f8bdfdc6e2db6ba7ecab2346fbc0925cf7098ab4';
const INITIAL_COUNTS = Object.freeze({
  logicalPages: 233,
  manifestPaths: 1165,
  uniqueManifestPaths: 1165,
  canonicalPages: 1165,
  sitemapEntries: 1165,
  allHtmlOutputPaths: 1170,
});
const HTML_CONTRACT_INPUTS = Object.freeze([
  'docs-src/static/index.html',
  'docs-src/templates/base.html',
]);
const SEO_IDENTITY_TYPES = new Set(['WebPage', 'BlogPosting', 'CollectionPage']);
const INITIAL_BASELINE_UNTRACKED_ALLOWLIST = new Set([
  'doc_web_interne/docs/seo-content-hubs-spec.md',
  'node_modules',
  'scripts/check-public-url-stability.js',
  'scripts/check-public-url-stability.test.js',
]);

function toPosix(value) {
  return String(value).split(path.sep).join('/');
}

function cleanString(value) {
  if (value == null) return null;
  return String(value).trim();
}

function decodeHtmlEntitiesOnce(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return String(value == null ? '' : value).replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|(amp|apos|gt|lt|nbsp|quot));/gi,
    (entity, decimal, hexadecimal, name) => {
      if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      return named[String(name).toLowerCase()] ?? entity;
    }
  );
}

function decodeRawValue(value) {
  return cleanString(decodeHtmlEntitiesOnce(value));
}

function parseTagAttributes(rawTag) {
  const attributes = {};
  const pattern = /([:@\w.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = pattern.exec(rawTag))) {
    attributes[match[1].toLowerCase()] = decodeRawValue(match[2] ?? match[3] ?? match[4] ?? '');
  }

  return attributes;
}

function tagValues(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) || [];
}

function relHas(attrs, expected) {
  return String(attrs.rel || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .includes(expected);
}

function extractSingleAttribute(tags, attribute, label, fileLabel) {
  if (tags.length > 1) {
    throw new Error(`[duplicate ${label}] ${fileLabel} count=${tags.length}`);
  }
  if (tags.length === 0) return null;

  const value = parseTagAttributes(tags[0])[attribute];
  if (!value) throw new Error(`[missing ${label} value] ${fileLabel}`);
  return value;
}

function jsonStableValue(value) {
  if (Array.isArray(value)) return value.map(jsonStableValue);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = jsonStableValue(value[key]);
      return result;
    }, {});
}

function compareStableValues(left, right) {
  return JSON.stringify(jsonStableValue(left)) === JSON.stringify(jsonStableValue(right));
}

function walkJson(value, visitor) {
  if (Array.isArray(value)) {
    for (const child of value) walkJson(child, visitor);
    return;
  }
  if (!value || typeof value !== 'object') return;

  visitor(value);
  for (const child of Object.values(value)) walkJson(child, visitor);
}

function nodeTypes(node) {
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  return types.filter((type) => typeof type === 'string').map((type) => type.trim());
}

function mainEntityId(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && typeof value['@id'] === 'string') {
    return value['@id'].trim();
  }
  return null;
}

function sortByStableJson(values) {
  return values.sort((left, right) =>
    JSON.stringify(jsonStableValue(left)).localeCompare(JSON.stringify(jsonStableValue(right)))
  );
}

function extractJsonLdContract(html, fileLabel) {
  const identities = [];
  const breadcrumbs = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  let scriptIndex = 0;

  while ((scriptMatch = scriptPattern.exec(html))) {
    const attrs = parseTagAttributes(scriptMatch[1]);
    if (String(attrs.type || '').toLowerCase() !== 'application/ld+json') continue;
    scriptIndex += 1;

    let value;
    try {
      value = JSON.parse(scriptMatch[2].trim());
    } catch (error) {
      throw new Error(`[invalid JSON-LD] ${fileLabel} script=${scriptIndex}: ${error.message}`);
    }

    walkJson(value, (node) => {
      const types = nodeTypes(node);

      for (const type of types) {
        if (!SEO_IDENTITY_TYPES.has(type)) continue;
        identities.push({
          type,
          url: cleanString(node.url),
          id: cleanString(node['@id']),
          mainEntityOfPageId: type === 'BlogPosting' ? mainEntityId(node.mainEntityOfPage) : null,
        });
      }

      if (!types.includes('BreadcrumbList')) return;
      const items = Array.isArray(node.itemListElement) ? node.itemListElement : [];
      const positions = new Set();
      const breadcrumbItems = items.map((item) => {
        const position = cleanString(item && item.position);
        if (position != null) {
          if (positions.has(position)) {
            throw new Error(`[duplicate breadcrumb position] ${fileLabel} position=${position}`);
          }
          positions.add(position);
        }

        return {
          position,
          item: mainEntityId(item && item.item),
        };
      });

      breadcrumbItems.sort((left, right) => {
        const leftNumber = Number(left.position);
        const rightNumber = Number(right.position);
        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
        return String(left.position).localeCompare(String(right.position));
      });
      breadcrumbs.push(breadcrumbItems);
    });
  }

  return {
    identities: sortByStableJson(identities),
    breadcrumbs: sortByStableJson(breadcrumbs),
  };
}

function resolveVisibleBreadcrumbHref(href, canonical, fileLabel) {
  const value = cleanString(href);
  if (!value) return null;

  // Absolute values stay byte-for-byte equivalent after entity decoding and trim.
  // URL is used only for the relative-resolution case allowed by the contract.
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value;

  try {
    return new URL(value, canonical).href;
  } catch (error) {
    throw new Error(`[invalid visible breadcrumb URL] ${fileLabel} href=${JSON.stringify(value)}: ${error.message}`);
  }
}

function extractVisibleBreadcrumbs(html, canonical, fileLabel) {
  const result = [];
  for (const rawTag of tagValues(html, 'a')) {
    const attrs = parseTagAttributes(rawTag);
    const itemprop = String(attrs.itemprop || '').split(/\s+/).filter(Boolean);
    if (!itemprop.includes('item') || !attrs.href) continue;
    if (!canonical) throw new Error(`[breadcrumb without canonical] ${fileLabel}`);
    result.push(resolveVisibleBreadcrumbHref(attrs.href, canonical, fileLabel));
  }
  return result;
}

function isIndexableHtml(html) {
  for (const rawTag of tagValues(html, 'meta')) {
    const attrs = parseTagAttributes(rawTag);
    if (String(attrs['http-equiv'] || '').toLowerCase() === 'refresh') return false;
    if (
      String(attrs.name || '').toLowerCase() === 'robots' &&
      String(attrs.content || '').toLowerCase().split(/[\s,]+/).includes('noindex')
    ) {
      return false;
    }
  }
  return true;
}

function extractHtmlContract(html, fileLabel) {
  const linkTags = tagValues(html, 'link');
  const metaTags = tagValues(html, 'meta');

  const canonicalTags = linkTags.filter((tag) => relHas(parseTagAttributes(tag), 'canonical'));
  const canonical = extractSingleAttribute(canonicalTags, 'href', 'canonical', fileLabel);

  const ogUrlTags = metaTags.filter((tag) => {
    const attrs = parseTagAttributes(tag);
    return String(attrs.property || '').toLowerCase() === 'og:url';
  });
  const ogUrl = extractSingleAttribute(ogUrlTags, 'content', 'og:url', fileLabel);

  const hreflangs = [];
  const seenHreflangs = new Set();
  for (const rawTag of linkTags) {
    const attrs = parseTagAttributes(rawTag);
    if (!relHas(attrs, 'alternate') || !attrs.hreflang) continue;
    if (!attrs.href) throw new Error(`[missing hreflang href] ${fileLabel} hreflang=${attrs.hreflang}`);
    if (seenHreflangs.has(attrs.hreflang)) {
      throw new Error(`[duplicate hreflang] ${fileLabel} hreflang=${attrs.hreflang}`);
    }
    seenHreflangs.add(attrs.hreflang);
    hreflangs.push({ hreflang: attrs.hreflang, href: attrs.href });
  }
  hreflangs.sort((left, right) => left.hreflang.localeCompare(right.hreflang));

  const indexable = isIndexableHtml(html);
  const jsonLd = extractJsonLdContract(html, fileLabel);

  if (indexable) {
    if (!canonical) throw new Error(`[missing canonical] ${fileLabel}`);
    if (!ogUrl) throw new Error(`[missing og:url] ${fileLabel}`);
    if (hreflangs.length === 0) throw new Error(`[missing hreflang] ${fileLabel}`);
  }

  return {
    indexable,
    canonical,
    hreflangs,
    ogUrl,
    jsonLdIdentities: jsonLd.identities,
    jsonLdBreadcrumbs: jsonLd.breadcrumbs,
    visibleBreadcrumbs: extractVisibleBreadcrumbs(html, canonical, fileLabel),
  };
}

function parseSitemap(xml, fileLabel = 'docs/sitemap.xml') {
  const entries = [];
  const seenLocs = new Set();
  const urlPattern = /<url\b[^>]*>([\s\S]*?)<\/url>/gi;
  let urlMatch;

  while ((urlMatch = urlPattern.exec(xml))) {
    const block = urlMatch[1];
    const locMatch = block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i);
    if (!locMatch) throw new Error(`[missing sitemap loc] ${fileLabel}`);
    const loc = decodeRawValue(locMatch[1]);
    if (seenLocs.has(loc)) throw new Error(`[duplicate sitemap loc] ${fileLabel} loc=${loc}`);
    seenLocs.add(loc);

    const alternates = [];
    const seenLanguages = new Set();
    for (const linkTag of block.match(/<(?:xhtml:)?link\b[^>]*\/?\s*>/gi) || []) {
      const attrs = parseTagAttributes(linkTag);
      if (!relHas(attrs, 'alternate') || !attrs.hreflang) continue;
      if (!attrs.href) {
        throw new Error(`[missing sitemap alternate href] ${fileLabel} loc=${loc} hreflang=${attrs.hreflang}`);
      }
      if (seenLanguages.has(attrs.hreflang)) {
        throw new Error(`[duplicate sitemap hreflang] ${fileLabel} loc=${loc} hreflang=${attrs.hreflang}`);
      }
      seenLanguages.add(attrs.hreflang);
      alternates.push({ hreflang: attrs.hreflang, href: attrs.href });
    }
    alternates.sort((left, right) => left.hreflang.localeCompare(right.hreflang));
    entries.push({ loc, alternates });
  }

  entries.sort((left, right) => left.loc.localeCompare(right.loc));
  return entries;
}

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath, predicate));
    else if (entry.isFile() && predicate(fullPath)) files.push(fullPath);
  }
  return files.sort((left, right) => toPosix(left).localeCompare(toPosix(right)));
}

function manifestRouteKey(route) {
  return `${route.collection}\u0000${route.pageId}\u0000${route.lang}`;
}

function buildManifestRoutes(manifest) {
  const routes = [];
  const pageIds = new Set();
  const paths = new Set();

  for (const collection of Object.keys(manifest.collections || {}).sort()) {
    const entries = manifest.collections[collection].entries || {};
    for (const pageId of Object.keys(entries).sort()) {
      const entry = entries[pageId];
      if (pageIds.has(pageId)) throw new Error(`[duplicate manifest pageId] pageId=${pageId}`);
      pageIds.add(pageId);

      for (const lang of Object.keys(entry.locales || {}).sort()) {
        const locale = entry.locales[lang];
        const route = {
          collection,
          pageId,
          type: cleanString(entry.type),
          canonicalLanguage: cleanString(entry.canonicalLanguage),
          canonicalSlug: cleanString(entry.canonicalSlug),
          lang,
          slug: cleanString(locale.slug),
          path: cleanString(locale.path),
        };
        if (!route.path) throw new Error(`[missing manifest path] pageId=${pageId} language=${lang}`);
        if (paths.has(route.path)) throw new Error(`[duplicate manifest path] path=${route.path}`);
        paths.add(route.path);
        routes.push(route);
      }
    }
  }

  routes.sort((left, right) => manifestRouteKey(left).localeCompare(manifestRouteKey(right)));
  return { routes, logicalPages: pageIds.size, uniquePaths: paths.size };
}

function outputPathForManifestRoute(route) {
  if (route.path === '/') return 'docs/index.html';
  const relativePath = route.path.replace(/^\/+/, '');
  if (route.path.endsWith('/')) return `docs/${relativePath}index.html`;
  return `docs/${relativePath}.html`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readDomain(rootDir) {
  const config = readJson(path.join(rootDir, 'docs-src', 'config', 'site.config.json'));
  const domain = cleanString(config.domain);
  if (!domain) throw new Error('[missing site domain] docs-src/config/site.config.json');
  return domain;
}

function readRedirectContract(rootDir) {
  const redirectsPath = path.join(rootDir, 'docs-src', 'static', '_redirects');
  const vercelPath = path.join(rootDir, 'docs-src', 'static', 'vercel.json');
  const netlifyRules = fs.readFileSync(redirectsPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const vercel = readJson(vercelPath);

  return {
    netlifyRules,
    vercel: {
      redirects: jsonStableValue(Array.isArray(vercel.redirects) ? vercel.redirects : []),
      rewrites: jsonStableValue(Array.isArray(vercel.rewrites) ? vercel.rewrites : []),
    },
  };
}

function routeUrl(domain, routePath) {
  return `${domain}${routePath}`;
}

function buildSnapshot(rootDir, options = {}) {
  const sourceRevision = options.sourceRevision || INITIAL_SOURCE_REVISION;
  const domain = options.domain || readDomain(rootDir);
  const manifest = readJson(path.join(rootDir, 'data', 'site-manifest.json'));
  const manifestData = buildManifestRoutes(manifest);
  const manifestRoutes = manifestData.routes;

  const routeByOutput = new Map();
  const routeByUrl = new Map();
  for (const route of manifestRoutes) {
    const outputPath = outputPathForManifestRoute(route);
    if (routeByOutput.has(outputPath)) throw new Error(`[duplicate manifest output] output=${outputPath}`);
    routeByOutput.set(outputPath, route);

    const url = routeUrl(domain, route.path);
    if (routeByUrl.has(url)) throw new Error(`[duplicate manifest URL] url=${url}`);
    routeByUrl.set(url, route);
  }

  const docsDir = path.join(rootDir, 'docs');
  const docsHtmlFiles = walkFiles(docsDir, (filePath) => filePath.endsWith('.html'));
  const docsHtmlPaths = docsHtmlFiles.map((filePath) => toPosix(path.relative(rootDir, filePath)));
  for (const relativePath of HTML_CONTRACT_INPUTS) {
    if (!fs.existsSync(path.join(rootDir, relativePath))) {
      throw new Error(`[missing HTML contract input] ${relativePath}`);
    }
  }
  const allHtmlOutputPaths = [...docsHtmlPaths, ...HTML_CONTRACT_INPUTS].sort();

  const canonicalPages = [];
  const seenPageRoutes = new Set();
  for (let index = 0; index < docsHtmlFiles.length; index += 1) {
    const filePath = docsHtmlFiles[index];
    const outputPath = docsHtmlPaths[index];
    const contract = extractHtmlContract(fs.readFileSync(filePath, 'utf8'), outputPath);
    if (!contract.indexable) continue;

    const route = routeByOutput.get(outputPath);
    if (!route) throw new Error(`[indexable output missing manifest route] output=${outputPath}`);
    const key = manifestRouteKey(route);
    if (seenPageRoutes.has(key)) {
      throw new Error(`[duplicate indexable manifest route] pageId=${route.pageId} language=${route.lang}`);
    }
    seenPageRoutes.add(key);
    canonicalPages.push({
      collection: route.collection,
      pageId: route.pageId,
      lang: route.lang,
      outputPath,
      canonical: contract.canonical,
      hreflangs: contract.hreflangs,
      ogUrl: contract.ogUrl,
      jsonLdIdentities: contract.jsonLdIdentities,
      jsonLdBreadcrumbs: contract.jsonLdBreadcrumbs,
      visibleBreadcrumbs: contract.visibleBreadcrumbs,
    });
  }
  canonicalPages.sort((left, right) => manifestRouteKey(left).localeCompare(manifestRouteKey(right)));

  for (const route of manifestRoutes) {
    if (!seenPageRoutes.has(manifestRouteKey(route))) {
      throw new Error(`[manifest route missing indexable output] pageId=${route.pageId} language=${route.lang}`);
    }
  }

  const sitemapPath = path.join(rootDir, 'docs', 'sitemap.xml');
  const parsedSitemap = parseSitemap(fs.readFileSync(sitemapPath, 'utf8'));
  const sitemap = parsedSitemap.map((entry) => {
    const route = routeByUrl.get(entry.loc);
    if (!route) throw new Error(`[sitemap loc missing manifest route] loc=${entry.loc}`);
    return {
      collection: route.collection,
      pageId: route.pageId,
      lang: route.lang,
      loc: entry.loc,
      alternates: entry.alternates,
    };
  });
  sitemap.sort((left, right) => manifestRouteKey(left).localeCompare(manifestRouteKey(right)));

  const sitemapRouteKeys = new Set(sitemap.map((entry) => manifestRouteKey(entry)));
  for (const route of manifestRoutes) {
    if (!sitemapRouteKeys.has(manifestRouteKey(route))) {
      throw new Error(
        `[manifest route missing sitemap entry] pageId=${route.pageId} language=${route.lang}`
      );
    }
  }

  const snapshot = {
    schemaVersion: 1,
    sourceRevision,
    counts: {
      logicalPages: manifestData.logicalPages,
      manifestPaths: manifestRoutes.length,
      uniqueManifestPaths: manifestData.uniquePaths,
      canonicalPages: canonicalPages.length,
      sitemapEntries: sitemap.length,
      allHtmlOutputPaths: allHtmlOutputPaths.length,
    },
    manifestRoutes,
    allHtmlOutputPaths,
    canonicalPages,
    sitemap,
    redirects: readRedirectContract(rootDir),
  };

  validateSnapshotShape(snapshot);
  return snapshot;
}

function validateSnapshotShape(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1) throw new Error('[invalid URL baseline schemaVersion] expected=1');
  if (!/^[0-9a-f]{40}$/i.test(String(snapshot.sourceRevision || ''))) {
    throw new Error('[invalid URL baseline sourceRevision] expected full 40-character Git SHA');
  }

  const expectedCounts = {
    manifestPaths: snapshot.manifestRoutes.length,
    uniqueManifestPaths: new Set(snapshot.manifestRoutes.map((route) => route.path)).size,
    canonicalPages: snapshot.canonicalPages.length,
    sitemapEntries: snapshot.sitemap.length,
    allHtmlOutputPaths: snapshot.allHtmlOutputPaths.length,
  };
  const pageIds = new Set(snapshot.manifestRoutes.map((route) => route.pageId));
  expectedCounts.logicalPages = pageIds.size;

  for (const [field, actual] of Object.entries(expectedCounts)) {
    if (snapshot.counts?.[field] !== actual) {
      throw new Error(`[invalid URL baseline count] field=${field} expected=${actual} actual=${snapshot.counts?.[field]}`);
    }
  }
  if (snapshot.counts.manifestPaths !== snapshot.counts.uniqueManifestPaths) {
    throw new Error('[invalid URL baseline] manifest paths are not unique');
  }
  for (const field of ['canonicalPages', 'sitemapEntries']) {
    if (snapshot.counts[field] !== snapshot.counts.manifestPaths) {
      throw new Error(
        `[invalid URL baseline parity] manifestPaths=${snapshot.counts.manifestPaths} ${field}=${snapshot.counts[field]}`
      );
    }
  }

  const outputPaths = new Set(snapshot.allHtmlOutputPaths);
  if (outputPaths.size !== snapshot.allHtmlOutputPaths.length) {
    throw new Error('[invalid URL baseline] duplicate allHtmlOutputPaths entry');
  }
}

function assertInitialCounts(snapshot) {
  for (const [field, expected] of Object.entries(INITIAL_COUNTS)) {
    const actual = snapshot.counts[field];
    if (actual !== expected) {
      throw new Error(`[initial URL contract count mismatch] field=${field} expected=${expected} actual=${actual}`);
    }
  }
}

function describeRoute(item) {
  return `pageId=${item.pageId} language=${item.lang}`;
}

function firstDifference(expected, actual, prefix = '') {
  if (compareStableValues(expected, actual)) return null;
  if (
    expected == null ||
    actual == null ||
    typeof expected !== 'object' ||
    typeof actual !== 'object'
  ) {
    return { field: prefix || 'value', expected, actual };
  }

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      return { field: prefix || 'value', expected, actual };
    }
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      const difference = firstDifference(expected[index], actual[index], `${prefix}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }

  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of [...keys].sort()) {
    const difference = firstDifference(expected[key], actual[key], prefix ? `${prefix}.${key}` : key);
    if (difference) return difference;
  }
  return null;
}

function formatValue(value) {
  return JSON.stringify(value === undefined ? '<missing>' : value);
}

function compareKeyedRecords(expectedItems, actualItems, label, options = {}) {
  const keyFor = options.keyFor || manifestRouteKey;
  const allowAdditions = options.allowAdditions === true;
  const expectedByKey = new Map(expectedItems.map((item) => [keyFor(item), item]));
  const actualByKey = new Map(actualItems.map((item) => [keyFor(item), item]));
  const errors = [];

  for (const [key, expected] of expectedByKey) {
    const actual = actualByKey.get(key);
    if (!actual) {
      errors.push(`[${label} removed] ${describeRoute(expected)} expected=${formatValue(expected)} actual="<missing>"`);
      continue;
    }
    const difference = firstDifference(expected, actual);
    if (difference) {
      errors.push(
        `[${label} changed] ${describeRoute(expected)} field=${difference.field} expected=${formatValue(difference.expected)} actual=${formatValue(difference.actual)}`
      );
    }
  }

  if (!allowAdditions) {
    for (const [key, actual] of actualByKey) {
      if (!expectedByKey.has(key)) {
        errors.push(`[${label} added] ${describeRoute(actual)} expected="<missing>" actual=${formatValue(actual)}`);
      }
    }
  }

  return errors;
}

function compareOutputPaths(expected, actual, allowAdditions) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const errors = [];
  for (const outputPath of expectedSet) {
    if (!actualSet.has(outputPath)) {
      errors.push(`[HTML output removed] output=${outputPath} expected=${formatValue(outputPath)} actual="<missing>"`);
    }
  }
  if (!allowAdditions) {
    for (const outputPath of actualSet) {
      if (!expectedSet.has(outputPath)) {
        errors.push(`[HTML output added] output=${outputPath} expected="<missing>" actual=${formatValue(outputPath)}`);
      }
    }
  }
  return errors;
}

function compareSnapshots(expected, actual, options = {}) {
  validateSnapshotShape(expected);
  validateSnapshotShape(actual);
  const allowAdditions = options.allowAdditions === true;
  const errors = [];

  errors.push(...compareKeyedRecords(expected.manifestRoutes, actual.manifestRoutes, 'manifest route', { allowAdditions }));
  errors.push(...compareOutputPaths(expected.allHtmlOutputPaths, actual.allHtmlOutputPaths, allowAdditions));
  errors.push(...compareKeyedRecords(expected.canonicalPages, actual.canonicalPages, 'canonical page', { allowAdditions }));
  errors.push(...compareKeyedRecords(expected.sitemap, actual.sitemap, 'sitemap route', { allowAdditions }));

  if (!compareStableValues(expected.redirects, actual.redirects)) {
    const difference = firstDifference(expected.redirects, actual.redirects);
    errors.push(
      `[redirect contract changed] field=${difference.field} expected=${formatValue(difference.expected)} actual=${formatValue(difference.actual)}`
    );
  }

  if (!allowAdditions && !compareStableValues(expected.counts, actual.counts)) {
    const difference = firstDifference(expected.counts, actual.counts);
    errors.push(
      `[URL contract count changed] field=${difference.field} expected=${formatValue(difference.expected)} actual=${formatValue(difference.actual)}`
    );
  }

  if (errors.length > 0) throw new Error(`Public URL stability check failed (${errors.length} difference(s)):\n${errors.join('\n')}`);
}

function runGit(rootDir, args) {
  return spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
}

function runDocsBuild(rootDir) {
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'docs-build.js')], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`[docs build failed before URL baseline mutation] status=${result.status}`);
  }
  const state = readDocsBuildState(rootDir);
  const completedAt = Date.parse(state?.completedAt || '');
  if (
    state?.status !== 'ready' ||
    !Number.isFinite(completedAt) ||
    completedAt < startedAt - 1_000
  ) {
    throw new Error('[missing fresh docs build attestation before URL baseline mutation]');
  }
}

const defaultGit = {
  getHeadRevision(rootDir) {
    const result = runGit(rootDir, ['rev-parse', 'HEAD']);
    if (result.status !== 0) throw new Error(`[git rev-parse failed] ${String(result.stderr || '').trim()}`);
    return result.stdout.trim();
  },
  assertAncestor(rootDir, revision) {
    const result = runGit(rootDir, ['merge-base', '--is-ancestor', revision, 'HEAD']);
    if (result.status !== 0) {
      throw new Error(`[URL baseline provenance mismatch] sourceRevision=${revision} is not an ancestor of HEAD`);
    }
  },
  assertTrackedClean(rootDir) {
    const result = runGit(rootDir, ['status', '--porcelain', '--untracked-files=all']);
    if (result.status !== 0) throw new Error(`[git status failed] ${String(result.stderr || '').trim()}`);
    const disallowedChanges = result.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => {
        if (!line.startsWith('?? ')) return true;
        return !INITIAL_BASELINE_UNTRACKED_ALLOWLIST.has(line.slice(3));
      });
    if (disallowedChanges.length > 0) {
      throw new Error(
        `Worktree inputs must be clean before writing a URL baseline:\n${disallowedChanges.join('\n')}`
      );
    }
  },
};

function parseMode(args) {
  const allowed = new Set(['--write-baseline', '--extend-baseline']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0) throw new Error(`[unknown argument] ${unknown.join(', ')}`);
  if (args.includes('--write-baseline') && args.includes('--extend-baseline')) {
    throw new Error('Choose exactly one baseline mutation mode.');
  }
  if (args.includes('--write-baseline')) return 'write';
  if (args.includes('--extend-baseline')) return 'extend';
  return 'check';
}

function writeBaseline(filePath, snapshot, options = {}) {
  if (!options.overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to replace existing URL baseline: ${filePath}`);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

function run(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const args = options.args || process.argv.slice(2);
  const git = options.git || defaultGit;
  const build = options.build || runDocsBuild;
  const baselinePath = path.join(rootDir, BASELINE_RELATIVE_PATH);
  const mode = parseMode(args);

  if (mode === 'check') assertDocsBuildReady(rootDir);

  if (mode === 'write') {
    if (fs.existsSync(baselinePath)) {
      throw new Error(`Refusing to replace existing URL baseline: ${BASELINE_RELATIVE_PATH}`);
    }
    git.assertTrackedClean(rootDir);
    const head = git.getHeadRevision(rootDir);
    if (head !== INITIAL_SOURCE_REVISION) {
      throw new Error(`[initial URL baseline revision mismatch] expected=${INITIAL_SOURCE_REVISION} actual=${head}`);
    }
    build(rootDir);
    assertDocsBuildReady(rootDir);
    git.assertTrackedClean(rootDir);
    const snapshot = buildSnapshot(rootDir, { sourceRevision: head });
    assertInitialCounts(snapshot);
    writeBaseline(baselinePath, snapshot);
    return { mode, snapshot };
  }

  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Missing URL baseline: ${BASELINE_RELATIVE_PATH}.`);
  }
  const baseline = readJson(baselinePath);
  validateSnapshotShape(baseline);
  git.assertAncestor(rootDir, baseline.sourceRevision);

  if (mode === 'extend') {
    git.assertTrackedClean(rootDir);
    const head = git.getHeadRevision(rootDir);
    build(rootDir);
    assertDocsBuildReady(rootDir);
    git.assertTrackedClean(rootDir);
    const candidate = buildSnapshot(rootDir, { sourceRevision: head });
    compareSnapshots(baseline, candidate, { allowAdditions: true });
    writeBaseline(baselinePath, candidate, { overwrite: true });
    return { mode, snapshot: candidate };
  }

  const candidate = buildSnapshot(rootDir, { sourceRevision: baseline.sourceRevision });
  compareSnapshots(baseline, candidate);
  return { mode, snapshot: candidate };
}

function main() {
  try {
    const result = run();
    const counts = result.snapshot.counts;
    if (result.mode === 'write') {
      console.log(
        `[url-stability] Baseline created: ${counts.logicalPages} logical pages, ${counts.manifestPaths} manifest paths, ${counts.canonicalPages} canonical pages, ${counts.sitemapEntries} sitemap entries, ${counts.allHtmlOutputPaths} HTML outputs.`
      );
    } else if (result.mode === 'extend') {
      console.log(
        `[url-stability] Baseline extended additively: ${counts.manifestPaths} manifest paths, ${counts.canonicalPages} canonical pages, ${counts.sitemapEntries} sitemap entries, ${counts.allHtmlOutputPaths} HTML outputs.`
      );
    } else {
      console.log(
        `[url-stability] Passed: ${counts.manifestPaths} manifest paths, ${counts.canonicalPages} canonical pages, ${counts.sitemapEntries} sitemap entries, ${counts.allHtmlOutputPaths} HTML outputs are unchanged.`
      );
    }
  } catch (error) {
    console.error(`[url-stability] ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  BASELINE_RELATIVE_PATH,
  HTML_CONTRACT_INPUTS,
  INITIAL_COUNTS,
  INITIAL_SOURCE_REVISION,
  buildManifestRoutes,
  buildSnapshot,
  compareSnapshots,
  decodeHtmlEntitiesOnce,
  extractHtmlContract,
  outputPathForManifestRoute,
  parseMode,
  parseSitemap,
  parseTagAttributes,
  readRedirectContract,
  run,
  runDocsBuild,
  validateSnapshotShape,
  writeBaseline,
};
