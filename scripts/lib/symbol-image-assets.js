'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./docs-site-config');

const REGISTRY_PATH = path.join(
  ROOT_DIR,
  'docs-src',
  'config',
  'symbol-image-assets.json'
);
const SYMBOL_CARD_RESPONSIVE_WIDTHS = Object.freeze([240, 480, 800, 1200]);
const SYMBOL_DETAIL_RESPONSIVE_WIDTHS = Object.freeze([480, 800, 1200, 1600]);
const SYMBOL_RESPONSIVE_WIDTHS = Object.freeze([
  ...new Set([
    ...SYMBOL_CARD_RESPONSIVE_WIDTHS,
    ...SYMBOL_DETAIL_RESPONSIVE_WIDTHS,
  ]),
]);
// Cards crop the 16:9 art with object-fit: cover, so the rendered width follows the
// box height: a 9.5rem square on mobile (~17rem wide), a full-height column (~24.5rem)
// on desktop (~44rem wide).
const SYMBOL_CARD_IMAGE_SIZES = '(max-width: 767px) 17rem, 44rem';

function loadSymbolImageRegistry(registryPath = REGISTRY_PATH) {
  if (!fs.existsSync(registryPath)) {
    return {
      version: null,
      responsiveBase: '/img/seo/symbols-v1',
      assets: {},
    };
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  return {
    ...registry,
    assets: registry.assets || {},
  };
}

function getGeneratedSymbolImage(symbolId, registry = loadSymbolImageRegistry()) {
  return registry.assets?.[symbolId] || null;
}

function generatedSymbolImagePath(asset) {
  return asset?.src
    ? path.join(ROOT_DIR, 'docs-src', 'static', asset.src.replace(/^\/+/, ''))
    : null;
}

function buildResponsiveSymbolImage(
  asset,
  {
    fallbackWidth,
    registry = loadSymbolImageRegistry(),
    staticDir = path.join(ROOT_DIR, 'docs-src', 'static'),
    widths = SYMBOL_DETAIL_RESPONSIVE_WIDTHS,
  } = {}
) {
  if (!asset?.src || !Array.isArray(widths) || widths.length === 0) return null;

  const originalWidth = Number(asset.width) || 1200;
  const originalHeight = Number(asset.height) || 675;
  const availableWidths = widths.filter((width) => width <= originalWidth);
  const selectedFallbackWidth = fallbackWidth || availableWidths[availableWidths.length - 1];
  const stem = path.basename(asset.src, path.extname(asset.src));
  const responsiveBase = registry.responsiveBase || '/img/seo/symbols-v2';
  const variants = availableWidths.map((width) => {
    const url = `${responsiveBase}/${stem}-${width}w.webp`;
    return {
      filePath: path.join(staticDir, url.replace(/^\/+/, '')),
      height: Math.round((originalHeight / originalWidth) * width),
      url,
      width,
    };
  });
  const fallback = variants.find(
    (variant) => variant.width === selectedFallbackWidth
  );

  if (!fallback || !variants.every((variant) => fs.existsSync(variant.filePath))) {
    return null;
  }

  return {
    height: fallback.height,
    src: fallback.url,
    srcset: variants
      .map((variant) => `${variant.url} ${variant.width}w`)
      .join(', '),
    variants,
    width: fallback.width,
  };
}

module.exports = {
  REGISTRY_PATH,
  SYMBOL_CARD_IMAGE_SIZES,
  SYMBOL_CARD_RESPONSIVE_WIDTHS,
  SYMBOL_DETAIL_RESPONSIVE_WIDTHS,
  SYMBOL_RESPONSIVE_WIDTHS,
  buildResponsiveSymbolImage,
  generatedSymbolImagePath,
  getGeneratedSymbolImage,
  loadSymbolImageRegistry,
};
