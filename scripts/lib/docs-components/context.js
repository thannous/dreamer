const { loadLocales, siteConfig } = require('../docs-site-config');
const { buildEntryIndex } = require('../site-manifest');

const locales = loadLocales();

function routePath(entryIndex, pageId, lang) {
  return entryIndex.get(pageId)?.locales?.[lang]?.path || `/${lang}/`;
}

function hasRoute(entryIndex, pageId, lang) {
  return Boolean(entryIndex.get(pageId)?.locales?.[lang]?.path);
}

function createRenderContext({ manifest, entryId, meta, entryOverride = null }) {
  const entryIndex = buildEntryIndex(manifest);
  const lang = meta.lang || siteConfig.defaultLanguage;

  return {
    entryId,
    entryIndex,
    entry: entryOverride || entryIndex.get(entryId),
    lang,
    locale: locales[lang],
    locales,
    manifest,
    meta,
    hasRoute: (pageId, candidateLang = lang) => hasRoute(entryIndex, pageId, candidateLang),
    routePath: (pageId, candidateLang = lang) => routePath(entryIndex, pageId, candidateLang),
    siteConfig,
  };
}

module.exports = {
  createRenderContext,
  hasRoute,
  routePath,
};
