#!/usr/bin/env node
/**
 * fix-p1-seo.js — Fix all P1 SEO issues across 530 pages
 *
 * Fixes:
 * 1. og:image:width / og:image:height — add to pages missing them
 * 2. og:site_name — add "Noctalia" to all pages missing it
 * 3. og:locale:alternate — add missing de_DE / it_IT locale alternates
 * 4. twitter:image:alt — add to pages missing it
 *
 * Run: node scripts/fix-p1-seo.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const DOCS_ROOT = path.resolve(__dirname, '..');

const LANGS = ['en', 'fr', 'es', 'de', 'it'];
const LOCALE_MAP = {
  en: 'en_US',
  fr: 'fr_FR',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
};

// Collect all HTML files
function collectHtmlFiles() {
  const files = [];
  for (const lang of LANGS) {
    const langDir = path.join(DOCS_ROOT, lang);
    walkDir(langDir, files);
  }
  return files;
}

function walkDir(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, acc);
    } else if (entry.name.endsWith('.html')) {
      acc.push(full);
    }
  }
}

// Detect language from file path
function detectLang(filePath) {
  const rel = path.relative(DOCS_ROOT, filePath);
  return rel.split(path.sep)[0]; // en, fr, es, de, it
}

// Extract <title> text for twitter:image:alt fallback
function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m) return m[1].replace(/\s*\|\s*Noctalia\s*$/, '').trim();
  return 'Noctalia';
}

// Determine the expected alternate locales for a page's language
function getExpectedAlternates(lang) {
  return LANGS.filter(l => l !== lang).map(l => LOCALE_MAP[l]);
}

const stats = {
  filesProcessed: 0,
  ogImageWidthAdded: 0,
  ogSiteNameAdded: 0,
  ogLocaleAlternateAdded: 0,
  twitterImageAltAdded: 0,
};

function fixFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf-8');
  const lang = detectLang(filePath);
  let modified = false;

  // ─── 1. og:image:width / og:image:height ───
  if (html.includes('og:image"') && !html.includes('og:image:width')) {
    // Detect format: minified blog uses <meta content="..." property="..."/>
    // Multi-line symbol/guide uses <meta property="..." content="...">
    const minifiedMatch = html.match(/<meta\s+content="([^"]+)"\s+property="og:image"\s*\/?>/);
    const standardMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"\s*\/?>/);

    if (minifiedMatch) {
      // Minified blog format
      const ogImageTag = minifiedMatch[0];
      const widthHeight = `\n<meta content="1200" property="og:image:width"/>\n<meta content="630" property="og:image:height"/>`;
      html = html.replace(ogImageTag, ogImageTag + widthHeight);
      modified = true;
      stats.ogImageWidthAdded++;
    } else if (standardMatch) {
      // Multi-line format
      const ogImageTag = standardMatch[0];
      const indent = '    ';
      const widthHeight = `\n${indent}<meta property="og:image:width" content="1200">\n${indent}<meta property="og:image:height" content="630">`;
      html = html.replace(ogImageTag, ogImageTag + widthHeight);
      modified = true;
      stats.ogImageWidthAdded++;
    }
  }

  // ─── 2. og:site_name ───
  if (!html.includes('og:site_name')) {
    const minifiedMatch = html.match(/<meta\s+content="[^"]+"\s+property="og:image"\s*\/?>/);
    const standardMatch = html.match(/<meta\s+property="og:image"\s+content="[^"]+"\s*\/?>/);

    if (minifiedMatch) {
      const ogImageTag = minifiedMatch[0];
      const siteNameTag = `\n<meta content="Noctalia" property="og:site_name"/>`;
      html = html.replace(ogImageTag, ogImageTag + siteNameTag);
      modified = true;
      stats.ogSiteNameAdded++;
    } else if (standardMatch) {
      const ogImageTag = standardMatch[0];
      const indent = '    ';
      const siteNameTag = `\n${indent}<meta property="og:site_name" content="Noctalia">`;
      html = html.replace(ogImageTag, ogImageTag + siteNameTag);
      modified = true;
      stats.ogSiteNameAdded++;
    }
  }

  // ─── 3. og:locale:alternate ───
  const expectedAlts = getExpectedAlternates(lang);
  const missingAlts = expectedAlts.filter(locale => {
    // Check for both formats
    return !html.includes(`"${locale}" property="og:locale:alternate"`) &&
           !html.includes(`property="og:locale:alternate" content="${locale}"`);
  });

  if (missingAlts.length > 0) {
    // Find the og:locale tag to insert after
    const minifiedLocale = html.match(/<meta\s+content="[^"]+"\s+property="og:locale"\s*\/?>/);
    const standardLocale = html.match(/<meta\s+property="og:locale"\s+content="[^"]+"\s*\/?>/);

    // Find the last existing og:locale:alternate to insert after that instead
    const lastAltMinified = html.match(/<meta\s+content="[^"]+"\s+property="og:locale:alternate"\s*\/?>/g);
    const lastAltStandard = html.match(/<meta\s+property="og:locale:alternate"\s+content="[^"]+"\s*\/?>/g);

    if (lastAltMinified && lastAltMinified.length > 0) {
      // Insert after last existing alternate (minified format)
      const lastTag = lastAltMinified[lastAltMinified.length - 1];
      const newTags = missingAlts.map(l => `\n<meta content="${l}" property="og:locale:alternate"/>`).join('');
      html = html.replace(lastTag, lastTag + newTags);
      modified = true;
      stats.ogLocaleAlternateAdded += missingAlts.length;
    } else if (lastAltStandard && lastAltStandard.length > 0) {
      // Insert after last existing alternate (standard format)
      const lastTag = lastAltStandard[lastAltStandard.length - 1];
      const indent = '    ';
      const newTags = missingAlts.map(l => `\n${indent}<meta property="og:locale:alternate" content="${l}">`).join('');
      html = html.replace(lastTag, lastTag + newTags);
      modified = true;
      stats.ogLocaleAlternateAdded += missingAlts.length;
    } else if (minifiedLocale) {
      // No alternates yet, insert after og:locale (minified)
      const localeTag = minifiedLocale[0];
      const newTags = missingAlts.map(l => `\n<meta content="${l}" property="og:locale:alternate"/>`).join('');
      html = html.replace(localeTag, localeTag + newTags);
      modified = true;
      stats.ogLocaleAlternateAdded += missingAlts.length;
    } else if (standardLocale) {
      // No alternates yet, insert after og:locale (standard)
      const localeTag = standardLocale[0];
      const indent = '    ';
      const newTags = missingAlts.map(l => `\n${indent}<meta property="og:locale:alternate" content="${l}">`).join('');
      html = html.replace(localeTag, localeTag + newTags);
      modified = true;
      stats.ogLocaleAlternateAdded += missingAlts.length;
    }
  }

  // ─── 4. twitter:image:alt ───
  if (html.includes('twitter:image') && !html.includes('twitter:image:alt')) {
    const title = extractTitle(html);
    const minifiedTwitter = html.match(/<meta\s+content="[^"]+"\s+name="twitter:image"\s*\/?>/);
    const standardTwitter = html.match(/<meta\s+name="twitter:image"\s+content="[^"]+"\s*\/?>/);

    if (minifiedTwitter) {
      const tag = minifiedTwitter[0];
      const altTag = `\n<meta content="${title}" name="twitter:image:alt"/>`;
      html = html.replace(tag, tag + altTag);
      modified = true;
      stats.twitterImageAltAdded++;
    } else if (standardTwitter) {
      const tag = standardTwitter[0];
      const indent = '    ';
      const altTag = `\n${indent}<meta name="twitter:image:alt" content="${title}">`;
      html = html.replace(tag, tag + altTag);
      modified = true;
      stats.twitterImageAltAdded++;
    }
  }

  if (modified && !DRY_RUN) {
    fs.writeFileSync(filePath, html, 'utf-8');
  }

  stats.filesProcessed++;
  return modified;
}

// ─── Main ───
console.log(`\n🔧 P1 SEO Fix Script${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log(`   Root: ${DOCS_ROOT}\n`);

const files = collectHtmlFiles();
console.log(`Found ${files.length} HTML files across ${LANGS.length} languages\n`);

let modifiedCount = 0;
for (const file of files) {
  const wasModified = fixFile(file);
  if (wasModified) {
    modifiedCount++;
    const rel = path.relative(DOCS_ROOT, file);
    if (DRY_RUN) console.log(`  [would fix] ${rel}`);
  }
}

console.log(`\n--- Results ---`);
console.log(`Files processed:           ${stats.filesProcessed}`);
console.log(`Files modified:            ${modifiedCount}`);
console.log(`og:image:width added:      ${stats.ogImageWidthAdded}`);
console.log(`og:site_name added:        ${stats.ogSiteNameAdded}`);
console.log(`og:locale:alternate added: ${stats.ogLocaleAlternateAdded}`);
console.log(`twitter:image:alt added:   ${stats.twitterImageAltAdded}`);
console.log(DRY_RUN ? '\n(Dry run — no files were modified)' : '\nDone!');
