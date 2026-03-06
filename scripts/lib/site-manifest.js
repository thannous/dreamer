const path = require('path');
const { DATA_DIR, DOCS_DIR, siteConfig, staticPagesConfig } = require('./docs-site-config');
const { readJson } = require('./docs-source-utils');

function buildStaticPagesCollection() {
  const entries = {};

  for (const page of staticPagesConfig.pages) {
    const locales = {};
    for (const lang of siteConfig.languages) {
      const slug = page.slugs[lang];
      locales[lang] = {
        slug,
        path: slug ? `/${lang}/${slug}` : `/${lang}/`,
      };
    }

    entries[page.pageId] = {
      id: page.pageId,
      type: page.layout,
      canonicalLanguage: siteConfig.defaultLanguage,
      canonicalSlug: page.slugs[siteConfig.defaultLanguage],
      locales,
    };
  }

  return {
    description: 'Localized landing and legal pages for the docs site.',
    entries,
  };
}

function buildBlogCollection() {
  const contentManifest = readJson(path.join(DATA_DIR, 'content-manifest.json'));
  return contentManifest.collections.blog;
}

function buildGuideCollection() {
  const symbolI18n = readJson(path.join(DOCS_DIR, 'data', 'symbol-i18n.json'));
  const curation = readJson(path.join(DOCS_DIR, 'data', 'curation-pages.json'));
  const entries = {};

  entries['guide.index'] = {
    id: 'guide.index',
    type: 'guideIndex',
    canonicalLanguage: siteConfig.defaultLanguage,
    canonicalSlug: '',
    locales: Object.fromEntries(
      siteConfig.languages.map((lang) => [
        lang,
        {
          slug: '',
          path: `/${lang}/guides/`,
        },
      ])
    ),
  };

  entries['guide.dictionary'] = {
    id: 'guide.dictionary',
    type: 'guideDictionary',
    canonicalLanguage: siteConfig.defaultLanguage,
    canonicalSlug: symbolI18n.en.dictionary_slug,
    locales: Object.fromEntries(
      siteConfig.languages.map((lang) => [
        lang,
        {
          slug: symbolI18n[lang].dictionary_slug,
          path: `/${lang}/guides/${symbolI18n[lang].dictionary_slug}`,
        },
      ])
    ),
  };

  for (const page of curation.pages || []) {
    entries[`guide.${page.id}`] = {
      id: `guide.${page.id}`,
      type: 'guideCuration',
      canonicalLanguage: siteConfig.defaultLanguage,
      canonicalSlug: page.slugs[siteConfig.defaultLanguage],
      locales: Object.fromEntries(
        siteConfig.languages.map((lang) => [
          lang,
          {
            slug: page.slugs[lang],
            path: `/${lang}/guides/${page.slugs[lang]}`,
          },
        ])
      ),
    };
  }

  return {
    description: 'Guide hubs and curated dream guide pages.',
    entries,
  };
}

function buildSymbolCollection() {
  const symbolsData = readJson(path.join(DOCS_DIR, 'data', 'dream-symbols.json'));
  const symbolI18n = readJson(path.join(DOCS_DIR, 'data', 'symbol-i18n.json'));
  const entries = {};

  for (const symbol of symbolsData.symbols || []) {
    entries[`symbol.${symbol.id}`] = {
      id: `symbol.${symbol.id}`,
      type: 'symbol',
      canonicalLanguage: siteConfig.defaultLanguage,
      canonicalSlug: symbol.en.slug,
      locales: Object.fromEntries(
        siteConfig.languages.map((lang) => [
          lang,
          {
            slug: symbol[lang].slug,
            path: `/${lang}/${siteConfig.symbolsPath[lang]}/${symbol[lang].slug}`,
          },
        ])
      ),
    };
  }

  for (const categoryId of Object.keys(symbolI18n.en.category_slugs || {})) {
    entries[`symbolCategory.${categoryId}`] = {
      id: `symbolCategory.${categoryId}`,
      type: 'symbolCategory',
      canonicalLanguage: siteConfig.defaultLanguage,
      canonicalSlug: symbolI18n.en.category_slugs[categoryId],
      locales: Object.fromEntries(
        siteConfig.languages.map((lang) => [
          lang,
          {
            slug: symbolI18n[lang].category_slugs[categoryId],
            path: `/${lang}/${siteConfig.symbolsPath[lang]}/${symbolI18n[lang].category_slugs[categoryId]}`,
          },
        ])
      ),
    };
  }

  return {
    description: 'Dream symbols and symbol category pages.',
    entries,
  };
}

function buildSiteManifest() {
  return {
    schemaVersion: 1,
    defaultLanguage: siteConfig.defaultLanguage,
    languages: siteConfig.languages,
    collections: {
      pages: buildStaticPagesCollection(),
      blog: buildBlogCollection(),
      guides: buildGuideCollection(),
      symbols: buildSymbolCollection(),
    },
  };
}

function buildEntryIndex(manifest) {
  const index = new Map();
  for (const collection of Object.values(manifest.collections || {})) {
    for (const entry of Object.values(collection.entries || {})) {
      index.set(entry.id, entry);
    }
  }
  return index;
}

module.exports = {
  buildEntryIndex,
  buildSiteManifest,
};
