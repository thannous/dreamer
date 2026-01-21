#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Enhances blog index pages SEO for the static docs site:
 * - Add explicit robots meta (index, follow, max-image-preview:large)
 * - Add an ItemList JSON-LD listing the articles on the page
 *
 * Run from repo root:
 *   node scripts/enhance-blog-index-seo.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DOCS_DIR = path.join(__dirname, '../docs');
const DOMAIN = 'https://noctalia.app';
const SUPPORTED_LANGS = ['en', 'fr', 'es'];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitHead(html) {
  const match = html.match(/^([\s\S]*?<head\b[^>]*>)([\s\S]*?)(<\/head>[\s\S]*)$/i);
  if (!match) return null;
  return { beforeHead: match[1], head: match[2], afterHead: match[3] };
}

function detectHeadIndent(head) {
  const match =
    head.match(/(^\s*)<meta\s+property=(["'])og:type\2/m) ||
    head.match(/(^\s*)<meta\s+name=(["'])twitter:card\2/m) ||
    head.match(/(^\s*)<link\s+rel=(["'])canonical\2/m);
  return match ? match[1] : '    ';
}

function removeItemListJsonLd(head) {
  let next = head;

  // Remove previously injected blocks (marker-based).
  next = next.replace(
    /^\s*<!--\s*Blog index ItemList\s*-->\s*\n\s*<script\s+type=(["'])application\/ld\+json\1>[\s\S]*?<\/script>\s*\n?/gim,
    '',
  );

  // Safety: remove any ItemList JSON-LD blocks (without marker).
  next = next.replace(
    /^\s*<script\s+type=(["'])application\/ld\+json\1>[\s\S]*?"@type"\s*:\s*"ItemList"[\s\S]*?<\/script>\s*\n?/gim,
    '',
  );

  return next;
}

function insertAfterMatch(head, matchRegex, insertion) {
  if (!matchRegex.test(head)) return head;
  return head.replace(matchRegex, (match) => `${match}\n${insertion}`);
}

function ensureRobotsMeta(head) {
  if (/<meta\s+name=(["'])robots\1/i.test(head)) return { head, changed: false };

  const indent = detectHeadIndent(head);
  const robotsLine = `${indent}<meta name="robots" content="index, follow, max-image-preview:large">`;

  let next = head;
  const twitterImageLine = /^\s*<meta\s+name=(["'])twitter:image\1[^>]*>[ \t]*$/im;
  const twitterTitleLine = /^\s*<meta\s+name=(["'])twitter:title\1[^>]*>[ \t]*$/im;
  const ogImageLine = /^\s*<meta\s+property=(["'])og:image\1[^>]*>[ \t]*$/im;

  if (twitterImageLine.test(next)) {
    next = insertAfterMatch(next, twitterImageLine, robotsLine);
  } else if (twitterTitleLine.test(next)) {
    next = insertAfterMatch(next, twitterTitleLine, robotsLine);
  } else if (ogImageLine.test(next)) {
    next = insertAfterMatch(next, ogImageLine, robotsLine);
  } else {
    next = `${next}\n${robotsLine}\n`;
  }

  return { head: next, changed: true };
}

function extractCanonical(html) {
  const match = html.match(/<link\s+rel=(["'])canonical\1\s+href=(["'])([^"']+)\2/i);
  return match ? match[3] : null;
}

function extractOgTitle(html) {
  const match = html.match(/<meta\s+property=(["'])og:title\1\s+content=(["'])([^"']+)\2/i);
  return match ? match[3].trim() : null;
}

function extractTitleTag(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, ' ').trim();
}

function normalizeTitleForName(title) {
  if (!title) return null;
  return title.replace(/\s*\|\s*Noctalia\s*$/i, '').trim();
}

function getArticleInfo({ lang, slug }) {
  const absPath = path.join(DOCS_DIR, lang, 'blog', `${slug}.html`);
  if (!fs.existsSync(absPath)) return null;

  const html = fs.readFileSync(absPath, 'utf8');
  const canonical = extractCanonical(html) || `${DOMAIN}/${lang}/blog/${slug}`;
  const ogTitle = extractOgTitle(html);
  const titleTag = normalizeTitleForName(extractTitleTag(html));
  const name = ogTitle || titleTag || slug;

  return { url: canonical, name };
}

function listIndexSlugs(indexHtml) {
  const dom = new JSDOM(indexHtml);
  const document = dom.window.document;

  const links = Array.from(document.querySelectorAll('article.article-card a[href]'));
  const out = [];
  const seen = new Set();

  for (const link of links) {
    const href = (link.getAttribute('href') || '').trim();
    if (!href) continue;
    if (/^(https?:|mailto:|tel:)/i.test(href)) continue;
    if (href.startsWith('#')) continue;
    if (href.startsWith('/')) continue;
    if (href.includes('/')) continue;
    if (href.includes('.')) continue;

    if (seen.has(href)) continue;
    seen.add(href);
    out.push(href);
  }

  return out;
}

function buildItemListJsonLd({ items }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: item.url,
      name: item.name,
    })),
  };
}

function formatJsonLdScript({ headIndent, data }) {
  const jsonIndent = `${headIndent}    `;
  const pretty = JSON.stringify(data, null, 4);
  const indentedJson = pretty
    .split('\n')
    .map((line) => `${jsonIndent}${line}`)
    .join('\n');

  return (
    `${headIndent}<!-- Blog index ItemList -->\n` +
    `${headIndent}<script type="application/ld+json">\n` +
    `${indentedJson}\n` +
    `${headIndent}</script>`
  );
}

function upsertItemListJsonLd(head, itemListScript) {
  let next = removeItemListJsonLd(head);

  const blogSchemaScriptRegex =
    /<script\s+type=(["'])application\/ld\+json\1>[\s\S]*?"@type"\s*:\s*"Blog"[\s\S]*?<\/script>/im;

  if (blogSchemaScriptRegex.test(next)) {
    next = next.replace(blogSchemaScriptRegex, (match) => `${match}\n\n${itemListScript}`);
    return next;
  }

  // Fallback: insert before the first <style> block or at the end.
  const styleIndex = next.search(/^\s*<style\b/im);
  if (styleIndex !== -1) {
    return `${next.slice(0, styleIndex).trimEnd()}\n\n${itemListScript}\n\n${next.slice(styleIndex)}`;
  }

  return `${next.trimEnd()}\n\n${itemListScript}\n`;
}

function processBlogIndex(lang) {
  const absPath = path.join(DOCS_DIR, lang, 'blog', 'index.html');
  if (!fs.existsSync(absPath)) return { changed: false, reason: 'missing-index' };

  const raw = fs.readFileSync(absPath, 'utf8');
  const headParts = splitHead(raw);
  if (!headParts) return { changed: false, reason: 'no-head' };

  const headIndent = detectHeadIndent(headParts.head);

  const slugs = listIndexSlugs(raw);
  const items = slugs
    .map((slug) => getArticleInfo({ lang, slug }))
    .filter(Boolean);

  const itemListJsonLd = buildItemListJsonLd({ items });
  const itemListScript = formatJsonLdScript({ headIndent, data: itemListJsonLd });

  let nextHead = headParts.head;
  let changed = false;

  const robotsRes = ensureRobotsMeta(nextHead);
  nextHead = robotsRes.head;
  changed ||= robotsRes.changed;

  const withItemList = upsertItemListJsonLd(nextHead, itemListScript);
  changed ||= withItemList !== nextHead;
  nextHead = withItemList;

  if (!changed) return { changed: false, reason: 'no-op' };

  const rebuilt = `${headParts.beforeHead}${nextHead}${headParts.afterHead}`;
  if (!DRY_RUN) fs.writeFileSync(absPath, rebuilt, 'utf8');

  const canonical = extractCanonical(raw) || `${DOMAIN}/${lang}/blog/`;
  return { changed: true, reason: 'updated', canonical };
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Missing `docs/` directory. Run from repo root.');
    process.exit(1);
  }

  let updated = 0;
  const skipped = {};

  for (const lang of SUPPORTED_LANGS) {
    const res = processBlogIndex(lang);
    if (res.changed) {
      updated += 1;
      console.log(`Updated docs/${lang}/blog/index.html`);
      continue;
    }
    skipped[res.reason] = (skipped[res.reason] || 0) + 1;
  }

  const mode = DRY_RUN ? 'dry-run' : 'write';
  console.log(`[enhance-blog-index-seo] mode=${mode} updated=${updated}`, skipped);
}

if (require.main === module) {
  main();
}

