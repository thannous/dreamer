#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Audits blog i18n parity using hreflang links in `docs/{lang}/blog/*.html`.
 *
 * Reports:
 * - BlogPosting page counts per language
 * - Missing hreflang targets (e.g., hreflang points to a URL whose HTML file is absent in `docs/`)
 * - Missing hreflang declarations on BlogPosting pages
 *
 * Usage:
 *   node scripts/audit-blog-i18n-parity.js
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const DOMAIN = 'https://noctalia.app';
const LANGS = ['en', 'fr', 'es', 'de', 'it'];

function listBlogHtmlFiles(lang) {
  const dir = path.join(DOCS_DIR, lang, 'blog');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.html'))
    .map((name) => ({
      lang,
      name,
      slug: name === 'index.html' ? 'index' : name.replace(/\.html$/, ''),
      absPath: path.join(dir, name),
    }));
}

function isBlogPosting(html) {
  return /["@']@type["@']\s*:\s*["']BlogPosting["']/.test(html);
}

function extractAlternateLinks(html) {
  const out = {};
  const linkRe = /<link\s+[^>]*rel=(["'])alternate\1[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    const hreflangMatch = tag.match(/hreflang=(["'])([^"']+)\1/i);
    const hrefMatch = tag.match(/href=(["'])([^"']+)\1/i);
    if (!hreflangMatch || !hrefMatch) continue;
    const hreflang = (hreflangMatch[2] || '').trim();
    const href = (hrefMatch[2] || '').trim();
    if (hreflang) out[hreflang] = href;
  }
  return out;
}

function urlToDocsFile(url) {
  const href = String(url).trim();
  if (!href) return null;
  if (!href.startsWith(DOMAIN)) return null;
  const pathPart = href.slice(DOMAIN.length);

  const match = pathPart.match(/^\/(en|fr|es|de|it)\/blog\/?([^?#]*)/i);
  if (!match) return null;

  const lang = match[1];
  const rest = (match[2] || '').replace(/\/+$/, '');
  if (!rest) return path.join(DOCS_DIR, lang, 'blog', 'index.html');

  // Clean URLs: /{lang}/blog/slug -> docs/{lang}/blog/slug.html
  if (rest.includes('/')) return null;
  return path.join(DOCS_DIR, lang, 'blog', `${rest}.html`);
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Missing `docs/` directory. Run from repo root.');
    process.exit(1);
  }

  const counts = {};
  const missingTargets = [];
  const missingHreflang = [];

  for (const lang of LANGS) {
    const files = listBlogHtmlFiles(lang);
    let blogPostingCount = 0;

    for (const file of files) {
      const html = fs.readFileSync(file.absPath, 'utf8');
      if (!isBlogPosting(html)) continue;
      blogPostingCount += 1;

      const alternates = extractAlternateLinks(html);
      const expectedLangs = [...LANGS, 'x-default'];

      for (const expected of expectedLangs) {
        if (!alternates[expected]) {
          missingHreflang.push({ from: file.absPath, missing: expected });
        }
      }

      for (const targetLang of LANGS) {
        const href = alternates[targetLang];
        if (!href) continue;
        const targetFile = urlToDocsFile(href);
        if (!targetFile) continue;
        if (!fs.existsSync(targetFile)) {
          missingTargets.push({ from: file.absPath, hreflang: targetLang, href, expectedFile: targetFile });
        }
      }
    }

    counts[lang] = blogPostingCount;
  }

  console.log('[audit-blog-i18n-parity] BlogPosting counts:', counts);
  console.log('[audit-blog-i18n-parity] Missing hreflang declarations:', missingHreflang.length);
  console.log('[audit-blog-i18n-parity] Missing hreflang targets:', missingTargets.length);

  if (missingHreflang.length > 0) {
    console.log('\nMissing hreflang declarations (first 20):');
    for (const item of missingHreflang.slice(0, 20)) {
      console.log(`- ${item.from} missing hreflang="${item.missing}"`);
    }
  }

  if (missingTargets.length > 0) {
    console.log('\nMissing hreflang targets (first 20):');
    for (const item of missingTargets.slice(0, 20)) {
      console.log(`- ${item.from} -> hreflang=${item.hreflang} ${item.href} (missing ${item.expectedFile})`);
    }
    process.exitCode = 2;
  }
}

main();
