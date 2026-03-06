const fs = require('fs');
const path = require('path');
const { readJson } = require('./docs-source-utils');

const ROOT_DIR = path.resolve(__dirname, '../..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const DOCS_SRC_DIR = path.join(ROOT_DIR, 'docs-src');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const siteConfig = readJson(path.join(DOCS_SRC_DIR, 'config', 'site.config.json'));
const staticPagesConfig = readJson(path.join(DOCS_SRC_DIR, 'config', 'static-pages.json'));

function loadLocales() {
  const locales = {};
  for (const lang of siteConfig.languages) {
    locales[lang] = readJson(path.join(DOCS_SRC_DIR, 'locales', `${lang}.json`));
  }
  return locales;
}

function readAssetVersion() {
  const docsSrcVersionPath = path.join(DOCS_SRC_DIR, 'static', 'version.txt');
  const docsVersionPath = path.join(DOCS_DIR, 'version.txt');
  const versionPath = fs.existsSync(docsSrcVersionPath) ? docsSrcVersionPath : docsVersionPath;

  if (!fs.existsSync(versionPath)) {
    throw new Error('Missing docs asset version file.');
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

function getAndroidStoreUrl(lang) {
  const suffix = lang ? `&hl=${lang}` : '';
  return `${siteConfig.storeLinks.androidBase}${suffix}`;
}

module.exports = {
  DATA_DIR,
  DOCS_DIR,
  DOCS_SRC_DIR,
  ROOT_DIR,
  getAndroidStoreUrl,
  getStaticPageConfig,
  getStaticPagePath,
  loadLocales,
  readAssetVersion,
  siteConfig,
  staticPagesConfig,
};
