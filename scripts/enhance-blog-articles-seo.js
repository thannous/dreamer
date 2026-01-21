#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Enhances blog article SEO for the static docs site:
 * - Use per-article featured image for og:image/twitter:image + BlogPosting.image
 * - Add BlogPosting.wordCount + BlogPosting.timeRequired + isAccessibleForFree + inLanguage
 * - Fix featured image dimensions (1200x630) and prioritize loading
 * - (Optionally) preload the featured image
 *
 * Run from repo root:
 *   node scripts/enhance-blog-articles-seo.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DOCS_DIR = path.join(__dirname, '../docs');
const BLOG_IMG_DIR = path.join(DOCS_DIR, 'img', 'blog');
const DOMAIN = 'https://noctalia.app';

const SUPPORTED_LANGS = ['en', 'fr', 'es'];
const WPM = 300;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function countWords(text) {
  const matches = text.match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function computeReadingInfoFromHtml(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const proseEls = Array.from(document.querySelectorAll('.prose'));
  const candidates = proseEls.length > 0 ? proseEls : Array.from(document.querySelectorAll('article'));
  const text = candidates.map((el) => el.textContent || '').join(' ');
  const words = countWords(text);
  if (words === 0) return null;

  const minutes = Math.max(1, Math.ceil(words / WPM));
  return { minutes, words };
}

function minutesToIsoDuration(minutes) {
  const safeMinutes = Math.max(1, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (hours === 0) return `PT${remainingMinutes}M`;
  if (remainingMinutes === 0) return `PT${hours}H`;
  return `PT${hours}H${remainingMinutes}M`;
}

function extractCanonicalUrl(html) {
  const canonicalRegex = /<link\s+rel=(["'])canonical\1\s+href=(["'])([^"']+)\2/i;
  const match = html.match(canonicalRegex);
  return match ? match[3] : null;
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

function normalizeHeadIndentation(head) {
  const indent = detectHeadIndent(head);
  return head.replace(/^(<(?:meta|link|script|!--))/gm, `${indent}$1`);
}

function collapseBlankLinesInMetaRegion(head) {
  const styleIndex = head.search(/^\s*<style\b/im);
  const splitIndex = styleIndex === -1 ? head.length : styleIndex;

  const before = head.slice(0, splitIndex);
  const after = head.slice(splitIndex);

  const cleanedBefore = before.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
  return cleanedBefore + after;
}

function removeMetaPropertyFromHead(head, property) {
  const re = new RegExp(
    `^\\s*<meta\\s+property=(["'])${escapeRegExp(property)}\\1\\s+content=(["'])([^\\n]*?)\\2\\s*>[\\t ]*\\n?`,
    'gim',
  );
  return head.replace(re, '');
}

function removeMetaNameFromHead(head, name) {
  const re = new RegExp(
    `^\\s*<meta\\s+name=(["'])${escapeRegExp(name)}\\1\\s+content=(["'])([^\\n]*?)\\2\\s*>[\\t ]*\\n?`,
    'gim',
  );
  return head.replace(re, '');
}

function removeFeaturedImagePreloadFromHead(head) {
  const markerRegex = /^\s*<!--\s*Preload featured image\s*-->\s*\n?/gim;
  const preloadRegex =
    /^\s*<link\s+rel=(["'])preload\1[^>]*\bhref=(["'])\/img\/blog\/[^"']+\2[^>]*\bas=(["'])image\3[^>]*>\s*\n?/gim;
  return head.replace(markerRegex, '').replace(preloadRegex, '');
}

function insertAfterLine(head, anchorRegex, insertion) {
  if (!anchorRegex.test(head)) return head;
  return head.replace(anchorRegex, (line) => `${line}\n${insertion}`);
}

function enhanceArticleHead(head, { imageUrl, featuredAlt, preloadHref }) {
  const indent = detectHeadIndent(head);
  let next = normalizeHeadIndentation(head);

  next = removeMetaPropertyFromHead(next, 'og:image');
  next = removeMetaPropertyFromHead(next, 'og:image:width');
  next = removeMetaPropertyFromHead(next, 'og:image:height');
  next = removeMetaPropertyFromHead(next, 'og:image:alt');

  next = removeMetaNameFromHead(next, 'twitter:image');
  next = removeMetaNameFromHead(next, 'twitter:image:alt');

  next = removeFeaturedImagePreloadFromHead(next);

  const ogLines = [
    `${indent}<meta property="og:image" content="${escapeHtmlAttr(imageUrl)}">`,
    `${indent}<meta property="og:image:width" content="1200">`,
    `${indent}<meta property="og:image:height" content="630">`,
  ];
  if (featuredAlt) {
    ogLines.push(`${indent}<meta property="og:image:alt" content="${escapeHtmlAttr(featuredAlt)}">`);
  }
  const ogBlock = `${ogLines.join('\n')}\n`;

  const ogUrlLine = /^\s*<meta\s+property=(["'])og:url\1[^>]*>[ \t]*$/im;
  const ogDescLine = /^\s*<meta\s+property=(["'])og:description\1[^>]*>[ \t]*$/im;
  const ogTitleLine = /^\s*<meta\s+property=(["'])og:title\1[^>]*>[ \t]*$/im;

  if (ogUrlLine.test(next)) {
    next = insertAfterLine(next, ogUrlLine, ogBlock);
  } else if (ogDescLine.test(next)) {
    next = insertAfterLine(next, ogDescLine, ogBlock);
  } else if (ogTitleLine.test(next)) {
    next = insertAfterLine(next, ogTitleLine, ogBlock);
  } else {
    next = `${ogBlock}${next}`;
  }

  const twitterLines = [`${indent}<meta name="twitter:image" content="${escapeHtmlAttr(imageUrl)}">`];
  if (featuredAlt) {
    twitterLines.push(`${indent}<meta name="twitter:image:alt" content="${escapeHtmlAttr(featuredAlt)}">`);
  }
  const twitterBlock = `${twitterLines.join('\n')}\n`;

  const twitterDescLine = /^\s*<meta\s+name=(["'])twitter:description\1[^>]*>[ \t]*$/im;
  const twitterTitleLine = /^\s*<meta\s+name=(["'])twitter:title\1[^>]*>[ \t]*$/im;
  const twitterCardLine = /^\s*<meta\s+name=(["'])twitter:card\1[^>]*>[ \t]*$/im;

  if (twitterDescLine.test(next)) {
    next = insertAfterLine(next, twitterDescLine, twitterBlock);
  } else if (twitterTitleLine.test(next)) {
    next = insertAfterLine(next, twitterTitleLine, twitterBlock);
  } else if (twitterCardLine.test(next)) {
    next = insertAfterLine(next, twitterCardLine, twitterBlock);
  } else {
    next = `${next}\n${twitterBlock}`;
  }

  // Remove duplicates introduced by previous runs.
  next = next.replace(
    /^\s*<meta\s+name=(["'])robots\1\s+content=(["'])max-image-preview:large\2\s*>\s*\n?/gim,
    '',
  );

  // Add robots meta (don't override existing robots directives like noindex).
  if (!/<meta\s+name=(["'])robots\1/i.test(next)) {
    const robotsLine = `${indent}<meta name="robots" content="max-image-preview:large">`;
    const articleAuthorLine = /^\s*<meta\s+property=(["'])article:author\1[^>]*>[ \t]*$/im;
    if (articleAuthorLine.test(next)) {
      next = insertAfterLine(next, articleAuthorLine, `${robotsLine}\n`);
    } else if (twitterDescLine.test(next)) {
      next = insertAfterLine(next, twitterDescLine, `${robotsLine}\n`);
    } else {
      next = `${next}${robotsLine}\n`;
    }
  }

  // Preload featured image (helps LCP on articles).
  const safePreloadHref = preloadHref ? String(preloadHref).trim() : '';
  const shouldPreload = safePreloadHref.startsWith('/img/');
  const lowerHref = safePreloadHref.toLowerCase();
  const mime =
    lowerHref.endsWith('.webp')
      ? 'image/webp'
      : lowerHref.endsWith('.png')
        ? 'image/png'
        : lowerHref.endsWith('.jpg') || lowerHref.endsWith('.jpeg')
          ? 'image/jpeg'
          : null;
  const typeAttr = mime ? ` type="${mime}"` : '';
  const preloadBlock = shouldPreload
    ? `${indent}<!-- Preload featured image -->\n` +
      `${indent}<link rel="preload" href="${escapeHtmlAttr(safePreloadHref)}" as="image"${typeAttr}>\n`
    : null;

  const frauncesPreloadLine =
    /^\s*<link\s+rel=(["'])preload\1\s+href=(["'])\/fonts\/Fraunces-Variable\.woff2\2[^>]*>[ \t]*$/im;
  const lastFontPreloadLine = /^\s*<link\s+rel=(["'])preload\1[^>]*\/fonts\/[^>]*>[ \t]*$/gim;
  if (preloadBlock) {
    if (frauncesPreloadLine.test(next)) {
      next = insertAfterLine(next, frauncesPreloadLine, preloadBlock);
    } else {
      const fontMatches = Array.from(next.matchAll(lastFontPreloadLine));
      if (fontMatches.length > 0) {
        const last = fontMatches[fontMatches.length - 1][0];
        next = next.replace(last, `${last}\n${preloadBlock}`);
      } else {
        next = `${preloadBlock}${next}`;
      }
    }
  }

  next = collapseBlankLinesInMetaRegion(next);
  return normalizeHeadIndentation(next);
}

function findBlogHtmlFiles() {
  const out = [];
  for (const lang of SUPPORTED_LANGS) {
    const blogDir = path.join(DOCS_DIR, lang, 'blog');
    if (!fs.existsSync(blogDir)) continue;
    const entries = fs.readdirSync(blogDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.html')) continue;
      if (entry.name === 'index.html') continue;
      out.push({
        lang,
        slug: entry.name.replace(/\.html$/, ''),
        absPath: path.join(blogDir, entry.name),
      });
    }
  }
  return out.sort((a, b) => a.absPath.localeCompare(b.absPath));
}

function fixFeaturedImageTag(html) {
  const featuredImgRegex =
    /(<!--\s*Featured Image\s*-->[\s\S]*?<figure\b[^>]*>[\s\S]*?)(<img\b[^>]*>)/i;
  const match = html.match(featuredImgRegex);
  if (!match) return html;

  let tag = match[2];

  // Ensure correct intrinsic size for the 1200x630 optimized images
  tag = tag.replace(/\bheight=(["'])600\1/gi, 'height="630"');
  if (!/\bheight=/.test(tag)) {
    if (/\bwidth=(["'])1200\1/i.test(tag)) {
      tag = tag.replace(/\bwidth=(["'])1200\1/i, 'width="1200" height="630"');
    } else if (!/\bwidth=/.test(tag)) {
      tag = tag.replace(/>$/, ' width="1200" height="630">');
    }
  }

  // Promote loading priority on the featured image
  if (!/\bfetchpriority=/.test(tag)) {
    if (/\bloading=(["'])eager\1/i.test(tag)) {
      tag = tag.replace(/\bloading=(["'])eager\1/i, 'loading="eager" fetchpriority="high"');
    } else {
      tag = tag.replace(/>$/, ' fetchpriority="high">');
    }
  }

  return html.replace(featuredImgRegex, (full, before, imgTag) => `${before}${tag}`);
}

function resolveImageUrlFromSrc(src) {
  if (!src) return null;
  const value = String(src).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `${DOMAIN}${value}`;
  const idx = value.indexOf('img/blog/');
  if (idx !== -1) return `${DOMAIN}/${value.slice(idx)}`;
  return null;
}

function getPreloadHrefFromImageUrl(imageUrl) {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    const base = new URL(DOMAIN);
    if (url.host !== base.host) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function findFeaturedImageFromDocument(document) {
  const prose = document.querySelector('.prose');
  if (prose) {
    let prev = prose.previousElementSibling;
    while (prev) {
      if (prev.tagName && prev.tagName.toLowerCase() === 'figure') {
        const img = prev.querySelector('img');
        if (img) return img;
      }
      prev = prev.previousElementSibling;
    }
  }

  const imgInFigure = document.querySelector('figure img');
  return imgInFigure || null;
}

function updateBlogPostingJsonLd(html, { lang, slug, imageUrl, minutes, words }) {
  const scriptRegex = /<script\s+type=(["'])application\/ld\+json\1>\s*([\s\S]*?)\s*<\/script>/gi;
  const canonical = extractCanonicalUrl(html);
  if (!canonical) return { html, changed: false };

  let changed = false;

  const next = html.replace(scriptRegex, (full, quote, jsonText) => {
    const trimmed = jsonText.trim();
    let data;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return full;
    }

    const type = data && data['@type'];
    const isBlogPosting =
      type === 'BlogPosting' ||
      (Array.isArray(type) && type.includes('BlogPosting')) ||
      (typeof type === 'string' && type.toLowerCase() === 'blogposting');

    if (!isBlogPosting) return full;

    const nextData = { ...data };
    nextData.inLanguage = lang;
    nextData.isAccessibleForFree = true;
    nextData.wordCount = words;
    nextData.timeRequired = minutesToIsoDuration(minutes);
    nextData.url = canonical;

    if (imageUrl) {
      nextData.image = {
        '@type': 'ImageObject',
        url: imageUrl,
        width: 1200,
        height: 630,
      };
    }

    const pretty = JSON.stringify(nextData, null, 4);
    const indented = pretty
      .split('\n')
      .map((line) => `        ${line}`)
      .join('\n');

    changed = true;
    return `<script type="application/ld+json">\n${indented}\n    </script>`;
  });

  return { html: next, changed };
}

function processArticle({ lang, slug, absPath }) {
  const raw = fs.readFileSync(absPath, 'utf8');

  // Only treat pages with a BlogPosting JSON-LD as an article page.
  if (!/["@']@type["@']\s*:\s*["']BlogPosting["']/.test(raw)) {
    return { changed: false, reason: 'not-blogposting' };
  }

  const readingInfo = computeReadingInfoFromHtml(raw);
  if (!readingInfo) {
    return { changed: false, reason: 'no-reading-info' };
  }

  const dom = new JSDOM(raw);
  const featuredImg = findFeaturedImageFromDocument(dom.window.document);
  const featuredSrc = featuredImg ? featuredImg.getAttribute('src') : null;
  const featuredAlt = featuredImg ? featuredImg.getAttribute('alt') : null;

  const imageFilePath = path.join(BLOG_IMG_DIR, `${slug}.webp`);
  const fallbackImageUrl = fs.existsSync(imageFilePath) ? `${DOMAIN}/img/blog/${slug}.webp` : null;
  const imageUrl = resolveImageUrlFromSrc(featuredSrc) || fallbackImageUrl;
  const preloadHref = getPreloadHrefFromImageUrl(imageUrl);

  let next = raw;

  if (imageUrl) {
    const headParts = splitHead(next);
    if (headParts) {
      const enhancedHead = enhanceArticleHead(headParts.head, { imageUrl, featuredAlt, preloadHref });
      const normalizedHead = enhancedHead.startsWith('\n') ? enhancedHead : `\n${enhancedHead}`;
      next = `${headParts.beforeHead}${normalizedHead}${headParts.afterHead}`;
    }
  }

  next = fixFeaturedImageTag(next);

  const jsonRes = updateBlogPostingJsonLd(next, {
    lang,
    slug,
    imageUrl,
    minutes: readingInfo.minutes,
    words: readingInfo.words,
  });
  next = jsonRes.html;

  const changed = next !== raw;
  if (changed && !DRY_RUN) {
    fs.writeFileSync(absPath, next, 'utf8');
  }

  return { changed, reason: changed ? 'updated' : 'no-op' };
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Missing `docs/` directory. Run from repo root.');
    process.exit(1);
  }

  const files = findBlogHtmlFiles();
  let updated = 0;
  const skipped = {};

  for (const file of files) {
    const res = processArticle(file);
    if (res.changed) {
      updated += 1;
      console.log(`Updated docs/${file.lang}/blog/${file.slug}.html`);
      continue;
    }
    skipped[res.reason] = (skipped[res.reason] || 0) + 1;
  }

  const mode = DRY_RUN ? 'dry-run' : 'write';
  console.log(`[enhance-blog-articles-seo] mode=${mode} updated=${updated}`, skipped);
}

if (require.main === module) {
  main();
}

module.exports = {
  computeReadingInfoFromHtml,
  enhanceArticleHead,
  fixFeaturedImageTag,
  splitHead,
  updateBlogPostingJsonLd,
};
