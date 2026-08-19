const fs = require('fs');
const path = require('path');
const { readJson } = require('./docs-source-utils');

const ROOT_DIR = path.resolve(__dirname, '../..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const DOCS_SRC_DIR = path.join(ROOT_DIR, 'docs-src');
const STATIC_DATA_DIR = path.join(DOCS_SRC_DIR, 'static', 'data');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const siteConfig = readJson(path.join(DOCS_SRC_DIR, 'config', 'site.config.json'));
const staticPagesConfig = readJson(path.join(DOCS_SRC_DIR, 'config', 'static-pages.json'));

function loadLocales() {
  const locales = {};
  for (const lang of siteConfig.languages) {
    const localePath = path.join(DOCS_SRC_DIR, 'locales', `${lang}.json`);
    if (!fs.existsSync(localePath)) {
      throw new Error(
        `Missing locale source file: ${path.relative(ROOT_DIR, localePath)} (required by site language "${lang}")`
      );
    }
    locales[lang] = readJson(localePath);
  }
  return locales;
}

function readAssetVersion() {
  const versionPath = path.join(DOCS_DIR, 'version.txt');

  if (!fs.existsSync(versionPath)) {
    throw new Error('Missing generated docs asset version file. Run `npm run docs:build`.');
  }

  const version = fs.readFileSync(versionPath, 'utf8').trim();
  if (!version) {
    throw new Error('Empty docs asset version file.');
  }

  return version;
}

function getStaticPageConfig(pageId) {
  return staticPagesConfig.pages.find((page) => page.pageId === pageId) || null;
}

function getStaticPagePath(pageId, lang) {
  const page = getStaticPageConfig(pageId);
  if (!page) return null;

  const slug = page.slugs?.[lang];
  if (slug == null) return null;
  return slug ? `/${lang}/${slug}` : `/${lang}/`;
}

function getLanguageTag(lang) {
  return siteConfig.languageTags?.[lang] || lang;
}

function getCollectionLanguages(collectionId) {
  const languages = siteConfig.collections?.[collectionId]?.languages;
  return Array.isArray(languages) && languages.length > 0 ? languages : siteConfig.languages;
}

function getAndroidStoreUrl(lang) {
  const hl = lang ? siteConfig.storeLinks?.hlOverrides?.[lang] || lang : null;
  const suffix = hl ? `&hl=${hl}` : '';
  return `${siteConfig.storeLinks.androidBase}${suffix}`;
}

// Public web app (Expo web build) CTA. The URL only carries campaign
// attribution — never visitor data. Parameters are emitted in a fixed order
// so identical surfaces always produce byte-identical links. `lang` is kept
// for parity with `getAndroidStoreUrl`; the web app currently derives its
// language from the browser and reads no language hint from the URL.
function getWebAppUrl(lang, { medium, content } = {}) {
  const base = siteConfig.storeLinks?.webAppBase;
  if (!base) {
    throw new Error('Missing storeLinks.webAppBase in docs-src/config/site.config.json');
  }
  if (!medium) {
    throw new Error('getWebAppUrl requires a `medium` (utm_medium) for the surface that renders the link');
  }

  const params = new URLSearchParams();
  params.set('utm_source', 'noctalia.app');
  params.set('utm_medium', String(medium));
  params.set('utm_campaign', 'web_app');
  if (content) params.set('utm_content', String(content));

  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${params.toString()}`;
}

module.exports = {
  DATA_DIR,
  DOCS_DIR,
  DOCS_SRC_DIR,
  ROOT_DIR,
  STATIC_DATA_DIR,
  getAndroidStoreUrl,
  getCollectionLanguages,
  getLanguageTag,
  getStaticPageConfig,
  getStaticPagePath,
  getWebAppUrl,
  loadLocales,
  readAssetVersion,
  siteConfig,
  staticPagesConfig,
};
