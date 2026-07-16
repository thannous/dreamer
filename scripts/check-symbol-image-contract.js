#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_DIR, DOCS_DIR, siteConfig } = require('./lib/docs-site-config');

const SITE_ORIGIN = siteConfig.domain.replace(/\/$/, '');
const CATALOG_PATH = path.join(DATA_DIR, 'dream-symbols.json');
const SITEMAP_PATH = path.join(DOCS_DIR, 'sitemap.xml');

function readMeta(html, key, value) {
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\b${key}=["']${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'])[^>]*\\bcontent=["']([^"']+)["'][^>]*>`,
    'i'
  );
  return html.match(pattern)?.[1] || null;
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)) {
    attributes[match[1].toLowerCase()] = match[3];
  }
  return attributes;
}

function extractHeroImage(html) {
  const figure = html.match(
    /<figure\b[^>]*data-image-seo-role=(["'])symbol-hero\1[^>]*>([\s\S]*?)<\/figure>/i
  );
  if (!figure) return null;
  const imageTag = figure[2].match(/<img\b[^>]*>/i)?.[0];
  return imageTag ? parseAttributes(imageTag) : null;
}

function extractArticleImage(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    let value;
    try {
      value = JSON.parse(script[1]);
    } catch {
      continue;
    }
    const items = Array.isArray(value?.['@graph']) ? value['@graph'] : [value];
    const article = items.find((item) => item?.['@type'] === 'Article');
    if (!article) continue;
    return article.image?.contentUrl || article.image?.url || article.image || null;
  }
  return null;
}

function sitemapImageForPage(sitemap, pageUrl) {
  const blocks = sitemap.match(/<url>[\s\S]*?<\/url>/g) || [];
  const block = blocks.find((value) => value.includes(`<loc>${pageUrl}</loc>`));
  return block?.match(/<image:loc>([^<]+)<\/image:loc>/)?.[1] || null;
}

function validateSymbolImageContract() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const errors = [];
  let pagesChecked = 0;

  for (const symbol of catalog.symbols || []) {
    for (const lang of siteConfig.languages) {
      const slug = symbol?.[lang]?.slug;
      const symbolsPath = siteConfig.symbolsPath?.[lang];
      if (!slug || !symbolsPath) {
        errors.push(`${symbol.id}/${lang}: missing localized route metadata`);
        continue;
      }

      const relativePagePath = path.join(lang, symbolsPath, `${slug}.html`);
      const pagePath = path.join(DOCS_DIR, relativePagePath);
      const pageUrl = `${SITE_ORIGIN}/${lang}/${symbolsPath}/${slug}`;
      if (!fs.existsSync(pagePath)) {
        errors.push(`${symbol.id}/${lang}: missing ${relativePagePath}`);
        continue;
      }

      pagesChecked += 1;
      const html = fs.readFileSync(pagePath, 'utf8');
      const image = extractHeroImage(html);
      if (!image) {
        errors.push(`${symbol.id}/${lang}: missing marked visible hero image`);
        continue;
      }

      const expectedImageUrl = image.src?.startsWith('http')
        ? image.src
        : `${SITE_ORIGIN}${image.src || ''}`;
      if (!image.alt?.trim()) errors.push(`${symbol.id}/${lang}: empty hero alt text`);
      if (image.width !== '1200' || !Number(image.height)) {
        errors.push(`${symbol.id}/${lang}: missing 1200px intrinsic hero dimensions`);
      }
      if (image.fetchpriority !== 'high') {
        errors.push(`${symbol.id}/${lang}: hero must use fetchpriority=high`);
      }
      if (image.loading?.toLowerCase() === 'lazy') {
        errors.push(`${symbol.id}/${lang}: above-the-fold hero must not be lazy-loaded`);
      }
      for (const width of [480, 800, 1200]) {
        if (!image.srcset?.includes(`${width}w`)) {
          errors.push(`${symbol.id}/${lang}: srcset missing ${width}w variant`);
        }
      }

      const ogImage = readMeta(html, 'property', 'og:image');
      const twitterImage = readMeta(html, 'name', 'twitter:image');
      const articleImage = extractArticleImage(html);
      const sitemapImage = sitemapImageForPage(sitemap, pageUrl);
      for (const [surface, value] of [
        ['Open Graph', ogImage],
        ['Twitter', twitterImage],
        ['Article JSON-LD', articleImage],
        ['image sitemap', sitemapImage],
      ]) {
        if (value !== expectedImageUrl) {
          errors.push(
            `${symbol.id}/${lang}: ${surface} image mismatch (${value || 'missing'} != ${expectedImageUrl})`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid rendered symbol image contract:\n- ${errors.join('\n- ')}`);
  }

  console.log(
    `Rendered symbol image contract checked: ${pagesChecked} pages, visible hero + social + JSON-LD + sitemap.`
  );
}

if (require.main === module) {
  validateSymbolImageContract();
}

module.exports = {
  extractArticleImage,
  extractHeroImage,
  parseAttributes,
  readMeta,
  sitemapImageForPage,
  validateSymbolImageContract,
};
