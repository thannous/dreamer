#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');
const { DOCS_DIR, ROOT_DIR, siteConfig } = require('./lib/docs-site-config');
const {
  getPageResponsiveImages,
  readImageAssetRegistry,
} = require('./lib/image-seo-assets');
const { walkFiles } = require('./lib/docs-source-utils');

const WARNING_BYTES = 180_000;
const MAX_BYTES = 250_000;
const LEGACY_SOCIAL_IMAGE = /\/img\/og\/noctalia-(?:en|fr|es|de|it)-1200x630\.jpg/i;

function parseAttributes(tag) {
  const attributes = {};
  for (const match of String(tag || '').matchAll(/([:@\w.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function findMeta(html, name, value) {
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) || []) {
    const attrs = parseAttributes(tag);
    if (String(attrs[name] || '').toLowerCase() === value.toLowerCase()) {
      return attrs.content || '';
    }
  }
  return '';
}

function canonicalToHtmlMap() {
  const result = new Map();
  for (const filePath of walkFiles(DOCS_DIR, (candidate) => candidate.endsWith('.html'))) {
    const html = fs.readFileSync(filePath, 'utf8');
    const canonicalTag = (html.match(/<link\b[^>]*rel=(['"])canonical\1[^>]*>/i) || [])[0];
    const href = canonicalTag ? parseAttributes(canonicalTag).href : '';
    if (href) result.set(new URL(href, siteConfig.domain).pathname.replace(/\/$/, '') || '/', { filePath, html });
  }
  return result;
}

function jsonLdBlocks(html, errors, label) {
  const blocks = [];
  for (const match of String(html).matchAll(/<script\b[^>]*type=(['"])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(match[2]));
    } catch (error) {
      errors.push(`${label}: invalid JSON-LD (${error.message})`);
    }
  }
  return blocks;
}

function collectSchemaImageUrls(blocks) {
  const urls = new Set();
  function visit(node, key = '') {
    if (Array.isArray(node)) {
      for (const child of node) visit(child, key);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if ((key === 'image' || key === 'primaryImageOfPage') && typeof node.url === 'string') {
      urls.add(node.url);
    }
    for (const [childKey, value] of Object.entries(node)) {
      if ((childKey === 'image' || childKey === 'primaryImageOfPage') && typeof value === 'string') {
        urls.add(value);
      }
      visit(value, childKey);
    }
  }
  visit(blocks);
  return urls;
}

function findImageTagForAsset(html, assetId) {
  const figurePattern = new RegExp(
    `<figure\\b[^>]*data-image-asset-id=(['"])${assetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1[^>]*>[\\s\\S]*?<\\/figure>`,
    'i'
  );
  const figure = html.match(figurePattern)?.[0] || '';
  return {
    figure,
    figureAttrs: parseAttributes(figure.match(/<figure\b[^>]*>/i)?.[0] || ''),
    img: figure.match(/<img\b[^>]*>/i)?.[0] || '',
    imgAttrs: parseAttributes(figure.match(/<img\b[^>]*>/i)?.[0] || ''),
  };
}

function validateAltText(alt) {
  const errors = [];
  if (!String(alt || '').trim()) errors.push('missing alt');
  if (String(alt || '').length > 180) errors.push('alt exceeds 180 characters');
  const counts = new Map();
  for (const token of String(alt || '').toLowerCase().match(/[a-zà-ÿ]{3,}/g) || []) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  if ([...counts.values()].some((count) => count > 4)) errors.push('alt repeats one term more than four times');
  return errors;
}

function checkImageSeoContract(options = {}) {
  const registry = options.registry || readImageAssetRegistry();
  const pageMap = options.pageMap || canonicalToHtmlMap();
  const sitemapPath = options.sitemapPath || path.join(DOCS_DIR, 'sitemap.xml');
  const sitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '';
  const errors = [];
  const warnings = [];
  let placementCount = 0;

  if (!sitemap.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')) {
    errors.push('sitemap.xml is missing the image namespace');
  }

  for (const [canonicalPath, page] of Object.entries(registry.pages)) {
    const rendered = pageMap.get(canonicalPath);
    if (!rendered) {
      errors.push(`${canonicalPath}: generated canonical page not found`);
      continue;
    }
    const images = getPageResponsiveImages(registry, canonicalPath);
    const schemaImages = collectSchemaImageUrls(jsonLdBlocks(rendered.html, errors, canonicalPath));
    const editorialUrl = `${siteConfig.domain}${images.editorial.src}`;
    const ogImage = findMeta(rendered.html, 'property', 'og:image');
    const twitterImage = findMeta(rendered.html, 'name', 'twitter:image');
    const ogWidth = Number(findMeta(rendered.html, 'property', 'og:image:width'));
    const ogHeight = Number(findMeta(rendered.html, 'property', 'og:image:height'));

    if (ogImage !== editorialUrl) errors.push(`${canonicalPath}: og:image does not match editorial image`);
    if (twitterImage !== editorialUrl) errors.push(`${canonicalPath}: twitter:image does not match editorial image`);
    if (ogWidth !== images.editorial.width || ogHeight !== images.editorial.height) {
      errors.push(`${canonicalPath}: Open Graph dimensions do not match the editorial asset`);
    }
    if (!schemaImages.has(editorialUrl)) {
      errors.push(`${canonicalPath}: preferred editorial image missing from JSON-LD`);
    }
    if (LEGACY_SOCIAL_IMAGE.test(rendered.html)) {
      errors.push(`${canonicalPath}: legacy portrait social image remains in rendered HTML`);
    }

    const priorityImages = (rendered.html.match(/<img\b[^>]*fetchpriority=(['"])high\1[^>]*>/gi) || []);
    if (priorityImages.length !== 1) {
      errors.push(`${canonicalPath}: expected exactly one high-priority image, found ${priorityImages.length}`);
    }
    if (/<link\b[^>]*rel=(['"])preload\1[^>]*as=(['"])image\2/i.test(rendered.html)) {
      errors.push(`${canonicalPath}: image preload duplicates the discoverable priority image`);
    }

    for (const role of ['editorial', 'educational']) {
      placementCount += 1;
      const image = images[role];
      const expectedRef = page.images[role];
      const match = findImageTagForAsset(rendered.html, image.assetId);
      if (!match.img) {
        errors.push(`${canonicalPath}: missing visible ${role} image ${image.assetId}`);
        continue;
      }
      if (match.figureAttrs['data-image-seo-role'] !== role) {
        errors.push(`${canonicalPath}: ${image.assetId} has the wrong image role`);
      }
      if (match.imgAttrs.src !== image.src) errors.push(`${canonicalPath}: ${image.assetId} fallback src mismatch`);
      if (!match.imgAttrs.srcset || !match.imgAttrs.sizes) {
        errors.push(`${canonicalPath}: ${image.assetId} is not responsive`);
      }
      if (Number(match.imgAttrs.width) !== image.width || Number(match.imgAttrs.height) !== image.height) {
        errors.push(`${canonicalPath}: ${image.assetId} intrinsic dimensions mismatch`);
      }
      if (match.imgAttrs.alt !== expectedRef.alt) {
        errors.push(`${canonicalPath}: ${image.assetId} localized alt mismatch`);
      }
      for (const issue of validateAltText(match.imgAttrs.alt)) {
        errors.push(`${canonicalPath}: ${image.assetId} ${issue}`);
      }
      const caption = decodeHtml(match.figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] || '');
      if (caption !== expectedRef.caption) {
        errors.push(`${canonicalPath}: ${image.assetId} localized caption mismatch`);
      }
      if (role === 'editorial') {
        if (match.imgAttrs.loading === 'lazy' || match.imgAttrs.fetchpriority !== 'high') {
          errors.push(`${canonicalPath}: editorial image must be eager and high priority`);
        }
      } else if (match.imgAttrs.loading !== 'lazy' || match.imgAttrs.fetchpriority === 'high') {
        errors.push(`${canonicalPath}: educational image must be lazy and non-priority`);
      }

      const localPath = path.join(DOCS_DIR, image.src.replace(/^\/+/, ''));
      if (!fs.existsSync(localPath)) {
        errors.push(`${canonicalPath}: missing generated image ${image.src}`);
      } else {
        const dimensions = imageSize(fs.readFileSync(localPath));
        if (dimensions.width !== image.width || dimensions.height !== image.height) {
          errors.push(`${canonicalPath}: generated dimensions mismatch for ${image.src}`);
        }
        const bytes = fs.statSync(localPath).size;
        if (bytes > MAX_BYTES) errors.push(`${canonicalPath}: ${image.src} is ${bytes} bytes (max ${MAX_BYTES})`);
        else if (bytes > WARNING_BYTES) warnings.push(`${canonicalPath}: ${image.src} is ${bytes} bytes (review above ${WARNING_BYTES})`);
      }

      if (image.sitemap) {
        const absolute = `${siteConfig.domain}${image.src}`;
        if (!sitemap.includes(`<image:loc>${absolute}</image:loc>`)) {
          errors.push(`${canonicalPath}: ${image.src} missing from image sitemap`);
        }
      }
    }
  }

  if (placementCount !== Object.keys(registry.pages).length * 2) {
    errors.push(`expected ${Object.keys(registry.pages).length * 2} pilot placements, found ${placementCount}`);
  }

  const allHtmlFiles = walkFiles(DOCS_DIR, (candidate) => candidate.endsWith('.html'));
  for (const filePath of allHtmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const robots = findMeta(html, 'name', 'robots').toLowerCase();
    if (!robots.includes('noindex') && LEGACY_SOCIAL_IMAGE.test(findMeta(html, 'property', 'og:image'))) {
      errors.push(`${path.relative(ROOT_DIR, filePath)}: legacy social image remains on an indexable page`);
    }
  }

  return { errors, warnings, placementCount };
}

function main() {
  const result = checkImageSeoContract();
  for (const warning of result.warnings) console.warn(`[image-seo-contract] Warning: ${warning}`);
  if (result.errors.length > 0) {
    console.error(`[image-seo-contract] Failed (${result.errors.length} issue(s)):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[image-seo-contract] Passed: ${result.placementCount} pilot placements, responsive metadata and sitemap entries validated.`);
}

if (require.main === module) main();

module.exports = {
  checkImageSeoContract,
  collectSchemaImageUrls,
  parseAttributes,
  validateAltText,
};
