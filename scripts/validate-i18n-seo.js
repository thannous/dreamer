#!/usr/bin/env node

/**
 * Validates international SEO consistency for the static docs site:
 * - Canonical is self-referential (no .html, matches file path)
 * - hreflang alternates only cover translations that actually exist
 *   (partial-coverage pages declare a reduced, reciprocal cluster)
 * - x-default points to the English URL when one exists, and is omitted
 *   for pages without an English version
 * - sitemap.xml only includes indexable canonical URLs and matches hreflang clusters
 */

const fs = require('fs');
const path = require('path');
const { assertDocsBuildReady } = require('./lib/docs-check-helpers');
const { getLanguageTag, siteConfig } = require('./lib/docs-site-config');
const {
  SUPPORTED_LANGS,
  normalizeUrl,
  extractCanonicalUrl,
  extractHreflangs,
  extractTagAttributes,
} = require('./lib/docs-seo-utils');

const DOCS_DIR = path.join(__dirname, '../docs');
const DOMAIN = 'https://noctalia.app';
const ROOT_DIR = path.join(__dirname, '..');

function pathToUrl(filePath) {
  let urlPath = filePath.replace(/\\/g, '/');
  urlPath = urlPath.replace(/index\.html$/, '');
  urlPath = urlPath.replace(/\.html$/, '');
  urlPath = urlPath.replace(/\/+/g, '/');
  if (urlPath === '/' || urlPath === '') {
    urlPath = '';
  }
  return normalizeUrl(`${DOMAIN}/${urlPath}`);
}

function findHtmlFiles(dir, baseDir = '') {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      files.push(...findHtmlFiles(fullPath, relativePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(relativePath);
    }
  }

  return files;
}

function extractCanonicalFromContent(content) {
  return extractCanonicalUrl(content);
}

function extractHreflangsFromContent(content) {
  return extractHreflangs(content);
}

function extractHtmlLang(content) {
  const match = String(content || '').match(/<html\b[^>]*\blang=(["'])([^"']+)\1/i);
  return match ? match[2] : null;
}

function hreflangClustersEqual(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => right[key] === left[key]);
}

function isIndexable(content) {
  if (/<meta\b(?=[^>]*\bhttp-equiv=(["'])refresh\1)[^>]*>/i.test(content)) {
    return false;
  }

  const robotsTag = content.match(/<meta\b(?=[^>]*\bname=(["'])robots\1)[^>]*>/i);
  if (!robotsTag) return true;
  const contentMatch = robotsTag[0].match(/\bcontent=(["'])([^"']+)\1/i);
  if (!contentMatch) return true;
  return !contentMatch[2].toLowerCase().includes('noindex');
}

function getLangFromRelativePath(relativePath) {
  const first = relativePath.split(path.sep)[0];
  return SUPPORTED_LANGS.includes(first) ? first : null;
}

function parseSitemap(sitemapXml) {
  const urls = [];
  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/g;
  let match;

  while ((match = urlBlockRegex.exec(sitemapXml)) !== null) {
    const block = match[1];
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/i);
    if (!locMatch) continue;
    const loc = normalizeUrl(locMatch[1].trim());

    const links = {};
    const linkTags = Array.from(block.matchAll(/<xhtml:link\b[^>]*\/?>/gi), (tagMatch) => tagMatch[0]);
    for (const tag of linkTags) {
      const attrs = extractTagAttributes(tag);
      const rel = String(attrs.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (!rel.includes('alternate')) continue;
      if (!attrs.hreflang || !attrs.href) continue;
      links[attrs.hreflang] = normalizeUrl(attrs.href);
    }

    urls.push({ loc, links });
  }

  return urls;
}

function main() {
  assertDocsBuildReady(ROOT_DIR);
  const errors = [];

  const files = findHtmlFiles(DOCS_DIR);
  const canonicalToFile = new Map();
  const canonicalToHreflangs = new Map();
  const xDefaultRoot = normalizeUrl(`${DOMAIN}/`);
  const languageHomes = new Set(
    SUPPORTED_LANGS.map((lang) => normalizeUrl(`${DOMAIN}/${lang}/`))
  );

  for (const file of files) {
    const fullPath = path.join(DOCS_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf8');

    if (!isIndexable(content)) continue;

    const canonical = extractCanonicalFromContent(content);
    const expectedUrl = pathToUrl(file);
    if (!canonical) {
      errors.push(`[missing canonical] ${file}`);
      continue;
    }

    if (canonical !== expectedUrl) {
      errors.push(`[non-self canonical] ${file} canonical=${canonical} expected=${expectedUrl}`);
      continue;
    }

    const lang = getLangFromRelativePath(file);

    if (lang) {
      const htmlLang = extractHtmlLang(content);
      const expectedHtmlLang = getLanguageTag(lang);
      if (htmlLang !== expectedHtmlLang) {
        errors.push(`[html lang mismatch] ${file} lang=${htmlLang || '<missing>'} expected=${expectedHtmlLang}`);
        continue;
      }
    }

    const hreflangs = extractHreflangsFromContent(content);
    const validTags = new Set([...SUPPORTED_LANGS.map(getLanguageTag), 'x-default']);
    const unknownTags = Object.keys(hreflangs).filter((tag) => !validTags.has(tag));
    if (unknownTags.length) {
      errors.push(`[unknown hreflang] ${file} hreflang=${unknownTags.join(',')}`);
      continue;
    }

    if (lang && hreflangs[getLanguageTag(lang)] !== canonical) {
      errors.push(`[hreflang self mismatch] ${file} hreflang(${getLanguageTag(lang)})=${hreflangs[getLanguageTag(lang)]} canonical=${canonical}`);
      continue;
    }

    // Convention:
    // - language homepages (/en/, /fr/, /pt-br/...) use x-default pointing to the language selector (/)
    // - other pages with an English version use x-default matching the English URL
    // - pages without an English version omit x-default entirely
    const isLangHome = languageHomes.has(canonical);
    if (isLangHome) {
      if (hreflangs['x-default'] !== xDefaultRoot) {
        errors.push(`[x-default mismatch] ${file} x-default=${hreflangs['x-default']} expected=${xDefaultRoot}`);
        continue;
      }
    } else if (hreflangs['en']) {
      if (hreflangs['x-default'] !== hreflangs['en']) {
        errors.push(`[x-default mismatch] ${file} x-default=${hreflangs['x-default']} expected=${hreflangs['en']}`);
        continue;
      }
    } else if (hreflangs['x-default']) {
      errors.push(`[unexpected x-default] ${file} has x-default but no English version`);
      continue;
    }

    canonicalToFile.set(canonical, file);
    canonicalToHreflangs.set(canonical, hreflangs);
  }

  // hreflang clusters must be reciprocal: every declared alternate is itself
  // an indexable canonical page declaring the exact same cluster.
  for (const [canonical, hreflangs] of canonicalToHreflangs) {
    for (const [tag, url] of Object.entries(hreflangs)) {
      if (tag === 'x-default') continue;
      const target = canonicalToHreflangs.get(url);
      if (!target) {
        errors.push(`[hreflang target missing] ${canonical} hreflang(${tag})=${url} is not an indexable canonical page`);
        continue;
      }
      if (!hreflangClustersEqual(target, hreflangs)) {
        errors.push(`[hreflang cluster mismatch] ${canonical} and ${url} declare different hreflang clusters`);
      }
    }
  }

  const sitemapPath = path.join(DOCS_DIR, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    errors.push('[missing sitemap] docs/sitemap.xml');
  } else {
    const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
    const entries = parseSitemap(sitemapXml);
    const sitemapLocs = new Set(entries.map((e) => e.loc));

    for (const { loc, links } of entries) {
      if (!loc.startsWith(DOMAIN)) {
        errors.push(`[sitemap non-domain loc] ${loc}`);
        continue;
      }
      if (loc.endsWith('.html')) {
        errors.push(`[sitemap non-canonical loc] ${loc}`);
        continue;
      }

      const hreflangs = canonicalToHreflangs.get(loc);
      if (!hreflangs) {
        errors.push(`[sitemap loc without canonical source] ${loc}`);
        continue;
      }

      // The sitemap must mirror the page's own hreflang cluster exactly:
      // same tags (partial coverage included), same URLs.
      for (const [key, href] of Object.entries(hreflangs)) {
        if (!links[key]) {
          errors.push(`[sitemap missing hreflang] ${loc} missing=${key}`);
          break;
        }
        if (links[key] !== href) {
          errors.push(`[sitemap hreflang mismatch] ${loc} ${key} sitemap=${links[key]} html=${href}`);
          break;
        }
      }
      for (const key of Object.keys(links)) {
        if (!(key in hreflangs)) {
          errors.push(`[sitemap extra hreflang] ${loc} extra=${key}`);
          break;
        }
      }
    }

    for (const canonical of canonicalToFile.keys()) {
      if (!sitemapLocs.has(canonical)) {
        errors.push(`[canonical missing from sitemap] ${canonical} (from ${canonicalToFile.get(canonical)})`);
      }
    }
  }

  if (errors.length) {
    console.error(`❌ International SEO validation failed (${errors.length} issue(s)):\n`);
    for (const err of errors) console.error(`- ${err}`);
    process.exit(1);
  }

  console.log(`✅ International SEO validation passed (${canonicalToFile.size} canonical page(s))`);
}

main();
