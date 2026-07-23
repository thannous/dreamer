#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const {
  DATA_DIR,
  DOCS_DIR,
  STATIC_DATA_DIR,
  siteConfig,
} = require('./lib/docs-site-config');
const {
  SYMBOL_CARD_IMAGE_SIZES,
  SYMBOL_CARD_RESPONSIVE_WIDTHS,
  loadSymbolImageRegistry,
} = require('./lib/symbol-image-assets');

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

function extractSymbolCardImages(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((match) => parseAttributes(match[0]))
    .filter((attributes) =>
      String(attributes.class || '')
        .split(/\s+/)
        .includes('symbol-card-image')
    );
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
  const symbolI18n = JSON.parse(
    fs.readFileSync(path.join(STATIC_DATA_DIR, 'symbol-i18n.json'), 'utf8')
  );
  const responsiveBase =
    loadSymbolImageRegistry().responsiveBase || '/img/seo/symbols-v2';
  const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const errors = [];
  const imageBySymbol = new Map();
  const symbolByImage = new Map();
  let pagesChecked = 0;
  let dictionaryCardsChecked = 0;
  let expectedDictionarySources = null;

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
      if (!image.src?.includes('/img/seo/symbols-v2/')) {
        errors.push(`${symbol.id}/${lang}: hero does not use the symbols-v2 image family`);
      }
      const existingImage = imageBySymbol.get(symbol.id);
      if (existingImage && existingImage !== expectedImageUrl) {
        errors.push(`${symbol.id}/${lang}: localized pages do not share one stable image`);
      }
      imageBySymbol.set(symbol.id, expectedImageUrl);

      const existingSymbol = symbolByImage.get(expectedImageUrl);
      if (existingSymbol && existingSymbol !== symbol.id) {
        errors.push(
          `${symbol.id}/${lang}: shares its hero image with symbol ${existingSymbol}`
        );
      }
      symbolByImage.set(expectedImageUrl, symbol.id);
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

  for (const lang of siteConfig.languages) {
    const dictionarySlug = symbolI18n[lang]?.dictionary_slug;
    const relativePagePath = path.join(
      lang,
      'guides',
      `${dictionarySlug || 'missing-dictionary-slug'}.html`
    );
    const pagePath = path.join(DOCS_DIR, relativePagePath);
    if (!dictionarySlug || !fs.existsSync(pagePath)) {
      errors.push(`${lang}: missing dictionary page ${relativePagePath}`);
      continue;
    }

    const images = extractSymbolCardImages(fs.readFileSync(pagePath, 'utf8'));
    if (images.length !== catalog.symbols.length) {
      errors.push(
        `${lang}: dictionary has ${images.length} card images (expected ${catalog.symbols.length})`
      );
    }

    const sources = new Set();
    for (const [index, image] of images.entries()) {
      const label = `${lang}: dictionary card ${index + 1}`;
      dictionaryCardsChecked += 1;
      if (!image.src?.startsWith(`${responsiveBase}/`) || !image.src.endsWith('-240w.webp')) {
        errors.push(`${label}: fallback src is not a 240w responsive symbol image`);
      }
      if (image.width !== '240' || !Number(image.height)) {
        errors.push(`${label}: missing 240px intrinsic fallback dimensions`);
      }
      if (image.sizes !== SYMBOL_CARD_IMAGE_SIZES) {
        errors.push(`${label}: invalid sizes attribute`);
      }
      if (image.loading !== 'lazy') {
        errors.push(`${label}: below-the-fold thumbnail must use loading=lazy`);
      }
      if (!image.alt?.trim()) {
        errors.push(`${label}: empty alt text`);
      }
      for (const width of SYMBOL_CARD_RESPONSIVE_WIDTHS) {
        if (!image.srcset?.includes(`${width}w`)) {
          errors.push(`${label}: srcset missing ${width}w variant`);
        }
      }
      if (image.src) sources.add(image.src);
    }

    if (sources.size !== catalog.symbols.length) {
      errors.push(
        `${lang}: dictionary has ${sources.size} unique card sources (expected ${catalog.symbols.length})`
      );
    }
    const normalizedSources = [...sources].sort();
    if (
      expectedDictionarySources &&
      JSON.stringify(normalizedSources) !== JSON.stringify(expectedDictionarySources)
    ) {
      errors.push(`${lang}: dictionary card sources differ across locales`);
    }
    expectedDictionarySources ||= normalizedSources;
  }

  if (errors.length > 0) {
    throw new Error(`Invalid rendered symbol image contract:\n- ${errors.join('\n- ')}`);
  }

  console.log(
    `Rendered symbol image contract checked: ${pagesChecked} detail pages, ` +
      `${dictionaryCardsChecked} dictionary cards, visible hero + social + JSON-LD + sitemap.`
  );
}

if (require.main === module) {
  validateSymbolImageContract();
}

module.exports = {
  extractArticleImage,
  extractHeroImage,
  extractSymbolCardImages,
  parseAttributes,
  readMeta,
  sitemapImageForPage,
  validateSymbolImageContract,
};
