#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Adds responsive `srcset`/`sizes` for local blog images (`/img/blog/*.webp`)
 * in `docs/{lang}/blog/` pages (articles + index).
 *
 * Assumes image variants exist (see `scripts/generate-blog-image-variants.js`).
 *
 * Usage:
 *   node scripts/add-blog-srcset.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const SUPPORTED_LANGS = ['en', 'fr', 'es'];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const SIZES = {
  featured: '(max-width: 768px) 100vw, 1200px',
  card: '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw',
};

function findBlogHtmlFiles() {
  const out = [];
  for (const lang of SUPPORTED_LANGS) {
    const dir = path.join(DOCS_DIR, lang, 'blog');
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.html')) continue;
      out.push({
        lang,
        isIndex: entry === 'index.html',
        absPath: path.join(dir, entry),
        relPath: path.join('docs', lang, 'blog', entry),
      });
    }
  }
  return out.sort((a, b) => a.absPath.localeCompare(b.absPath));
}

function getSrcsetForSrc(src) {
  if (!src || !/\/img\/blog\/[^"']+\.webp$/i.test(src)) return null;
  if (/-\d+w\.webp$/i.test(src)) return null;

  const src480 = src.replace(/\.webp$/i, '-480w.webp');
  const src800 = src.replace(/\.webp$/i, '-800w.webp');
  const src1200 = src.replace(/\.webp$/i, '-1200w.webp');

  return `${src480} 480w, ${src800} 800w, ${src1200} 1200w`;
}

function upsertAttr(tag, attrName, value) {
  const escaped = String(value).replace(/"/g, '&quot;');
  const re = new RegExp(`\\b${attrName}=(["'])([\\s\\S]*?)\\1`, 'i');
  if (re.test(tag)) return tag.replace(re, `${attrName}="${escaped}"`);
  return tag.replace(/>$/, ` ${attrName}="${escaped}">`);
}

function addSrcsetToImgTag(tag, kind) {
  const srcMatch = tag.match(/\bsrc=(["'])([^"']+)\1/i);
  if (!srcMatch) return tag;
  const src = srcMatch[2];
  if (!/\/img\/blog\//i.test(src)) return tag;
  if (/^https?:\/\//i.test(src)) return tag;

  const srcset = getSrcsetForSrc(src);
  if (!srcset) return tag;

  let next = tag;
  if (!/\bsrcset=/.test(next)) next = upsertAttr(next, 'srcset', srcset);
  next = upsertAttr(next, 'sizes', kind === 'featured' ? SIZES.featured : SIZES.card);
  return next;
}

function injectFeaturedSrcset(html, isIndex) {
  if (isIndex) return { html, changed: false };
  const featuredImgRegex =
    /(<!--\s*Featured Image\s*-->[\s\S]*?<figure\b[^>]*>[\s\S]*?)(<img\b[^>]*>)/i;
  if (!featuredImgRegex.test(html)) return { html, changed: false };
  const next = html.replace(featuredImgRegex, (full, before, imgTag) => {
    const updated = addSrcsetToImgTag(imgTag, 'featured');
    return `${before}${updated}`;
  });
  return { html: next, changed: next !== html };
}

function injectAllLocalBlogImgs(html, isIndex) {
  const imgTagRegex = /<img\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>/gi;
  let changed = false;

  const next = html.replace(imgTagRegex, (tag) => {
    if (!/\/img\/blog\//i.test(tag)) return tag;
    if (/\bsrcset=/.test(tag)) return tag;
    const updated = addSrcsetToImgTag(tag, isIndex ? 'card' : 'card');
    if (updated !== tag) changed = true;
    return updated;
  });

  return { html: next, changed };
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error('Missing `docs/` directory. Run from repo root.');
    process.exit(1);
  }

  const files = findBlogHtmlFiles();
  let updated = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file.absPath, 'utf8');
    let next = raw;

    const featuredRes = injectFeaturedSrcset(next, file.isIndex);
    next = featuredRes.html;

    const allRes = injectAllLocalBlogImgs(next, file.isIndex);
    next = allRes.html;

    if (next !== raw) {
      updated += 1;
      if (!DRY_RUN) fs.writeFileSync(file.absPath, next, 'utf8');
    }
  }

  const mode = DRY_RUN ? 'dry-run' : 'write';
  console.log(`[add-blog-srcset] mode=${mode} updated=${updated}`);
}

main();
