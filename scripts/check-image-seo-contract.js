#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');
const { DOCS_DIR, ROOT_DIR, siteConfig } = require('./lib/docs-site-config');
const {
  getPageResponsiveImages,
  getResponsiveImageData,
  readImageAssetRegistry,
} = require('./lib/image-seo-assets');
const {
  listPageIllustrationRoutes,
  readCompleteImageAssetRegistry,
} = require('./lib/page-illustrations');
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

function validateEditorialHero(html, label = 'page') {
  const errors = [];
  const source = String(html || '');
  const isArticle = /<html\b[^>]*\bclass=(['"])[^"']*\bblog-article\b/i.test(source);
  const isDictionary = /<body\b[^>]*\bclass=(['"])[^"']*\bdictionary-page\b/i.test(source);
  const figureTags = source.match(/<figure\b[^>]*>/gi) || [];
  const editorialTags = figureTags.filter((tag) => (
    parseAttributes(tag)['data-image-seo-role'] === 'editorial'
  ));

  if (!isArticle && !isDictionary) return { eligible: false, errors };
  if (figureTags.length === 0) return { eligible: false, errors };
  if (editorialTags.length !== 1) {
    errors.push(`${label}: expected one editorial hero image, found ${editorialTags.length}`);
    return { eligible: true, errors };
  }

  const hero = source.match(
    /<header\b[^>]*\bdata-image-seo-hero=(['"])true\1[^>]*>[\s\S]*?<\/header>/i
  )?.[0] || '';
  if (!hero) {
    errors.push(`${label}: illustrated page is missing its immersive hero`);
    return { eligible: true, errors };
  }

  const heroEditorialTags = (hero.match(/<figure\b[^>]*>/gi) || []).filter((tag) => (
    parseAttributes(tag)['data-image-seo-role'] === 'editorial'
  ));
  if (heroEditorialTags.length !== 1) {
    errors.push(`${label}: editorial image is not contained once inside the hero`);
  }
  if (!/<picture\b/i.test(hero)) errors.push(`${label}: editorial hero is missing its picture element`);

  const imageTag = hero.match(/<figure\b[^>]*data-image-seo-role=(['"])editorial\1[^>]*>[\s\S]*?<img\b[^>]*>/i)?.[0]
    .match(/<img\b[^>]*>/i)?.[0] || '';
  const imageAttrs = parseAttributes(imageTag);
  if (!imageAttrs.src || !imageAttrs.sizes || !imageAttrs.width || !imageAttrs.height) {
    errors.push(`${label}: editorial hero is missing responsive dimensions or fallback src`);
  }
  if (!imageAttrs.alt) errors.push(`${label}: editorial hero is missing alt text`);
  if (imageAttrs.loading === 'lazy' || imageAttrs.fetchpriority !== 'high') {
    errors.push(`${label}: editorial hero must be eager and high priority`);
  }

  const priorityImages = source.match(/<img\b[^>]*fetchpriority=(['"])high\1[^>]*>/gi) || [];
  if (priorityImages.length !== 1) {
    errors.push(`${label}: expected exactly one high-priority image, found ${priorityImages.length}`);
  }
  if (isArticle && !/\bclass=(['"])[^"']*\barticle-hero-copy\b/i.test(hero)) {
    errors.push(`${label}: article hero copy is not using the shared layout`);
  }
  if (isDictionary && !/\bclass=(['"])[^"']*\bdictionary-hero-copy\b/i.test(hero)) {
    errors.push(`${label}: dictionary hero copy is not using the shared layout`);
  }

  return { eligible: true, errors };
}

function validateSitewidePageIllustrations({ pageMap, sitemap, errors, warnings }) {
  const registry = readCompleteImageAssetRegistry();
  const routes = listPageIllustrationRoutes();
  let placementCount = 0;

  for (const route of routes) {
    const canonicalPath = route.path.replace(/\/$/, '') || '/';
    const rendered = pageMap.get(canonicalPath);
    const assetId = `sitewide.${route.pageId}`;
    if (!rendered) {
      errors.push(`${canonicalPath}: sitewide illustration page not found`);
      continue;
    }

    const image = getResponsiveImageData(registry, assetId, '16x9');
    const imageUrl = `${siteConfig.domain}${image.src}`;
    const match = findImageTagForAsset(rendered.html, assetId);
    if (!match.img) {
      errors.push(`${canonicalPath}: missing visible sitewide illustration ${assetId}`);
      continue;
    }
    placementCount += 1;

    if (!/data-image-seo-hero=(['"])true\1/i.test(rendered.html)) {
      errors.push(`${canonicalPath}: sitewide illustration is not promoted into a hero`);
    }
    if (match.figureAttrs['data-image-seo-role'] !== 'editorial') {
      errors.push(`${canonicalPath}: ${assetId} is missing its editorial role`);
    }
    if (match.imgAttrs.src !== image.src) {
      errors.push(`${canonicalPath}: ${assetId} fallback src mismatch`);
    }
    if (!match.imgAttrs.srcset || !match.imgAttrs.sizes) {
      errors.push(`${canonicalPath}: ${assetId} is not responsive`);
    }
    if (Number(match.imgAttrs.width) !== image.width || Number(match.imgAttrs.height) !== image.height) {
      errors.push(`${canonicalPath}: ${assetId} intrinsic dimensions mismatch`);
    }
    for (const issue of validateAltText(match.imgAttrs.alt)) {
      errors.push(`${canonicalPath}: ${assetId} ${issue}`);
    }
    if (match.imgAttrs.loading === 'lazy' || match.imgAttrs.fetchpriority !== 'high') {
      errors.push(`${canonicalPath}: ${assetId} must be eager and high priority`);
    }
    const caption = decodeHtml(
      match.figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] || ''
    );
    if (!caption.trim()) errors.push(`${canonicalPath}: ${assetId} is missing its localized caption`);

    const priorityImages = rendered.html.match(/<img\b[^>]*fetchpriority=(['"])high\1[^>]*>/gi) || [];
    if (priorityImages.length !== 1) {
      errors.push(`${canonicalPath}: expected exactly one high-priority image, found ${priorityImages.length}`);
    }

    const ogImage = findMeta(rendered.html, 'property', 'og:image');
    const twitterImage = findMeta(rendered.html, 'name', 'twitter:image');
    const ogWidth = Number(findMeta(rendered.html, 'property', 'og:image:width'));
    const ogHeight = Number(findMeta(rendered.html, 'property', 'og:image:height'));
    if (ogImage !== imageUrl) errors.push(`${canonicalPath}: og:image does not match ${assetId}`);
    if (twitterImage !== imageUrl) errors.push(`${canonicalPath}: twitter:image does not match ${assetId}`);
    if (ogWidth !== image.width || ogHeight !== image.height) {
      errors.push(`${canonicalPath}: Open Graph dimensions do not match ${assetId}`);
    }

    const schemaImages = collectSchemaImageUrls(jsonLdBlocks(rendered.html, errors, canonicalPath));
    if (!schemaImages.has(imageUrl)) {
      errors.push(`${canonicalPath}: ${assetId} missing from JSON-LD`);
    }
    if (!sitemap.includes(`<image:loc>${imageUrl}</image:loc>`)) {
      errors.push(`${canonicalPath}: ${assetId} missing from image sitemap`);
    }

    const localPath = path.join(DOCS_DIR, image.src.replace(/^\/+/, ''));
    if (!fs.existsSync(localPath)) {
      errors.push(`${canonicalPath}: missing generated image ${image.src}`);
      continue;
    }
    const dimensions = imageSize(fs.readFileSync(localPath));
    if (dimensions.width !== image.width || dimensions.height !== image.height) {
      errors.push(`${canonicalPath}: generated dimensions mismatch for ${image.src}`);
    }
    const bytes = fs.statSync(localPath).size;
    if (bytes > MAX_BYTES) errors.push(`${canonicalPath}: ${image.src} is ${bytes} bytes (max ${MAX_BYTES})`);
    else if (bytes > WARNING_BYTES) warnings.push(`${canonicalPath}: ${image.src} is ${bytes} bytes (review above ${WARNING_BYTES})`);
  }

  if (routes.length !== 170) errors.push(`expected 170 sitewide illustration routes, found ${routes.length}`);
  if (placementCount !== routes.length) {
    errors.push(`expected ${routes.length} visible sitewide illustrations, found ${placementCount}`);
  }
  return placementCount;
}

function checkImageSeoContract(options = {}) {
  const registry = options.registry || readImageAssetRegistry();
  const pageMap = options.pageMap || canonicalToHtmlMap();
  const sitemapPath = options.sitemapPath || path.join(DOCS_DIR, 'sitemap.xml');
  const sitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '';
  const errors = [];
  const warnings = [];
  let placementCount = 0;
  let sitewidePlacementCount = 0;

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

  const includeSitewide = options.includeSitewide ?? (!options.registry && !options.pageMap);
  if (includeSitewide) {
    sitewidePlacementCount = validateSitewidePageIllustrations({
      pageMap,
      sitemap,
      errors,
      warnings,
    });
  }

  const allHtmlFiles = walkFiles(DOCS_DIR, (candidate) => candidate.endsWith('.html'));
  let editorialHeroCount = 0;
  for (const filePath of allHtmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const label = path.relative(ROOT_DIR, filePath);
    const robots = findMeta(html, 'name', 'robots').toLowerCase();
    if (!robots.includes('noindex') && LEGACY_SOCIAL_IMAGE.test(findMeta(html, 'property', 'og:image'))) {
      errors.push(`${label}: legacy social image remains on an indexable page`);
    }
    const heroContract = validateEditorialHero(html, label);
    if (heroContract.eligible) {
      editorialHeroCount += 1;
      errors.push(...heroContract.errors);
    }
  }

  if (editorialHeroCount === 0) errors.push('no illustrated editorial heroes were found');

  return { errors, warnings, placementCount, editorialHeroCount, sitewidePlacementCount };
}

function main() {
  const result = checkImageSeoContract();
  for (const warning of result.warnings) console.warn(`[image-seo-contract] Warning: ${warning}`);
  if (result.errors.length > 0) {
    console.error(`[image-seo-contract] Failed (${result.errors.length} issue(s)):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(
    `[image-seo-contract] Passed: ${result.editorialHeroCount} illustrated pages share the immersive hero; ` +
    `${result.placementCount} pilot placements and ${result.sitewidePlacementCount} sitewide illustrations ` +
    `keep responsive metadata and sitemap entries.`
  );
}

if (require.main === module) main();

module.exports = {
  checkImageSeoContract,
  collectSchemaImageUrls,
  parseAttributes,
  validateAltText,
  validateEditorialHero,
  validateSitewidePageIllustrations,
};
