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
 *   node scripts/generate-symbol-pages.js --lang=en     # Only English
 *   node scripts/generate-symbol-pages.js --categories  # Only category pages
 *   node scripts/generate-symbol-pages.js --curation    # Only curated guide pages
 *   node scripts/generate-symbol-pages.js --dry-run     # Preview without writing
 */

const fs = require('fs');
const path = require('path');
const { createRenderContext } = require('../../scripts/lib/docs-components/context');
const { renderFooter: renderSharedFooter } = require('../../scripts/lib/docs-components/footer');
const { renderNavigation } = require('../../scripts/lib/docs-components/navigation');
const { renderSharedComponentStyles } = require('../../scripts/lib/docs-components/styles');
const { inlineLucideIcons } = require('../../scripts/lib/lucide-inline');
const { canonicalOrganization } = require('../../scripts/lib/canonical-organization');
const { renderAhrefsAnalyticsScript } = require('../../scripts/lib/ahrefs-analytics');
const { renderResponsivePicture } = require('../../scripts/lib/image-seo-assets');
const { getPageIllustration } = require('../../scripts/lib/page-illustrations');

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
  const stem = path.basename(illustration.src, path.extname(illustration.src));
  const widths = [480, 800, 1200];
  const variants = widths.map((width) => ({
    width,
    url: `/img/seo/symbols-v1/${stem}-${width}w.webp`,
    filePath: path.join(__dirname, '..', 'img', 'seo', 'symbols-v1', `${stem}-${width}w.webp`),
  }));
  const hasVariants = variants.every((variant) => fs.existsSync(variant.filePath));

  if (!hasVariants) {
    return {
      src: illustration.src,
      srcset: '',
      width: originalWidth,
      height: originalHeight,
    };
  }

  return {
    src: variants[variants.length - 1].url,
    srcset: variants.map((variant) => `${variant.url} ${variant.width}w`).join(', '),
    width: 1200,
    height: Math.round((originalHeight / originalWidth) * 1200),
  };
}

function readCatalogModifiedDate(fallbackDate) {
  const catalogPath = path.join(ROOT_DATA_DIR, 'dream-symbols.json');
  try {
    const payload = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    return normalizeIsoDate(payload?.meta?.lastUpdated) || fallbackDate;
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
  languages: ['en', 'fr', 'es', 'de', 'it'],
  symbolsPath: {
    en: 'symbols',
    fr: 'symboles',
    es: 'simbolos',
    de: 'traumsymbole',
    it: 'simboli'
  },
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
  }
};

const QUICK_REFERENCE_LABELS = {
  de: 'Kurzdeutung des Symbols',
  en: 'Quick symbol reference',
  es: 'Ficha rápida del símbolo',
  fr: 'Fiche rapide du symbole',
  it: 'Scheda rapida del simbolo',
};

const SYMBOL_IMAGE_ALT_TEMPLATES = {
  de: (name) => `Traumhafte Illustration des Symbols ${name}`,
  en: (name) => `Dreamlike illustration representing the symbol ${name}`,
  es: (name) => `Ilustración onírica que representa el símbolo ${name}`,
  fr: (name) => `Illustration onirique représentant le symbole ${name}`,
  it: (name) => `Illustrazione onirica che rappresenta il simbolo ${name}`,
};

const SYMBOL_IMAGE_CAPTION_TEMPLATES = {
  de: (name) => `Visuelle Darstellung des Traumsymbols ${name}.`,
  en: (name) => `Visual representation of the dream symbol ${name}.`,
  es: (name) => `Representación visual del símbolo onírico ${name}.`,
  fr: (name) => `Représentation visuelle du symbole onirique ${name}.`,
  it: (name) => `Rappresentazione visiva del simbolo onirico ${name}.`,
};

function resolveSymbolIllustration(symbolId, explicitIllustration, symbolData, lang) {
  if (explicitIllustration?.src) return explicitIllustration;

  const src = `/img/symbols/posters-v1/${symbolId}.webp`;
  const filePath = path.join(__dirname, '..', src.replace(/^\/+/, ''));
  if (!fs.existsSync(filePath)) return null;

  const altTemplate = SYMBOL_IMAGE_ALT_TEMPLATES[lang] || SYMBOL_IMAGE_ALT_TEMPLATES.en;
  const captionTemplate =
    SYMBOL_IMAGE_CAPTION_TEMPLATES[lang] || SYMBOL_IMAGE_CAPTION_TEMPLATES.en;
  return {
    src,
    width: 1200,
    height: 675,
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

function getSymbolCtaUrl(lang) {
  const paths = {
    en: '/en/ai-dream-interpretation-app',
    fr: '/fr/application-interpretation-reves-ia',
    es: '/es/app-interpretacion-suenos-ia',
    de: '/de/ki-traumdeutung-app',
    it: '/it/app-interpretazione-sogni-ai',
  };

  return paths[lang] || paths.en;
}

function getAndroidStoreUrl(lang) {
  const base = SHARED_SITE_CONFIG.storeLinks?.androidBase || 'https://play.google.com/store/apps/details?id=com.tanuki75.noctalia';
  return `${base}&hl=${lang}`;
}

const SYMBOL_CONVERSION_COPY = {
  en: { store: 'Get Noctalia on Google Play', details: 'See how Noctalia adds your context' },
  fr: { store: 'Télécharger Noctalia sur Google Play', details: 'Voir comment Noctalia relie votre contexte' },
  es: { store: 'Descargar Noctalia en Google Play', details: 'Ver cómo Noctalia añade tu contexto' },
  de: { store: 'Noctalia bei Google Play herunterladen', details: 'So bezieht Noctalia deinen Kontext ein' },
  it: { store: 'Scarica Noctalia su Google Play', details: 'Scopri come Noctalia usa il tuo contesto' },
};

function renderSymbolConversionActions(lang) {
  const copy = SYMBOL_CONVERSION_COPY[lang] || SYMBOL_CONVERSION_COPY.en;
  return `<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                    <a href="${getAndroidStoreUrl(lang)}" class="inline-flex items-center justify-center gap-2 px-8 py-4 bg-dream-salmon text-dream-dark rounded-full font-bold hover:bg-dream-salmon/90 transition-colors" rel="nofollow noopener noreferrer" target="_blank">
                        ${escapeHtml(copy.store)} <i data-lucide="external-link" class="w-5 h-5"></i>
                    </a>
                    <a href="${getSymbolCtaUrl(lang)}" class="inline-flex items-center justify-center gap-2 px-8 py-4 glass-button text-dream-cream rounded-full font-bold hover:border-dream-salmon/40 transition-colors">
                        ${escapeHtml(copy.details)} <i data-lucide="arrow-right" class="w-5 h-5"></i>
                    </a>
                </div>`;
}

function loadSiteManifest() {
  return JSON.parse(fs.readFileSync(SITE_MANIFEST_PATH, 'utf8'));
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
  return Array.isArray(data?.pages) ? data.pages : [];
}

const OPTIONAL_CURATION_PAGES = loadOptionalCurationPages();

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

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

  return {
    symbols,
    i18n,
    extended: {
      primary: extendedPrimary,
      tier3: extendedTier3
    }
  };
}

// Get category name for a symbol
function getCategoryName(symbol, i18n, lang) {
  const categories = {
    nature: { en: 'Nature', fr: 'Nature', es: 'Naturaleza', de: 'Natur', it: 'Natura' },
    animals: { en: 'Animals', fr: 'Animaux', es: 'Animales', de: 'Tiere', it: 'Animali' },
    body: { en: 'Body', fr: 'Corps', es: 'Cuerpo', de: 'Körper', it: 'Corpo' },
    places: { en: 'Places', fr: 'Lieux', es: 'Lugares', de: 'Orte', it: 'Luoghi' },
    objects: { en: 'Objects', fr: 'Objets', es: 'Objetos', de: 'Objekte', it: 'Oggetti' },
    actions: { en: 'Actions', fr: 'Actions', es: 'Acciones', de: 'Handlungen', it: 'Azioni' },
    people: { en: 'People', fr: 'Personnes', es: 'Personas', de: 'Menschen', it: 'Persone' },
    celestial: { en: 'Celestial', fr: 'Céleste', es: 'Celestial', de: 'Himmlisch', it: 'Celeste' }
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

// Generate HTML page for a symbol
function generatePage(symbol, allSymbols, i18n, extended, lang) {
  const t = i18n[lang];
  const symbolData = symbol[lang];
  const modifiedDate = getSymbolModifiedDate(symbol, lang);
  const homePath = localizedHomePath(lang);
  const homeUrl = localizedHomeUrl(lang);
  const hreflang = generateHreflangUrls(symbol);
  const metaTitle = generateMetaTitle(symbol, i18n, lang);
  const metaDescription = generateMetaDescription(symbol, i18n, lang);
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
  const preferredImageUrl = responsiveIllustration
    ? `https://noctalia.app${responsiveIllustration.src}`
    : DEFAULT_SOCIAL_IMAGE;
  const preferredImageWidth = responsiveIllustration?.width || 1200;
  const preferredImageHeight = responsiveIllustration?.height || 630;
  const preferredImageAlt = illustration?.alt || metaTitle;
  const softCta = symbolData.softCta && symbolData.softCta.href
    ? symbolData.softCta
    : null;

  // Generate variations HTML
  const variationsHtml = variations.map(v => `
                    <div class="variation-card glass-panel rounded-xl p-5 border border-transparent">
                        <h3 class="font-medium text-dream-cream mb-2">${escapeHtml(sanitizeEmDashes(v.context))}</h3>
                        <p class="text-sm text-gray-300">${escapeHtml(sanitizeEmDashes(v.meaning))}</p>
                    </div>`).join('\n');

  const interpretationSectionHtml = hasInterpretation ? `            <!-- Main Interpretation -->
            <section id="meaning" class="symbol-meaning glass-panel rounded-2xl p-6 md:p-8 mb-10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-4 flex items-center gap-3">
                    <i data-lucide="eye" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_interpretation}
                </h2>
                <div class="prose prose-invert prose-purple max-w-none text-gray-300 leading-relaxed space-y-4">
                    ${fullInterpretation}
                </div>
            </section>` : '';

  const variationsSectionHtml = hasVariations ? `            <!-- Variations -->
            <section id="variations" class="symbol-variations mb-10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="layers" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_variations}
                </h2>
                <div class="grid gap-4">${variationsHtml}
                </div>
            </section>` : '';

  const heroPictureHtml = illustration && responsiveIllustration ? `
                    <picture class="symbol-hero-media">
                        <img src="${escapeHtml(responsiveIllustration.src)}"
                             ${responsiveIllustration.srcset ? `srcset="${escapeHtml(responsiveIllustration.srcset)}"` : ''}
                             sizes="100vw"
                             alt="${escapeHtml(preferredImageAlt)}"
                             fetchpriority="high"
                             decoding="async"
                             width="${escapeHtml(String(responsiveIllustration.width))}"
                             height="${escapeHtml(String(responsiveIllustration.height))}">
                    </picture>` : '';

  // Generate ask yourself HTML
  const askYourselfHtml = symbolData.askYourself.map(q => `
                    <li class="flex items-start gap-3 text-purple-200/80">
                        <i data-lucide="chevron-right" class="w-5 h-5 text-dream-salmon flex-shrink-0 mt-0.5"></i>
                        <span>${escapeHtml(q)}</span>
                    </li>`).join('\n');

  // Generate related symbols HTML
  const relatedSymbolsHtml = relatedSymbols.map(rs => `
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${rs.slug}" class="symbol-link glass-panel rounded-xl p-4 text-center border border-transparent hover:border-dream-salmon/30 transition-all">
                        <span class="font-serif text-dream-cream">${escapeHtml(rs.name)}</span>
                    </a>`).join('\n');

  // Check for related article
  const relatedArticle = symbol.relatedArticles?.[lang];
  const hasRelatedArticle = !!relatedArticle;

  // Generate related article section
  const relatedArticleHtml = hasRelatedArticle ? `
            <!-- Related Article -->
            <section class="mb-10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="book-open" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_learn_more}
                </h2>
                <a href="/${lang}/blog/${relatedArticle}" class="glass-panel rounded-xl p-6 block hover:border-dream-salmon/30 transition-colors border border-transparent">
                    <span class="text-xs text-dream-salmon uppercase mb-2 block">${t.in_depth_guide}</span>
                    <h3 class="font-serif text-lg text-dream-cream mb-2">${escapeHtml(symbolData.name)} - ${t.in_depth_guide}</h3>
                    <span class="text-sm text-purple-200/60 flex items-center gap-2">
                        ${t.read_article} <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </span>
                </a>
            </section>` : '';

  const symbolFaq = Array.isArray(symbolData.faq) ? symbolData.faq.slice(0, 4) : [];

  const softCtaHtml = softCta ? `
            <!-- Soft App CTA -->
            <aside class="symbol-soft-cta glass-panel rounded-2xl p-6 md:p-8 mb-10 border border-dream-salmon/15">
                <div class="flex flex-col sm:flex-row sm:items-center gap-5">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-dream-salmon mb-2">${escapeHtml(softCta.kicker || 'Noctalia')}</p>
                        <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-3">${escapeHtml(softCta.title)}</h2>
                        <p class="text-sm md:text-base text-purple-200/75 leading-relaxed">${escapeHtml(softCta.text)}</p>
                    </div>
                    <a href="${escapeHtml(softCta.href)}" class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-dream-salmon text-dream-dark font-bold hover:bg-dream-salmon/90 transition-colors">
                        ${escapeHtml(softCta.button || t.cta_button)} <i data-lucide="arrow-right" class="w-5 h-5"></i>
                    </a>
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
    description: metaDescription,
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
    inLanguage: lang
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
                    <div class="glass-panel rounded-2xl p-6 border border-transparent">
                        <h3 class="font-medium text-dream-cream mb-2">${escapeHtml(sanitizeEmDashes(item.question))}</h3>
                        <p class="text-sm text-gray-300 leading-relaxed">${escapeHtml(sanitizeEmDashes(item.answer))}</p>
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
            <section class="mb-10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="help-circle" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_faq}
                </h2>
                <div class="grid gap-4">${faqCardsHtml}
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
    .map(l => `    <link rel="alternate" hreflang="${l}" href="${hreflang[l]}">`)
    .join('\n');
  const currentPaths = Object.fromEntries(
    CONFIG.languages.map(l => [l, `/${l}/${CONFIG.symbolsPath[l]}/${symbol[l]?.slug || symbolData.slug}`])
  );

  // Generate the full HTML
  return `<!DOCTYPE html>
<html lang="${lang}" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(metaTitle)} | Noctalia</title>
    <meta name="description" content="${escapeHtml(metaDescription)}">
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
    <meta property="og:title" content="${escapeHtml(metaTitle)}">
    <meta property="og:description" content="${escapeHtml(symbolData.shortDescription)}">
    <meta property="og:url" content="https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}">
    <meta property="og:image" content="${preferredImageUrl}">
    <meta property="og:site_name" content="Noctalia">
    <meta property="og:image:width" content="${preferredImageWidth}">
    <meta property="og:image:height" content="${preferredImageHeight}">
    <meta property="og:image:alt" content="${escapeHtml(preferredImageAlt)}">
    <meta property="og:locale" content="${t.locale}">
${CONFIG.languages.filter(l => l !== lang).map(l => `    <meta property="og:locale:alternate" content="${{ en: 'en_US', fr: 'fr_FR', es: 'es_ES', de: 'de_DE', it: 'it_IT' }[l]}">`).join('\n')}
    <meta property="article:published_time" content="${CONFIG.datePublished}">
    <meta property="article:modified_time" content="${modifiedDate}">
    <meta property="article:author" content="Noctalia">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
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
        ::-webkit-scrollbar-thumb { background: #4c1d95; border-radius: 4px; }
        .aurora-bg {
            background: radial-gradient(at 0% 0%, hsla(253, 16%, 7%, 1) 0, transparent 50%),
                radial-gradient(at 50% 0%, hsla(260, 39%, 20%, 1) 0, transparent 50%),
                radial-gradient(at 100% 0%, hsla(339, 49%, 20%, 1) 0, transparent 50%);
            background-size: 200% 200%; animation: aurora 20s ease infinite;
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1;
        }
        .orb { position: absolute; border-radius: 50%; filter: blur(100px); z-index: -1; opacity: 0.5; max-width: 100vw; max-height: 100vw; }
        .glass-panel {
            background: rgba(20, 10, 40, 0.4); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .glass-button { background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.15); transition: all 0.3s ease; }
        .glass-button:hover { background: rgba(255, 255, 255, 0.15); }
        @keyframes aurora { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        html, body { overflow-x: hidden; }
        .symbol-page .aurora-bg {
            background:
                radial-gradient(circle at 82% 18%, rgba(253, 164, 129, 0.10), transparent 22rem),
                radial-gradient(circle at 18% 0%, rgba(167, 139, 250, 0.12), transparent 24rem),
                linear-gradient(rgba(255, 255, 255, 0.022) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.022) 1px, transparent 1px),
                #08030f;
            background-size: auto, auto, 5rem 5rem, 5rem 5rem, auto;
            animation: none;
        }
        .symbol-page-main {
            position: relative;
            padding-top: 0 !important;
        }
        .symbol-breadcrumb {
            margin-bottom: auto;
            padding-top: clamp(6.5rem, 9vw, 8rem);
            letter-spacing: 0.01em;
            color: rgba(237, 225, 255, 0.68);
        }
        .symbol-hero {
            position: relative;
            left: 50%;
            width: 100vw;
            min-height: max(42rem, 100svh);
            margin-left: -50vw;
            isolation: isolate;
            overflow: hidden;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
            object-fit: cover;
            object-position: center;
        }
        .symbol-hero-overlay {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            width: min(100%, 52rem);
            min-height: max(42rem, 100svh);
            margin: 0 auto;
            padding: 0 1rem clamp(3rem, 7vh, 5.5rem);
            background:
                linear-gradient(180deg, rgba(8, 3, 15, 0.04) 18%, rgba(8, 3, 15, 0.16) 40%, rgba(8, 3, 15, 0.88) 87%, #090413 100%);
        }
        .symbol-hero::after {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 1;
            pointer-events: none;
            background:
                linear-gradient(90deg, rgba(8, 3, 15, 0.36), transparent 65%),
                linear-gradient(180deg, rgba(8, 3, 15, 0.16), transparent 35%, rgba(8, 3, 15, 0.34));
        }
        .symbol-hero-copy {
            width: 100%;
            min-width: 0;
            margin-top: auto;
        }
        .symbol-hero-chips span,
        .symbol-hero-chips a {
            background: rgba(8, 3, 15, 0.72);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }
        .symbol-heading {
            width: min(100%, 12ch);
            max-width: 100%;
            color: #fff7ed;
            font-size: clamp(3.25rem, 8vw, 6.5rem) !important;
            line-height: 0.92 !important;
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
            margin-top: clamp(1.75rem, 4vw, 3rem);
            color: rgba(237, 225, 255, 0.84);
        }
        .symbol-soft-cta a {
            flex-shrink: 0;
        }
        .symbol-jump-nav { display: none; }
        .symbol-meaning,
        .symbol-variations,
        #questions {
            scroll-margin-top: 7rem;
        }
        .variation-card { transition: all 0.3s ease; }
        .variation-card:hover { transform: translateY(-2px); border-color: rgba(253, 164, 129, 0.3); }
        .symbol-link { transition: all 0.3s ease; }
        .symbol-link:hover { transform: translateY(-2px); border-color: rgba(253, 164, 129, 0.3); }
        @media (max-width: 767px) {
            .symbol-page-main {
                padding-top: 0 !important;
                padding-left: 1rem !important;
                padding-right: 1rem !important;
                padding-bottom: 3.5rem !important;
            }
            .symbol-page .orb { display: none; }
            .symbol-breadcrumb {
                display: none;
            }
            .symbol-hero {
                min-height: clamp(30rem, 125vw, 43rem);
                margin-bottom: 0 !important;
            }
            .symbol-hero-overlay {
                min-height: clamp(30rem, 125vw, 43rem);
                padding: 6.5rem 1rem clamp(2rem, 5vw, 3rem);
                background:
                    linear-gradient(180deg, rgba(8, 3, 15, 0.03) 18%, rgba(8, 3, 15, 0.12) 40%, rgba(8, 3, 15, 0.78) 75%, #090413 100%);
            }
            .symbol-hero-chips {
                gap: 0.55rem !important;
                margin-bottom: 1rem !important;
            }
            .symbol-hero-chips span,
            .symbol-hero-chips a {
                padding: 0.48rem 0.74rem !important;
                font-size: 0.68rem !important;
            }
            .symbol-category-chip { display: none !important; }
            .symbol-heading {
                margin-bottom: 0 !important;
                font-size: clamp(2.15rem, 9.4vw, 3.1rem) !important;
                line-height: 0.97 !important;
                letter-spacing: 0 !important;
            }
            .symbol-h1-prefix { display: none; }
            .symbol-summary {
                font-size: 1rem !important;
                line-height: 1.6 !important;
                max-width: 30rem;
            }
            .symbol-soft-cta a {
                width: 100%;
            }
            .symbol-jump-nav {
                position: sticky;
                top: 4.65rem;
                z-index: 25;
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                overflow: hidden;
                margin: 0.95rem -0.1rem 1.45rem;
                border: 1px solid rgba(255, 255, 255, 0.10);
                border-radius: 1.15rem;
                background: rgba(13, 6, 24, 0.94);
                backdrop-filter: blur(18px);
                -webkit-backdrop-filter: blur(18px);
                box-shadow: 0 16px 38px rgba(0, 0, 0, 0.28);
            }
            .symbol-jump-link {
                min-height: 4.35rem;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 0.35rem;
                color: rgba(237, 225, 255, 0.72);
                font-size: 0.78rem;
                border-left: 1px solid rgba(255, 255, 255, 0.075);
            }
            .symbol-jump-link:first-child { border-left: 0; }
            .symbol-jump-link:focus { outline: none; }
            .symbol-jump-link:focus-visible {
                outline: 2px solid rgba(253, 164, 129, 0.64);
                outline-offset: -4px;
            }
            .symbol-jump-link.is-active {
                color: #fff7ed;
                box-shadow: inset 0 -3px 0 #fda481;
            }
            .symbol-jump-link.is-active svg { color: #fda481; }
            body.symbol-jump-fixed .symbol-jump-nav {
                position: fixed;
                left: 1rem;
                right: 1rem;
                top: 4.65rem;
                margin: 0;
                max-width: calc(100vw - 2rem);
            }
            body.symbol-jump-fixed .symbol-jump-nav + .symbol-meaning {
                margin-top: 6rem !important;
            }
            .symbol-meaning,
            #questions {
                padding: 1.25rem !important;
                border-radius: 1.15rem !important;
                margin-bottom: 1.75rem !important;
            }
            .symbol-meaning h2,
            .symbol-variations h2,
            #questions h2 {
                font-size: 1.25rem !important;
                margin-bottom: 1rem !important;
            }
            .symbol-meaning .prose {
                font-size: 0.98rem;
                line-height: 1.68;
            }
            .symbol-meaning .prose p + p {
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid rgba(255, 255, 255, 0.055);
            }
            .symbol-variations {
                margin-bottom: 1.75rem !important;
            }
            .variation-card {
                padding: 1rem !important;
                border-radius: 1rem !important;
            }
            .variation-card p {
                line-height: 1.55;
            }
        }
    </style>

    <!-- Schema.org DefinedTerm -->
${renderJsonLd(definedTermJsonLd)}

    <!-- Schema.org Article -->
${renderJsonLd(articleJsonLd)}

    <!-- Schema.org BreadcrumbList -->
${renderJsonLd(breadcrumbListJsonLd)}

    <!-- Schema.org FAQPage -->
${faqPageJsonLd ? renderJsonLd(faqPageJsonLd) : ''}
</head>

<body class="symbol-page bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden" style="background-color: #0a0514;">
    <div class="aurora-bg"></div>
    <div class="orb w-[70vw] h-[70vw] md:w-[40rem] md:h-[40rem] bg-purple-900/30 top-0 left-0"></div>
    <div class="orb w-[90vw] h-[90vw] md:w-[50rem] md:h-[50rem] bg-blue-900/20 bottom-0 right-0"></div>

    <!-- Navbar -->
${renderPseoNav(lang, currentPaths, 'dictionary')}

    <main class="symbol-page-main pt-32 pb-20 px-4">
        <article class="max-w-3xl mx-auto">

            <!-- Header -->
            <header class="symbol-hero" data-image-seo-hero="true">
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
                            <span data-page-intent="quick-symbol-reference" class="inline-flex items-center gap-2 text-xs font-mono text-dream-salmon border border-dream-salmon/30 rounded-full px-4 py-2">
                                <i data-lucide="sparkles" class="w-4 h-4"></i>
                                ${QUICK_REFERENCE_LABELS[lang] || QUICK_REFERENCE_LABELS.en}
                            </span>
                            <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${t.category_slugs[symbol.category]}"
                               class="symbol-category-chip inline-flex items-center gap-2 text-xs font-mono text-purple-200/70 border border-white/10 rounded-full px-4 py-2 hover:text-white hover:border-dream-salmon/30 transition-colors">
                                ${categoryName}
                            </a>
                        </div>

                        <h1 class="symbol-heading font-serif text-3xl md:text-6xl mb-0 leading-[0.96]">
                            <span class="symbol-h1-prefix">${escapeHtml(t.h1_prefix)}</span> <span>${escapeHtml(symbolData.name)}</span>
                        </h1>
                    </div>
                </div>
            </header>

            <p class="symbol-summary text-lg leading-relaxed">
                ${escapeHtml(symbolData.shortDescription)}
            </p>

            <nav class="symbol-jump-nav" aria-label="${escapeHtml(sheetLabels.jumpNav)}" style="grid-template-columns: repeat(${jumpItems.length}, minmax(0, 1fr));">${jumpNavHtml}
            </nav>

${interpretationSectionHtml}

${variationsSectionHtml}

            <!-- Ask Yourself -->
            <section id="questions" class="glass-panel rounded-2xl p-6 md:p-8 mb-10 border border-dream-salmon/20">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-4 flex items-center gap-3">
                    <i data-lucide="help-circle" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_ask_yourself}
                </h2>
                <ul class="space-y-3">${askYourselfHtml}
                </ul>
            </section>

${softCtaHtml}
${faqSectionHtml}

            <!-- Related Symbols -->
            ${relatedSymbols.length > 0 ? `<section class="mb-10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="link" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_related_symbols}
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">${relatedSymbolsHtml}
                </div>
            </section>` : ''}
${relatedArticleHtml}
            <!-- CTA Section -->
            <aside class="glass-panel rounded-3xl p-8 md:p-10 text-center border border-dream-salmon/20">
                <div class="w-16 h-16 bg-dream-salmon/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i data-lucide="sparkles" class="w-8 h-8 text-dream-salmon"></i>
                </div>
                <h3 class="font-serif text-2xl md:text-3xl mb-4 text-dream-cream">${t.cta_title}</h3>
                <p class="text-purple-200/70 mb-6 max-w-lg mx-auto">
                    ${t.cta_description}
                </p>
                ${renderSymbolConversionActions(lang)}
            </aside>

            <!-- Back to Dictionary -->
            <div class="mt-10 text-center">
                <a href="/${lang}/guides/${t.dictionary_slug}" class="inline-flex items-center gap-2 text-purple-200/60 hover:text-dream-salmon transition-colors">
                    <i data-lucide="arrow-left" class="w-4 h-4"></i>
                    ${t.back_to_dictionary}
                </a>
            </div>

        </article>
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
    <script src="/js/mobile-menu.js?v=${CONFIG.cssVersion}" defer></script>
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

// Category icons mapping (Lucide icon names)
const CATEGORY_ICONS = {
  nature: 'leaf',
  animals: 'paw-print',
  body: 'user',
  places: 'home',
  objects: 'package',
  actions: 'zap',
  people: 'users',
  celestial: 'sun'
};

// Get category name for a given category ID
function getCategoryNameById(categoryId, lang) {
  const categories = {
    nature: { en: 'Nature', fr: 'Nature', es: 'Naturaleza', de: 'Natur', it: 'Natura' },
    animals: { en: 'Animals', fr: 'Animaux', es: 'Animales', de: 'Tiere', it: 'Animali' },
    body: { en: 'Body', fr: 'Corps', es: 'Cuerpo', de: 'Körper', it: 'Corpo' },
    places: { en: 'Places', fr: 'Lieux', es: 'Lugares', de: 'Orte', it: 'Luoghi' },
    objects: { en: 'Objects', fr: 'Objets', es: 'Objetos', de: 'Objekte', it: 'Oggetti' },
    actions: { en: 'Actions', fr: 'Actions', es: 'Acciones', de: 'Handlungen', it: 'Azioni' },
    people: { en: 'People', fr: 'Personnes', es: 'Personas', de: 'Menschen', it: 'Persone' },
    celestial: { en: 'Celestial', fr: 'Céleste', es: 'Celestial', de: 'Himmlisch', it: 'Celeste' }
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
  const categoryIcon = CATEGORY_ICONS[categoryId] || 'sparkles';
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
    it: 'Come usare questa categoria'
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
    ]
  };

  const howToBullets = {
    en: ['Write down the main emotion.', 'Note what changed during the dream.', 'Pick one symbol and connect it to a recent moment.'],
    fr: ["Notez l'émotion principale.", 'Repérez ce qui change dans le rêve.', 'Choisissez un symbole et reliez-le à un moment récent.'],
    es: ['Anota la emoción principal.', 'Fíjate en qué cambia durante el sueño.', 'Elige un símbolo y conéctalo con un momento reciente.'],
    de: ['Notiere die wichtigste Emotion.', 'Achte darauf, was sich im Traum verändert.', 'Wähle ein Symbol und verbinde es mit einem aktuellen Moment.'],
    it: ["Scrivi l'emozione principale.", 'Nota cosa cambia durante il sogno.', 'Scegli un simbolo e collegalo a un momento recente.']
  };

  const categoryHowToHtml = `
            <!-- How to use -->
            <section class="glass-panel rounded-2xl p-6 md:p-8 mb-12 border border-dream-salmon/10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-4 flex items-center gap-3">
                    <i data-lucide="sparkles" class="w-6 h-6 text-dream-salmon"></i>
                    ${escapeHtml(howToTitles[lang] || howToTitles.en)}
                </h2>
                <div class="prose prose-invert prose-purple max-w-none text-gray-300 leading-relaxed space-y-4">
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
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${s[lang].slug}" class="symbol-card glass-panel rounded-2xl p-6 border border-transparent group">
                        <h2 class="font-serif text-xl text-dream-cream mb-3 group-hover:text-dream-salmon transition-colors">${escapeHtml(s[lang].name)}</h2>
                        <p class="text-sm text-gray-400 leading-relaxed line-clamp-3">${escapeHtml(s[lang].shortDescription)}</p>
                        <span class="inline-flex items-center gap-2 text-xs text-dream-salmon mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            ${t.read_article} <i data-lucide="arrow-right" class="w-3 h-3"></i>
                        </span>
                    </a>`).join('\n');

  // Generate other categories HTML
  const otherCategoriesHtml = allCategories
    .filter(c => c.id !== categoryId)
    .map(c => `
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${i18n[lang].category_slugs[c.id]}" class="category-chip glass-panel rounded-full px-5 py-3 text-sm text-purple-200/80 border border-transparent hover:text-dream-cream">
                        ${getCategoryNameById(c.id, lang)} <span class="text-purple-400/60 ml-1">(${c.count})</span>
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
                    <a href="/${lang}/guides/${p.slugs[lang]}" class="category-chip glass-panel rounded-xl px-5 py-4 text-sm text-purple-200/80 border border-transparent hover:text-dream-cream hover:border-dream-salmon/30 transition-all flex items-center gap-2">
                        <i data-lucide="book-open" class="w-4 h-4 text-dream-salmon"></i>
                        ${escapeHtml(p[lang].title)}
                    </a>`).join('\n');

      relatedGuidesHtml = `
            <!-- Related Guides -->
            <section class="mb-16">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="book-marked" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.curation_related_guides}
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${guidesLinksHtml}
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
    inLanguage: lang,
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
<html lang="${lang}" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(metaTitle)} | Noctalia</title>
    <meta name="description" content="${escapeHtml(metaDescription)}">
    <link rel="canonical" href="https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${categorySlug}">
${CONFIG.languages.filter(l => hreflang[l]).map(l => `    <link rel="alternate" hreflang="${l}" href="${hreflang[l]}">`).join('\n')}
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
${CONFIG.languages.filter(l => l !== lang).map(l => `    <meta property="og:locale:alternate" content="${{ en: 'en_US', fr: 'fr_FR', es: 'es_ES', de: 'de_DE', it: 'it_IT' }[l]}">`).join('\n')}
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
        ::-webkit-scrollbar-thumb { background: #4c1d95; border-radius: 4px; }
        .aurora-bg {
            background: radial-gradient(at 0% 0%, hsla(253, 16%, 7%, 1) 0, transparent 50%),
                radial-gradient(at 50% 0%, hsla(260, 39%, 20%, 1) 0, transparent 50%),
                radial-gradient(at 100% 0%, hsla(339, 49%, 20%, 1) 0, transparent 50%);
            background-size: 200% 200%; animation: aurora 20s ease infinite;
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1;
        }
        .orb { position: absolute; border-radius: 50%; filter: blur(100px); z-index: -1; opacity: 0.5; max-width: 100vw; max-height: 100vw; }
        .glass-panel {
            background: rgba(20, 10, 40, 0.4); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .glass-button { background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.15); transition: all 0.3s ease; }
        .glass-button:hover { background: rgba(255, 255, 255, 0.15); }
        @keyframes aurora { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        html, body { overflow-x: hidden; }
        .symbol-card { transition: all 0.3s ease; }
        .symbol-card:hover { transform: translateY(-4px); border-color: rgba(253, 164, 129, 0.3); }
        .category-chip { transition: all 0.3s ease; }
        .category-chip:hover { background: rgba(255, 255, 255, 0.15); border-color: rgba(253, 164, 129, 0.3); }
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    </style>

    <!-- Schema.org CollectionPage -->
${renderJsonLd(collectionPageJsonLd)}

    <!-- Schema.org ItemList -->
${renderJsonLd(itemListJsonLd)}

    <!-- Schema.org BreadcrumbList -->
${renderJsonLd(breadcrumbListJsonLd)}
</head>

<body class="bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden" style="background-color: #0a0514;">
    <div class="aurora-bg"></div>
    <div class="orb w-[70vw] h-[70vw] md:w-[40rem] md:h-[40rem] bg-purple-900/30 top-0 left-0"></div>
    <div class="orb w-[90vw] h-[90vw] md:w-[50rem] md:h-[50rem] bg-blue-900/20 bottom-0 right-0"></div>

    <!-- Navbar -->
${renderPseoNav(lang, currentPaths, 'dictionary')}

    <main class="pt-32 pb-20 px-4">
        <div class="max-w-5xl mx-auto">

            <!-- Breadcrumb -->
            <nav class="text-sm text-purple-200/60 mb-8" aria-label="Breadcrumb">
                <ol class="flex items-center gap-2 flex-wrap">
                    <li>
                        <a href="${homePath}" class="hover:text-dream-salmon transition-colors">${t.home}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <a href="/${lang}/guides/${t.dictionary_slug}" class="hover:text-dream-salmon transition-colors">${t.symbols}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <span class="text-dream-cream">${escapeHtml(categoryName)}</span>
                    </li>
                </ol>
            </nav>

            <!-- Header -->
            <header class="pseo-illustrated-hero mb-12 text-center" data-image-seo-hero="true">
${renderPseoHeroIllustration(pageIllustration)}
                <div class="pseo-hero-copy">
                <div class="flex justify-center gap-3 mb-6">
                    <span class="inline-flex items-center gap-2 text-xs font-mono text-dream-salmon border border-dream-salmon/30 rounded-full px-4 py-2">
                        <i data-lucide="${categoryIcon}" class="w-4 h-4"></i>
                        ${symbolsCount} ${t.symbols_in_category}
                    </span>
                </div>

                <h1 class="font-serif text-3xl md:text-5xl mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white via-dream-lavender to-purple-400/50 leading-tight">
                    ${t.category_h1_template.replace(/{category}/g, categoryName)}
                </h1>

                <p class="text-lg text-purple-200/80 leading-relaxed max-w-2xl mx-auto">
                    ${escapeHtml(sanitizeEmDashes(categoryIntro))}
                </p>
                </div>
            </header>

${categoryHowToHtml}
            <!-- Symbol Grid -->
            <section class="mb-16">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${symbolsHtml}
                </div>
            </section>

            <!-- Other Categories -->
            <section class="mb-16">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="grid-3x3" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.other_categories}
                </h2>
                <div class="flex flex-wrap gap-3">${otherCategoriesHtml}
                </div>
            </section>
${relatedGuidesHtml}
            <!-- CTA Section -->
            <aside class="glass-panel rounded-3xl p-8 md:p-10 text-center border border-dream-salmon/20">
                <div class="w-16 h-16 bg-dream-salmon/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i data-lucide="sparkles" class="w-8 h-8 text-dream-salmon"></i>
                </div>
                <h3 class="font-serif text-2xl md:text-3xl mb-4 text-dream-cream">${t.cta_title}</h3>
                <p class="text-purple-200/70 mb-6 max-w-lg mx-auto">
                    ${t.cta_description}
                </p>
                ${renderSymbolConversionActions(lang)}
            </aside>

            <!-- Back to Dictionary -->
            <div class="mt-10 text-center">
                <a href="/${lang}/guides/${t.dictionary_slug}" class="inline-flex items-center gap-2 text-purple-200/60 hover:text-dream-salmon transition-colors">
                    <i data-lucide="arrow-left" class="w-4 h-4"></i>
                    ${t.back_to_dictionary}
                </a>
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
  return JSON.parse(fs.readFileSync(curationPath, 'utf8'));
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
    const relatedArticle = s.relatedArticles?.[lang];
    const relatedArticleHtml = relatedArticle ? `
                        <a href="/${lang}/blog/${relatedArticle}" class="mt-4 inline-flex items-center gap-2 text-xs text-purple-200/70 hover:text-dream-salmon transition-colors">
                            ${t.read_article} <i data-lucide="arrow-right" class="w-3 h-3"></i>
                        </a>` : '';
    return `
                    <article class="symbol-card glass-panel rounded-2xl p-6 border border-transparent group">
                        <a href="${symbolHref}" class="block">
                        <div class="flex items-start justify-between mb-3">
                            <h2 class="font-serif text-xl text-dream-cream group-hover:text-dream-salmon transition-colors">${i + 1}. ${escapeHtml(symbolData.name)}</h2>
                        </div>
                        <p class="text-sm text-gray-400 leading-relaxed mb-3 line-clamp-3">${escapeHtml(symbolData.shortDescription)}</p>
                        <span class="inline-flex items-center gap-2 text-xs text-dream-salmon opacity-0 group-hover:opacity-100 transition-opacity">
                            ${t.curation_read_full} <i data-lucide="arrow-right" class="w-3 h-3"></i>
                        </span>
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
    inLanguage: lang
  };

  return `<!DOCTYPE html>
<html lang="${lang}" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(metaTitle)} | Noctalia</title>
    <meta name="description" content="${escapeHtml(pageData.metaDescription)}">
    <link rel="canonical" href="https://noctalia.app/${lang}/guides/${slug}">
${CONFIG.languages.filter(l => hreflang[l]).map(l => `    <link rel="alternate" hreflang="${l}" href="${hreflang[l]}">`).join('\n')}
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
${CONFIG.languages.filter(l => l !== lang).map(l => `    <meta property="og:locale:alternate" content="${{ en: 'en_US', fr: 'fr_FR', es: 'es_ES', de: 'de_DE', it: 'it_IT' }[l]}">`).join('\n')}
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
        ::-webkit-scrollbar-thumb { background: #4c1d95; border-radius: 4px; }
        .aurora-bg {
            background: radial-gradient(at 0% 0%, hsla(253, 16%, 7%, 1) 0, transparent 50%),
                radial-gradient(at 50% 0%, hsla(260, 39%, 20%, 1) 0, transparent 50%),
                radial-gradient(at 100% 0%, hsla(339, 49%, 20%, 1) 0, transparent 50%);
            background-size: 200% 200%; animation: aurora 20s ease infinite;
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1;
        }
        .orb { position: absolute; border-radius: 50%; filter: blur(100px); z-index: -1; opacity: 0.5; max-width: 100vw; max-height: 100vw; }
        .glass-panel {
            background: rgba(20, 10, 40, 0.4); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .glass-button { background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.15); transition: all 0.3s ease; }
        .glass-button:hover { background: rgba(255, 255, 255, 0.15); }
        @keyframes aurora { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        html, body { overflow-x: hidden; }
        .symbol-card { transition: all 0.3s ease; }
        .symbol-card:hover { transform: translateY(-4px); border-color: rgba(253, 164, 129, 0.3); }
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    </style>

    <!-- Schema.org ItemList -->
${renderJsonLd(itemListJsonLd)}

    <!-- Schema.org Article -->
${renderJsonLd(articleJsonLd)}

    <!-- Schema.org BreadcrumbList -->
${renderJsonLd(breadcrumbListJsonLd)}
</head>

<body class="bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden" style="background-color: #0a0514;">
    <div class="aurora-bg"></div>
    <div class="orb w-[70vw] h-[70vw] md:w-[40rem] md:h-[40rem] bg-purple-900/30 top-0 left-0"></div>
    <div class="orb w-[90vw] h-[90vw] md:w-[50rem] md:h-[50rem] bg-blue-900/20 bottom-0 right-0"></div>

    <!-- Navbar -->
${renderPseoNav(lang, currentPaths, 'dictionary')}

    <main class="pt-32 pb-20 px-4">
        <div class="max-w-5xl mx-auto">

            <!-- Breadcrumb -->
            <nav class="text-sm text-purple-200/60 mb-8" aria-label="Breadcrumb">
                <ol class="flex items-center gap-2 flex-wrap">
                    <li>
                        <a href="${homePath}" class="hover:text-dream-salmon transition-colors">${t.home}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <a href="/${lang}/guides/${t.dictionary_slug}" class="hover:text-dream-salmon transition-colors">${t.symbols}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <span class="text-dream-cream">${escapeHtml(pageData.title)}</span>
                    </li>
                </ol>
            </nav>

            <!-- Header -->
            <header class="pseo-illustrated-hero mb-12 text-center" data-image-seo-hero="true">
${renderPseoHeroIllustration(pageIllustration)}
                <div class="pseo-hero-copy">
                <div class="flex justify-center gap-3 mb-6">
                    <span class="inline-flex items-center gap-2 text-xs font-mono text-dream-salmon border border-dream-salmon/30 rounded-full px-4 py-2">
                        <i data-lucide="list" class="w-4 h-4"></i>
                        ${t.curation_label}
                    </span>
                    <span class="inline-flex items-center gap-2 text-xs font-mono text-purple-200/70 border border-white/10 rounded-full px-4 py-2">
                        ${t.curation_symbols_count.replace('{count}', symbolsCount)}
                    </span>
                </div>

                <h1 class="font-serif text-3xl md:text-5xl mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white via-dream-lavender to-purple-400/50 leading-tight">
                    ${escapeHtml(pageData.title)}
                </h1>

                <p class="text-lg text-purple-200/80 leading-relaxed max-w-3xl mx-auto">
                    ${escapeHtml(sanitizeEmDashes(pageData.intro))}
                </p>
                </div>
            </header>

            <!-- Symbol Grid -->
            <section class="mb-16">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${symbolCardsHtml}
                </div>
            </section>

            <!-- Outro -->
            <section class="glass-panel rounded-2xl p-6 md:p-8 mb-10">
                <div class="prose prose-invert prose-purple max-w-none text-gray-300 leading-relaxed">
                    <p>${escapeHtml(sanitizeEmDashes(pageData.outro))}</p>
                </div>
            </section>

            <!-- CTA Section -->
            <aside class="glass-panel rounded-3xl p-8 md:p-10 text-center border border-dream-salmon/20">
                <div class="w-16 h-16 bg-dream-salmon/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i data-lucide="sparkles" class="w-8 h-8 text-dream-salmon"></i>
                </div>
                <h3 class="font-serif text-2xl md:text-3xl mb-4 text-dream-cream">${t.cta_title}</h3>
                <p class="text-purple-200/70 mb-6 max-w-lg mx-auto">
                    ${t.cta_description}
                </p>
                ${renderSymbolConversionActions(lang)}
            </aside>

            <!-- Back to Dictionary -->
            <div class="mt-10 text-center">
                <a href="/${lang}/guides/${t.dictionary_slug}" class="inline-flex items-center gap-2 text-purple-200/60 hover:text-dream-salmon transition-colors">
                    <i data-lucide="arrow-left" class="w-4 h-4"></i>
                    ${t.back_to_dictionary}
                </a>
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
