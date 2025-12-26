#!/usr/bin/env node

/**
 * Validates international SEO consistency for the static docs site:
 * - Canonical is self-referential (no .html, matches file path)
 * - hreflang alternates are present (fr/en/es + x-default) and coherent
 * - sitemap.xml only includes indexable canonical URLs and matches hreflang clusters
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const DOMAIN = 'https://noctalia.app';

const SUPPORTED_LANGS = ['fr', 'en', 'es'];

function normalizeUrl(url) {
  return url
    .replace(/\/index\.html$/, '/')
    .replace(/\.html$/, '');
}

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
  const canonicalRegex = /<link\s+rel=(["'])canonical\1\s+href=(["'])([^"']+)\2/i;
  const match = content.match(canonicalRegex);
  return match ? normalizeUrl(match[3]) : null;
}

function extractHreflangsFromContent(content) {
  const hreflangRegex = /<link\s+rel=(["'])alternate\1\s+hreflang=(["'])([^"']+)\2\s+href=(["'])([^"']+)\4/gi;
  const hreflangs = {};
  let match;

  while ((match = hreflangRegex.exec(content)) !== null) {
    const [, , , hreflang, , href] = match;
    hreflangs[hreflang] = normalizeUrl(href);
  }

  return hreflangs;
}

function isIndexable(content) {
  if (/<meta\s+http-equiv=(["'])refresh\1/i.test(content)) {
    return false;
  }

  const robotsMatch = content.match(/<meta\s+name=(["'])robots\1\s+content=(["'])([^"']+)\2/i);
  if (!robotsMatch) return true;
  return !robotsMatch[3].toLowerCase().includes('noindex');
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
    const linkRegex = /<xhtml:link\s+rel=(["'])alternate\1\s+hreflang=(["'])([^"']+)\2\s+href=(["'])([^"']+)\4\s*\/?>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(block)) !== null) {
      const hreflang = linkMatch[3];
      const href = normalizeUrl(linkMatch[5]);
      links[hreflang] = href;
    }

    urls.push({ loc, links });
  }

  return urls;
}

function main() {
  const errors = [];

  const files = findHtmlFiles(DOCS_DIR);
  const canonicalToFile = new Map();
  const canonicalToHreflangs = new Map();

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

    const hreflangs = extractHreflangsFromContent(content);
    const missing = [...SUPPORTED_LANGS, 'x-default'].filter((l) => !hreflangs[l]);
    if (missing.length) {
      errors.push(`[missing hreflang] ${file} missing=${missing.join(',')}`);
      continue;
    }

    const lang = getLangFromRelativePath(file);
    if (lang && hreflangs[lang] !== canonical) {
      errors.push(`[hreflang self mismatch] ${file} hreflang(${lang})=${hreflangs[lang]} canonical=${canonical}`);
      continue;
    }

    // Convention: x-default should match the English variant
    if (hreflangs['x-default'] !== hreflangs['en']) {
      errors.push(`[x-default mismatch] ${file} x-default=${hreflangs['x-default']} en=${hreflangs['en']}`);
      continue;
    }

    canonicalToFile.set(canonical, file);
    canonicalToHreflangs.set(canonical, hreflangs);
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

      const allExpected = [...SUPPORTED_LANGS, 'x-default'];
      for (const key of allExpected) {
        if (!links[key]) {
          errors.push(`[sitemap missing hreflang] ${loc} missing=${key}`);
          break;
        }
        if (links[key] !== hreflangs[key]) {
          errors.push(`[sitemap hreflang mismatch] ${loc} ${key} sitemap=${links[key]} html=${hreflangs[key]}`);
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

