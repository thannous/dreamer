#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');
const { DOCS_DIR, ROOT_DIR, siteConfig } = require('./lib/docs-site-config');
const { MAX_OUTPUT_BYTES } = require('./optimize-homepage-hero');

const HERO_PATH = path.join(DOCS_DIR, 'img', 'hero', 'noctalia-observatory-bg.webp');
const OBSERVATORY_CSS_PATH = path.join(DOCS_DIR, 'css', 'observatory.css');

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)(?:=(['"])(.*?)\2)?/g)) {
    attributes[match[1].toLowerCase()] = match[3] ?? '';
  }
  return attributes;
}

function checkWebPerformanceContract() {
  const errors = [];

  if (!fs.existsSync(HERO_PATH)) {
    errors.push('[homepage LCP] missing optimized WebP hero');
  } else if (fs.statSync(HERO_PATH).size > MAX_OUTPUT_BYTES) {
    errors.push(
      `[homepage LCP] optimized hero is ${fs.statSync(HERO_PATH).size} bytes; maximum is ${MAX_OUTPUT_BYTES}`
    );
  }

  if (!fs.existsSync(OBSERVATORY_CSS_PATH)) {
    errors.push('[homepage LCP] missing observatory.css');
  } else {
    const css = fs.readFileSync(OBSERVATORY_CSS_PATH, 'utf8');
    if (!css.includes("url('/img/hero/noctalia-observatory-bg.webp')")) {
      errors.push('[homepage LCP] observatory.css must use the optimized WebP hero');
    }
    if (css.includes("url('/img/hero/noctalia-observatory-bg.png')")) {
      errors.push('[homepage LCP] observatory.css still requests the 1.8 MB PNG hero');
    }
  }

  const homePaths = [path.join(DOCS_DIR, 'index.html')];
  for (const lang of siteConfig.languages.filter((candidate) => candidate !== 'en')) {
    homePaths.push(path.join(DOCS_DIR, lang, 'index.html'));
  }
  for (const homePath of homePaths) {
    if (!fs.existsSync(homePath)) {
      errors.push(`[homepage LCP] missing ${path.relative(ROOT_DIR, homePath)}`);
      continue;
    }
    const html = fs.readFileSync(homePath, 'utf8');
    if (
      !/<link\b(?=[^>]*rel=(['"])preload\1)(?=[^>]*href=(['"])\/img\/hero\/noctalia-observatory-bg\.webp\2)(?=[^>]*fetchpriority=(['"])high\3)[^>]*>/i.test(
        html
      )
    ) {
      errors.push(`[homepage LCP] ${path.relative(ROOT_DIR, homePath)} must preload the WebP hero`);
    }
  }

  for (const lang of siteConfig.languages) {
    const indexPath = path.join(DOCS_DIR, lang, 'blog', 'index.html');
    if (!fs.existsSync(indexPath)) {
      errors.push(`[blog index images] missing ${path.relative(ROOT_DIR, indexPath)}`);
      continue;
    }
    const html = fs.readFileSync(indexPath, 'utf8');
    const localImages = (html.match(/<img\b[^>]*>/gi) || [])
      .map((tag) => ({ attrs: parseAttributes(tag), tag }))
      .filter(({ attrs }) => /\/img\/blog\//i.test(attrs.src || ''));
    const eager = localImages.filter(({ attrs }) => attrs.loading === 'eager');
    if (eager.length !== 1 || eager[0]?.attrs.fetchpriority !== 'high') {
      errors.push(
        `[blog index images] ${path.relative(ROOT_DIR, indexPath)} must have exactly one eager high-priority local image`
      );
    }
    for (const { attrs } of localImages) {
      if (!attrs.width || !attrs.height) {
        errors.push(`[blog index images] ${path.relative(ROOT_DIR, indexPath)} has an image without dimensions`);
        break;
      }
      if (!attrs.srcset || !attrs.sizes) {
        errors.push(`[blog index images] ${path.relative(ROOT_DIR, indexPath)} has a non-responsive image`);
        break;
      }
      if (attrs.loading !== 'eager' && attrs.loading !== 'lazy') {
        errors.push(`[blog index images] ${path.relative(ROOT_DIR, indexPath)} has no loading policy`);
        break;
      }
    }
  }

  return { errors };
}

function main() {
  const result = checkWebPerformanceContract();
  if (result.errors.length > 0) {
    console.error(`[web-performance-contract] Failed (${result.errors.length} issue(s)):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('[web-performance-contract] Passed: optimized homepage hero and one eager responsive blog-index image per locale.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[web-performance-contract] Failed: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = {
  checkWebPerformanceContract,
  parseAttributes,
};
