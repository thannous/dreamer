#!/usr/bin/env node
/**
 * Dream Symbol Pages Generator
 *
 * Generates the full dream-symbol page family in each language:
 * individual symbol pages, category pages, and curated guide pages.
 * using the data from dream-symbols.json and symbol-i18n.json
 *
 * Usage:
 *   node scripts/generate-symbol-pages.js             # All symbol pages
 *   node scripts/generate-symbol-pages.js --priority=1  # Only priority 1 symbols
 *   node scripts/generate-symbol-pages.js --id=tiger --lang=fr  # Fast single-page preview
 *   node scripts/generate-symbol-pages.js --lang=en     # Only English
 *   node scripts/generate-symbol-pages.js --categories  # Only category pages
 *   node scripts/generate-symbol-pages.js --curation    # Only curated guide pages
 *   node scripts/generate-symbol-pages.js --dry-run     # Preview without writing
 */

const crypto = require('crypto');
const fs = require('fs');
const { conversionLinkAttributes } = require('../../scripts/lib/docs-components/conversion-link');
const path = require('path');
const { createRenderContext } = require('../../scripts/lib/docs-components/context');
const { getAndroidStoreUrl, getCollectionLanguages, getLanguageTag, getWebAppUrl, loadLocales, siteConfig } = require('../../scripts/lib/docs-site-config');
const { aliasWebLocales, catalogKey } = require('../../scripts/lib/symbol-locales');
const { renderFooter: renderSharedFooter } = require('../../scripts/lib/docs-components/footer');
const { renderNavigation } = require('../../scripts/lib/docs-components/navigation');
const { renderSharedComponentStyles } = require('../../scripts/lib/docs-components/styles');
const { inlineLucideIcons } = require('../../scripts/lib/lucide-inline');
const { canonicalOrganization } = require('../../scripts/lib/canonical-organization');
const { renderAhrefsAnalyticsScript } = require('../../scripts/lib/ahrefs-analytics');
const { renderResponsivePicture } = require('../../scripts/lib/image-seo-assets');
const { getPageIllustration } = require('../../scripts/lib/page-illustrations');
const {
  SYMBOL_DETAIL_RESPONSIVE_WIDTHS,
  buildResponsiveSymbolImage,
  getGeneratedSymbolImage,
  loadSymbolImageRegistry,
} = require('../../scripts/lib/symbol-image-assets');

function readDocsAssetVersionOrExit() {
  const versionPath = path.join(__dirname, '..', 'version.txt');
  if (!fs.existsSync(versionPath)) {
    console.error('Missing `docs/version.txt` (needed for cache-busting).');
    process.exit(1);
  }

  const version = fs.readFileSync(versionPath, 'utf8').trim();
  if (!version) {
    console.error('Empty `docs/version.txt` (needed for cache-busting).');
    process.exit(1);
  }

  return version;
}

const DOCS_ASSET_VERSION = readDocsAssetVersionOrExit();
const ROOT_DIR = path.join(__dirname, '..', '..');
const DOCS_SRC_DIR = path.join(ROOT_DIR, 'docs-src');
const ROOT_DATA_DIR = path.join(ROOT_DIR, 'data');
const SITE_MANIFEST_PATH = path.join(ROOT_DATA_DIR, 'site-manifest.json');
const DEFAULT_SOCIAL_IMAGE = 'https://noctalia.app/img/og/noctalia-dreamscape-v2-1200x630.jpg';
const SYMBOL_IMAGE_REGISTRY = loadSymbolImageRegistry();

function renderPseoHeroIllustration(illustration) {
  if (!illustration) return '';
  const picture = renderResponsivePicture(illustration.registry, illustration.ref, {
    figure: false,
    priority: true,
    sizes: '100vw',
    mobileSizes: '100vw',
  });
  return `<figure class="pseo-hero-illustration" data-image-seo-role="editorial" data-image-asset-id="${escapeHtml(illustration.image.assetId)}">
                ${picture}
                <figcaption>${escapeHtml(illustration.ref.caption)}</figcaption>
            </figure>`;
}

function resolveResponsiveSymbolIllustration(illustration) {
  if (!illustration?.src) return null;

  const originalWidth = Number(illustration.width) || 1200;
  const originalHeight = Number(illustration.height) || 675;
  const responsive = buildResponsiveSymbolImage(illustration, {
    fallbackWidth: 1200,
    registry: SYMBOL_IMAGE_REGISTRY,
    widths: SYMBOL_DETAIL_RESPONSIVE_WIDTHS,
  });

  if (!responsive) {
    return {
      src: illustration.src,
      srcset: '',
      width: originalWidth,
      height: originalHeight,
    };
  }

  // AVIF siblings come from scripts/generate-symbol-avif-images.js; the hero
  // offers them only when every width exists.
  const avifVariants = responsive.variants.map((variant) => ({
    filePath: variant.filePath.replace(/\.webp$/, '.avif'),
    url: variant.url.replace(/\.webp$/, '.avif'),
    width: variant.width,
  }));
  const avifSrcset = avifVariants.every((variant) => fs.existsSync(variant.filePath))
    ? avifVariants.map((variant) => `${variant.url} ${variant.width}w`).join(', ')
    : '';
  return { ...responsive, avifSrcset };
}

function readCatalogModifiedDate(fallbackDate) {
  const catalogPath = path.join(ROOT_DATA_DIR, 'dream-symbols.json');
  try {
    const payload = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    return normalizeIsoDate(payload?.meta?.fallbackModifiedAt) ||
      normalizeIsoDate(payload?.meta?.lastUpdated) || fallbackDate;
  } catch {
    return fallbackDate;
  }
}

function finalizeGeneratedHtml(html) {
  return inlineLucideIcons(html);
}

function normalizeIsoDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/);
  return match ? match[1] : null;
}

function extractGeneratedModifiedDate(html) {
  const metaMatch = html.match(/<meta\s+property="article:modified_time"\s+content="(\d{4}-\d{2}-\d{2})(?:[T\s][^"]*)?">/);
  if (metaMatch) return metaMatch[1];

  const jsonLdMatch = html.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})(?:[T\s][^"]*)?"/);
  return jsonLdMatch ? jsonLdMatch[1] : null;
}

function replaceGeneratedModifiedDate(html, date) {
  return html
    .replace(
      /(<meta\s+property="article:modified_time"\s+content=")\d{4}-\d{2}-\d{2}([^"]*">)/g,
      `$1${date}$2`
    )
    .replace(/("dateModified"\s*:\s*")\d{4}-\d{2}-\d{2}([^"]*")/g, `$1${date}$2`);
}

function writeGeneratedHtml(filepath, html, options = {}) {
  const {
    preserveDateOnlyChanges = true,
    preserveExistingModifiedDate = false,
  } = options;
  let nextHtml = finalizeGeneratedHtml(html);

  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, nextHtml, 'utf8');
    return;
  }

  const currentHtml = fs.readFileSync(filepath, 'utf8');
  const currentModifiedDate = extractGeneratedModifiedDate(currentHtml);

  if (preserveExistingModifiedDate && currentModifiedDate) {
    nextHtml = replaceGeneratedModifiedDate(nextHtml, currentModifiedDate);
  }

  if (currentHtml === nextHtml) {
    return;
  }

  if (preserveDateOnlyChanges && currentModifiedDate) {
    const nextWithCurrentDate = replaceGeneratedModifiedDate(nextHtml, currentModifiedDate);
    if (nextWithCurrentDate === currentHtml) {
      return;
    }
  }

  fs.writeFileSync(filepath, nextHtml, 'utf8');
}

function localizedHomePath(lang) {
  return lang === 'en' ? '/' : `/${lang}/`;
}

function localizedHomeUrl(lang) {
  return lang === 'en' ? 'https://noctalia.app/' : `https://noctalia.app/${lang}/`;
}

// Configuration
const CONFIG = {
  dataDir: path.join(__dirname, '..', 'data'),
  outputDir: path.join(__dirname, '..'),
  symbolsFile: 'dream-symbols.json',
  i18nFile: 'symbol-i18n.json',
  extendedFile: 'dream-symbols-extended.json',
  extendedTier3File: 'dream-symbols-extended-tier3.json',
  // The symbol collection's languages and paths (docs-src/config/site.config.json). Web locales
  // read their catalog block through scripts/lib/symbol-locales.js (pt-br reads pt).
  languages: getCollectionLanguages('symbols'),
  symbolsPath: siteConfig.symbolsPath,
  datePublished: '2025-01-21',
  // Explicit editorial source date; release gates require this to move with
  // substantive catalog changes instead of inferring freshness from Git.
  dateModified: readCatalogModifiedDate('2025-01-21'),
  cssVersion: DOCS_ASSET_VERSION
};

const SYMBOL_SHEET_LABELS = {
  en: {
    jumpNav: 'Symbol sections',
    meaning: 'Meaning',
    variations: 'Variations',
    questions: 'Questions'
  },
  fr: {
    jumpNav: 'Sections du symbole',
    meaning: 'Sens',
    variations: 'Variantes',
    questions: 'Questions'
  },
  es: {
    jumpNav: 'Secciones del símbolo',
    meaning: 'Sentido',
    variations: 'Variantes',
    questions: 'Preguntas'
  },
  de: {
    jumpNav: 'Symbolabschnitte',
    meaning: 'Bedeutung',
    variations: 'Varianten',
    questions: 'Fragen'
  },
  it: {
    jumpNav: 'Sezioni del simbolo',
    meaning: 'Significato',
    variations: 'Varianti',
    questions: 'Domande'
  },
  'pt-br': {
    jumpNav: 'Seções do símbolo',
    meaning: 'Sentido',
    variations: 'Variações',
    questions: 'Perguntas'
  }
};

const SYMBOL_IMAGE_ALT_TEMPLATES = {
  de: (name) => `Traumhafte Illustration des Symbols ${name}`,
  en: (name) => `Dreamlike illustration representing the symbol ${name}`,
  es: (name) => `Ilustración onírica que representa el símbolo ${name}`,
  fr: (name) => `Illustration onirique représentant le symbole ${name}`,
  it: (name) => `Illustrazione onirica che rappresenta il simbolo ${name}`,
  'pt-br': (name) => `Ilustração onírica que representa o símbolo ${name}`,
};

const SYMBOL_IMAGE_CAPTION_TEMPLATES = {
  de: (name) => `Visuelle Darstellung des Traumsymbols ${name}.`,
  en: (name) => `Visual representation of the dream symbol ${name}.`,
  es: (name) => `Representación visual del símbolo onírico ${name}.`,
  fr: (name) => `Représentation visuelle du symbole onirique ${name}.`,
  it: (name) => `Rappresentazione visiva del simbolo onirico ${name}.`,
  'pt-br': (name) => `Representação visual do símbolo onírico ${name}.`,
};

function resolveSymbolIllustration(symbolId, explicitIllustration, symbolData, lang) {
  if (explicitIllustration?.src) return explicitIllustration;

  const generatedAsset = getGeneratedSymbolImage(symbolId, SYMBOL_IMAGE_REGISTRY);
  const src = generatedAsset?.src || `/img/symbols/posters-v1/${symbolId}.webp`;
  const filePath = path.join(__dirname, '..', src.replace(/^\/+/, ''));
  if (!fs.existsSync(filePath)) return null;

  const altTemplate = SYMBOL_IMAGE_ALT_TEMPLATES[lang] || SYMBOL_IMAGE_ALT_TEMPLATES.en;
  const captionTemplate =
    SYMBOL_IMAGE_CAPTION_TEMPLATES[lang] || SYMBOL_IMAGE_CAPTION_TEMPLATES.en;
  return {
    src,
    width: Number(generatedAsset?.width) || 1200,
    height: Number(generatedAsset?.height) || 675,
    alt: altTemplate(symbolData.name),
    caption: captionTemplate(symbolData.name),
  };
}

function getSymbolSheetLabels(lang) {
  return SYMBOL_SHEET_LABELS[lang] || SYMBOL_SHEET_LABELS.en;
}

function getSymbolModifiedDate(symbol, lang) {
  return (
    normalizeIsoDate(symbol?.[lang]?.modifiedAt) ||
    normalizeIsoDate(symbol?.modifiedAt) ||
    CONFIG.dateModified
  );
}

function hasExplicitSymbolModifiedDate(symbol, lang) {
  return Boolean(normalizeIsoDate(symbol?.[lang]?.modifiedAt) || normalizeIsoDate(symbol?.modifiedAt));
}

function loadSharedSiteConfig() {
  const configPath = path.join(DOCS_SRC_DIR, 'config', 'site.config.json');
  if (!fs.existsSync(configPath)) {
    return { seoLinking: { featuredBlogEntries: [], featuredGuideEntries: [], featuredSymbols: [] } };
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function stripSiteSuffix(title) {
  return String(title || '').replace(/\s*\|\s*Noctalia\s*$/i, '').trim();
}

function parseSourceDocument(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  return {
    meta: JSON.parse(match[1]),
    body: match[2]
  };
}

const SHARED_SITE_CONFIG = loadSharedSiteConfig();
// Shared UI strings (docs-src/locales) for the web-app CTA rendered on every
// symbol, category and curated-guide page.
const SHARED_LOCALES = loadLocales();

function getSymbolCtaUrl(lang) {
  const paths = {
    en: '/en/ai-dream-interpretation-app',
    fr: '/fr/application-interpretation-reves-ia',
    es: '/es/app-interpretacion-suenos-ia',
    de: '/de/ki-traumdeutung-app',
    it: '/it/app-interpretazione-sogni-ai',
    'pt-br': '/pt-br/app-interpretacao-de-sonhos-ia',
  };

  return paths[lang] || paths.en;
}

const SYMBOL_CONVERSION_COPY = {
  en: { store: 'Get Noctalia on Google Play', details: 'See how Noctalia adds your context' },
  fr: { store: 'Télécharger Noctalia sur Google Play', details: 'Voir comment Noctalia relie votre contexte' },
  es: { store: 'Descargar Noctalia en Google Play', details: 'Ver cómo Noctalia añade tu contexto' },
  de: { store: 'Noctalia bei Google Play herunterladen', details: 'So bezieht Noctalia deinen Kontext ein' },
  it: { store: 'Scarica Noctalia su Google Play', details: 'Scopri come Noctalia usa il tuo contesto' },
  'pt-br': { store: 'Baixar o Noctalia no Google Play', details: 'Veja como o Noctalia considera o seu contexto' },
};

// `content` identifies the page family entry (canonical symbol id, or a
// `category-`/`guide-` prefixed id) so web-app clicks can be attributed per
// landing page independently of the localized slug.
function renderSymbolConversionActions(lang, content, pagePath = '') {
  const copy = SYMBOL_CONVERSION_COPY[lang] || SYMBOL_CONVERSION_COPY.en;
  const sharedLocale = SHARED_LOCALES[lang] || SHARED_LOCALES.en;
  const webAppHref = getWebAppUrl(lang, { medium: 'symbol_page', content });
  return `<div class="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
                    <a${conversionLinkAttributes(pagePath, 'final', 'web')} href="${webAppHref}" class="symbol-webapp-cta inline-flex items-center justify-center gap-2 px-8 py-4 bg-dream-salmon text-dream-dark rounded-full font-bold hover:bg-dream-salmon/90 transition-colors" rel="noopener">
                        ${escapeHtml(sharedLocale.webAppCta)} <i data-lucide="arrow-right" class="w-5 h-5"></i>
                    </a>
                    <a${conversionLinkAttributes(pagePath, 'final', 'play')} href="${getAndroidStoreUrl(lang)}" class="inline-flex items-center justify-center gap-2 px-8 py-4 bg-dream-salmon text-dream-dark rounded-full font-bold hover:bg-dream-salmon/90 transition-colors" rel="nofollow noopener noreferrer" target="_blank">
                        ${escapeHtml(copy.store)} <i data-lucide="external-link" class="w-5 h-5"></i>
                    </a>
                    <a href="${getSymbolCtaUrl(lang)}" class="inline-flex items-center justify-center gap-2 px-8 py-4 glass-button text-dream-cream rounded-full font-bold hover:border-dream-salmon/40 transition-colors">
                        ${escapeHtml(copy.details)} <i data-lucide="arrow-right" class="w-5 h-5"></i>
                    </a>
                </div>
                <p class="symbol-webapp-note text-xs mt-3 max-w-lg mx-auto">${escapeHtml(sharedLocale.webAppNote)}</p>`;
}

function loadSiteManifest() {
  return JSON.parse(fs.readFileSync(SITE_MANIFEST_PATH, 'utf8'));
}

// Localized blog slug → article title (minus the "| Noctalia" suffix), so
// related-article links can name their destination.
const BLOG_TITLES_BY_LANG = new Map();
function getBlogTitleBySlug(lang, slug) {
  if (!BLOG_TITLES_BY_LANG.has(lang)) {
    const map = new Map();
    const entries = loadSiteManifest().collections?.blog?.entries || {};
    for (const [id, entry] of Object.entries(entries)) {
      const localeSlug = entry.locales?.[lang]?.slug;
      if (!localeSlug) continue;
      const filePath = path.join(DOCS_SRC_DIR, 'content', 'blog', id, `${lang}.md`);
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8');
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) continue;
      try {
        const title = String(JSON.parse(match[1])?.title || '')
          .replace(/\s*[|\-–—]\s*Noctalia\s*$/i, '')
          .trim();
        if (title) map.set(localeSlug, title);
      } catch {
        // Unreadable frontmatter: links fall back to the generic label.
      }
    }
    BLOG_TITLES_BY_LANG.set(lang, map);
  }
  return BLOG_TITLES_BY_LANG.get(lang).get(String(slug || '').split('#')[0]) || null;
}

function getRelatedGuidePage(symbol) {
  if (!symbol?.relatedGuide) return null;
  return OPTIONAL_CURATION_PAGES.find((page) => page.id === symbol.relatedGuide) || null;
}

function createGeneratedShellContext(lang, currentPaths, activeNav = 'dictionary') {
  const locales = Object.fromEntries(
    CONFIG.languages.map((candidate) => [
      candidate,
      { path: currentPaths[candidate] || `/${candidate}/` },
    ])
  );

  return createRenderContext({
    manifest: loadSiteManifest(),
    entryId: 'page.home',
    meta: {
      lang,
      layout: 'generated',
      activeNav,
    },
    entryOverride: {
      id: `generated.${activeNav}`,
      locales,
    },
  });
}

function renderPseoNav(lang, currentPaths, activeNav = 'dictionary') {
  return renderNavigation(createGeneratedShellContext(lang, currentPaths, activeNav));
}

function renderPseoFooter(lang, currentPaths, activeNav = 'dictionary') {
  return renderSharedFooter(createGeneratedShellContext(lang, currentPaths, activeNav));
}

const GUIDES_HUB_LABELS = {
  en: 'Dream Guides',
  fr: 'Guides des rêves',
  es: 'Guías de sueños',
  de: 'Traumratgeber',
  it: 'Guide ai sogni'
};

const CURATION_META_TITLE_OVERRIDES = {
  'most-common-dream-symbols': {
    fr: '20 symboles de rêves courants'
  },
  'scary-dream-symbols': {
    fr: 'Symboles de rêves effrayants',
    es: 'Símbolos de sueños aterradores',
    de: 'Angsteinflößende Traumsymbole',
    it: 'Simboli dei sogni spaventosi'
  },
  'positive-dream-symbols': {
    fr: 'Symboles de rêves positifs',
    es: 'Símbolos de sueños positivos',
    de: 'Positive Traumsymbole',
    it: 'Simboli dei sogni positivi'
  },
  'animal-dream-symbols': {
    fr: "Symboles de rêves d'animaux",
    es: 'Símbolos de sueños con animales',
    it: 'Simboli dei sogni con animali'
  },
  'water-dream-symbols': {
    fr: "Symboles de rêves d'eau",
    es: 'Símbolos de sueños con agua',
    it: 'Simboli dei sogni con acqua'
  },
  'death-transformation-dreams': {
    en: 'Death & Transformation in Dreams',
    fr: 'Mort et transformation dans les rêves',
    es: 'Muerte y transformación en los sueños',
    de: 'Tod und Verwandlung in Träumen',
    it: 'Morte e trasformazione nei sogni'
  },
  'people-in-dreams': {
    fr: 'Les personnes dans les rêves',
    de: 'Menschen in Träumen'
  },
  'dream-locations': {
    fr: 'Les lieux dans les rêves',
    es: 'Lugares en los sueños: significado',
    it: 'Luoghi nei sogni: significato'
  }
};

const DICTIONARY_NAV_LABELS = {
  en: 'Dream Dictionary',
  fr: 'Dictionnaire des rêves',
  es: 'Diccionario de sueños',
  de: 'Traumlexikon',
  it: 'Dizionario dei sogni'
};

const POPULAR_SYMBOLS_LABELS = {
  en: 'Popular Symbols',
  fr: 'Symboles populaires',
  es: 'Símbolos populares',
  de: 'Beliebte Symbole',
  it: 'Simboli popolari'
};

function loadOptionalCurationPages() {
  const curationPath = path.join(CONFIG.dataDir, 'curation-pages.json');
  if (!fs.existsSync(curationPath)) return [];
  const data = JSON.parse(fs.readFileSync(curationPath, 'utf8'));
  return Array.isArray(data?.pages) ? data.pages.map(aliasCurationPage) : [];
}

const OPTIONAL_CURATION_PAGES = loadOptionalCurationPages();

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});
if (args.lang && !CONFIG.languages.includes(args.lang)) {
  throw new Error(`Unsupported --lang: ${args.lang}. Expected ${CONFIG.languages.join(', ')}.`);
}

// Load data files
function loadData() {
  const symbolsPath = path.join(CONFIG.dataDir, CONFIG.symbolsFile);
  const i18nPath = path.join(CONFIG.dataDir, CONFIG.i18nFile);
  const extendedPath = path.join(CONFIG.dataDir, CONFIG.extendedFile);
  const extendedTier3Path = path.join(CONFIG.dataDir, CONFIG.extendedTier3File);

  const symbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
  const i18n = JSON.parse(fs.readFileSync(i18nPath, 'utf8'));

  // Load extended data if available
  let extendedPrimary = { symbols: {} };
  if (fs.existsSync(extendedPath)) {
    extendedPrimary = JSON.parse(fs.readFileSync(extendedPath, 'utf8'));
  }

  // Tier3 fallback mirrors Expo app behavior.
  let extendedTier3 = {};
  if (fs.existsSync(extendedTier3Path)) {
    extendedTier3 = JSON.parse(fs.readFileSync(extendedTier3Path, 'utf8'));
  }

  // Web locales read their catalog block (pt-br reads pt), in memory only.
  (symbols.symbols || []).forEach(aliasWebLocales);
  Object.values(symbols.categories || {}).forEach(aliasWebLocales);
  Object.values(extendedPrimary.symbols || {}).forEach(aliasWebLocales);
  Object.values(extendedTier3 || {}).forEach(aliasWebLocales);

  return {
    symbols,
    i18n,
    extended: {
      primary: extendedPrimary,
      tier3: extendedTier3
    }
  };
}

// A curation page (docs-src/static/data/curation-pages.json) with its web-locale aliases.
function aliasCurationPage(page) {
  aliasWebLocales(page);
  aliasWebLocales(page?.slugs);
  return page;
}

// Get category name for a symbol
function getCategoryName(symbol, i18n, lang) {
  const categories = {
    nature: { en: 'Nature', fr: 'Nature', es: 'Naturaleza', de: 'Natur', it: 'Natura', 'pt-br': 'Natureza' },
    animals: { en: 'Animals', fr: 'Animaux', es: 'Animales', de: 'Tiere', it: 'Animali', 'pt-br': 'Animais' },
    body: { en: 'Body', fr: 'Corps', es: 'Cuerpo', de: 'Körper', it: 'Corpo', 'pt-br': 'Corpo' },
    places: { en: 'Places', fr: 'Lieux', es: 'Lugares', de: 'Orte', it: 'Luoghi', 'pt-br': 'Lugares' },
    objects: { en: 'Objects', fr: 'Objets', es: 'Objetos', de: 'Objekte', it: 'Oggetti', 'pt-br': 'Objetos' },
    actions: { en: 'Actions', fr: 'Actions', es: 'Acciones', de: 'Handlungen', it: 'Azioni', 'pt-br': 'Ações' },
    people: { en: 'People', fr: 'Personnes', es: 'Personas', de: 'Menschen', it: 'Persone', 'pt-br': 'Pessoas' },
    celestial: { en: 'Celestial', fr: 'Céleste', es: 'Celestial', de: 'Himmlisch', it: 'Celeste', 'pt-br': 'Celeste' }
  };
  return categories[symbol.category]?.[lang] || symbol.category;
}

// Generate meta title
function generateMetaTitle(symbol, i18n, lang) {
  const template = i18n[lang].meta_title_template;
  const name = symbol[lang].seoTitle || symbol[lang].name;
  return template.replace(/{symbol}/g, name);
}

// Truncate a meta description to a maximum length, cutting at the last sentence or word boundary
function truncateMetaDescription(text, maxLength = 160, minLength = 110) {
  if (text.length <= maxLength) return text;
  // Try to cut at the last sentence boundary (period followed by space) within the limit
  const truncated = text.slice(0, maxLength);
  const lastSentenceEnd = truncated.lastIndexOf('. ');
  if (lastSentenceEnd >= minLength) {
    return truncated.slice(0, lastSentenceEnd + 1);
  }
  // Fall back to last word boundary, reserving space for ellipsis
  const ellipsis = '\u2026'; // single-char ellipsis (…)
  const truncatedForEllipsis = text.slice(0, maxLength - 1);
  const lastSpace = truncatedForEllipsis.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.5) {
    return truncatedForEllipsis.slice(0, lastSpace) + ellipsis;
  }
  return truncatedForEllipsis + ellipsis;
}

// Generate meta description
function generateMetaDescription(symbol, i18n, lang) {
  const template = i18n[lang].meta_description_template;
  const name = symbol[lang].name;
  const shortDesc = symbol[lang].shortDescription;
  const description = template
    .replace(/{symbol}/g, name)
    .replace(/{short_description}/g, shortDesc);
  return truncateMetaDescription(description);
}

// Generate hreflang URLs
function generateHreflangUrls(symbol) {
  const urls = {};
  for (const l of CONFIG.languages) {
    if (symbol[l]) {
      urls[l] = `https://noctalia.app/${l}/${CONFIG.symbolsPath[l]}/${symbol[l].slug}`;
    }
  }
  return urls;
}

// Get related symbols data
function getRelatedSymbols(symbol, allSymbols, lang) {
  if (!symbol.relatedSymbols || symbol.relatedSymbols.length === 0) {
    return [];
  }

  return symbol.relatedSymbols
    .map(relId => {
      const relSymbol = allSymbols.find(s => s.id === relId);
      if (!relSymbol || !relSymbol[lang]) return null;
      return {
        slug: relSymbol[lang].slug,
        name: relSymbol[lang].name
      };
    })
    .filter(Boolean)
    .slice(0, 6); // Max 6 related symbols
}

// Get extended content for a symbol
function getExtendedContent(symbolId, extended, lang) {
  const extSymbol = extended?.primary?.symbols?.[symbolId]?.[lang];
  if (extSymbol) {
    return {
      fullInterpretation: extSymbol.fullInterpretation || null,
      variations: extSymbol.variations || [],
      illustration: extSymbol.illustration || null
    };
  }

  const tier3Symbol = extended?.tier3?.[symbolId]?.[lang];
  if (tier3Symbol) {
    return {
      fullInterpretation: tier3Symbol.fullInterpretation || null,
      variations: tier3Symbol.variations || [],
      illustration: tier3Symbol.illustration || null
    };
  }

  return {
    fullInterpretation: null,
    variations: [],
    illustration: null
  };
}

// Escape HTML entities
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeEmDashes(text) {
  if (!text) return text;
  return String(text)
    .replace(/\s*—\s*/g, ', ')
    .replace(/,\s*,/g, ', ')
    .replace(/\s{2,}/g, ' ');
}

function injectEditorialLinks(symbolId, lang, html) {
  if (typeof html !== 'string' || !html) return html;

  if (symbolId === 'plane' && lang === 'es') {
    return html.replace(
      'Soñar con volar en avión',
      '<a class="text-dream-salmon hover:underline" href="/es/blog/suenos-de-volar">Soñar con volar en avión</a>'
    );
  }

  return html;
}

function renderVariationContext(symbolId, lang, context) {
  const label = escapeHtml(sanitizeEmDashes(context));

  if (symbolId === 'night' && lang === 'de' && context === 'In der Dunkelheit verfolgt werden') {
    return `<a class="text-dream-salmon hover:underline" href="/de/traumsymbole/verfolgung">${label}</a>`;
  }

  return label;
}

function safeJsonStringifyForHtml(data, space = 4) {
  return JSON.stringify(data, null, space).replace(/</g, '\\u003c');
}

function indentLines(text, indent) {
  const prefix = ' '.repeat(indent);
  return text.split('\n').map(line => prefix + line).join('\n');
}

function renderJsonLd(data, indent = 4) {
  return indentLines(
    `<script type="application/ld+json">\n${safeJsonStringifyForHtml(data)}\n</script>`,
    indent
  );
}

function loadFeaturedBlogLinks() {
  const manifestPath = path.join(ROOT_DATA_DIR, 'content-manifest.json');
  if (!fs.existsSync(manifestPath)) return {};

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entries = manifest?.collections?.blog?.entries || {};
  const linksByLang = {};

  for (const lang of CONFIG.languages) {
    linksByLang[lang] = [];

    for (const entryId of SHARED_SITE_CONFIG.seoLinking?.featuredBlogEntries || []) {
      const entry = entries[entryId];
      if (!entry?.locales?.[lang]) continue;

      const sourcePath = path.join(DOCS_SRC_DIR, 'content', 'blog', entryId, `${lang}.md`);
      if (!fs.existsSync(sourcePath)) continue;

      const { meta } = parseSourceDocument(fs.readFileSync(sourcePath, 'utf8'));
      if (!meta?.title) continue;

      linksByLang[lang].push({
        href: entry.locales[lang].path,
        label: stripSiteSuffix(meta.title)
      });
    }
  }

  return linksByLang;
}

const FEATURED_BLOG_LINKS = loadFeaturedBlogLinks();

function getFeaturedGuideLinks(lang, curationPages) {
  return (SHARED_SITE_CONFIG.seoLinking?.featuredGuideEntries || [])
    .map((entryId) => entryId.replace(/^guide\./, ''))
    .map((pageId) => curationPages.find((page) => page.id === pageId))
    .filter(Boolean)
    .map((page) => ({
      href: `/${lang}/guides/${page.slugs[lang]}`,
      label: page[lang].title
    }));
}

function getPopularSymbolLinks(lang, allSymbols) {
  return (SHARED_SITE_CONFIG.seoLinking?.featuredSymbols || [])
    .map((symbolId) => allSymbols.find((symbol) => symbol.id === symbolId))
    .filter(Boolean)
    .map((symbol) => ({
      href: `/${lang}/${CONFIG.symbolsPath[lang]}/${symbol[lang].slug}`,
      label: symbol[lang].name
    }));
}

function renderFooterLinkList(links, { highlightFirst = false } = {}) {
  return links
    .map((link, index) => {
      const className = highlightFirst && index === 0
        ? 'text-dream-salmon'
        : 'hover:text-dream-salmon transition-colors';
      return `<li><a href="${link.href}" class="${className}">${escapeHtml(link.label)}</a></li>`;
    })
    .join('');
}

function renderPseoNavLinks(lang, t) {
  return `
                <a href="/${lang}/#${t.nav_how_it_works_anchor}" class="hidden lg:inline-flex hover:text-white transition-colors">${t.nav_how_it_works}</a>
                <a href="/${lang}/#${t.nav_features_anchor}" class="hidden lg:inline-flex hover:text-white transition-colors">${t.nav_features}</a>
                <a href="/${lang}/blog/" class="hidden sm:inline-flex hover:text-white transition-colors">${t.nav_resources}</a>
                <a href="/${lang}/guides/${t.dictionary_slug}" class="hidden sm:inline-flex text-dream-salmon transition-colors">${DICTIONARY_NAV_LABELS[lang]}</a>`;
}

function renderLegacyPseoFooter(lang, t, allSymbols, curationPages = OPTIONAL_CURATION_PAGES) {
  const resourcesLinks = [
    { href: `/${lang}/blog/`, label: t.nav_resources },
    ...(FEATURED_BLOG_LINKS[lang] || [])
  ];
  const guideLinks = [
    { href: `/${lang}/guides/${t.dictionary_slug}`, label: DICTIONARY_NAV_LABELS[lang] },
    { href: `/${lang}/guides/`, label: GUIDES_HUB_LABELS[lang] },
    ...getFeaturedGuideLinks(lang, curationPages)
  ];
  const symbolLinks = getPopularSymbolLinks(lang, allSymbols);

  return `    <footer class="pb-10 pt-20 border-t border-white/5 px-6 bg-[#05020a]">
        <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-10 mb-16">
            <div class="xl:col-span-2">
                <a href="${localizedHomePath(lang)}" class="flex items-center gap-2 mb-4">
                    <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>
                    <h4 class="font-serif text-2xl text-dream-cream">Noctalia</h4>
                </a>
                <p class="text-sm text-gray-500 max-w-xs mb-6">${t.footer_tagline}</p>
            </div>
            <div>
                <h5 class="font-bold mb-4 text-white">${t.nav_resources}</h5>
                <ul class="space-y-2 text-sm text-gray-500">${renderFooterLinkList(resourcesLinks, { highlightFirst: true })}
                </ul>
            </div>
            <div>
                <h5 class="font-bold mb-4 text-white">${DICTIONARY_NAV_LABELS[lang]}</h5>
                <ul class="space-y-2 text-sm text-gray-500">${renderFooterLinkList(guideLinks, { highlightFirst: true })}
                </ul>
            </div>
            <div>
                <h5 class="font-bold mb-4 text-white">${POPULAR_SYMBOLS_LABELS[lang]}</h5>
                <ul class="space-y-2 text-sm text-gray-500">${renderFooterLinkList(symbolLinks)}
                </ul>
            </div>
            <div>
                <h5 class="font-bold mb-4 text-white">${t.footer_legal}</h5>
                <ul class="space-y-2 text-sm text-gray-500">
                    <li><a href="/${lang}/${t.about_slug}" class="hover:text-dream-salmon transition-colors">${t.about}</a></li>
                    <li><a href="/${lang}/${t.legal_slug}" class="hover:text-dream-salmon transition-colors">${t.legal_notice}</a></li>
                    <li><a href="/${lang}/${t.privacy_slug}" class="hover:text-dream-salmon transition-colors">${t.privacy}</a></li>
                    <li><a href="/${lang}/${t.terms_slug}" class="hover:text-dream-salmon transition-colors">${t.terms}</a></li>
                </ul>
            </div>
        </div>
        <div class="text-center pt-8 border-t border-white/5 text-[10px] text-gray-600 flex flex-col md:flex-row justify-between items-center">
            <span>&copy; 2026 TiMax. Noctalia is published by TiMax.</span>
            <span class="mt-2 md:mt-0 flex gap-2 items-center">${t.footer_made_with} <i data-lucide="heart" class="w-3 h-3 text-dream-salmon fill-current"></i> ${t.footer_for_dreamers}</span>
        </div>
    </footer>`;
}

// Living-painting pilot of the French tiger page (mist, lantern glow, scroll
// depth), without a pause control: it stops by itself for reduced motion, a
// hidden tab or a hero off screen. The script's folder is named after its
// sha256, so the immutable /js/* cache never serves a stale copy; its layers
// and the portrait painting stay in the V4 folder, which the script reads
// relative to itself. On a phone held upright the hero takes 75svh and shows a
// dedicated portrait painting; the landscape image, SEO and cards stay shared.
const TIGER_LIVING = {
  dir: '/js/tiger-living/c0677c4083d5',
  assets: '/js/tiger-living/22c79c696a2f/assets',
  media: '(max-width: 767px) and (orientation: portrait)',
  portrait: { name: 'tiger-mobile-v4', width: 984, height: 1599, widths: [480, 984] },
};

function tigerLivingSourcesHtml() {
  const { assets, media, portrait } = TIGER_LIVING;
  return ['avif', 'webp'].map((format) => {
    const srcset = portrait.widths
      .map((width) => `${assets}/${portrait.name}-${width}w.${format} ${width}w`)
      .join(', ');
    return `
                        <source media="${media}" type="image/${format}" srcset="${srcset}" sizes="100vw" width="${portrait.width}" height="${portrait.height}">`;
  }).join('');
}

// Before any script runs: the portrait hero has its final height, so the
// painting and the title never jump.
function tigerLivingStyleHtml() {
  return livingStyleHtml('50% 35%', TIGER_ATLAS_CSS);
}

function livingStyleHtml(portraitPosition, atlasCss) {
  return `
    <style>
        @media ${TIGER_LIVING.media} {
            .symbol-hero--living { aspect-ratio: auto; height: 75vh; height: 75svh; }
            .symbol-hero--living .symbol-hero-media img { object-fit: cover; object-position: ${portraitPosition}; }
        }${atlasCss}
    </style>`;
}

// Atlas composition of the same pilot page, read like a dictionary entry: the
// symbol is described first (summary, meaning, beside its illustration), then the
// app, its common scenes with the reading of the chosen one right beside the list,
// the questions to ask, the detailed reading, the variations, the FAQ and further
// reading; the app closes the page again. An index
// beside the opening mirrors the section titles. Every text comes from the
// symbol's data: a scene shows the opening question of its variation card and the
// sentence after it, and the build fails if a card, its question, the caveat or
// an image file disappears. The words of every language (copy, caveat, journal lead,
// each scene's card, label and anchor) come from docs-src/config/symbol-atlas-locales.json.
const TIGER_ATLAS_IMAGES = '/img/symbols/atlas-tiger-v1';
const TIGER_ATLAS = {
  scenes: {
    choices: [
      { id: 'poursuite', image: 'pursuit' },
      { id: 'calme', image: 'calm' },
      { id: 'cage', image: 'cage' },
    ],
  },
  // Fingerprinted files from docs-src/static/img/symbols/atlas-tiger-v1 (assets-manifest.json).
  images: {
    pursuit: { width: 320, height: 180, avif: { 320: 'tiger-pursuit-320-f1ce09fe543d.avif', 640: 'tiger-pursuit-640-112fb4ac41a6.avif' }, webp: { 320: 'tiger-pursuit-320-05b0f7866689.webp', 640: 'tiger-pursuit-640-54f668afdf3d.webp' } },
    calm: { width: 320, height: 180, avif: { 320: 'tiger-calm-320-4bb28e7a6b72.avif', 640: 'tiger-calm-640-f928699ca141.avif' }, webp: { 320: 'tiger-calm-320-ccf237942860.webp', 640: 'tiger-calm-640-d0dfdd8f3b83.webp' } },
    cage: { width: 320, height: 180, avif: { 320: 'tiger-cage-320-c7c194529c9e.avif', 640: 'tiger-cage-640-17ac80fe1837.avif' }, webp: { 320: 'tiger-cage-320-057946eb9ebd.webp', 640: 'tiger-cage-640-f21bb88f0cdd.webp' } },
    decor: { width: 1402, height: 1122, avif: { 700: 'tiger-atlas-vignette-700-4e8dfc5cbde1.avif', 1402: 'tiger-atlas-vignette-1402-9962f65e3b08.avif' }, webp: { 700: 'tiger-atlas-vignette-700-c59a48b34c27.webp', 1402: 'tiger-atlas-vignette-1402-52162fa918f0.webp' } },
  },
  sceneSizes: '(min-width: 1200px) 8.5rem, 6.5rem',
  // The decor exists from 1440px only, beside the meaning: no source matches below, so
  // phones and narrower screens never fetch it.
  decorMedia: '(min-width: 1440px)',
  decorSizes: 'min(52rem, 50vw)',
};

function plainText(html) {
  return String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[ \t\r\n\f\v]+/g, ' ')
    .trim();
}

// Compares French copy whatever its non-breaking spaces (one character for one, so indexes match).
function looseSpaces(text) {
  return text.replace(/[\u00a0\u202f]/g, ' ');
}

// French punctuation never starts a line: the space before : ; ? ! » and after « holds.
function frenchSpaces(text) {
  return String(text).replace(/ ([:;?!»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
}

// The whole sentence of `text` that starts with `prefix`.
function sentenceStarting(text, prefix, where) {
  const start = looseSpaces(text).indexOf(prefix);
  if (start === -1) throw new Error(`Atlas: "${prefix}" no longer appears in ${where}`);
  const end = text.slice(start).search(/[.?!](\s|$)/);
  return text.slice(start, end === -1 ? undefined : start + end + 1);
}

function tigerAtlasSrcset(files) {
  return Object.entries(files).map(([width, file]) => {
    const relative = path.join('static', TIGER_ATLAS_IMAGES, file);
    if (!fs.existsSync(path.join(DOCS_SRC_DIR, relative))) throw new Error(`Tiger atlas: missing image docs-src/${relative}`);
    return `${TIGER_ATLAS_IMAGES}/${file} ${width}w`;
  }).join(', ');
}

function renderTigerAtlasScenePicture(image) {
  return `<picture class="atlas-scene-thumb">
                                        <source type="image/avif" srcset="${tigerAtlasSrcset(image.avif)}" sizes="${TIGER_ATLAS.sceneSizes}">
                                        <img src="${TIGER_ATLAS_IMAGES}/${image.webp[320]}" srcset="${tigerAtlasSrcset(image.webp)}" sizes="${TIGER_ATLAS.sceneSizes}" alt="" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">
                                    </picture>`;
}

function renderTigerAtlasDecor() {
  const image = TIGER_ATLAS.images.decor;
  const { decorMedia: media, decorSizes: sizes } = TIGER_ATLAS;
  return `<picture class="atlas-decor" aria-hidden="true">
                        <source media="${media}" type="image/avif" srcset="${tigerAtlasSrcset(image.avif)}" sizes="${sizes}">
                        <source media="${media}" type="image/webp" srcset="${tigerAtlasSrcset(image.webp)}" sizes="${sizes}">
                        <img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">
                    </picture>`;
}

// The existing final CTA links (same URLs, tracking and copy), laid out for a
// column. The browser-journal promotion is paused sitewide (styles.min.css hides
// its link and [data-web-app-cta]); its note follows the same switch, and Google
// Play leads meanwhile.
function renderTigerAtlasActions(lang, content, pagePath, placement) {
  const copy = SYMBOL_CONVERSION_COPY[lang] || SYMBOL_CONVERSION_COPY.en;
  const sharedLocale = SHARED_LOCALES[lang] || SHARED_LOCALES.en;
  return `<div class="atlas-actions">
                            <a${conversionLinkAttributes(pagePath, placement, 'web')} href="${getWebAppUrl(lang, { medium: 'symbol_page', content })}" class="symbol-webapp-cta atlas-primary" rel="noopener"><i data-lucide="arrow-up-right" class="w-5 h-5"></i>${escapeHtml(sharedLocale.webAppCta)}</a>
                            <a${conversionLinkAttributes(pagePath, placement, 'play')} href="${getAndroidStoreUrl(lang)}" class="atlas-primary" rel="nofollow noopener noreferrer" target="_blank"><i data-lucide="arrow-up-right" class="w-5 h-5"></i>${escapeHtml(copy.store)}</a>
                            <a href="${getSymbolCtaUrl(lang)}" class="atlas-secondary"><i data-lucide="arrow-right" class="w-4 h-4"></i>${escapeHtml(copy.details)}</a>
                        </div>
                        <p class="symbol-webapp-note atlas-note" data-web-app-cta>${escapeHtml(sharedLocale.webAppNote)}</p>`;
}

// The tiger reading: its paintings, its scene labels, the opening question and next
// sentence of each scene's card, the journal example left out.
const TIGER_ATLAS_PAGE = {
  ...TIGER_ATLAS,
  name: 'Tiger',
  omitJournal: true,
  sceneText: 'excerpt',
  scenePicture: (image) => renderTigerAtlasScenePicture(TIGER_ATLAS.images[image]),
  decorHtml: () => renderTigerAtlasDecor(),
};

function renderAtlasArticle(c, atlas) {
  const { anchors, quotes: [open, close] } = atlas;
  // French punctuation keeps its spaces; the other languages print their titles as written.
  const spaced = (title) => (atlas.lang === 'fr' ? frenchSpaces(title) : title);
  const paragraphs = c.interpretationHtml.match(/<p>[\s\S]*?<\/p>/g) || [];
  if (paragraphs.join('').replace(/\s+/g, '') !== c.interpretationHtml.replace(/\s+/g, '')) {
    throw new Error(`${atlas.name} atlas: the interpretation is no longer a plain list of paragraphs`);
  }
  // The opening keeps the first paragraph; the others, complete, make the detailed reading.
  const [opening, ...continuation] = atlas.omitJournal
    ? paragraphs.filter((p) => !looseSpaces(plainText(p)).startsWith(atlas.journalLead))
    : paragraphs;
  if (!opening || continuation.length === 0) throw new Error(`${atlas.name} atlas: the interpretation needs an opening and a continuation`);
  const caveat = atlas.caveat ? sentenceStarting(plainText(c.interpretationHtml), atlas.caveat, 'the interpretation') : '';

  const scenes = atlas.scenes.choices.map((choice, index) => {
    const variation = c.variations.find((v) => looseSpaces(plainText(v.context)) === choice.variation);
    if (!variation) throw new Error(`${atlas.name} atlas: variation "${choice.variation}" is missing`);
    const meaning = plainText(variation.meaning);
    const scene = { ...choice, label: choice.label || choice.variation, checked: index === 0, card: c.variations.indexOf(variation) };
    if (atlas.sceneText === 'excerpt') {
      const question = meaning.slice(0, meaning.indexOf('?') + 1);
      const rest = meaning.slice(question.length).trim();
      if (!question || !rest) throw new Error(`${atlas.name} atlas: variation "${choice.variation}" no longer opens with a question`);
      return { ...scene, question, excerpt: sentenceStarting(rest, looseSpaces(rest.slice(0, 12)), `variation "${choice.variation}"`) };
    }
    // The whole published card: its opening question apart when it has one, every sentence kept.
    const first = meaning.search(/[.?!](\s|$)/);
    const question = first !== -1 && meaning[first] === '?' ? meaning.slice(0, first + 1) : '';
    return { ...scene, question, excerpt: meaning.slice(question.length).trim() };
  });
  const sceneChoicesHtml = scenes.map((scene) => `
                                <input class="atlas-scene-input" type="radio" name="atlas-scene" id="atlas-scene-${scene.id}" value="${scene.id}" aria-controls="atlas-scene-results"${scene.checked ? ' checked' : ''}>
                                <label class="atlas-scene${scene.image ? '' : ' atlas-scene--text'}" for="atlas-scene-${scene.id}">${scene.image ? `
                                    ${atlas.scenePicture(scene.image)}` : ''}
                                    <span class="atlas-scene-text">
                                        <span class="atlas-scene-label">${escapeHtml(scene.label)}</span>${scene.label !== scene.variation ? `
                                        <span class="atlas-scene-variation">${escapeHtml(scene.variation)}</span>` : ''}
                                    </span>
                                    <span class="atlas-scene-mark" aria-hidden="true"><i data-lucide="arrow-right" class="w-4 h-4"></i></span>
                                </label>`).join('');
  const sceneResultsHtml = scenes.map((scene) => `
                        <div class="atlas-scene-result" data-scene="${scene.id}">
                            <p class="atlas-kicker atlas-scene-chosen">${escapeHtml(atlas.scenes.chosen)}${escapeHtml(atlas.chosenSeparator)}${escapeHtml(scene.label)}</p>${scene.question ? `
                            <p class="atlas-scene-question"><i data-lucide="quote" class="w-5 h-5"></i>${escapeHtml(scene.question)}</p>` : ''}
                            <p class="atlas-scene-excerpt">${escapeHtml(scene.excerpt)}</p>
                            <a class="atlas-link" href="#${anchors.variation}-${scene.anchor}">${escapeHtml(atlas.scenes.source)} ${escapeHtml(open)}${escapeHtml(scene.variation)}${escapeHtml(close)}</a>
                        </div>`).join('');

  // Each scene's source link lands on its own variation card.
  let card = -1;
  const variationsHtml = c.variationsHtml.replace(/<div class="variation-card">/g, () => {
    card += 1;
    const scene = scenes.find((s) => s.card === card);
    return scene ? `<div class="variation-card" id="${anchors.variation}-${scene.anchor}">` : '<div class="variation-card">';
  });
  if (card !== c.variations.length - 1) throw new Error(`${atlas.name} atlas: the variation cards no longer match the variations`);

  // Every section opens with one h2; the index beside the opening lists the same titles. A language
  // whose catalog has no FAQ for the symbol shows no FAQ section (and no index entry for it).
  const hasFaq = Boolean(c.faqCardsHtml.trim());
  const sections = {
    meaning: spaced(c.t.section_interpretation),
    scenes: escapeHtml(atlas.scenes.title),
    questions: c.t.section_ask_yourself,
    [anchors.reading]: escapeHtml(atlas.continuationTitle),
    variations: c.t.section_variations,
    ...(hasFaq ? { faq: c.t.section_faq } : {}),
    [anchors.further]: c.t.section_learn_more,
  };
  const heading = (id) => `<h2 class="symbol-h2" id="atlas-${id}-title">${sections[id]}</h2>`;
  const keep = (id, placement) => `<aside class="atlas-keep" id="${id}" aria-labelledby="${id}-title">
                <div>
                    <p class="atlas-kicker"><i data-lucide="feather" class="w-5 h-5"></i>${escapeHtml(atlas.keepKicker)}</p>
                    <h2 class="atlas-keep-title" id="${id}-title">${c.t.cta_title}</h2>
                    <p class="atlas-keep-text">${c.t.cta_description}</p>
                </div>
                <div>
                    ${c.conversionActions(placement)}
                </div>
            </aside>`;

  return `<article class="atlas">
            <div class="atlas-top">
                <nav class="atlas-rail" aria-labelledby="atlas-rail-title">
                    <p class="atlas-kicker" id="atlas-rail-title">${escapeHtml(atlas.navLabel)}</p>
                    <ol class="atlas-index">${Object.entries(sections).map(([id, title]) => `
                        <li><a href="#${id}">${title}</a></li>`).join('')}
                    </ol>
                </nav>

                <div class="atlas-plate">
                    <div class="atlas-reading">
                        <p class="symbol-summary atlas-lead">${escapeHtml(c.symbolData.shortDescription)}</p>

                        <nav class="symbol-jump-nav" aria-label="${escapeHtml(c.sheetLabels.jumpNav)}" style="grid-template-columns: repeat(${c.jumpCount}, minmax(0, 1fr));">${c.jumpNavHtml}
                        </nav>
                        <!-- Main Interpretation -->
                        <section id="meaning" class="symbol-meaning atlas-meaning" aria-labelledby="atlas-meaning-title">
                            ${heading('meaning')}
                            <div class="prose prose-invert prose-purple max-w-none leading-relaxed space-y-4">
                                ${opening}
                            </div>
                        </section>
                    </div>
                    ${atlas.decorHtml()}
                    <!-- The app, right after the meaning -->
                    ${keep(anchors.keepInline, 'inline')}
                    <!-- The scene list, and the chosen scene's reading beside it (under it on a phone) -->
                    <section class="atlas-scenes" id="${atlas.scenes.id}" aria-labelledby="atlas-scenes-title">
                        ${heading('scenes')}
                        <p class="atlas-scenes-hint">${escapeHtml(atlas.scenes.hint)}</p>
                        <div class="atlas-scenes-body">
                            <fieldset class="atlas-scene-list">
                                <legend class="atlas-sr">${escapeHtml(atlas.scenes.legend)}</legend>${sceneChoicesHtml}
                            </fieldset>
                            <section class="atlas-reflection" id="${anchors.reflection}" aria-label="${escapeHtml(atlas.scenes.reading)}">
                                <div class="atlas-scene-results" id="atlas-scene-results" aria-live="polite">${sceneResultsHtml}
                                </div>${caveat ? `
                                <p class="atlas-caveat">${escapeHtml(caveat)}</p>` : ''}
                            </section>
                        </div>
                    </section>
                </div>
            </div>

            <!-- Ask Yourself -->
            <section id="questions" class="symbol-questions symbol-section atlas-questions" aria-labelledby="atlas-questions-title">
                ${heading('questions')}
                <ul>${c.askYourselfHtml}
                </ul>
            </section>

            <!-- Rest of the interpretation -->
            <section id="${anchors.reading}" class="symbol-meaning symbol-section atlas-continuation" aria-labelledby="atlas-${anchors.reading}-title">
                ${heading(anchors.reading)}
                <div class="prose prose-invert prose-purple max-w-none leading-relaxed">
                    ${continuation.join('\n                    ')}
                </div>
            </section>

            <!-- Variations -->
            <section id="variations" class="symbol-variations symbol-section" aria-labelledby="atlas-variations-title">
                ${heading('variations')}
                <div class="atlas-variation-grid">${variationsHtml}
                </div>
            </section>

            ${hasFaq ? `<section id="faq" class="symbol-faq symbol-section" aria-labelledby="atlas-faq-title">
                ${heading('faq')}
                <div class="atlas-faq-grid">${c.faqCardsHtml}
                </div>
            </section>` : ''}

            <!-- Related symbols and reading -->
            <section id="${anchors.further}" class="symbol-section atlas-further" aria-labelledby="atlas-${anchors.further}-title">
                ${heading(anchors.further)}
                <div class="symbol-related atlas-related" id="${anchors.related}">
                    <h3 class="atlas-kicker"><i data-lucide="orbit" class="w-5 h-5"></i>${c.t.section_related_symbols}</h3>
                    <div class="atlas-related-links">${c.relatedSymbolsHtml}
                    </div>
                </div>${c.relatedReadingCard ? c.relatedReadingCard.replace(/<h3>([\s\S]*?)<\/h3>/, (match, title) => `<h3>${spaced(title)}</h3>`) : ''}
            </section>

            <!-- CTA Section: the app again, once the symbol is explained -->
            ${keep(anchors.keepFinal, 'final')}

            <!-- Back to Dictionary -->
            <div class="mt-10 atlas-back">
                <a href="/${c.lang}/guides/${c.t.dictionary_slug}" class="symbol-back-link">${c.t.back_to_dictionary}</a>
            </div>
            <script>
                // On a phone the shared navbar never compacts and stays transparent: past the hero
                // it would sit on the text, so it gets a ground there; back on the hero it clears.
                (() => {
                    const nav = document.getElementById('navbar');
                    const hero = document.querySelector('.symbol-hero');
                    if (!nav || !hero || !('IntersectionObserver' in window)) return;
                    const top = Math.round(nav.getBoundingClientRect().height);
                    new IntersectionObserver(([entry]) => nav.classList.toggle('atlas-nav-solid', !entry.isIntersecting), { rootMargin: '-' + top + 'px 0px 0px 0px' }).observe(hero);
                })();
                // A clicked or tapped scene brings its reading into view, just enough to show it whole
                // (on a phone it sits below the cards); the arrow keys change the scene without moving the page.
                (() => {
                    const results = document.getElementById('atlas-scene-results');
                    if (!results) return;
                    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
                    document.querySelectorAll('.atlas-scene').forEach((label) => label.addEventListener('click', () => {
                        requestAnimationFrame(() => results.scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'instant' : 'smooth' }));
                    }));
                })();
            </script>
        </article>`;
}

// The scene ids only name the selector that shows the chosen scene's reading.
function atlasCss(sceneIds) {
  const [first] = sceneIds;
  const shown = sceneIds.map((id) => `.atlas:has(#atlas-scene-${id}:checked) .atlas-scene-result[data-scene="${id}"]`).join(',\n        ');
  return `
        /* Atlas composition (French tiger pilot), read like a dictionary entry. Phones keep one column. */
        .symbol-page-main > article.atlas { max-width: none; }
        .atlas { --atlas-rail: 12.5rem; --atlas-gap: clamp(1.75rem, 3vw, 4.5rem); }
        .atlas-rail, .atlas-decor { display: none; }
        .atlas-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        .atlas-kicker {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            margin: 0 0 0.9rem;
            font-family: 'Outfit', ui-sans-serif, system-ui, sans-serif;
            font-size: 0.68rem;
            font-weight: 500;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            color: var(--salmon);
        }
        .atlas-kicker svg { color: var(--salmon-dim); letter-spacing: 0; }
        .atlas-lead.symbol-summary { max-width: 38rem; color: var(--cream); }
        .atlas-meaning { padding-top: 0.25rem; }
        .atlas .symbol-reading-card:hover h3 { color: var(--salmon); }
        .atlas-continuation .prose > * + * { margin-top: 1rem; }
        .atlas-continuation .prose p { max-width: 40rem; }
        .atlas-continuation .prose p:last-child { font-size: 0.9rem; color: var(--cream-64); }

        /* Scene selector: native radios, one published question and excerpt per scene, read
           beside the list (under it on a phone). */
        .atlas-scenes { margin-top: clamp(2.5rem, 5vw, 3.5rem); padding-top: clamp(2.25rem, 4vw, 3rem); border-top: 1px solid var(--line); }
        .atlas-scenes .symbol-h2 { margin-bottom: 0.5rem; }
        .atlas-scenes-hint { margin-bottom: 1.25rem; font-size: 0.92rem; line-height: 1.5; color: var(--cream-64); }
        .atlas-scenes-body { display: grid; gap: 1.75rem; align-items: start; }
        .atlas-scene-list { display: grid; gap: 0.75rem; margin: 0; padding: 0; border: 0; min-width: 0; }
        .atlas-scene-input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
        .atlas-scene {
            display: grid;
            grid-template-columns: 6.5rem minmax(0, 1fr) auto;
            align-items: center;
            gap: 1rem;
            padding: 0 1rem 0 0;
            min-height: 4.5rem;
            border: 1px solid rgba(255, 247, 237, 0.16);
            background: rgba(10, 5, 18, 0.92);
            cursor: pointer;
            transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.16s ease-out;
        }
        .atlas-scene:active { transform: scale(0.99); }
        .atlas-scene-thumb, .atlas-scene-thumb img { display: block; width: 100%; height: 100%; }
        .atlas-scene-thumb img { aspect-ratio: 16 / 9; object-fit: cover; }
        .atlas-scene-text { display: grid; gap: 0.2rem; padding: 0.75rem 0; min-width: 0; }
        .atlas-scene-label { font-family: 'Fraunces', ui-serif, Georgia, serif; font-size: 1.1rem; color: var(--cream); }
        .atlas-scene-variation { font-size: 0.82rem; line-height: 1.4; color: var(--cream-64); }
        .atlas-scene-mark {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 2.1rem;
            height: 2.1rem;
            border: 1px solid rgba(255, 247, 237, 0.55);
            border-radius: 999px;
            color: var(--cream);
            transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        @media (hover: hover) and (pointer: fine) {
            .atlas-scene:hover { border-color: rgba(234, 212, 180, 0.5); }
        }
        .atlas-scene-input:checked + .atlas-scene { border-color: var(--salmon); background: rgba(28, 18, 40, 0.88); }
        .atlas-scene-input:checked + .atlas-scene .atlas-scene-mark { background: var(--salmon); border-color: var(--salmon); color: #0a0512; }
        .atlas-scene-input:focus-visible + .atlas-scene { outline: 2px solid var(--salmon); outline-offset: 3px; }
        .atlas-scene-result { display: none; }
        .atlas-scene-result[data-scene="${first}"] { display: block; }
        .atlas:has(.atlas-scene-input:checked) .atlas-scene-result { display: none; }
        ${shown} { display: block; }
        .atlas-scene-question {
            position: relative;
            padding-left: 2rem;
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 550;
            font-size: clamp(1.3rem, 1.7vw, 1.65rem);
            line-height: 1.25;
            color: var(--cream);
            text-wrap: pretty;
        }
        .atlas-scene-question svg { position: absolute; left: 0; top: 0.15em; color: var(--salmon-dim); }
        .atlas-scene-question::after { content: ''; display: block; width: 1.5rem; height: 1px; margin: 1.1rem 0; background: var(--cream-64); }
        .atlas-scene-excerpt { padding-left: 2rem; font-size: 0.95rem; line-height: 1.65; color: var(--cream-64); margin-bottom: 0.35rem; }
        .atlas-scene-result .atlas-link { margin-left: 2rem; }
        .atlas-scene-results { scroll-margin-bottom: 1.5rem; }
        .atlas-reflection .atlas-caveat { padding-left: 2rem; }
        .atlas-link { display: inline-flex; align-items: center; min-height: 44px; font-size: 0.85rem; color: var(--salmon); text-decoration: underline; text-decoration-color: rgba(234, 212, 180, 0.35); text-underline-offset: 3px; }
        .atlas-caveat { margin-top: 0.75rem; font-size: 0.8rem; font-style: italic; color: var(--cream-64); }
        .atlas .variation-card { scroll-margin-top: 7rem; }
        .atlas .variation-card:target { border-top-color: var(--salmon); }
        .atlas .variation-card:target h3 { color: var(--salmon); }

        .atlas-reflection { max-width: 44rem; scroll-margin-top: 7rem; }

        /* Questions to ask: side by side when they fit, one per line otherwise. */
        .atlas-questions { margin-top: clamp(3rem, 6vw, 4.5rem); }
        .atlas .symbol-questions ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); column-gap: 1.5rem; margin: 0; padding: 0; list-style: none; }
        .atlas .symbol-question-item { font-size: 1.08rem; }
        .atlas .symbol-question-item:last-child { border-bottom: 0; }

        /* Further reading: related symbols, then the guide. */
        .atlas-related { display: grid; gap: 0.35rem; margin-bottom: 1.75rem; scroll-margin-top: 7rem; }
        .atlas-related .atlas-kicker { margin: 0; }
        .atlas-related-links { display: flex; flex-wrap: wrap; gap: 0.25rem 1.5rem; }
        .atlas-related-links .symbol-link { border-top: 0; padding: 0.55rem 0; gap: 0.5rem; justify-content: flex-start; }
        .atlas-related-links .symbol-link span { text-decoration: underline; text-decoration-color: rgba(255, 247, 237, 0.3); text-underline-offset: 4px; font-size: 1rem; }

        /* The app, once the symbol is explained. */
        .atlas-keep { display: grid; gap: 1.5rem; padding: clamp(2.25rem, 4vw, 3rem) 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); scroll-margin-top: 7rem; }
        .atlas-keep-title { font-family: 'Fraunces', ui-serif, Georgia, serif; font-weight: 550; font-size: clamp(1.35rem, 1.8vw, 1.75rem); line-height: 1.2; color: var(--cream); margin-bottom: 0.75rem; }
        .atlas-keep-text { font-size: 0.95rem; line-height: 1.65; color: var(--cream-64); max-width: 34rem; }
        .atlas-plate > .atlas-keep { margin-top: clamp(2.5rem, 5vw, 3.5rem); border-bottom: 0; }
        .atlas-plate > .atlas-keep + .atlas-scenes { margin-top: 0; }
        .atlas-actions { display: grid; justify-items: start; gap: 0.6rem; }
        .atlas-primary {
            display: inline-flex;
            align-items: center;
            gap: 0.6rem;
            min-height: 3.25rem;
            padding: 0 1.6rem;
            border-radius: 999px;
            background: var(--salmon);
            color: #0a0512;
            font-weight: 600;
            transition: background-color 0.2s ease, transform 0.16s ease-out;
        }
        .atlas-primary:hover { background: #f1e1c8; }
        .atlas-primary:active { transform: scale(0.97); }
        .atlas-secondary { display: inline-flex; align-items: center; gap: 0.5rem; min-height: 44px; font-size: 0.88rem; color: var(--cream-88); }
        .atlas-secondary:hover { color: var(--salmon); }
        .atlas-note { margin-top: 0.5rem; font-size: 0.75rem; color: var(--cream-64); max-width: 30rem; }

        .atlas-variation-grid, .atlas-faq-grid { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: var(--atlas-gap); }
        .atlas .variation-card { padding: 1.35rem 0; }
        .atlas .variation-card::before { content: none; }
        .atlas .variation-card:last-child, .atlas .symbol-faq-card:last-child { border-bottom: 0; }
        .atlas .symbol-faq { scroll-margin-top: 7rem; }
        .atlas-back { text-align: left; }
        @media (max-width: 767px) {
            /* Below the fixed navbar and section bar. */
            .atlas .variation-card { scroll-margin-top: 12rem; }
            /* The navbar slides away when scrolling down: the section bar takes its place
               at the top instead of leaving the text visible above it. */
            body.symbol-jump-fixed:has(#navbar.nav-scroll-hidden) .symbol-jump-nav { transform: translateY(-4.65rem); }
            #navbar.atlas-nav-solid, body.symbol-jump-fixed #navbar {
                background: rgba(10, 5, 20, 0.92);
                backdrop-filter: blur(18px);
                -webkit-backdrop-filter: blur(18px);
                box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
            }
        }
        @media (max-width: 767px) and (prefers-reduced-motion: no-preference) {
            body.symbol-jump-fixed .symbol-jump-nav { transition: transform 0.3s ease; }
        }

        @media (min-width: 768px) {
            .symbol-page-main > article.atlas { width: min(90vw, 2304px); }
            .atlas-variation-grid, .atlas-faq-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            /* No section bar here: the meaning keeps its distance from the summary. */
            .atlas-meaning { margin-top: clamp(1.75rem, 2.5vw, 2.25rem); }
            /* The list on the left, the chosen scene's reading on its right. */
            .atlas-scenes-body { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--atlas-gap); }
            .atlas-further { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--atlas-gap); align-items: start; }
            .atlas-further > .symbol-h2 { grid-column: 1 / -1; }
            .atlas-related { margin-bottom: 0; }
            .atlas-keep { grid-template-columns: minmax(0, 36rem) auto; justify-content: start; align-items: center; column-gap: var(--atlas-gap); }
            .symbol-hero--living .symbol-hero-overlay { width: min(90vw, 2304px); padding-inline: 0; }
        }
        @media (min-width: 1024px) {
            .atlas .atlas-lead.symbol-summary { font-size: clamp(1.2rem, 1.4vw, 1.45rem) !important; line-height: 1.45 !important; }
            .atlas .atlas-lead.symbol-summary { margin-top: 1rem; }
            .atlas-meaning .prose { font-size: 0.98rem; line-height: 1.7; }
            /* The reading beside its illustration, then the scenes across the plate. */
            .atlas-plate { display: grid; grid-template-columns: minmax(0, 38rem) minmax(0, 1fr); column-gap: var(--atlas-gap); align-items: start; }
            .atlas-reading { grid-column: 1; grid-row: 1; }
            .atlas-plate > .atlas-keep { grid-column: 1 / -1; grid-row: 2; }
            .atlas-scenes { grid-column: 1 / -1; grid-row: 3; }
            .atlas-scenes-body { grid-template-columns: minmax(0, 25rem) minmax(0, 1fr); }
        }
        @media (min-width: 1200px) {
            .atlas-scene { grid-template-columns: 8.5rem minmax(0, 1fr) auto; }
        }
        @media (min-width: 1200px) {
            .atlas-top { display: grid; grid-template-columns: var(--atlas-rail) minmax(0, 1fr); column-gap: var(--atlas-gap); }
            .atlas-plate { min-width: 0; padding-top: clamp(2rem, 3vw, 3rem); }
            /* The index lists the section titles, in page order. */
            .atlas-rail {
                display: block;
                padding: clamp(2rem, 3vw, 3rem) 1.5rem 2rem 0;
                border-right: 1px solid var(--line);
            }
            .atlas-rail .atlas-kicker { margin-bottom: 1rem; }
            .atlas-index { display: grid; list-style: none; margin: 0; padding: 0; }
            .atlas-index a {
                position: relative;
                display: block;
                padding: 0.5rem 0 0.5rem 1.25rem;
                font-family: 'Fraunces', ui-serif, Georgia, serif;
                font-size: 0.98rem;
                line-height: 1.3;
                color: var(--cream-64);
                transition: color 0.2s ease;
            }
            .atlas-index a::before {
                content: '';
                position: absolute;
                left: 0;
                top: 50%;
                width: 0.6rem;
                height: 1px;
                background: var(--cream-45);
                transform-origin: left;
                transition: transform 0.2s ease, background-color 0.2s ease;
            }
            .atlas-index a:hover, .atlas-index a:focus-visible { color: var(--cream); }
            .atlas-index a:hover::before, .atlas-index a:focus-visible::before { transform: scaleX(1.6); background: var(--salmon); }
            .atlas-variation-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .atlas-continuation .prose { columns: 2 22rem; column-gap: var(--atlas-gap); }
            .atlas-continuation .prose p { break-inside: avoid; }
            .symbol-hero--living .symbol-hero-overlay { padding-left: calc(12.5rem + clamp(1.75rem, 3vw, 4.5rem)); }
        }
        .atlas-decor img { display: block; width: 100%; height: auto; }
        /* From 1440px the illustration sits in the opening, beside the meaning. */
        @media (min-width: 1440px) {
            .atlas-decor { display: block; grid-column: 2; grid-row: 1; justify-self: center; align-self: center; width: min(52rem, 100%); pointer-events: none; }
        }
        @media (min-width: 1800px) {
            /* Up to QHD, wide rows hold one paragraph or answer per column. */
            .atlas-continuation .prose { columns: 3 22rem; }
            .atlas-faq-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }`;
}

const TIGER_ATLAS_CSS = atlasCss(TIGER_ATLAS.scenes.choices.map((choice) => choice.id));

// First batch after the tiger: six French pages read as the same atlas, with the
// tiger's grounds, type and UI colours; each differs by its paintings, their framing
// and their motion. An explicit allowlist, not a template for the whole dictionary.
// As on the tiger, each page has three images besides its hero: a cut-out side
// illustration beside the meaning (from 1440px) and three scene thumbnails, each
// painting the published variation card it names; the reading beside the list shows
// that card whole. Every painting comes from docs-src/config/symbol-atlas-six-assets.json
// (hero, portrait, plate, scene-<id>, and two transparent textures, layer and accent);
// the former illustration stays the page's canonical image for SEO and the other
// languages. Every text comes from the data; the build fails if a variation, a caveat
// sentence or an asset file disappears.
// Motion: every painting carries two distinct raster effects, channel a (layer) and
// channel b (accent); boxes are fractions of the painting shown (see js/symbol-living).
const SYMBOL_LIVING_DIR = '/js/symbol-living/c97b1746cf68';
const ATLAS_SIX_ASSETS_PATH = path.join(DOCS_SRC_DIR, 'config', 'symbol-atlas-six-assets.json');
const ATLAS_SIX_IMAGES = '/img/symbols/atlas-six-v2';
const ATLAS_SIX_PORTRAIT_MEDIA = TIGER_LIVING.media;
// The six pages, an explicit allowlist read from docs-src/config/symbol-atlas-pilots.json: per
// symbol, its French slug, its caveat sentence (or null), its three scenes (each naming a published
// variation card) and the motion of each painting: hero landscape and portrait, side illustration
// (plate) and thumbnails, each with exactly two effects, one per texture (layer, accent). The build
// stops at the first entry that leaves this contract; nothing is skipped.
const ATLAS_PILOTS_PATH = path.join(DOCS_SRC_DIR, 'config', 'symbol-atlas-pilots.json');
const ATLAS_SIX_ROLES = ['hero', 'portrait', 'plate', 'layer', 'accent'];
const ATLAS_SIX_BLENDS = ['screen', 'multiply'];

function loadAtlasPilots() {
  const pilots = JSON.parse(fs.readFileSync(ATLAS_PILOTS_PATH, 'utf8'));
  const file = path.relative(ROOT_DIR, ATLAS_PILOTS_PATH);
  const fail = (at, message) => { throw new Error(`Atlas pilots (${file}) ${at}: ${message}`); };
  const object = (value, at, keys, required = keys) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(at, 'expected an object');
    for (const key of Object.keys(value)) if (!keys.includes(key)) fail(at, `unknown key "${key}"`);
    for (const key of required) if (!Object.hasOwn(value, key)) fail(at, `missing "${key}"`);
    return value;
  };
  const number = (value, at, min, max) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(at, `expected a number from ${min} to ${max}`);
  };
  const pair = (value, at, min, max) => {
    if (!Array.isArray(value) || value.length !== 2) fail(at, 'expected two numbers');
    value.forEach((item, index) => number(item, `${at}[${index}]`, min, max));
  };
  const text = (value, at) => {
    if (typeof value !== 'string' || !value.trim()) fail(at, 'expected a non-empty string');
  };
  const unique = (values, at) => {
    if (new Set(values).size !== values.length) fail(at, 'must be distinct');
  };

  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT_DATA_DIR, 'dream-symbols.json'), 'utf8'));
  object(pilots, 'root', Object.keys(pilots), []);
  for (const [id, pilot] of Object.entries(pilots)) {
    const symbol = (catalog.symbols || []).find((item) => item.id === id);
    if (!symbol) fail(id, 'is not a symbol of data/dream-symbols.json');
    object(pilot, id, ['slug', 'caveat', 'scenes', 'portraitPosition', 'motion']);
    if (pilot.slug !== symbol.fr?.slug) fail(`${id}.slug`, `is "${pilot.slug}", the French slug is "${symbol.fr?.slug}"`);
    if (pilot.caveat !== null) text(pilot.caveat, `${id}.caveat`);

    if (!Array.isArray(pilot.scenes) || pilot.scenes.length !== 3) fail(`${id}.scenes`, 'expected exactly three scenes');
    pilot.scenes.forEach((scene, index) => {
      const at = `${id}.scenes[${index}]`;
      object(scene, at, ['id', 'variation']);
      if (typeof scene.id !== 'string' || !/^[a-z0-9-]+$/.test(scene.id)) fail(`${at}.id`, 'expected lowercase letters, digits and hyphens');
      text(scene.variation, `${at}.variation`);
    });
    unique(pilot.scenes.map((scene) => scene.id), `${id}.scenes ids`);
    unique(pilot.scenes.map((scene) => scene.variation), `${id}.scenes variations`);
    if (typeof pilot.portraitPosition !== 'string' || !/^\d+(\.\d+)?% \d+(\.\d+)?%$/.test(pilot.portraitPosition)) fail(`${id}.portraitPosition`, 'expected "<x>% <y>%"');

    const motion = object(pilot.motion, `${id}.motion`, ['parallax', 'hero', 'plate', 'thumb', 'scenes'], ['parallax', 'hero', 'plate', 'thumb']);
    number(motion.parallax, `${id}.motion.parallax`, 0, 1);
    object(motion.hero, `${id}.motion.hero`, ['landscape', 'portrait']);
    const sceneMotion = Object.hasOwn(motion, 'scenes')
      ? object(motion.scenes, `${id}.motion.scenes`, pilot.scenes.map((scene) => scene.id), [])
      : {};
    const surfaces = [['hero.landscape', motion.hero.landscape], ['hero.portrait', motion.hero.portrait], ['plate', motion.plate], ['thumb', motion.thumb],
      ...Object.entries(sceneMotion).map(([scene, effects]) => [`scenes.${scene}`, effects])];
    for (const [name, effects] of surfaces) {
      const at = `${id}.motion.${name}`;
      if (!Array.isArray(effects) || effects.length !== 2 || effects.map((effect) => effect?.texture).sort().join() !== 'accent,layer') {
        fail(at, 'expected exactly two effects, one on each texture (layer, accent)');
      }
      effects.forEach((effect, index) => {
        const where = `${at}[${index}]`;
        object(effect, where, ['texture', 'place', 'motion', 'move', 'dur', 'op', 'copies', 'depth', 'blend'], ['texture', 'place', 'motion', 'dur', 'op']);
        const place = object(effect.place, `${where}.place`, ['fit', 'zoom', 'x', 'y', 'at'], ['fit']);
        if (!['width', 'cover'].includes(place.fit)) fail(`${where}.place.fit`, 'expected width or cover');
        if (Object.hasOwn(place, 'zoom')) number(place.zoom, `${where}.place.zoom`, 0.1, 4);
        for (const axis of ['x', 'y']) if (Object.hasOwn(place, axis)) number(place[axis], `${where}.place.${axis}`, 0, 1);
        if (Object.hasOwn(place, 'at')) {
          pair(place.at, `${where}.place.at`, 0, 1);
          if (Object.hasOwn(place, 'x') || Object.hasOwn(place, 'y')) fail(`${where}.place`, 'at cannot be combined with x or y');
        }
        if (!['drift', 'flow', 'pulse'].includes(effect.motion)) fail(`${where}.motion`, 'expected drift, flow or pulse');
        if (effect.motion === 'pulse') {
          if (Object.hasOwn(effect, 'move')) fail(`${where}.move`, 'a pulse does not move');
        } else {
          pair(effect.move, `${where}.move`, -1, 1);
        }
        if (Object.hasOwn(effect, 'copies') && (effect.motion !== 'flow' || !Number.isInteger(effect.copies) || effect.copies < 1 || effect.copies > 4)) {
          fail(`${where}.copies`, 'a whole number from 1 to 4, for a flow only');
        }
        number(effect.dur, `${where}.dur`, 0.5, 60);
        pair(effect.op, `${where}.op`, 0, 1);
        if (effect.op[0] > effect.op[1]) fail(`${where}.op`, 'expected [min, max]');
        if (Object.hasOwn(effect, 'depth')) pair(effect.depth, `${where}.depth`, -1, 1);
        if (Object.hasOwn(effect, 'blend') && !ATLAS_SIX_BLENDS.includes(effect.blend)) fail(`${where}.blend`, `expected one of ${ATLAS_SIX_BLENDS.join(', ')}`);
      });
    }
  }
  return pilots;
}
const SYMBOL_ATLAS_SIX = loadAtlasPilots();

// The atlas in every language, read from docs-src/config/symbol-atlas-locales.json: the shared copy
// of each site language (titles, hint, kicker, quotation marks, section anchors) and, per equipped
// symbol (the tiger and the pilots) and language, its caveat sentence (or null), the tiger's journal
// lead and each scene's exact published card (its context in that language), label and anchor. A
// symbol without a language keeps the classic page in that language. French must agree with the
// pilots config. The build stops at the first entry that leaves this contract.
const ATLAS_LOCALES_PATH = path.join(DOCS_SRC_DIR, 'config', 'symbol-atlas-locales.json');
const ATLAS_FIXED_IDS = ['meaning', 'scenes', 'questions', 'variations', 'faq'];

function loadAtlasLocales() {
  const config = JSON.parse(fs.readFileSync(ATLAS_LOCALES_PATH, 'utf8'));
  const file = path.relative(ROOT_DIR, ATLAS_LOCALES_PATH);
  const fail = (at, message) => { throw new Error(`Atlas locales (${file}) ${at}: ${message}`); };
  const object = (value, at, keys, required = keys) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(at, 'expected an object');
    for (const key of Object.keys(value)) if (!keys.includes(key)) fail(at, `unknown key "${key}"`);
    for (const key of required) if (!Object.hasOwn(value, key)) fail(at, `missing "${key}"`);
    return value;
  };
  const text = (value, at) => {
    if (typeof value !== 'string' || !value.trim()) fail(at, 'expected a non-empty string');
  };
  const anchor = (value, at) => {
    if (typeof value !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) fail(at, 'expected lowercase letters, digits and single hyphens');
  };
  const distinct = (values, at) => {
    if (new Set(values).size !== values.length) fail(at, 'must be distinct');
  };

  object(config, 'root', ['copy', 'symbols']);
  object(config.copy, 'copy', CONFIG.languages);
  for (const lang of CONFIG.languages) {
    const at = `copy.${lang}`;
    const copy = object(config.copy[lang], at, ['navLabel', 'scenes', 'continuationTitle', 'keepKicker', 'quotes', 'chosenSeparator', 'anchors']);
    for (const key of ['navLabel', 'continuationTitle', 'keepKicker']) text(copy[key], `${at}.${key}`);
    const scenes = object(copy.scenes, `${at}.scenes`, ['title', 'hint', 'legend', 'reading', 'source', 'chosen']);
    for (const [key, value] of Object.entries(scenes)) text(value, `${at}.scenes.${key}`);
    if (!Array.isArray(copy.quotes) || copy.quotes.length !== 2 || copy.quotes.some((mark) => typeof mark !== 'string' || !mark.trim())) fail(`${at}.quotes`, 'expected an opening and a closing mark');
    if (typeof copy.chosenSeparator !== 'string' || !copy.chosenSeparator.trim()) fail(`${at}.chosenSeparator`, 'expected a separator');
    const anchors = object(copy.anchors, `${at}.anchors`, ['keepInline', 'keepFinal', 'reflection', 'reading', 'further', 'related', 'variation']);
    for (const [key, value] of Object.entries(anchors)) anchor(value, `${at}.anchors.${key}`);
    distinct([...Object.values(anchors), ...ATLAS_FIXED_IDS], `${at}.anchors (and the fixed ids ${ATLAS_FIXED_IDS.join(', ')})`);
  }

  const equipped = { tiger: TIGER_ATLAS.scenes.choices.map((choice) => choice.id) };
  for (const [id, pilot] of Object.entries(SYMBOL_ATLAS_SIX)) equipped[id] = pilot.scenes.map((scene) => scene.id);
  object(config.symbols, 'symbols', Object.keys(equipped), []);
  for (const [id, sceneIds] of Object.entries(equipped)) {
    const byLang = config.symbols[id];
    if (!byLang) {
      if (id !== 'tiger') fail(id, 'every pilot needs its French entry');
      continue;
    }
    object(byLang, id, CONFIG.languages, Object.hasOwn(SYMBOL_ATLAS_SIX, id) ? ['fr'] : []);
    for (const [lang, entry] of Object.entries(byLang)) {
      const at = `${id}.${lang}`;
      object(entry, at, id === 'tiger' ? ['caveat', 'journalLead', 'scenes'] : ['caveat', 'scenes']);
      if (entry.caveat !== null) text(entry.caveat, `${at}.caveat`);
      if (id === 'tiger') text(entry.journalLead, `${at}.journalLead`);
      object(entry.scenes, `${at}.scenes`, sceneIds);
      for (const sceneId of sceneIds) {
        const scene = object(entry.scenes[sceneId], `${at}.scenes.${sceneId}`, ['variation', 'anchor', 'label'], id === 'tiger' ? ['variation', 'anchor', 'label'] : ['variation', 'anchor']);
        text(scene.variation, `${at}.scenes.${sceneId}.variation`);
        anchor(scene.anchor, `${at}.scenes.${sceneId}.anchor`);
        if (Object.hasOwn(scene, 'label')) text(scene.label, `${at}.scenes.${sceneId}.label`);
      }
      distinct(sceneIds.map((sceneId) => entry.scenes[sceneId].anchor), `${at}.scenes anchors`);
      distinct(sceneIds.map((sceneId) => entry.scenes[sceneId].variation), `${at}.scenes variations`);
      const pilot = lang === 'fr' && SYMBOL_ATLAS_SIX[id];
      if (pilot) {
        if (entry.caveat !== pilot.caveat) fail(`${at}.caveat`, `differs from ${path.relative(ROOT_DIR, ATLAS_PILOTS_PATH)}`);
        for (const scene of pilot.scenes) {
          if (entry.scenes[scene.id].variation !== scene.variation) fail(`${at}.scenes.${scene.id}.variation`, `differs from ${path.relative(ROOT_DIR, ATLAS_PILOTS_PATH)}`);
        }
      }
    }
  }
  return config;
}
const SYMBOL_ATLAS_LOCALES = loadAtlasLocales();

// The atlas of one page in one language (its copy, caveat, journal lead and scenes), or null when
// the symbol has none there: that page stays the classic one, in its own language.
function atlasLocaleFor(symbolId, lang) {
  const locale = SYMBOL_ATLAS_LOCALES.symbols[symbolId]?.[lang];
  if (!locale) return null;
  const { scenes, ...copy } = SYMBOL_ATLAS_LOCALES.copy[lang];
  return { lang, ...copy, scenes: { id: 'scenes', ...scenes }, caveat: locale.caveat, journalLead: locale.journalLead, sceneLocales: locale.scenes };
}

// The asset contract: per allowlisted symbol id, all eight of hero (landscape), portrait,
// plate (the cut-out side illustration), scene-<id> for each of its three scenes, and the
// two transparent full-frame textures layer and accent, each
// { width, height, avif?: { width: url }, webp: { width: url } }.
// Files live in docs-src/static/img/symbols/atlas-six-v2/<id>/, named
// <role>-<width>-<first 12 hex of the file's sha256>.<format> (the /img/* cache is
// immutable), never wider than the native width.
function loadAtlasSixAssets() {
  const fail = (message) => { throw new Error(`Atlas assets (${path.relative(ROOT_DIR, ATLAS_SIX_ASSETS_PATH)}): ${message}`); };
  if (!fs.existsSync(ATLAS_SIX_ASSETS_PATH)) fail('missing; every page of symbol-atlas-pilots.json needs its paintings');
  const manifest = JSON.parse(fs.readFileSync(ATLAS_SIX_ASSETS_PATH, 'utf8'));
  for (const [id, roles] of Object.entries(manifest)) {
    if (!Object.hasOwn(SYMBOL_ATLAS_SIX, id)) fail(`"${id}" is not one of ${Object.keys(SYMBOL_ATLAS_SIX).join(', ')}`);
    for (const [role, asset] of Object.entries(roles)) {
      const roles = [...ATLAS_SIX_ROLES, ...SYMBOL_ATLAS_SIX[id].scenes.map((scene) => `scene-${scene.id}`)];
      if (!roles.includes(role)) fail(`${id}: unknown role "${role}" (expected one of ${roles.join(', ')})`);
      if (!(Number.isInteger(asset.width) && asset.width > 0 && Number.isInteger(asset.height) && asset.height > 0)) fail(`${id}.${role}: width and height are required`);
      if (!asset.webp || Object.keys(asset.webp).length === 0) fail(`${id}.${role}: webp sources are required`);
      if (asset.avif && Object.keys(asset.avif).join() !== Object.keys(asset.webp).join()) fail(`${id}.${role}: avif and webp must offer the same widths`);
      for (const format of ['avif', 'webp']) {
        for (const [key, url] of Object.entries(asset[format] || {})) {
          const width = Number(key);
          if (!Number.isInteger(width) || width <= 0 || width > asset.width) fail(`${id}.${role}: ${format} width ${key} is not within the native ${asset.width}px`);
          const name = new RegExp(`^${ATLAS_SIX_IMAGES}/${id}/${role}-${width}-([0-9a-f]{12})\\.${format}$`).exec(url);
          if (!name) fail(`${id}.${role}: ${url} is not ${ATLAS_SIX_IMAGES}/${id}/${role}-${width}-<hash>.${format}`);
          const file = path.join(DOCS_SRC_DIR, 'static', url);
          if (!fs.existsSync(file)) fail(`${id}.${role}: missing docs-src/static${url}`);
          const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
          if (hash !== name[1]) fail(`${id}.${role}: ${url} holds content ${hash}; rename it so the immutable cache never serves a stale file`);
        }
      }
    }
  }
  // Every allowlisted page needs its eight paintings and textures: an incomplete one stops the build.
  for (const [id, pilot] of Object.entries(SYMBOL_ATLAS_SIX)) {
    const missing = [...ATLAS_SIX_ROLES, ...pilot.scenes.map((scene) => `scene-${scene.id}`)].filter((role) => !manifest[id]?.[role]);
    if (missing.length > 0) fail(`${id}: missing ${missing.join(', ')}`);
  }
  return manifest;
}
const ATLAS_SIX_ASSETS = loadAtlasSixAssets();

// The shared motion script is served from a folder named after its hash (immutable /js/* cache).
function checkSymbolLivingScript() {
  const file = path.join(DOCS_SRC_DIR, 'static', SYMBOL_LIVING_DIR, 'symbol-living.js');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  if (!SYMBOL_LIVING_DIR.endsWith(`/${hash}`)) throw new Error(`symbol-living.js hashes to ${hash}: move it to /js/symbol-living/${hash}/ and update SYMBOL_LIVING_DIR`);
}

function atlasSixSrcset(files) {
  return Object.entries(files)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([width, url]) => `${url} ${width}w`)
    .join(', ');
}

function atlasSixSourcesHtml(assets, heroSizes) {
  const sources = [];
  for (const [asset, media, sizes] of [[assets.portrait, ATLAS_SIX_PORTRAIT_MEDIA, '100vw'], [assets.hero, null, heroSizes]]) {
    if (!asset) continue;
    for (const format of ['avif', 'webp']) {
      if (!asset[format]) continue;
      sources.push(`
                        <source${media ? ` media="${media}"` : ''} type="image/${format}" srcset="${atlasSixSrcset(asset[format])}" sizes="${sizes}" width="${asset.width}" height="${asset.height}">`);
    }
  }
  return sources.join('');
}

// The cut-out side illustration, beside the meaning from 1440px: no source matches
// below, so phones and narrower screens never fetch it. Its wrapper holds its motion.
function renderAtlasSixPlate(asset) {
  const { decorMedia: media, decorSizes: sizes } = TIGER_ATLAS;
  return `<div class="atlas-decor atlas-decor--living" data-living-surface="plate">
                        <picture aria-hidden="true">${['avif', 'webp'].filter((format) => asset[format]).map((format) => `
                            <source media="${media}" type="image/${format}" srcset="${atlasSixSrcset(asset[format])}" sizes="${sizes}">`).join('')}
                            <img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="" width="${asset.width}" height="${asset.height}" loading="lazy" decoding="async">
                        </picture>
                    </div>`;
}

// A scene thumbnail, painting the variation card it names (lazy, like the tiger's).
function renderAtlasSixScenePicture(role, asset) {
  const smallest = Object.keys(asset.webp).map(Number).sort((a, b) => a - b)[0];
  return `<picture class="atlas-scene-thumb" data-living-surface="${role}">${asset.avif ? `
                                        <source type="image/avif" srcset="${atlasSixSrcset(asset.avif)}" sizes="${TIGER_ATLAS.sceneSizes}">` : ''}
                                        <img src="${asset.webp[smallest]}" srcset="${atlasSixSrcset(asset.webp)}" sizes="${TIGER_ATLAS.sceneSizes}" alt="" width="${asset.width}" height="${asset.height}" loading="lazy" decoding="async">
                                    </picture>`;
}

// The texture closest to `max` pixels wide without exceeding it (the smallest otherwise).
function atlasSixLayerSrc(layer, max) {
  const widths = Object.keys(layer.webp).map(Number).sort((a, b) => a - b);
  const width = widths.filter((w) => w <= max).pop() || widths[0];
  return layer.webp[width];
}

// A 16:9 texture keeps its ratio over a painting of another ratio: it fits the painting's
// width ('width') or covers it ('cover'), optionally zoomed on the part that carries the
// effect (below 1 for a local glow), anchored by x and y (0 = left or top edge, 1 = right or bottom edge). The stage
// clips what overflows; the side illustration also masks it with its own alpha.
// Optional at places the texture centre on a painting coordinate, including near an edge.
function atlasSixBox({ fit, zoom = 1, x = 0.5, y = 0.5, at }, painting, texture) {
  const ratio = (painting.width / painting.height) / (texture.width / texture.height);
  let w = 1;
  let h = ratio;
  if (fit === 'cover' && h < 1) {
    w = 1 / h;
    h = 1;
  }
  w *= zoom;
  h *= zoom;
  const round = (value) => Number(value.toFixed(4));
  return [round(at ? at[0] - w / 2 : x * (1 - w)), round(at ? at[1] - h / 2 : y * (1 - h)), round(w), round(h)];
}

// Motion config read by js/symbol-living: one surface per painting (hero, plate, each
// thumbnail), each with its two channels; the hero's scene follows the painting the
// browser shows. Both textures load once, at 960px, and serve every surface. Without
// a texture the page gets no motion script.
function atlasSixLivingConfig(id, assets) {
  const pilot = SYMBOL_ATLAS_SIX[id];
  const { motion } = pilot;
  const src = {
    layer: assets.layer && atlasSixLayerSrc(assets.layer, 960),
    accent: assets.accent && atlasSixLayerSrc(assets.accent, 960),
  };
  const layers = (list, painting) => list
    .filter((layer) => src[layer.texture])
    .map(({ texture, place, ...layer }) => ({ channel: texture === 'layer' ? 'a' : 'b', src: src[texture], box: atlasSixBox(place, painting, assets[texture]), ...layer }));
  const surfaces = [];
  if (assets.hero) {
    const scenes = { landscape: { match: `${ATLAS_SIX_IMAGES}/${id}/hero-`, layers: layers(motion.hero.landscape, assets.hero) } };
    if (assets.portrait) scenes.portrait = { match: `${ATLAS_SIX_IMAGES}/${id}/portrait-`, layers: layers(motion.hero.portrait, assets.portrait) };
    surfaces.push({ name: 'hero', selector: '.symbol-hero', img: '.symbol-hero-media img', figure: '.symbol-hero-figure', depth: motion.parallax, eager: true, scenes });
  }
  if (assets.plate) {
    surfaces.push({ name: 'plate', selector: '[data-living-surface="plate"]', img: 'img', mask: true, scenes: { plate: { match: `${ATLAS_SIX_IMAGES}/${id}/plate-`, layers: layers(motion.plate, assets.plate) } } });
  }
  pilot.scenes.forEach((scene, index) => {
    const role = `scene-${scene.id}`;
    if (!assets[role]) return;
    // Thumbnails share the default effects and phase; a local light can follow its subject in each scene.
    surfaces.push({ name: role, selector: `[data-living-surface="${role}"]`, img: 'img', clip: true, phase: index / pilot.scenes.length, scenes: { [role]: { match: `${ATLAS_SIX_IMAGES}/${id}/${role}-`, layers: layers(motion.scenes?.[scene.id] ?? motion.thumb, assets[role]) } } });
  });
  const live = surfaces.filter((surface) => Object.values(surface.scenes).some((scene) => scene.layers.length > 0));
  if (live.length === 0) return null;
  // No toggles: the pages carry no pause control (owner decision), so the shared module mounts none;
  // reduced motion, a hidden tab and a painting off screen still stop the effects.
  return { surfaces: live };
}

// The tiger's grounds, type and UI colours; only the scene selectors, the thumbnails'
// frames, the side illustration's wrapper and the scenes' anchor differ.
function atlasSixCss(id) {
  return atlasCss(SYMBOL_ATLAS_SIX[id].scenes.map((scene) => scene.id)) + `
        /* Keep the composited hero edge on the page ground, including fractional preview scales. */
        .symbol-hero--living {
            -webkit-mask-image: linear-gradient(#000 calc(100% - 4px), transparent);
            mask-image: linear-gradient(#000 calc(100% - 4px), transparent);
        }
        .symbol-hero--living::after {
            inset: -1px;
            background: linear-gradient(180deg, rgba(8, 3, 15, 0.45) 0%, rgba(8, 3, 15, 0.05) 32%,
                rgba(8, 3, 15, 0.10) 55%, rgba(9, 4, 19, 0.82) 88%, #0a0514 98%, #0a0514 100%);
        }
        /* A scene without its thumbnail yet: the published variation title is the label. */
        .atlas-scene.atlas-scene--text { grid-template-columns: minmax(0, 1fr) auto; padding: 0 1rem 0 1.25rem; min-height: 4rem; }
        /* A thumbnail's two effects never leave its frame, so never reach its label. */
        .atlas-scene-thumb { position: relative; overflow: hidden; }
        .atlas-decor--living picture { display: block; }
        @media (max-width: 767px) {
            /* Reached by #scenes, the title line lands where a variation card lands (12rem),
               below the fixed navbar and section bar. */
            .atlas-scenes { scroll-margin-top: 9.75rem; }
        }`;
}

// Generate HTML page for a symbol
function generatePage(symbol, allSymbols, i18n, extended, lang) {
  const t = i18n[lang];
  const symbolData = symbol[lang];
  const modifiedDate = getSymbolModifiedDate(symbol, lang);
  const homePath = localizedHomePath(lang);
  const homeUrl = localizedHomeUrl(lang);
  const hreflang = generateHreflangUrls(symbol);
  const sharedMetaTitle = generateMetaTitle(symbol, i18n, lang);
  const sharedMetaDescription = generateMetaDescription(symbol, i18n, lang);
  const documentTitle = symbolData.documentTitle || sharedMetaTitle;
  const documentMetaDescription = truncateMetaDescription(
    symbolData.documentMetaDescription || sharedMetaDescription
  );
  const categoryName = getCategoryName(symbol, i18n, lang);
  const relatedSymbols = getRelatedSymbols(symbol, allSymbols, lang);
  const extendedContent = getExtendedContent(symbol.id, extended, lang);

  // Keep web detail behavior aligned with Expo app:
  // only render interpretation/variations when present in shared extended datasets.
  const fullInterpretation = injectEditorialLinks(
    symbol.id,
    lang,
    sanitizeEmDashes(extendedContent.fullInterpretation)
  );
  const variations = Array.isArray(extendedContent.variations) ? extendedContent.variations : [];
  const hasInterpretation = Boolean(fullInterpretation && String(fullInterpretation).trim());
  const hasVariations = variations.length > 0;
  const illustration = resolveSymbolIllustration(
    symbol.id,
    extendedContent.illustration,
    symbolData,
    lang
  );
  const responsiveIllustration = resolveResponsiveSymbolIllustration(illustration);
  const heroImageSizes = '(min-width: 2560px) 2560px, 100vw';
  const preferredImageUrl = responsiveIllustration
    ? `https://noctalia.app${responsiveIllustration.src}`
    : DEFAULT_SOCIAL_IMAGE;
  const preferredImageWidth = responsiveIllustration?.width || 1200;
  const preferredImageHeight = responsiveIllustration?.height || 630;
  const preferredImageAlt = illustration?.alt || sharedMetaTitle;
  const softCta = symbolData.softCta && symbolData.softCta.href
    ? symbolData.softCta
    : null;
  // The same paintings, engines and profiles serve every language with its own words.
  const atlasLocale = atlasLocaleFor(symbol.id, lang);
  const livingPainting = symbol.id === 'tiger' && Boolean(atlasLocale);
  const atlasSix = atlasLocale && Object.hasOwn(SYMBOL_ATLAS_SIX, symbol.id) ? SYMBOL_ATLAS_SIX[symbol.id] : null;
  if (atlasSix && lang === 'fr' && symbolData.slug !== atlasSix.slug) throw new Error(`Atlas ${symbol.id}: the French slug is ${symbolData.slug}, not ${atlasSix.slug}`);
  const atlasSixAssets = atlasSix ? ATLAS_SIX_ASSETS[symbol.id] || {} : null;
  const atlasPage = livingPainting || Boolean(atlasSix);
  let livingPaintingScriptHtml = livingPainting
    ? `\n    <script src="${TIGER_LIVING.dir}/tiger-living-painting.js" defer></script>`
    : '';
  const livingConfig = atlasSix ? atlasSixLivingConfig(symbol.id, atlasSixAssets) : null;
  if (livingConfig) {
    checkSymbolLivingScript();
    livingPaintingScriptHtml = `
    <script type="application/json" id="symbol-living-config">${JSON.stringify(livingConfig).replace(/</g, '\\u003c')}</script>
    <script src="${SYMBOL_LIVING_DIR}/symbol-living.js" defer></script>`;
  }

  // Generate variations HTML
  const variationsHtml = variations.map(v => `
                    <div class="variation-card">
                        <h3>${renderVariationContext(symbol.id, lang, v.context)}</h3>
                        <p>${escapeHtml(sanitizeEmDashes(v.meaning))}</p>
                    </div>`).join('\n');

  const interpretationSectionHtml = hasInterpretation ? `            <!-- Main Interpretation -->
            <section id="meaning" class="symbol-meaning symbol-section">
                <h2 class="symbol-h2">${t.section_interpretation}</h2>
                <div class="prose prose-invert prose-purple max-w-none leading-relaxed space-y-4">
                    ${fullInterpretation}
                </div>
            </section>` : '';

  const variationsSectionHtml = hasVariations ? `            <!-- Variations -->
            <section id="variations" class="symbol-variations symbol-section">
                <h2 class="symbol-h2">${t.section_variations}</h2>
                <div>${variationsHtml}
                </div>
            </section>` : '';

  const heroPictureHtml = illustration && responsiveIllustration ? `
                    <picture class="symbol-hero-media">${livingPainting ? tigerLivingSourcesHtml() : atlasSix ? atlasSixSourcesHtml(atlasSixAssets, heroImageSizes) : ''}${responsiveIllustration.avifSrcset ? `
                        <source type="image/avif" srcset="${escapeHtml(responsiveIllustration.avifSrcset)}" sizes="${heroImageSizes}">` : ''}
                        <img src="${escapeHtml(responsiveIllustration.src)}"
                             ${responsiveIllustration.srcset ? `srcset="${escapeHtml(responsiveIllustration.srcset)}"` : ''}
                             sizes="${heroImageSizes}"
                             alt="${escapeHtml(preferredImageAlt)}"
                             fetchpriority="high"
                             decoding="async"
                             width="${escapeHtml(String(responsiveIllustration.width))}"
                             height="${escapeHtml(String(responsiveIllustration.height))}">
                    </picture>` : '';

  // Generate ask yourself HTML
  const askYourselfHtml = symbolData.askYourself.map(q => `
                    <li class="symbol-question-item">${escapeHtml(q)}</li>`).join('\n');

  // Generate related symbols HTML
  const relatedSymbolsHtml = relatedSymbols.map(rs => `
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${rs.slug}" class="symbol-link">
                        <span>${escapeHtml(rs.name)}</span>
                    </a>`).join('\n');

  // Related reading: a thematic guide when one is mapped, otherwise the
  // related blog article — always naming the actual destination.
  const relatedGuidePage = getRelatedGuidePage(symbol);
  const relatedGuideSlug = relatedGuidePage?.slugs?.[lang];
  const relatedGuideTitle = relatedGuidePage?.[lang]?.title;
  const relatedArticle = symbol.relatedArticles?.[lang];
  let relatedReadingCard = '';
  if (relatedGuideSlug && relatedGuideTitle) {
    relatedReadingCard = `
                <a href="/${lang}/guides/${relatedGuideSlug}" class="symbol-reading-card">
                    <span class="symbol-reading-label">${t.related_guide_label}</span>
                    <h3>${escapeHtml(relatedGuideTitle)}</h3>
                    <span class="symbol-reading-cta">${t.read_guide}</span>
                </a>`;
  } else if (relatedArticle) {
    const relatedArticleTitle = getBlogTitleBySlug(lang, relatedArticle);
    relatedReadingCard = `
                <a href="/${lang}/blog/${relatedArticle}" class="symbol-reading-card">
                    <span class="symbol-reading-label">${t.in_depth_guide}</span>
                    <h3>${escapeHtml(relatedArticleTitle || `${symbolData.name} - ${t.in_depth_guide}`)}</h3>
                    <span class="symbol-reading-cta">${t.read_article}</span>
                </a>`;
  }

  const relatedArticleHtml = relatedReadingCard ? `
            <!-- Related Reading -->
            <section class="symbol-reading symbol-section">
                <h2 class="symbol-h2">${t.section_learn_more}</h2>${relatedReadingCard}
            </section>` : '';

  // The six atlas pages show every published answer (the house has seven).
  const symbolFaq = Array.isArray(symbolData.faq) ? symbolData.faq.slice(0, atlasSix ? undefined : symbol.id === 'spider' && lang === 'it' ? 5 : 4) : [];

  const conversionPath = `/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}`;
  const softCtaHtml = softCta ? `
            <!-- Soft App CTA -->
            <aside class="symbol-soft-cta">
                <div class="flex flex-col sm:flex-row sm:items-center gap-5">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-dream-salmon mb-2">${escapeHtml(softCta.kicker || 'Noctalia')}</p>
                        <h2 class="text-xl md:text-2xl text-dream-cream mb-3">${escapeHtml(softCta.title)}</h2>
                        <p class="text-sm md:text-base leading-relaxed">${escapeHtml(softCta.text)}</p>
                    </div>
                    ${softCta.webButton ? '<div class="flex flex-col gap-3 shrink-0">' : ''}
                    <a${conversionLinkAttributes(conversionPath, 'inline', 'play')} href="${escapeHtml(softCta.href)}" class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-dream-salmon text-dream-dark font-bold hover:bg-dream-salmon/90 transition-colors">
                        ${escapeHtml(softCta.button || t.cta_button)} <i data-lucide="arrow-right" class="w-5 h-5"></i>
                    </a>${softCta.webButton ? `
                    <a${conversionLinkAttributes(conversionPath, 'inline', 'web')} href="${escapeHtml(getWebAppUrl(lang, { medium: 'symbol_page', content: symbol.id }))}" class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full glass-button text-dream-cream font-bold transition-colors" rel="noopener">${escapeHtml(softCta.webButton)}</a>
                    </div>` : ''}
                </div>
            </aside>` : '';
  const visibleHeadline = `${t.h1_prefix} ${symbolData.name}`.trim();
  const sheetLabels = getSymbolSheetLabels(lang);
  const jumpItems = [
    {
      href: 'meaning',
      icon: 'eye',
      label: sheetLabels.meaning,
      enabled: hasInterpretation
    },
    {
      href: 'variations',
      icon: 'waves',
      label: sheetLabels.variations,
      enabled: hasVariations
    },
    {
      href: 'questions',
      icon: 'help-circle',
      label: sheetLabels.questions,
      enabled: true
    }
  ].filter(item => item.enabled);
  // The atlas sets the questions before the variations: its bar follows the page,
  // which the active-link scan below expects.
  if (atlasPage) jumpItems.sort((a, b) => Number(a.href === 'variations') - Number(b.href === 'variations'));
  const jumpNavHtml = jumpItems.map((item, index) => `
                    <a href="#${item.href}" class="symbol-jump-link ${index === 0 ? 'is-active' : ''}">
                        <i data-lucide="${item.icon}" class="w-5 h-5"></i>
                        <span>${escapeHtml(item.label)}</span>
                    </a>`).join('');
  const definedTermJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: symbolData.name,
    description: symbolData.shortDescription,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: t.symbols,
      url: `https://noctalia.app/${lang}/guides/${t.dictionary_slug}`
    },
    url: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}`
  };

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: visibleHeadline,
    description: sharedMetaDescription,
    image: {
      '@type': 'ImageObject',
      contentUrl: preferredImageUrl,
      url: preferredImageUrl,
      width: preferredImageWidth,
      height: preferredImageHeight,
    },
    author: canonicalOrganization(),
    publisher: canonicalOrganization(),
    datePublished: CONFIG.datePublished,
    dateModified: modifiedDate,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}` },
    inLanguage: getLanguageTag(lang)
  };

  const breadcrumbListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: homeUrl },
      { '@type': 'ListItem', position: 2, name: t.symbols, item: `https://noctalia.app/${lang}/guides/${t.dictionary_slug}` },
      { '@type': 'ListItem', position: 3, name: symbolData.name, item: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}` }
    ]
  };

  const faqItems = symbolFaq;
  const faqCardsHtml = faqItems.map(item => `
                    <div class="symbol-faq-card">
                        <h3>${escapeHtml(sanitizeEmDashes(item.question))}</h3>
                        <p>${escapeHtml(sanitizeEmDashes(item.answer))}</p>
                    </div>`).join('\n');

  const faqPageJsonLd = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: sanitizeEmDashes(item.question),
      acceptedAnswer: { '@type': 'Answer', text: sanitizeEmDashes(item.answer) }
    }))
  } : null;
  const faqSectionHtml = faqItems.length > 0 ? `
            <section class="symbol-faq symbol-section">
                <h2 class="symbol-h2">${t.section_faq}</h2>
                <div>${faqCardsHtml}
                </div>
            </section>` : '';

  // Language dropdown items
  const langItems = {
    en: { flag: '🇺🇸', name: 'English' },
    fr: { flag: '🇫🇷', name: 'Français' },
    es: { flag: '🇪🇸', name: 'Español' },
    de: { flag: '🇩🇪', name: 'Deutsch' },
    it: { flag: '🇮🇹', name: 'Italiano' }
  };

  const langDropdownHtml = Object.keys(langItems).map(l => {
    const isActive = l === lang;
    const targetSlug = symbol[l]?.slug || symbolData.slug;
    const activeClass = isActive ? 'text-dream-salmon bg-dream-salmon/10' : 'text-purple-100/80 hover:text-white hover:bg-white/5';
    return `
                        <a href="/${l}/${CONFIG.symbolsPath[l]}/${targetSlug}" hreflang="${l}" class="flex items-center gap-3 px-4 py-2 text-sm ${activeClass} transition-colors" role="menuitem">
                            <span class="w-5 text-center">${langItems[l].flag}</span> ${langItems[l].name}
                        </a>`;
  }).join('\n');

  // Generate hreflang links
  const hreflangLinks = CONFIG.languages
    .filter(l => hreflang[l])
    .map(l => `    <link rel="alternate" hreflang="${getLanguageTag(l)}" href="${hreflang[l]}">`)
    .join('\n');
  const currentPaths = Object.fromEntries(
    CONFIG.languages.map(l => [l, `/${l}/${CONFIG.symbolsPath[l]}/${symbol[l]?.slug || symbolData.slug}`])
  );
  const atlasArticleHtml = atlasPage ? renderAtlasArticle({
    lang, t, symbolData, sheetLabels,
    interpretationHtml: fullInterpretation,
    variations,
    variationsHtml,
    askYourselfHtml,
    faqCardsHtml,
    relatedSymbolsHtml,
    relatedReadingCard,
    jumpNavHtml,
    jumpCount: jumpItems.length,
    conversionActions: (placement) => renderTigerAtlasActions(lang, symbol.id, currentPaths[lang], placement),
  }, livingPainting ? {
    ...TIGER_ATLAS_PAGE,
    ...atlasLocale,
    scenes: { ...atlasLocale.scenes, choices: TIGER_ATLAS.scenes.choices.map((choice) => ({ ...choice, ...atlasLocale.sceneLocales[choice.id] })) },
  } : {
    ...atlasLocale,
    name: `Atlas ${symbol.id}`,
    scenes: { ...atlasLocale.scenes, choices: atlasSix.scenes.map((scene) => ({ id: scene.id, ...atlasLocale.sceneLocales[scene.id], image: atlasSixAssets[`scene-${scene.id}`] ? `scene-${scene.id}` : undefined })) },
    sceneText: 'full',
    omitJournal: false,
    scenePicture: (role) => renderAtlasSixScenePicture(role, atlasSixAssets[role]),
    decorHtml: () => (atlasSixAssets.plate ? renderAtlasSixPlate(atlasSixAssets.plate) : ''),
  }) : '';

  // Generate the full HTML
  return `<!DOCTYPE html>
<html lang="${getLanguageTag(lang)}" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(documentTitle)} | Noctalia</title>
    <meta name="description" content="${escapeHtml(documentMetaDescription)}">
    <link rel="canonical" href="https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}">
${hreflangLinks}
    <link rel="alternate" hreflang="x-default" href="${hreflang.en}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="64x64 48x48 32x32 16x16">
    <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">
    <link rel="apple-touch-icon" href="/logo192.png" sizes="192x192">
${renderAhrefsAnalyticsScript()}

    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(sharedMetaTitle)}">
    <meta property="og:description" content="${escapeHtml(symbolData.shortDescription)}">
    <meta property="og:url" content="https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}">
    <meta property="og:image" content="${preferredImageUrl}">
    <meta property="og:site_name" content="Noctalia">
    <meta property="og:image:width" content="${preferredImageWidth}">
    <meta property="og:image:height" content="${preferredImageHeight}">
    <meta property="og:image:alt" content="${escapeHtml(preferredImageAlt)}">
    <meta property="og:locale" content="${t.locale}">
${CONFIG.languages.filter(l => l !== lang).map(l => `    <meta property="og:locale:alternate" content="${siteConfig.localeCodes[l]}">`).join('\n')}
    <meta property="article:published_time" content="${CONFIG.datePublished}">
    <meta property="article:modified_time" content="${modifiedDate}">
    <meta property="article:author" content="Noctalia">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(sharedMetaTitle)}">
    <meta name="twitter:description" content="${escapeHtml(symbolData.shortDescription)}">
    <meta name="twitter:image" content="${preferredImageUrl}">
    <meta name="twitter:site" content="@NoctaliaDreams">
    <meta name="twitter:image:alt" content="${escapeHtml(preferredImageAlt)}">

    <!-- Fonts -->
    <link rel="preload" href="/fonts/Outfit-Regular.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Outfit-Bold.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Fraunces-Variable.woff2" as="font" type="font/woff2" crossorigin>

    <!-- Styles -->
    <link rel="stylesheet" href="/css/styles.min.css?v=${CONFIG.cssVersion}">
    <link rel="stylesheet" href="/css/language-dropdown.css?v=${CONFIG.cssVersion}">
${renderSharedComponentStyles()}

    <style>
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0a0514; }
        ::-webkit-scrollbar-thumb { background: #39294f; border-radius: 4px; }
        html, body { overflow-x: hidden; }

        .symbol-page {
            --cream: #fff7ed;
            --cream-88: rgba(255, 247, 237, 0.88);
            --cream-64: rgba(255, 247, 237, 0.64);
            --cream-45: rgba(255, 247, 237, 0.45);
            --cream-35: rgba(255, 247, 237, 0.35);
            --line: rgba(255, 247, 237, 0.10);
            --salmon: #ead4b4;
            --salmon-dim: rgba(234, 212, 180, 0.72);
        }
        .symbol-page a:focus-visible {
            outline: 2px solid var(--salmon);
            outline-offset: 3px;
            border-radius: 2px;
        }
        /* Static night backdrop + film grain (no animated aurora, no orbs) */
        .aurora-bg {
            position: fixed; inset: 0; z-index: -1;
            background:
                radial-gradient(58rem 38rem at 88% -12%, rgba(234, 212, 180, 0.07), transparent 62%),
                radial-gradient(46rem 34rem at -8% -6%, rgba(150, 122, 204, 0.09), transparent 58%),
                #0a0512;
        }
        .symbol-page::after {
            content: '';
            position: fixed; inset: 0; z-index: 90;
            pointer-events: none; opacity: 0.05;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
        }
        .glass-button {
            background: rgba(255, 247, 237, 0.04);
            border: 1px solid rgba(255, 247, 237, 0.16);
            transition: border-color 0.25s ease, background 0.25s ease, transform 0.2s ease;
        }
        .glass-button:hover { background: rgba(255, 247, 237, 0.08); border-color: rgba(234, 212, 180, 0.45); }
        .glass-button:active { transform: scale(0.98); }
        .symbol-page-main {
            position: relative;
            padding-top: 0 !important;
            padding-inline: 0;
        }
        .symbol-page-main > article {
            width: calc(100% - 2rem);
            max-width: 48rem;
            margin-inline: auto;
        }
        .symbol-breadcrumb {
            margin-bottom: auto;
            padding-top: 0;
            font-size: 0.8rem;
            letter-spacing: 0.03em;
            color: var(--cream-45);
        }
        .symbol-breadcrumb a { color: var(--cream-64); transition: color 0.25s ease; }
        .symbol-breadcrumb a:hover { color: var(--salmon); }
        .symbol-breadcrumb .text-purple-400 { color: var(--cream-35); }
        .symbol-breadcrumb .text-dream-cream { color: var(--cream-88); }
        .symbol-hero {
            position: relative;
            width: 100%;
            max-width: 2560px;
            aspect-ratio: 16 / 9;
            margin: 0 auto;
            isolation: isolate;
            overflow: hidden;
            background: #090413;
        }
        .symbol-hero-figure {
            position: absolute;
            inset: 0;
            z-index: 0;
            width: 100%;
            height: 100%;
            margin: 0;
        }
        .symbol-hero-media {
            position: absolute;
            inset: 0;
            display: block;
            width: 100%;
            height: 100%;
        }
        .symbol-hero-media img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
            object-position: center;
        }
        .symbol-hero::after {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 1;
            pointer-events: none;
            background: linear-gradient(180deg,
                rgba(8, 3, 15, 0.45) 0%,
                rgba(8, 3, 15, 0.05) 32%,
                rgba(8, 3, 15, 0.10) 55%,
                rgba(9, 4, 19, 0.82) 88%,
                #0a0512 100%);
        }
        .symbol-hero-overlay {
            position: absolute;
            inset: 0;
            z-index: 2;
            display: flex;
            flex-direction: column;
            width: min(100%, 48rem);
            height: 100%;
            margin: 0 auto;
            padding: 6.5rem 1rem clamp(3rem, 7vh, 5rem);
        }
        .symbol-hero-copy {
            width: 100%;
            min-width: 0;
            margin-top: auto;
        }
        .symbol-chip {
            display: inline-flex;
            align-items: center;
            padding: 0.6rem 0.9rem;
            border: 1px solid rgba(255, 247, 237, 0.24);
            border-radius: 3px;
            font-size: 0.68rem;
            font-weight: 500;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--cream-88);
            transition: border-color 0.25s ease, color 0.25s ease;
        }
        .symbol-chip--accent { color: var(--salmon); border-color: rgba(234, 212, 180, 0.45); }
        a.symbol-chip:hover { border-color: var(--salmon); color: var(--salmon); }
        .symbol-heading {
            width: min(100%, 14ch);
            max-width: 100%;
            color: var(--cream);
            font-weight: 560;
            font-size: clamp(3rem, 7.5vw, 6rem) !important;
            line-height: 0.94 !important;
            letter-spacing: -0.015em;
            overflow-wrap: anywhere;
            hyphens: auto;
            text-wrap: balance;
            text-shadow: 0 3px 28px rgba(8, 3, 15, 0.78);
        }
        .symbol-hero-caption {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            clip-path: inset(50%);
            white-space: nowrap;
            border: 0;
        }
        .symbol-summary {
            margin-top: clamp(2rem, 4vw, 3rem);
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 340;
            font-size: clamp(1.25rem, 2vw, 1.5rem) !important;
            line-height: 1.5 !important;
            color: var(--cream-88);
            max-width: 36rem;
            text-wrap: pretty;
        }

        /* Content sections: hairline structure, no glass boxes */
        .symbol-section {
            border-top: 1px solid var(--line);
            padding-top: clamp(2.25rem, 4vw, 3rem);
            margin-bottom: clamp(3rem, 6vw, 4.5rem);
        }
        .symbol-h2 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 550;
            font-size: clamp(1.45rem, 2.4vw, 1.9rem);
            line-height: 1.15;
            letter-spacing: -0.01em;
            color: var(--cream);
            margin-bottom: clamp(1.25rem, 2.5vw, 1.75rem);
        }
        .symbol-h2::before {
            content: '';
            display: block;
            width: 2rem;
            height: 2px;
            background: var(--salmon);
            margin-bottom: 1rem;
        }
        .symbol-meaning,
        .symbol-variations,
        .symbol-questions {
            scroll-margin-top: 7rem;
        }
        .symbol-meaning .prose {
            color: var(--cream-64);
            font-size: 1.02rem;
            line-height: 1.8;
        }
        .symbol-meaning .prose p { max-width: 42rem; }
        .symbol-meaning .prose a {
            color: var(--salmon);
            text-decoration: underline;
            text-decoration-color: rgba(234, 212, 180, 0.35);
            text-underline-offset: 3px;
            transition: text-decoration-color 0.25s ease;
        }
        .symbol-meaning .prose a:hover { text-decoration-color: var(--salmon); }

        /* Variations: numbered editorial rows */
        .symbol-variations { counter-reset: variation; }
        .variation-card {
            position: relative;
            padding: 1.35rem 0 1.35rem 3.25rem;
            border-top: 1px solid var(--line);
        }
        .variation-card:last-child { border-bottom: 1px solid var(--line); }
        .variation-card::before {
            counter-increment: variation;
            content: counter(variation, decimal-leading-zero);
            position: absolute;
            left: 0;
            top: 1.55rem;
            font-size: 0.75rem;
            font-weight: 500;
            letter-spacing: 0.14em;
            color: var(--salmon-dim);
        }
        .variation-card h3 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 550;
            font-size: 1.08rem;
            color: var(--cream);
            margin-bottom: 0.35rem;
            transition: color 0.25s ease;
        }
        .variation-card:hover h3 { color: var(--salmon); }
        .variation-card p {
            color: var(--cream-64);
            font-size: 0.95rem;
            line-height: 1.7;
            max-width: 42rem;
        }

        /* Ask yourself */
        .symbol-questions ul { margin: 0; padding: 0; list-style: none; }
        .symbol-question-item {
            border-top: 1px solid var(--line);
            padding: 1.05rem 0;
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 400;
            font-size: 1.12rem;
            line-height: 1.5;
            color: var(--cream-88);
        }
        .symbol-question-item:last-child { border-bottom: 1px solid var(--line); }

        /* FAQ */
        .symbol-faq-card { border-top: 1px solid var(--line); padding: 1.35rem 0; }
        .symbol-faq-card:last-child { border-bottom: 1px solid var(--line); }
        .symbol-faq-card h3 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 550;
            font-size: 1.08rem;
            color: var(--cream);
            margin-bottom: 0.4rem;
        }
        .symbol-faq-card p {
            color: var(--cream-64);
            font-size: 0.95rem;
            line-height: 1.7;
            max-width: 42rem;
        }

        /* Related symbols: index list */
        .symbol-related-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            column-gap: 2.5rem;
            border-bottom: 1px solid var(--line);
        }
        .symbol-link {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.95rem 0;
            border-top: 1px solid var(--line);
        }
        .symbol-link span {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-size: 1.05rem;
            color: var(--cream-88);
            transition: color 0.25s ease;
        }
        .symbol-link::after {
            content: '\\2192';
            font-size: 0.9rem;
            color: var(--cream-35);
            transition: transform 0.25s ease, color 0.25s ease;
        }
        .symbol-link:hover { border-top-color: rgba(234, 212, 180, 0.55); }
        .symbol-link:hover span { color: var(--cream); }
        .symbol-link:hover::after { transform: translateX(4px); color: var(--salmon); }

        /* Related reading */
        .symbol-reading-card { display: block; padding-top: 0.25rem; }
        .symbol-reading-label {
            display: block;
            font-size: 0.68rem;
            font-weight: 500;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--salmon);
            margin-bottom: 0.6rem;
        }
        .symbol-reading-card h3 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 550;
            font-size: 1.25rem;
            line-height: 1.3;
            color: var(--cream);
            margin-bottom: 0.5rem;
            transition: color 0.25s ease;
        }
        .symbol-reading-card:hover h3 { color: var(--salmon); }
        .symbol-reading-cta {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.85rem;
            color: var(--cream-45);
            transition: color 0.25s ease;
        }
        .symbol-reading-cta::after {
            content: '\\2192';
            transition: transform 0.25s ease, color 0.25s ease;
        }
        .symbol-reading-card:hover .symbol-reading-cta { color: var(--cream-88); }
        .symbol-reading-card:hover .symbol-reading-cta::after { transform: translateX(4px); color: var(--salmon); }

        /* Soft app CTA */
        .symbol-soft-cta {
            border: 1px solid rgba(234, 212, 180, 0.22);
            border-radius: 0.75rem;
            background:
                radial-gradient(30rem 14rem at 12% 0%, rgba(234, 212, 180, 0.09), transparent 65%),
                rgba(255, 247, 237, 0.02);
            padding: clamp(1.5rem, 3vw, 2.25rem);
            margin-bottom: clamp(3rem, 6vw, 4.5rem);
        }
        .symbol-soft-cta h2 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 550;
            letter-spacing: -0.01em;
        }
        .symbol-soft-cta p { color: var(--cream-64); }
        .symbol-soft-cta a { flex-shrink: 0; transition: transform 0.2s ease, background 0.25s ease; }
        .symbol-soft-cta a:hover { transform: translateY(-1px); }
        .symbol-soft-cta a:active { transform: translateY(0) scale(0.98); }

        /* Final CTA */
        .symbol-final-cta {
            position: relative;
            overflow: hidden;
            border: 1px solid var(--line);
            border-radius: 1rem;
            background:
                radial-gradient(36rem 16rem at 50% -20%, rgba(234, 212, 180, 0.12), transparent 70%),
                rgba(255, 247, 237, 0.02);
            padding: clamp(2.5rem, 6vw, 4rem) clamp(1.5rem, 4vw, 3rem);
            text-align: center;
        }
        .symbol-final-cta h3 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 560;
            font-size: clamp(1.6rem, 3vw, 2.25rem);
            letter-spacing: -0.015em;
            color: var(--cream);
            margin-bottom: 0.85rem;
            text-wrap: balance;
        }
        .symbol-final-cta p { color: var(--cream-64); }
        .symbol-final-cta a { transition: transform 0.2s ease, background 0.25s ease, border-color 0.25s ease; }
        .symbol-final-cta a:active { transform: scale(0.98); }

        .symbol-back-link {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.6rem 0;
            color: var(--cream-45);
            font-size: 0.9rem;
            transition: color 0.25s ease;
        }
        .symbol-back-link::before { content: '\\2190'; transition: transform 0.25s ease; }
        .symbol-back-link:hover { color: var(--salmon); }
        .symbol-back-link:hover::before { transform: translateX(-4px); }

        /* Jump nav (mobile only) */
        .symbol-jump-nav { display: none; }
        @media (max-width: 767px) {
            .symbol-page-main {
                padding-top: 0 !important;
                padding-inline: 0;
                padding-bottom: 3.5rem !important;
            }
            .symbol-breadcrumb { display: none; }
            .symbol-hero {
                margin-bottom: 0 !important;
            }
            .symbol-hero-overlay {
                padding: 5rem 1rem 1.25rem;
            }
            .symbol-hero-chips { display: none !important; }
            .symbol-category-chip { display: none !important; }
            .symbol-heading {
                margin-bottom: 0 !important;
                font-size: clamp(2rem, 9.5vw, 2.9rem) !important;
                line-height: 0.98 !important;
                letter-spacing: -0.01em !important;
            }
            .symbol-summary {
                font-size: 1.15rem !important;
                line-height: 1.55 !important;
            }
            .symbol-jump-nav {
                position: sticky;
                top: 4.65rem;
                z-index: 25;
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                overflow: hidden;
                margin: 1.1rem 0 1.75rem;
                border: 1px solid var(--line);
                border-radius: 4px;
                background: rgba(10, 5, 18, 0.94);
                backdrop-filter: blur(18px);
                -webkit-backdrop-filter: blur(18px);
            }
            .symbol-jump-link {
                min-height: 3.9rem;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 0.3rem;
                color: var(--cream-45);
                font-size: 0.68rem;
                font-weight: 500;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                border-left: 1px solid var(--line);
            }
            .symbol-jump-link:first-child { border-left: 0; }
            .symbol-jump-link:focus { outline: none; }
            .symbol-jump-link:focus-visible {
                outline: 2px solid var(--salmon);
                outline-offset: -4px;
            }
            .symbol-jump-link.is-active {
                color: var(--cream);
                box-shadow: inset 0 -2px 0 var(--salmon);
            }
            .symbol-jump-link.is-active svg { color: var(--salmon); }
            body.symbol-jump-fixed .symbol-jump-nav {
                position: fixed;
                left: 1rem;
                right: 1rem;
                top: 4.65rem;
                margin: 0;
                max-width: calc(100vw - 2rem);
            }
            body.symbol-jump-fixed .symbol-jump-nav + section {
                margin-top: 6rem !important;
            }
            .symbol-soft-cta a { width: 100%; }
            .symbol-related-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
                column-gap: 1.5rem;
            }
            .variation-card { padding-left: 2.5rem; }
        }
    </style>${livingPainting ? tigerLivingStyleHtml() : atlasSix ? livingStyleHtml(atlasSix.portraitPosition, atlasSixCss(symbol.id)) : ''}

    <!-- Schema.org DefinedTerm -->
${renderJsonLd(definedTermJsonLd)}

    <!-- Schema.org Article -->
${renderJsonLd(articleJsonLd)}

    <!-- Schema.org BreadcrumbList -->
${renderJsonLd(breadcrumbListJsonLd)}

${faqPageJsonLd ? `    <!-- Schema.org FAQPage -->\n${renderJsonLd(faqPageJsonLd)}` : ''}
</head>

<body class="symbol-page bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden" style="background-color: #0a0514;">
    <div class="aurora-bg"></div>

    <!-- Navbar -->
${renderPseoNav(lang, currentPaths, 'dictionary')}

    <main class="symbol-page-main pb-20">
            <!-- Header -->
            <header class="symbol-hero${atlasPage ? ' symbol-hero--living' : ''}" data-image-seo-hero="true">
                <figure class="symbol-hero-figure" data-image-seo-role="symbol-hero" data-image-asset-id="symbol.${escapeHtml(symbol.id)}">
${heroPictureHtml}
                    ${illustration?.caption ? `<figcaption class="symbol-hero-caption">${escapeHtml(illustration.caption)}</figcaption>` : ''}
                </figure>
                <div class="symbol-hero-overlay">
                    <nav class="symbol-breadcrumb text-sm" aria-label="Breadcrumb">
                        <ol class="flex items-center gap-2 flex-wrap">
                            <li><a href="${homePath}" class="hover:text-dream-salmon transition-colors">${t.home}</a></li>
                            <li class="text-purple-400">/</li>
                            <li><a href="/${lang}/guides/${t.dictionary_slug}" class="hover:text-dream-salmon transition-colors">${t.symbols}</a></li>
                            <li class="text-purple-400">/</li>
                            <li><span class="text-dream-cream">${escapeHtml(symbolData.name)}</span></li>
                        </ol>
                    </nav>
                    <div class="symbol-hero-copy">
                        <div class="symbol-hero-chips flex flex-wrap gap-3 mb-6">
                            <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${t.category_slugs[symbol.category]}"
                               class="symbol-category-chip symbol-chip">
                                ${categoryName}
                            </a>
                        </div>

                        <h1 class="symbol-heading font-serif text-3xl md:text-6xl mb-0 leading-[0.96]">
                            <span data-page-intent="quick-symbol-reference">${escapeHtml(symbolData.name)}</span>
                        </h1>
                    </div>
                </div>
            </header>

        ${atlasPage ? atlasArticleHtml : `<article class="max-w-3xl mx-auto">
            <p class="symbol-summary text-lg leading-relaxed">
                ${escapeHtml(symbolData.shortDescription)}
            </p>

            <nav class="symbol-jump-nav" aria-label="${escapeHtml(sheetLabels.jumpNav)}" style="grid-template-columns: repeat(${jumpItems.length}, minmax(0, 1fr));">${jumpNavHtml}
            </nav>

${interpretationSectionHtml}

${variationsSectionHtml}

            <!-- Ask Yourself -->
            <section id="questions" class="symbol-questions symbol-section">
                <h2 class="symbol-h2">${t.section_ask_yourself}</h2>
                <ul>${askYourselfHtml}
                </ul>
            </section>

${softCtaHtml}
${faqSectionHtml}

            <!-- Related Symbols -->
            ${relatedSymbols.length > 0 ? `<section class="symbol-related symbol-section">
                <h2 class="symbol-h2">${t.section_related_symbols}</h2>
                <div class="symbol-related-grid">${relatedSymbolsHtml}
                </div>
            </section>` : ''}
${relatedArticleHtml}
            <!-- CTA Section -->
            <aside class="symbol-final-cta">
                <h3>${t.cta_title}</h3>
                <p class="mb-6 max-w-lg mx-auto">
                    ${t.cta_description}
                </p>
                ${renderSymbolConversionActions(lang, symbol.id, currentPaths[lang])}
            </aside>

            <!-- Back to Dictionary -->
            <div class="mt-10 text-center">
                <a href="/${lang}/guides/${t.dictionary_slug}" class="symbol-back-link">${t.back_to_dictionary}</a>
            </div>

        </article>`}
    </main>

${renderPseoFooter(lang, currentPaths, 'dictionary')}

    <script src="/js/site-shell.js?v=${CONFIG.cssVersion}" defer></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const jumpLinks = Array.from(document.querySelectorAll('.symbol-jump-link'));
            const jumpNav = document.querySelector('.symbol-jump-nav');
            const jumpTargets = jumpLinks
                .map((link) => {
                    const hash = link.getAttribute('href');
                    return hash ? { hash, section: document.querySelector(hash) } : null;
                })
                .filter((item) => item && item.section);
            let jumpStart = 0;
            const refreshJumpStart = () => {
                if (!jumpNav) return;
                document.body.classList.remove('symbol-jump-fixed');
                jumpStart = jumpNav.getBoundingClientRect().top + window.scrollY;
            };
            const updateJumpPosition = () => {
                if (!jumpNav || window.innerWidth >= 768) {
                    document.body.classList.remove('symbol-jump-fixed');
                    return;
                }
                document.body.classList.toggle('symbol-jump-fixed', window.scrollY > jumpStart - 76);
            };
            const setActiveJumpLink = (hash) => {
                if (!jumpLinks.length) return;
                const normalized = hash || jumpLinks[0].getAttribute('href');
                jumpLinks.forEach((link) => {
                    link.classList.toggle('is-active', link.getAttribute('href') === normalized);
                });
            };
            const getJumpOffset = () => window.innerWidth < 768 ? 188 : 96;
            const updateActiveJumpLink = () => {
                if (!jumpTargets.length) return;
                const probeY = getJumpOffset() + 1;
                let activeHash = jumpTargets[0].hash;
                for (const target of jumpTargets) {
                    const rect = target.section.getBoundingClientRect();
                    if (rect.top <= probeY) {
                        activeHash = target.hash;
                    }
                    if (rect.top <= probeY && rect.bottom > probeY) break;
                }
                setActiveJumpLink(activeHash);
            };
            jumpLinks.forEach((link) => {
                link.addEventListener('click', (event) => {
                    const hash = link.getAttribute('href');
                    const target = hash ? document.querySelector(hash) : null;
                    if (!hash || !target) {
                        setActiveJumpLink(hash);
                        return;
                    }
                    event.preventDefault();
                    setActiveJumpLink(hash);
                    const offset = getJumpOffset();
                    const top = target.getBoundingClientRect().top + window.scrollY - offset;
                    window.history.pushState(null, '', hash);
                    window.scrollTo({ top, behavior: 'smooth' });
                });
            });
            window.addEventListener('hashchange', () => setActiveJumpLink(window.location.hash));
            window.addEventListener('resize', () => {
                refreshJumpStart();
                updateJumpPosition();
                updateActiveJumpLink();
            });
            window.addEventListener('scroll', () => {
                updateJumpPosition();
                updateActiveJumpLink();
            }, { passive: true });
            refreshJumpStart();
            updateJumpPosition();
            if (window.location.hash) {
                setActiveJumpLink(window.location.hash);
            } else {
                updateActiveJumpLink();
            }
        });
    </script>
    <script src="/js/language-dropdown.js?v=${CONFIG.cssVersion}" defer></script>
    <script src="/js/mobile-menu.js?v=${CONFIG.cssVersion}" defer></script>${livingPaintingScriptHtml}
</body>
</html>`;
}

// Main function
function main() {
  console.log('🌙 Dream Symbol Pages Generator\n');

  // Load data
  const { symbols, i18n, extended } = loadData();
  console.log(`📚 Loaded ${symbols.symbols.length} symbols`);
  console.log(`🌍 Languages: ${CONFIG.languages.join(', ')}`);

  // Filter by priority if specified
  let symbolsToGenerate = symbols.symbols;
  if (args.priority) {
    const priority = parseInt(args.priority);
    symbolsToGenerate = symbolsToGenerate.filter(s => s.priority === priority);
    console.log(`🎯 Filtered to priority ${priority}: ${symbolsToGenerate.length} symbols`);
  }

  // Filter by symbol id(s) if specified (comma-separated)
  if (args.id) {
    const ids = String(args.id).split(',').map(s => s.trim()).filter(Boolean);
    const unknown = ids.filter(id => !symbols.symbols.some(symbol => symbol.id === id));
    if (!ids.length || unknown.length) {
      throw new Error(`Unknown --id: ${unknown.join(', ') || '(empty)'}. No pages were written.`);
    }
    symbolsToGenerate = symbolsToGenerate.filter(s => ids.includes(s.id));
    console.log(`🔎 Filtered to ids: ${ids.join(', ')} (${symbolsToGenerate.length} symbols)`);
  }

  // Filter by language if specified
  let languages = CONFIG.languages;
  if (args.lang) {
    languages = [args.lang];
    console.log(`🌍 Filtered to language: ${args.lang}`);
  }

  // Calculate total pages
  const totalPages = symbolsToGenerate.length * languages.length;
  console.log(`\n📄 Generating ${totalPages} pages...\n`);

  let generated = 0;
  let errors = 0;

  // Generate pages
  for (const lang of languages) {
    const langDir = path.join(CONFIG.outputDir, lang, CONFIG.symbolsPath[lang]);

    // Create directory if not dry run
    if (!args['dry-run']) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    for (const symbol of symbolsToGenerate) {
      const symbolData = symbol[lang];
      if (!symbolData) {
        console.log(`⚠️  Skipping ${symbol.id} for ${lang} (no translation)`);
        errors++;
        continue;
      }

      const filename = `${symbolData.slug}.html`;
      const filepath = path.join(langDir, filename);

      try {
        const html = generatePage(symbol, symbols.symbols, i18n, extended, lang);

        if (args['dry-run']) {
          console.log(`  [DRY RUN] Would create: ${filepath}`);
        } else {
          const hasExplicitModifiedDate = hasExplicitSymbolModifiedDate(symbol, lang);
          writeGeneratedHtml(filepath, html, {
            preserveDateOnlyChanges: !hasExplicitModifiedDate,
            preserveExistingModifiedDate: !hasExplicitModifiedDate,
          });
          console.log(`  ✅ ${lang}/${CONFIG.symbolsPath[lang]}/${filename}`);
        }
        generated++;
      } catch (err) {
        console.error(`  ❌ Error generating ${symbol.id} (${lang}): ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n✨ Done! Generated ${generated} pages, ${errors} errors.`);

  if (!args['dry-run']) {
    console.log(`\n📁 Output directories:`);
    for (const lang of languages) {
      console.log(`   /${lang}/${CONFIG.symbolsPath[lang]}/`);
    }
  }

  if (args.id || args.priority) {
    console.log('\nℹ️  Skipping category and curation pages because a symbol filter is active.');
    return;
  }

  generateCategoryPages(symbols, i18n, languages);
  generateCurationPages(symbols, i18n, languages);
}

// =====================================================
// CATEGORY PAGES GENERATION
// =====================================================

// Get category name for a given category ID
function getCategoryNameById(categoryId, lang) {
  const categories = {
    nature: { en: 'Nature', fr: 'Nature', es: 'Naturaleza', de: 'Natur', it: 'Natura', 'pt-br': 'Natureza' },
    animals: { en: 'Animals', fr: 'Animaux', es: 'Animales', de: 'Tiere', it: 'Animali', 'pt-br': 'Animais' },
    body: { en: 'Body', fr: 'Corps', es: 'Cuerpo', de: 'Körper', it: 'Corpo', 'pt-br': 'Corpo' },
    places: { en: 'Places', fr: 'Lieux', es: 'Lugares', de: 'Orte', it: 'Luoghi', 'pt-br': 'Lugares' },
    objects: { en: 'Objects', fr: 'Objets', es: 'Objetos', de: 'Objekte', it: 'Oggetti', 'pt-br': 'Objetos' },
    actions: { en: 'Actions', fr: 'Actions', es: 'Acciones', de: 'Handlungen', it: 'Azioni', 'pt-br': 'Ações' },
    people: { en: 'People', fr: 'Personnes', es: 'Personas', de: 'Menschen', it: 'Persone', 'pt-br': 'Pessoas' },
    celestial: { en: 'Celestial', fr: 'Céleste', es: 'Celestial', de: 'Himmlisch', it: 'Celeste', 'pt-br': 'Celeste' }
  };
  return categories[categoryId]?.[lang] || categoryId;
}

// Generate category hreflang URLs
function generateCategoryHreflangUrls(categoryId, i18n) {
  const urls = {};
  for (const l of CONFIG.languages) {
    if (i18n[l]?.category_slugs?.[categoryId]) {
      urls[l] = `https://noctalia.app/${l}/${CONFIG.symbolsPath[l]}/${i18n[l].category_slugs[categoryId]}`;
    }
  }
  return urls;
}

// Generate category meta title
function generateCategoryMetaTitle(categoryId, i18n, lang) {
  const template = i18n[lang].category_meta_title_template;
  const categoryName = getCategoryNameById(categoryId, lang);
  return template.replace(/{category}/g, categoryName);
}

// Generate category meta description
function generateCategoryMetaDescription(categoryId, i18n, lang) {
  const template = i18n[lang].category_meta_description_template;
  const categoryName = getCategoryNameById(categoryId, lang);
  const description = template
    .replace(/{category}/g, categoryName)
    .replace(/{category_lower}/g, categoryName.toLowerCase());
  return truncateMetaDescription(description);
}

function getCurationMetaTitle(page, lang) {
  return CURATION_META_TITLE_OVERRIDES[page.id]?.[lang] || page[lang].metaTitle || page[lang].title;
}

// Generate category page HTML
function generateCategoryPage(categoryId, symbolsInCategory, allSymbols, allCategories, i18n, lang, curationPages) {
  const t = i18n[lang];
  const homePath = localizedHomePath(lang);
  const homeUrl = localizedHomeUrl(lang);
  const categoryName = getCategoryNameById(categoryId, lang);
  const categorySchemaName = t.category_h1_template.replace(/{category}/g, categoryName);
  const categorySlug = t.category_slugs[categoryId];
  const hreflang = generateCategoryHreflangUrls(categoryId, i18n);
  const metaTitle = generateCategoryMetaTitle(categoryId, i18n, lang);
  const metaDescription = generateCategoryMetaDescription(categoryId, i18n, lang);
  const categoryIntro = t.category_intros?.[categoryId] || t.category_intro_template.replace(/{category_lower}/g, categoryName.toLowerCase());
  const symbolsCount = symbolsInCategory.length;
  const pageIllustration = getPageIllustration(
    `symbolCategory.${categoryId}`,
    lang,
    categorySchemaName
  );
  const preferredImageUrl = pageIllustration
    ? `https://noctalia.app${pageIllustration.image.src}`
    : DEFAULT_SOCIAL_IMAGE;
  const preferredImageWidth = pageIllustration?.image.width || 1200;
  const preferredImageHeight = pageIllustration?.image.height || 630;

  const howToTitles = {
    en: 'How to use this category',
    fr: 'Comment utiliser cette catégorie',
    es: 'Cómo usar esta categoría',
    de: 'So nutzt du diese Kategorie',
    it: 'Come usare questa categoria',
    'pt-br': 'Como usar esta categoria'
  };

  const howToParagraphs = {
    en: [
      `This category groups symbols that often share related themes. Start with how the dream felt, then look at the symbol details.`,
      `If you notice several ${categoryName.toLowerCase()} symbols in a short period, it can help to look for one common situation in your waking life.`
    ],
    fr: [
      `Cette catégorie regroupe des symboles qui partagent souvent des thèmes proches. Commencez par l'émotion du rêve, puis regardez les détails du symbole.`,
      `Si vous remarquez plusieurs symboles de type ${categoryName.toLowerCase()} sur une courte période, cherchez un point commun dans votre vie éveillée.`
    ],
    es: [
      `Esta categoría agrupa símbolos que suelen compartir temas relacionados. Empieza por cómo se sintió el sueño y luego mira los detalles del símbolo.`,
      `Si ves varios símbolos de ${categoryName.toLowerCase()} en poco tiempo, puede ayudar buscar una situación común en tu vida despierta.`
    ],
    de: [
      `Diese Kategorie bündelt Symbole, die oft ähnliche Themen teilen. Starte mit dem Gefühl im Traum und achte dann auf die Details des Symbols.`,
      `Wenn dir mehrere ${categoryName.toLowerCase()}-Symbole in kurzer Zeit auffallen, kann es helfen, nach einer gemeinsamen Situation im Wachleben zu suchen.`
    ],
    it: [
      `Questa categoria raccoglie simboli che spesso condividono temi collegati. Parti da come ti sei sentito nel sogno e poi guarda i dettagli del simbolo.`,
      `Se noti più simboli di tipo ${categoryName.toLowerCase()} in poco tempo, può aiutare cercare una situazione comune nella tua vita da sveglio.`
    ],
    'pt-br': [
      `Esta categoria reúne símbolos que costumam compartilhar temas parecidos. Comece por como o sonho fez você se sentir e depois olhe os detalhes do símbolo.`,
      `Se você notar vários símbolos de ${categoryName.toLowerCase()} em pouco tempo, pode ajudar procurar uma situação em comum na sua vida desperta.`
    ]
  };

  const howToBullets = {
    en: ['Write down the main emotion.', 'Note what changed during the dream.', 'Pick one symbol and connect it to a recent moment.'],
    fr: ["Notez l'émotion principale.", 'Repérez ce qui change dans le rêve.', 'Choisissez un symbole et reliez-le à un moment récent.'],
    es: ['Anota la emoción principal.', 'Fíjate en qué cambia durante el sueño.', 'Elige un símbolo y conéctalo con un momento reciente.'],
    de: ['Notiere die wichtigste Emotion.', 'Achte darauf, was sich im Traum verändert.', 'Wähle ein Symbol und verbinde es mit einem aktuellen Moment.'],
    it: ["Scrivi l'emozione principale.", 'Nota cosa cambia durante il sogno.', 'Scegli un simbolo e collegalo a un momento recente.'],
    'pt-br': ['Anote a emoção principal.', 'Repare no que muda durante o sonho.', 'Escolha um símbolo e ligue-o a um momento recente.']
  };

  const categoryHowToHtml = `
            <!-- How to use -->
            <section class="category-howto symbol-section">
                <h2 class="symbol-h2">${escapeHtml(howToTitles[lang] || howToTitles.en)}</h2>
                <div class="prose prose-invert prose-purple max-w-none leading-relaxed space-y-4">
                    <p>${escapeHtml(howToParagraphs[lang]?.[0] || howToParagraphs.en[0])}</p>
                    <p>${escapeHtml(howToParagraphs[lang]?.[1] || howToParagraphs.en[1])}</p>
                    <ul>${(howToBullets[lang] || howToBullets.en).map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
                </div>
            </section>`;

  // Language dropdown items
  const langItems = {
    en: { flag: '🇺🇸', name: 'English' },
    fr: { flag: '🇫🇷', name: 'Français' },
    es: { flag: '🇪🇸', name: 'Español' },
    de: { flag: '🇩🇪', name: 'Deutsch' },
    it: { flag: '🇮🇹', name: 'Italiano' }
  };

  const langDropdownHtml = Object.keys(langItems).map(l => {
    const isActive = l === lang;
    const targetSlug = i18n[l].category_slugs[categoryId];
    const activeClass = isActive ? 'text-dream-salmon bg-dream-salmon/10' : 'text-purple-100/80 hover:text-white hover:bg-white/5';
    return `
                        <a href="/${l}/${CONFIG.symbolsPath[l]}/${targetSlug}" hreflang="${l}" class="flex items-center gap-3 px-4 py-2 text-sm ${activeClass} transition-colors" role="menuitem">
                            <span class="w-5 text-center">${langItems[l].flag}</span> ${langItems[l].name}
                        </a>`;
  }).join('\n');
  const currentPaths = Object.fromEntries(
    CONFIG.languages.map(l => [l, `/${l}/${CONFIG.symbolsPath[l]}/${i18n[l].category_slugs[categoryId]}`])
  );

  // Generate symbols grid HTML
  const symbolsHtml = symbolsInCategory.map(s => `
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${s[lang].slug}" class="symbol-index-card">
                        <h2>${escapeHtml(s[lang].name)}</h2>
                        <p>${escapeHtml(s[lang].shortDescription)}</p>
                    </a>`).join('\n');

  // Generate other categories HTML
  const otherCategoriesHtml = allCategories
    .filter(c => c.id !== categoryId)
    .map(c => `
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${i18n[lang].category_slugs[c.id]}" class="category-chip symbol-chip">
                        ${getCategoryNameById(c.id, lang)}<span class="category-chip-count">${c.count}</span>
                    </a>`).join('\n');

  // Generate related guides HTML (from curation pages)
  let relatedGuidesHtml = '';
  if (curationPages && curationPages.length > 0) {
    const relatedCurationIds = CATEGORY_TO_CURATION[categoryId] || [];
    const relatedPages = relatedCurationIds
      .map(id => curationPages.find(p => p.id === id))
      .filter(Boolean);

    if (relatedPages.length > 0) {
      const guidesLinksHtml = relatedPages.map(p => `
                    <a href="/${lang}/guides/${p.slugs[lang]}" class="guide-link">
                        <span>${escapeHtml(p[lang].title)}</span>
                    </a>`).join('\n');

      relatedGuidesHtml = `
            <!-- Related Guides -->
            <section class="symbol-section">
                <h2 class="symbol-h2">${t.curation_related_guides}</h2>
                <div class="guide-link-list">${guidesLinksHtml}
                </div>
            </section>`;
    }
  }

  // Schema.org CollectionPage
  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: metaTitle,
    description: metaDescription,
    url: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${categorySlug}`,
    inLanguage: getLanguageTag(lang),
    isPartOf: {
      '@type': 'WebSite',
      name: 'Noctalia',
      url: 'https://noctalia.app'
    },
    about: {
      '@type': 'Thing',
      name: categorySchemaName
    },
    publisher: canonicalOrganization(),
    datePublished: CONFIG.datePublished,
    dateModified: CONFIG.dateModified,
    ...(pageIllustration ? {
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: preferredImageUrl,
        width: preferredImageWidth,
        height: preferredImageHeight
      }
    } : {})
  };

  // Schema.org ItemList
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: categorySchemaName,
    description: categoryIntro,
    numberOfItems: symbolsCount,
    itemListElement: symbolsInCategory.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s[lang].name,
      url: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${s[lang].slug}`
    }))
  };

  // Schema.org BreadcrumbList
  const breadcrumbListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: homeUrl },
      { '@type': 'ListItem', position: 2, name: t.symbols, item: `https://noctalia.app/${lang}/guides/${t.dictionary_slug}` },
      { '@type': 'ListItem', position: 3, name: categoryName, item: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${categorySlug}` }
    ]
  };

  // Generate the full HTML
  return `<!DOCTYPE html>
<html lang="${getLanguageTag(lang)}" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(metaTitle)} | Noctalia</title>
    <meta name="description" content="${escapeHtml(metaDescription)}">
    <link rel="canonical" href="https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${categorySlug}">
${CONFIG.languages.filter(l => hreflang[l]).map(l => `    <link rel="alternate" hreflang="${getLanguageTag(l)}" href="${hreflang[l]}">`).join('\n')}
    <link rel="alternate" hreflang="x-default" href="${hreflang.en}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="64x64 48x48 32x32 16x16">
    <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">
    <link rel="apple-touch-icon" href="/logo192.png" sizes="192x192">
${renderAhrefsAnalyticsScript()}

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(metaTitle)}">
    <meta property="og:description" content="${escapeHtml(metaDescription)}">
    <meta property="og:url" content="https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${categorySlug}">
    <meta property="og:image" content="${preferredImageUrl}">
    <meta property="og:image:width" content="${preferredImageWidth}">
    <meta property="og:image:height" content="${preferredImageHeight}">
    <meta property="og:image:alt" content="${escapeHtml(pageIllustration?.ref.alt || metaTitle)}">
    <meta property="og:locale" content="${t.locale}">
${CONFIG.languages.filter(l => l !== lang).map(l => `    <meta property="og:locale:alternate" content="${siteConfig.localeCodes[l]}">`).join('\n')}
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
    <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
    <meta name="twitter:image" content="${preferredImageUrl}">
    <meta name="twitter:site" content="@NoctaliaDreams">
    <meta name="twitter:image:alt" content="${escapeHtml(pageIllustration?.ref.alt || metaTitle)}">

    <!-- Fonts -->
    <link rel="preload" href="/fonts/Outfit-Regular.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Outfit-Bold.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Fraunces-Variable.woff2" as="font" type="font/woff2" crossorigin>

    <!-- Styles -->
    <link rel="stylesheet" href="/css/styles.min.css?v=${CONFIG.cssVersion}">
    <link rel="stylesheet" href="/css/language-dropdown.css?v=${CONFIG.cssVersion}">
${renderSharedComponentStyles()}

    <style>
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0a0514; }
        ::-webkit-scrollbar-thumb { background: #39294f; border-radius: 4px; }
        html, body { overflow-x: hidden; }

        .category-page {
            --cream: #fff7ed;
            --cream-88: rgba(255, 247, 237, 0.88);
            --cream-64: rgba(255, 247, 237, 0.64);
            --cream-45: rgba(255, 247, 237, 0.45);
            --cream-35: rgba(255, 247, 237, 0.35);
            --line: rgba(255, 247, 237, 0.10);
            --salmon: #ead4b4;
            --salmon-dim: rgba(234, 212, 180, 0.72);
        }
        .category-page a:focus-visible {
            outline: 2px solid var(--salmon);
            outline-offset: 3px;
            border-radius: 2px;
        }
        /* Static night backdrop + film grain (no animated aurora, no orbs) */
        .aurora-bg {
            position: fixed; inset: 0; z-index: -1;
            background:
                radial-gradient(58rem 38rem at 88% -12%, rgba(234, 212, 180, 0.07), transparent 62%),
                radial-gradient(46rem 34rem at -8% -6%, rgba(150, 122, 204, 0.09), transparent 58%),
                #0a0512;
        }
        .category-page::after {
            content: '';
            position: fixed; inset: 0; z-index: 90;
            pointer-events: none; opacity: 0.05;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
        }
        .glass-button {
            background: rgba(255, 247, 237, 0.04);
            border: 1px solid rgba(255, 247, 237, 0.16);
            transition: border-color 0.25s ease, background 0.25s ease, transform 0.2s ease;
        }
        .glass-button:hover { background: rgba(255, 247, 237, 0.08); border-color: rgba(234, 212, 180, 0.45); }
        .glass-button:active { transform: scale(0.98); }

        .symbol-breadcrumb {
            font-size: 0.8rem;
            letter-spacing: 0.03em;
            color: var(--cream-45);
            margin-bottom: 2rem;
        }
        .symbol-breadcrumb a { color: var(--cream-64); transition: color 0.25s ease; }
        .symbol-breadcrumb a:hover { color: var(--salmon); }
        .symbol-breadcrumb .text-purple-400 { color: var(--cream-35); }
        .symbol-breadcrumb .text-dream-cream { color: var(--cream-88); }

        .symbol-chip {
            display: inline-flex;
            align-items: center;
            padding: 0.6rem 0.9rem;
            border: 1px solid rgba(255, 247, 237, 0.24);
            border-radius: 3px;
            font-size: 0.68rem;
            font-weight: 500;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--cream-88);
            transition: border-color 0.25s ease, color 0.25s ease;
        }
        .symbol-chip--accent { color: var(--salmon); border-color: rgba(234, 212, 180, 0.45); }
        a.symbol-chip:hover { border-color: var(--salmon); color: var(--salmon); }

        /* Hero: left-aligned editorial copy over the contracted illustration */
        .category-page .pseo-hero-copy { text-align: left; max-width: 52rem; margin: 0; }
        .category-h1 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 560;
            font-size: clamp(2.25rem, 5vw, 3.75rem);
            line-height: 1.02;
            letter-spacing: -0.015em;
            color: var(--cream);
            margin-bottom: 1.25rem;
            text-wrap: balance;
        }
        .category-intro {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 340;
            font-size: clamp(1.1rem, 1.8vw, 1.3rem);
            line-height: 1.55;
            color: var(--cream-88);
            max-width: 40rem;
            text-wrap: pretty;
        }

        .symbol-section {
            border-top: 1px solid var(--line);
            padding-top: clamp(2.25rem, 4vw, 3rem);
            margin-bottom: clamp(3rem, 6vw, 4.5rem);
        }
        .symbol-h2 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 550;
            font-size: clamp(1.45rem, 2.4vw, 1.9rem);
            line-height: 1.15;
            letter-spacing: -0.01em;
            color: var(--cream);
            margin-bottom: clamp(1.25rem, 2.5vw, 1.75rem);
        }
        .symbol-h2::before {
            content: '';
            display: block;
            width: 2rem;
            height: 2px;
            background: var(--salmon);
            margin-bottom: 1rem;
        }
        .category-howto .prose {
            color: var(--cream-64);
            font-size: 1.02rem;
            line-height: 1.8;
            max-width: 42rem;
        }
        .category-howto ul { list-style: none; padding-left: 0; }
        .category-howto li { position: relative; padding-left: 1.5rem; }
        .category-howto li::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0.78em;
            width: 0.9rem;
            height: 1px;
            background: var(--salmon);
        }

        /* Symbol index: hairline rows, no glass cards */
        .symbol-index-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 2.5rem;
        }
        .symbol-index-card {
            position: relative;
            display: block;
            padding: 1.35rem 2rem 1.35rem 0;
            border-top: 1px solid var(--line);
        }
        .symbol-index-card h2 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 550;
            font-size: 1.15rem;
            color: var(--cream);
            margin-bottom: 0.35rem;
            transition: color 0.25s ease;
        }
        .symbol-index-card p {
            color: var(--cream-64);
            font-size: 0.92rem;
            line-height: 1.6;
        }
        .symbol-index-card::after {
            content: '\\2192';
            position: absolute;
            right: 0;
            top: 1.5rem;
            font-size: 0.95rem;
            color: var(--cream-35);
            transition: transform 0.25s ease, color 0.25s ease;
        }
        .symbol-index-card:hover h2 { color: var(--salmon); }
        .symbol-index-card:hover::after { transform: translateX(4px); color: var(--salmon); }

        /* Other categories */
        .category-chip .category-chip-count {
            color: var(--cream-35);
            margin-left: 0.35rem;
            letter-spacing: 0.08em;
        }

        /* Related guides */
        .guide-link {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 1rem;
            padding: 1rem 0;
            border-top: 1px solid var(--line);
        }
        .guide-link span {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-size: 1.05rem;
            color: var(--cream-88);
            transition: color 0.25s ease;
        }
        .guide-link::after {
            content: '\\2192';
            font-size: 0.9rem;
            color: var(--cream-35);
            transition: transform 0.25s ease, color 0.25s ease;
        }
        .guide-link:hover { border-top-color: rgba(234, 212, 180, 0.55); }
        .guide-link:hover span { color: var(--cream); }
        .guide-link:hover::after { transform: translateX(4px); color: var(--salmon); }
        .guide-link-list { border-bottom: 1px solid var(--line); }

        /* Final CTA */
        .symbol-final-cta {
            position: relative;
            overflow: hidden;
            border: 1px solid var(--line);
            border-radius: 1rem;
            background:
                radial-gradient(36rem 16rem at 50% -20%, rgba(234, 212, 180, 0.12), transparent 70%),
                rgba(255, 247, 237, 0.02);
            padding: clamp(2.5rem, 6vw, 4rem) clamp(1.5rem, 4vw, 3rem);
            text-align: center;
        }
        .symbol-final-cta h3 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 560;
            font-size: clamp(1.6rem, 3vw, 2.25rem);
            letter-spacing: -0.015em;
            color: var(--cream);
            margin-bottom: 0.85rem;
            text-wrap: balance;
        }
        .symbol-final-cta p { color: var(--cream-64); }
        .symbol-final-cta a { transition: transform 0.2s ease, background 0.25s ease, border-color 0.25s ease; }
        .symbol-final-cta a:active { transform: scale(0.98); }

        .symbol-back-link {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.6rem 0;
            color: var(--cream-45);
            font-size: 0.9rem;
            transition: color 0.25s ease;
        }
        .symbol-back-link::before { content: '\\2190'; transition: transform 0.25s ease; }
        .symbol-back-link:hover { color: var(--salmon); }
        .symbol-back-link:hover::before { transform: translateX(-4px); }

        @media (max-width: 767px) {
            .category-page main { padding-top: 5.5rem !important; }
            .symbol-breadcrumb { display: none; }
            .category-h1 { font-size: clamp(1.9rem, 8vw, 2.6rem); }
            .category-intro { font-size: 1.05rem; }
            .symbol-index-grid { grid-template-columns: 1fr; }
        }
    </style>

    <!-- Schema.org CollectionPage -->
${renderJsonLd(collectionPageJsonLd)}

    <!-- Schema.org ItemList -->
${renderJsonLd(itemListJsonLd)}

    <!-- Schema.org BreadcrumbList -->
${renderJsonLd(breadcrumbListJsonLd)}
</head>

<body class="category-page bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden" style="background-color: #0a0514;">
    <div class="aurora-bg"></div>

    <!-- Navbar -->
${renderPseoNav(lang, currentPaths, 'dictionary')}

    <main class="pt-32 pb-20 px-4">
        <div class="max-w-5xl mx-auto">

            <!-- Breadcrumb -->
            <nav class="symbol-breadcrumb" aria-label="Breadcrumb">
                <ol class="flex items-center gap-2 flex-wrap">
                    <li>
                        <a href="${homePath}">${t.home}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <a href="/${lang}/guides/${t.dictionary_slug}">${t.symbols}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <span class="text-dream-cream">${escapeHtml(categoryName)}</span>
                    </li>
                </ol>
            </nav>

            <!-- Header -->
            <header class="pseo-illustrated-hero mb-12" data-image-seo-hero="true">
${renderPseoHeroIllustration(pageIllustration)}
                <div class="pseo-hero-copy">
                <div class="flex flex-wrap gap-3 mb-6">
                    <span class="symbol-chip symbol-chip--accent">
                        ${symbolsCount} ${t.symbols_in_category}
                    </span>
                </div>

                <h1 class="category-h1">
                    ${t.category_h1_template.replace(/{category}/g, categoryName)}
                </h1>

                <p class="category-intro">
                    ${escapeHtml(sanitizeEmDashes(categoryIntro))}
                </p>
                </div>
            </header>

${categoryHowToHtml}
            <!-- Symbol Grid -->
            <section class="mb-16">
                <div class="symbol-index-grid">${symbolsHtml}
                </div>
            </section>

            <!-- Other Categories -->
            <section class="symbol-section">
                <h2 class="symbol-h2">${t.other_categories}</h2>
                <div class="flex flex-wrap gap-3">${otherCategoriesHtml}
                </div>
            </section>
${relatedGuidesHtml}
            <!-- CTA Section -->
            <aside class="symbol-final-cta">
                <h3>${t.cta_title}</h3>
                <p class="mb-6 max-w-lg mx-auto">
                    ${t.cta_description}
                </p>
                ${renderSymbolConversionActions(lang, `category-${categoryId}`)}
            </aside>

            <!-- Back to Dictionary -->
            <div class="mt-10 text-center">
                <a href="/${lang}/guides/${t.dictionary_slug}" class="symbol-back-link">${t.back_to_dictionary}</a>
            </div>

        </div>
    </main>

${renderPseoFooter(lang, currentPaths, 'dictionary')}

    <script src="/js/site-shell.js?v=${CONFIG.cssVersion}" defer></script>
    <script src="/js/language-dropdown.js?v=${CONFIG.cssVersion}" defer></script>
    <script src="/js/mobile-menu.js?v=${CONFIG.cssVersion}" defer></script>
</body>
</html>`;
}

// Generate all category pages
function generateCategoryPages(symbols, i18n, languages) {
  console.log('\n📁 Generating category pages...\n');

  // Load curation pages for cross-linking (graceful if missing)
  let curationPages = [];
  try {
    const curationData = loadCurationData();
    curationPages = curationData.pages || [];
  } catch (e) {
    console.log('ℹ️  No curation-pages.json found, skipping related guides in category pages.');
  }

  // Group symbols by category
  const categoriesMap = {};
  for (const symbol of symbols.symbols) {
    const cat = symbol.category;
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = [];
    }
    categoriesMap[cat].push(symbol);
  }

  // Build allCategories array for cross-linking
  const allCategories = Object.keys(categoriesMap).map(id => ({
    id,
    count: categoriesMap[id].length
  }));

  let generated = 0;
  let errors = 0;

  // Generate pages
  for (const lang of languages) {
    const langDir = path.join(CONFIG.outputDir, lang, CONFIG.symbolsPath[lang]);

    // Create directory if not dry run
    if (!args['dry-run']) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    for (const categoryId of Object.keys(categoriesMap)) {
      const symbolsInCategory = categoriesMap[categoryId];
      const categorySlug = i18n[lang].category_slugs?.[categoryId];

      if (!categorySlug) {
        console.log(`⚠️  Skipping category ${categoryId} for ${lang} (no slug)`);
        errors++;
        continue;
      }

      const filename = `${categorySlug}.html`;
      const filepath = path.join(langDir, filename);

      try {
        const html = generateCategoryPage(categoryId, symbolsInCategory, symbols.symbols, allCategories, i18n, lang, curationPages);

        if (args['dry-run']) {
          console.log(`  [DRY RUN] Would create: ${filepath}`);
        } else {
          writeGeneratedHtml(filepath, html, { preserveExistingModifiedDate: true });
          console.log(`  ✅ ${lang}/${CONFIG.symbolsPath[lang]}/${filename} (${symbolsInCategory.length} symbols)`);
        }
        generated++;
      } catch (err) {
        console.error(`  ❌ Error generating category ${categoryId} (${lang}): ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n✨ Category pages done! Generated ${generated} pages, ${errors} errors.`);
  return { generated, errors };
}

// =====================================================
// CURATION PAGES GENERATION
// =====================================================

function loadCurationData() {
  const curationPath = path.join(CONFIG.dataDir, 'curation-pages.json');
  if (!fs.existsSync(curationPath)) {
    console.error('Missing data/curation-pages.json');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(curationPath, 'utf8'));
  (data?.pages || []).forEach(aliasCurationPage);
  return data;
}

function validateCurationDataOrExit(curationData, allSymbols) {
  const pages = Array.isArray(curationData?.pages) ? curationData.pages : [];
  const symbolIds = new Set((allSymbols || []).map(s => s.id));

  const problems = [];
  for (const page of pages) {
    const pageId = page?.id || '(unknown-page-id)';
    const ids = Array.isArray(page?.symbols) ? page.symbols : [];
    const missing = ids.filter(id => !symbolIds.has(id));
    if (missing.length > 0) {
      problems.push({ pageId, missing });
    }
  }

  if (problems.length === 0) return;

  // Fail fast: otherwise we silently drop missing symbols and render inconsistent counts.
  console.error('\n❌ Invalid data/curation-pages.json: unknown symbol ids referenced:\n');
  for (const p of problems) {
    console.error(`- ${p.pageId}: ${p.missing.join(', ')}`);
  }
  console.error('\nFix by adding the missing symbols to data/dream-symbols.json (and ideally data/dream-symbols-extended.json), or removing them from curation-pages.json.\n');
  process.exit(1);
}

// Generate hreflang URLs for a curation page
function generateCurationHreflangUrls(page) {
  const urls = {};
  for (const l of CONFIG.languages) {
    if (page.slugs[l]) {
      urls[l] = `https://noctalia.app/${l}/guides/${page.slugs[l]}`;
    }
  }
  return urls;
}

// Generate a single curation page HTML
function generateCurationPage(page, allSymbols, i18n, lang) {
  const t = i18n[lang];
  const homePath = localizedHomePath(lang);
  const homeUrl = localizedHomeUrl(lang);
  const pageData = { ...page[lang], metaDescription: truncateMetaDescription(page[lang].metaDescription) };
  const metaTitle = getCurationMetaTitle(page, lang);
  const slug = page.slugs[lang];
  const hreflang = generateCurationHreflangUrls(page);
  const symbolsCount = page.symbols.length;
  const pageIllustration = getPageIllustration(`guide.${page.id}`, lang, pageData.title);
  const preferredImageUrl = pageIllustration
    ? `https://noctalia.app${pageIllustration.image.src}`
    : DEFAULT_SOCIAL_IMAGE;
  const preferredImageWidth = pageIllustration?.image.width || 1200;
  const preferredImageHeight = pageIllustration?.image.height || 630;

  // Resolve symbols
  const resolvedSymbols = page.symbols
    .map(id => allSymbols.find(s => s.id === id))
    .filter(Boolean);

  // Safety net: keep counts and rendered content consistent.
  if (resolvedSymbols.length !== symbolsCount) {
    const resolvedIds = new Set(resolvedSymbols.map(s => s.id));
    const missing = page.symbols.filter(id => !resolvedIds.has(id));
    throw new Error(`Curation "${page.id}" references unknown symbols: ${missing.join(', ')}`);
  }

  // Language dropdown
  const langItems = {
    en: { flag: '🇺🇸', name: 'English' },
    fr: { flag: '🇫🇷', name: 'Français' },
    es: { flag: '🇪🇸', name: 'Español' },
    de: { flag: '🇩🇪', name: 'Deutsch' },
    it: { flag: '🇮🇹', name: 'Italiano' }
  };

  const langDropdownHtml = Object.keys(langItems).map(l => {
    const isActive = l === lang;
    const targetSlug = page.slugs[l];
    const activeClass = isActive ? 'text-dream-salmon bg-dream-salmon/10' : 'text-purple-100/80 hover:text-white hover:bg-white/5';
    return `
                        <a href="/${l}/guides/${targetSlug}" hreflang="${l}" class="flex items-center gap-3 px-4 py-2 text-sm ${activeClass} transition-colors" role="menuitem">
                            <span class="w-5 text-center">${langItems[l].flag}</span> ${langItems[l].name}
                        </a>`;
  }).join('\n');
  const currentPaths = Object.fromEntries(
    CONFIG.languages.map(l => [l, `/${l}/guides/${page.slugs[l]}`])
  );

  // Generate symbol cards
  const symbolCardsHtml = resolvedSymbols.map((s, i) => {
    const symbolData = s[lang];
    if (!symbolData) return '';
    const symbolHref = `/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}`;
    // Prefer the mapped thematic guide (skipping self-links on the guide's
    // own page), otherwise the related article — naming the destination.
    const cardGuidePage = s.relatedGuide !== page.id ? getRelatedGuidePage(s) : null;
    const cardGuideSlug = cardGuidePage?.slugs?.[lang];
    const cardGuideTitle = cardGuidePage?.[lang]?.title;
    const relatedArticle = s.relatedArticles?.[lang];
    let relatedArticleHtml = '';
    if (cardGuideSlug && cardGuideTitle) {
      relatedArticleHtml = `
                        <a href="/${lang}/guides/${cardGuideSlug}" class="curation-related">${t.related_guide_label} : ${escapeHtml(cardGuideTitle)}</a>`;
    } else if (relatedArticle) {
      const cardArticleTitle = getBlogTitleBySlug(lang, relatedArticle);
      relatedArticleHtml = `
                        <a href="/${lang}/blog/${relatedArticle}" class="curation-related">${cardArticleTitle ? `${t.related_article_label} : ${escapeHtml(cardArticleTitle)}` : t.read_article}</a>`;
    }
    return `
                    <article class="curation-card">
                        <a href="${symbolHref}" class="curation-main">
                        <h2>${escapeHtml(symbolData.name)}</h2>
                        <p>${escapeHtml(symbolData.shortDescription)}</p>
                        </a>
                        ${relatedArticleHtml}
                    </article>`;
  }).join('\n');

  // Schema.org ItemList
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: pageData.title,
    description: pageData.metaDescription,
    numberOfItems: symbolsCount,
    itemListElement: resolvedSymbols.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s[lang]?.name || s.id,
      url: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${s[lang]?.slug || s.id}`
    }))
  };

  // Schema.org BreadcrumbList
  const breadcrumbListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: homeUrl },
      { '@type': 'ListItem', position: 2, name: t.symbols, item: `https://noctalia.app/${lang}/guides/${t.dictionary_slug}` },
      { '@type': 'ListItem', position: 3, name: pageData.title, item: `https://noctalia.app/${lang}/guides/${slug}` }
    ]
  };

  // Schema.org Article
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: pageData.title,
    description: pageData.metaDescription,
    image: {
      '@type': 'ImageObject',
      url: preferredImageUrl,
      width: preferredImageWidth,
      height: preferredImageHeight
    },
    author: canonicalOrganization(),
    publisher: canonicalOrganization(),
    datePublished: CONFIG.datePublished,
    dateModified: CONFIG.dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://noctalia.app/${lang}/guides/${slug}` },
    inLanguage: getLanguageTag(lang)
  };

  return `<!DOCTYPE html>
<html lang="${getLanguageTag(lang)}" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(metaTitle)} | Noctalia</title>
    <meta name="description" content="${escapeHtml(pageData.metaDescription)}">
    <link rel="canonical" href="https://noctalia.app/${lang}/guides/${slug}">
${CONFIG.languages.filter(l => hreflang[l]).map(l => `    <link rel="alternate" hreflang="${getLanguageTag(l)}" href="${hreflang[l]}">`).join('\n')}
    <link rel="alternate" hreflang="x-default" href="${hreflang.en}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="64x64 48x48 32x32 16x16">
    <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">
    <link rel="apple-touch-icon" href="/logo192.png" sizes="192x192">
${renderAhrefsAnalyticsScript()}

    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(metaTitle)}">
    <meta property="og:description" content="${escapeHtml(pageData.metaDescription)}">
    <meta property="og:url" content="https://noctalia.app/${lang}/guides/${slug}">
    <meta property="og:image" content="${preferredImageUrl}">
    <meta property="og:image:width" content="${preferredImageWidth}">
    <meta property="og:image:height" content="${preferredImageHeight}">
    <meta property="og:image:alt" content="${escapeHtml(pageIllustration?.ref.alt || metaTitle)}">
    <meta property="og:locale" content="${t.locale}">
${CONFIG.languages.filter(l => l !== lang).map(l => `    <meta property="og:locale:alternate" content="${siteConfig.localeCodes[l]}">`).join('\n')}
    <meta property="article:published_time" content="${CONFIG.datePublished}">
    <meta property="article:modified_time" content="${CONFIG.dateModified}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
    <meta name="twitter:description" content="${escapeHtml(pageData.metaDescription)}">
    <meta name="twitter:image" content="${preferredImageUrl}">
    <meta name="twitter:site" content="@NoctaliaDreams">
    <meta name="twitter:image:alt" content="${escapeHtml(pageIllustration?.ref.alt || metaTitle)}">

    <!-- Fonts -->
    <link rel="preload" href="/fonts/Outfit-Regular.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Outfit-Bold.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Fraunces-Variable.woff2" as="font" type="font/woff2" crossorigin>

    <!-- Styles -->
    <link rel="stylesheet" href="/css/styles.min.css?v=${CONFIG.cssVersion}">
    <link rel="stylesheet" href="/css/language-dropdown.css?v=${CONFIG.cssVersion}">
${renderSharedComponentStyles()}

    <style>
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0a0514; }
        ::-webkit-scrollbar-thumb { background: #39294f; border-radius: 4px; }
        html, body { overflow-x: hidden; }

        .curation-page {
            --cream: #fff7ed;
            --cream-88: rgba(255, 247, 237, 0.88);
            --cream-64: rgba(255, 247, 237, 0.64);
            --cream-45: rgba(255, 247, 237, 0.45);
            --cream-35: rgba(255, 247, 237, 0.35);
            --line: rgba(255, 247, 237, 0.10);
            --salmon: #ead4b4;
            --salmon-dim: rgba(234, 212, 180, 0.72);
        }
        .curation-page a:focus-visible {
            outline: 2px solid var(--salmon);
            outline-offset: 3px;
            border-radius: 2px;
        }
        /* Static night backdrop + film grain (no animated aurora, no orbs) */
        .aurora-bg {
            position: fixed; inset: 0; z-index: -1;
            background:
                radial-gradient(58rem 38rem at 88% -12%, rgba(234, 212, 180, 0.07), transparent 62%),
                radial-gradient(46rem 34rem at -8% -6%, rgba(150, 122, 204, 0.09), transparent 58%),
                #0a0512;
        }
        .curation-page::after {
            content: '';
            position: fixed; inset: 0; z-index: 90;
            pointer-events: none; opacity: 0.05;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
        }
        .glass-button {
            background: rgba(255, 247, 237, 0.04);
            border: 1px solid rgba(255, 247, 237, 0.16);
            transition: border-color 0.25s ease, background 0.25s ease, transform 0.2s ease;
        }
        .glass-button:hover { background: rgba(255, 247, 237, 0.08); border-color: rgba(234, 212, 180, 0.45); }
        .glass-button:active { transform: scale(0.98); }

        .symbol-breadcrumb {
            font-size: 0.8rem;
            letter-spacing: 0.03em;
            color: var(--cream-45);
            margin-bottom: 2rem;
        }
        .symbol-breadcrumb a { color: var(--cream-64); transition: color 0.25s ease; }
        .symbol-breadcrumb a:hover { color: var(--salmon); }
        .symbol-breadcrumb .text-purple-400 { color: var(--cream-35); }
        .symbol-breadcrumb .text-dream-cream { color: var(--cream-88); }

        .symbol-chip {
            display: inline-flex;
            align-items: center;
            padding: 0.6rem 0.9rem;
            border: 1px solid rgba(255, 247, 237, 0.24);
            border-radius: 3px;
            font-size: 0.68rem;
            font-weight: 500;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--cream-88);
            transition: border-color 0.25s ease, color 0.25s ease;
        }
        .symbol-chip--accent { color: var(--salmon); border-color: rgba(234, 212, 180, 0.45); }
        a.symbol-chip:hover { border-color: var(--salmon); color: var(--salmon); }

        /* Hero: left-aligned editorial copy over the contracted illustration */
        .curation-page .pseo-hero-copy { text-align: left; max-width: 52rem; margin: 0; }
        .curation-h1 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 560;
            font-size: clamp(2.25rem, 5vw, 3.75rem);
            line-height: 1.02;
            letter-spacing: -0.015em;
            color: var(--cream);
            margin-bottom: 1.25rem;
            text-wrap: balance;
        }
        .curation-intro {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 340;
            font-size: clamp(1.1rem, 1.8vw, 1.3rem);
            line-height: 1.55;
            color: var(--cream-88);
            max-width: 42rem;
            text-wrap: pretty;
        }

        .symbol-section {
            border-top: 1px solid var(--line);
            padding-top: clamp(2.25rem, 4vw, 3rem);
            margin-bottom: clamp(3rem, 6vw, 4.5rem);
        }
        .symbol-h2 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 550;
            font-size: clamp(1.45rem, 2.4vw, 1.9rem);
            line-height: 1.15;
            letter-spacing: -0.01em;
            color: var(--cream);
            margin-bottom: clamp(1.25rem, 2.5vw, 1.75rem);
        }
        .symbol-h2::before {
            content: '';
            display: block;
            width: 2rem;
            height: 2px;
            background: var(--salmon);
            margin-bottom: 1rem;
        }

        /* Ranked symbol list: numbered editorial rows */
        .curation-list { counter-reset: rank; }
        .curation-card {
            position: relative;
            padding: 1.35rem 0 1.35rem 3.5rem;
            border-top: 1px solid var(--line);
        }
        .curation-card:last-child { border-bottom: 1px solid var(--line); }
        .curation-card::before {
            counter-increment: rank;
            content: counter(rank, decimal-leading-zero);
            position: absolute;
            left: 0;
            top: 1.55rem;
            font-size: 0.88rem;
            font-weight: 500;
            letter-spacing: 0.14em;
            color: var(--salmon);
        }
        .curation-card h2 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 550;
            font-size: 1.15rem;
            color: var(--cream);
            margin-bottom: 0.35rem;
            transition: color 0.25s ease;
        }
        .curation-card .curation-main:hover h2 { color: var(--salmon); }
        .curation-card p {
            color: var(--cream-64);
            font-size: 0.92rem;
            line-height: 1.6;
            max-width: 44rem;
        }
        .curation-main { display: block; }
        .curation-related {
            display: inline-flex;
            align-items: baseline;
            gap: 0.45rem;
            margin-top: 0.4rem;
            padding: 0.5rem 0;
            font-size: 0.82rem;
            color: var(--cream-64);
            transition: color 0.25s ease;
        }
        .curation-related::after {
            content: '\\2192';
            color: var(--cream-35);
            transition: transform 0.25s ease, color 0.25s ease;
        }
        .curation-related:hover { color: var(--salmon); }
        .curation-related:hover::after { transform: translateX(4px); color: var(--salmon); }

        /* Outro */
        .curation-outro.symbol-section { border-top: 0; padding-top: 0; }
        .curation-outro .prose {
            color: var(--cream-64);
            font-size: 1.02rem;
            line-height: 1.8;
            max-width: 42rem;
        }

        /* Final CTA */
        .symbol-final-cta {
            position: relative;
            overflow: hidden;
            border: 1px solid var(--line);
            border-radius: 1rem;
            background:
                radial-gradient(36rem 16rem at 50% -20%, rgba(234, 212, 180, 0.12), transparent 70%),
                rgba(255, 247, 237, 0.02);
            padding: clamp(2.5rem, 6vw, 4rem) clamp(1.5rem, 4vw, 3rem);
            text-align: center;
        }
        .symbol-final-cta h3 {
            font-family: 'Fraunces', ui-serif, Georgia, serif;
            font-weight: 560;
            font-size: clamp(1.6rem, 3vw, 2.25rem);
            letter-spacing: -0.015em;
            color: var(--cream);
            margin-bottom: 0.85rem;
            text-wrap: balance;
        }
        .symbol-final-cta p { color: var(--cream-64); }
        .symbol-final-cta a { transition: transform 0.2s ease, background 0.25s ease, border-color 0.25s ease; }
        .symbol-final-cta a:active { transform: scale(0.98); }

        .symbol-back-link {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.6rem 0;
            color: var(--cream-45);
            font-size: 0.9rem;
            transition: color 0.25s ease;
        }
        .symbol-back-link::before { content: '\\2190'; transition: transform 0.25s ease; }
        .symbol-back-link:hover { color: var(--salmon); }
        .symbol-back-link:hover::before { transform: translateX(-4px); }

        @media (max-width: 767px) {
            .curation-page main { padding-top: 5.5rem !important; }
            .symbol-breadcrumb { display: none; }
            .curation-h1 { font-size: clamp(1.9rem, 8vw, 2.6rem); }
            .curation-intro { font-size: 1.05rem; }
            .curation-card { padding-left: 2.5rem; }
        }
    </style>

    <!-- Schema.org ItemList -->
${renderJsonLd(itemListJsonLd)}

    <!-- Schema.org Article -->
${renderJsonLd(articleJsonLd)}

    <!-- Schema.org BreadcrumbList -->
${renderJsonLd(breadcrumbListJsonLd)}
</head>

<body class="curation-page bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden" style="background-color: #0a0514;">
    <div class="aurora-bg"></div>

    <!-- Navbar -->
${renderPseoNav(lang, currentPaths, 'dictionary')}

    <main class="pt-32 pb-20 px-4">
        <div class="max-w-5xl mx-auto">

            <!-- Breadcrumb -->
            <nav class="symbol-breadcrumb" aria-label="Breadcrumb">
                <ol class="flex items-center gap-2 flex-wrap">
                    <li>
                        <a href="${homePath}">${t.home}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <a href="/${lang}/guides/${t.dictionary_slug}">${t.symbols}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <span class="text-dream-cream">${escapeHtml(pageData.title)}</span>
                    </li>
                </ol>
            </nav>

            <!-- Header -->
            <header class="pseo-illustrated-hero mb-12" data-image-seo-hero="true">
${renderPseoHeroIllustration(pageIllustration)}
                <div class="pseo-hero-copy">
                <div class="flex flex-wrap gap-3 mb-6">
                    <span class="symbol-chip symbol-chip--accent">
                        ${t.curation_label}
                    </span>
                    <span class="symbol-chip">
                        ${t.curation_symbols_count.replace('{count}', symbolsCount)}
                    </span>
                </div>

                <h1 class="curation-h1">
                    ${escapeHtml(pageData.title)}
                </h1>

                <p class="curation-intro">
                    ${escapeHtml(sanitizeEmDashes(pageData.intro))}
                </p>
                </div>
            </header>

            <!-- Symbol Grid -->
            <section class="mb-16">
                <div class="curation-list">${symbolCardsHtml}
                </div>
            </section>

            <!-- Outro -->
            <section class="curation-outro symbol-section">
                <div class="prose prose-invert prose-purple max-w-none leading-relaxed">
                    <p>${escapeHtml(sanitizeEmDashes(pageData.outro))}</p>
                </div>
            </section>

            <!-- CTA Section -->
            <aside class="symbol-final-cta">
                <h3>${t.cta_title}</h3>
                <p class="mb-6 max-w-lg mx-auto">
                    ${t.cta_description}
                </p>
                ${renderSymbolConversionActions(lang, `guide-${page.id}`)}
            </aside>

            <!-- Back to Dictionary -->
            <div class="mt-10 text-center">
                <a href="/${lang}/guides/${t.dictionary_slug}" class="symbol-back-link">${t.back_to_dictionary}</a>
            </div>

        </div>
    </main>

${renderPseoFooter(lang, currentPaths, 'dictionary')}

    <script src="/js/site-shell.js?v=${CONFIG.cssVersion}" defer></script>
    <script src="/js/language-dropdown.js?v=${CONFIG.cssVersion}" defer></script>
    <script src="/js/mobile-menu.js?v=${CONFIG.cssVersion}" defer></script>
</body>
</html>`;
}

// Generate all curation pages
function generateCurationPages(symbols, i18n, languages) {
  console.log('\n📋 Generating curation pages...\n');

  const curationData = loadCurationData();
  validateCurationDataOrExit(curationData, symbols.symbols);
  let generated = 0;
  let errors = 0;

  for (const lang of languages) {
    const langDir = path.join(CONFIG.outputDir, lang, 'guides');

    if (!args['dry-run']) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    for (const page of curationData.pages) {
      const slug = page.slugs[lang];
      if (!slug) {
        console.log(`⚠️  Skipping curation ${page.id} for ${lang} (no slug)`);
        errors++;
        continue;
      }

      const filename = `${slug}.html`;
      const filepath = path.join(langDir, filename);

      try {
        const html = generateCurationPage(page, symbols.symbols, i18n, lang);

        if (args['dry-run']) {
          console.log(`  [DRY RUN] Would create: ${filepath}`);
        } else {
          writeGeneratedHtml(filepath, html, { preserveExistingModifiedDate: true });
          console.log(`  ✅ ${lang}/guides/${filename} (${page.symbols.length} symbols)`);
        }
        generated++;
      } catch (err) {
        console.error(`  ❌ Error generating curation ${page.id} (${lang}): ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n✨ Curation pages done! Generated ${generated} pages, ${errors} errors.`);
  return { generated, errors };
}

// =====================================================
// CATEGORY PAGES: RELATED GUIDES CROSS-LINKS (Phase 3)
// =====================================================

// Map categories to relevant curation page IDs
const CATEGORY_TO_CURATION = {
  animals: ['animal-dream-symbols', 'scary-dream-symbols', 'most-common-dream-symbols'],
  nature: ['water-dream-symbols', 'most-common-dream-symbols'],
  body: ['scary-dream-symbols', 'most-common-dream-symbols', 'death-transformation-dreams'],
  places: ['dream-locations', 'most-common-dream-symbols'],
  objects: ['most-common-dream-symbols', 'dream-locations'],
  actions: ['scary-dream-symbols', 'most-common-dream-symbols', 'positive-dream-symbols'],
  people: ['people-in-dreams', 'death-transformation-dreams', 'positive-dream-symbols'],
  celestial: ['positive-dream-symbols', 'death-transformation-dreams']
};

// Run
if (args.curation) {
  // Generate only curation pages
  const { symbols, i18n } = loadData();
  let languages = CONFIG.languages;
  if (args.lang) {
    languages = [args.lang];
  }
  generateCurationPages(symbols, i18n, languages);
} else if (args.categories) {
  // Generate only category pages
  const { symbols, i18n } = loadData();
  let languages = CONFIG.languages;
  if (args.lang) {
    languages = [args.lang];
  }
  generateCategoryPages(symbols, i18n, languages);
} else {
  main();
}
