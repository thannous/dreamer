const fs = require('fs');
const path = require('path');
const {
  getResponsiveImageData,
  readImageAssetRegistry,
} = require('./image-seo-assets');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(REPO_ROOT, 'docs-src', 'config', 'page-illustrations.json');
const SITE_MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'site-manifest.json');
const SUPPORTED_LANGS = ['en', 'fr', 'es', 'de', 'it'];

const ALT_TEMPLATES = {
  en: (title) => `Dreamlike editorial illustration for ${title}`,
  fr: (title) => `Illustration éditoriale onirique pour « ${title} »`,
  es: (title) => `Ilustración editorial onírica para «${title}»`,
  de: (title) => `Traumhafte redaktionelle Illustration zu „${title}“`,
  it: (title) => `Illustrazione editoriale onirica per «${title}»`,
};

const CAPTION_TEMPLATES = {
  en: (title) => `A Noctalia editorial scene exploring ${title}.`,
  fr: (title) => `Une scène éditoriale Noctalia autour de « ${title} ».`,
  es: (title) => `Una escena editorial de Noctalia sobre «${title}».`,
  de: (title) => `Eine redaktionelle Noctalia-Szene zu „${title}“.`,
  it: (title) => `Una scena editoriale di Noctalia dedicata a «${title}».`,
};

let cachedConfig;
let cachedRegistry;
let cachedManifest;

function cleanTitle(value) {
  return String(value || 'Noctalia')
    .replace(/\s*[|–—-]\s*Noctalia\s*$/i, '')
    .trim();
}

function readPageIllustrationConfig() {
  if (cachedConfig) return cachedConfig;
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (config?.schemaVersion !== 1 || !config?.release || !config?.families) {
    throw new Error('Invalid page illustration config');
  }
  cachedConfig = config;
  return config;
}

function buildSitewideAsset(pageId, stem, release) {
  const assetId = `sitewide.${pageId}`;
  return [assetId, {
    role: 'editorial',
    source: `docs-src/static/img/seo/${release}/masters/${stem}.png`,
    outputStem: `/img/seo/${release}/editorial/${stem}`,
    formats: ['avif', 'webp'],
    fallbackFormat: 'webp',
    visible: true,
    sitemap: true,
    aspects: {
      '16x9': {
        width: 1200,
        height: 675,
        widths: [480, 800, 1200],
        mode: 'cover',
        position: { x: 50, y: 50 },
      },
      '4x5': {
        width: 800,
        height: 1000,
        widths: [480, 800],
        mode: 'cover',
        position: { x: 50, y: 50 },
      },
    },
  }];
}

function readCompleteImageAssetRegistry() {
  if (cachedRegistry) return cachedRegistry;
  const base = readImageAssetRegistry();
  const config = readPageIllustrationConfig();
  const assets = Object.fromEntries(
    Object.entries(config.families).map(([pageId, stem]) =>
      buildSitewideAsset(pageId, stem, config.release)
    )
  );
  cachedRegistry = {
    ...base,
    assets: { ...base.assets, ...assets },
  };
  return cachedRegistry;
}

function getPageIllustration(pageId, lang, title) {
  const config = readPageIllustrationConfig();
  const stem = config.families[pageId];
  if (!stem) return null;
  const locale = SUPPORTED_LANGS.includes(lang) ? lang : 'en';
  const localizedTitle = cleanTitle(title);
  const registry = readCompleteImageAssetRegistry();
  const assetId = `sitewide.${pageId}`;
  const ref = {
    assetId,
    aspect: '16x9',
    mobileAspect: '4x5',
    mobileBreakpoint: '640px',
    alt: ALT_TEMPLATES[locale](localizedTitle),
    caption: CAPTION_TEMPLATES[locale](localizedTitle),
  };
  return {
    pageId,
    locale,
    registry,
    ref,
    image: {
      ...ref,
      ...getResponsiveImageData(registry, assetId, ref.aspect),
    },
  };
}

function readSiteManifest() {
  if (!cachedManifest) cachedManifest = JSON.parse(fs.readFileSync(SITE_MANIFEST_PATH, 'utf8'));
  return cachedManifest;
}

function getManifestEntry(pageId, manifest = readSiteManifest()) {
  for (const collection of Object.values(manifest.collections || {})) {
    const entry = collection?.entries?.[pageId];
    if (entry) return entry;
  }
  return null;
}

function listPageIllustrationRoutes(manifest = readSiteManifest()) {
  const config = readPageIllustrationConfig();
  const routes = [];
  for (const pageId of Object.keys(config.families)) {
    const entry = getManifestEntry(pageId, manifest);
    if (!entry) throw new Error(`Missing site manifest entry for ${pageId}`);
    for (const lang of SUPPORTED_LANGS) {
      const pagePath = entry.locales?.[lang]?.path;
      if (!pagePath) throw new Error(`Missing ${lang} route for ${pageId}`);
      routes.push({ pageId, lang, path: pagePath });
    }
  }
  return routes;
}

module.exports = {
  CONFIG_PATH,
  SUPPORTED_LANGS,
  getManifestEntry,
  getPageIllustration,
  listPageIllustrationRoutes,
  readCompleteImageAssetRegistry,
  readPageIllustrationConfig,
};
