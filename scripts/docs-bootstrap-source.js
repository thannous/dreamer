#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const {
  DOCS_DIR,
  DOCS_SRC_DIR,
  staticPagesConfig,
} = require('./lib/docs-site-config');
const {
  copyFile,
  ensureDir,
  normalizePrettyPath,
  readJson,
  writeSourceDocument,
} = require('./lib/docs-source-utils');

const BLOG_MANIFEST_PATH = path.join(DOCS_DIR, '..', 'data', 'content-manifest.json');

function readHtmlDocument(filePath) {
  return new JSDOM(fs.readFileSync(filePath, 'utf8')).window.document;
}

function getMetaAttr(document, selector, attr = 'content') {
  const element = document.querySelector(selector);
  return element ? (element.getAttribute(attr) || '').trim() : '';
}

function collectJsonLd(document) {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((node) => (node.textContent || '').trim())
    .filter(Boolean);
}

function absoluteToPath(urlValue) {
  if (!urlValue) return '';
  try {
    const parsed = new URL(urlValue, 'https://noctalia.app');
    return normalizePrettyPath(parsed.pathname);
  } catch {
    return normalizePrettyPath(urlValue);
  }
}

function cloneBody(document) {
  return new JSDOM(`<body>${document.body.innerHTML}</body>`).window.document.body;
}

function stripSharedChrome(body, { removeBackgrounds }) {
  body.querySelectorAll('nav, footer, script').forEach((node) => node.remove());
  if (removeBackgrounds) {
    body
      .querySelectorAll('.aurora-bg, .noise-overlay, .orb')
      .forEach((node) => node.remove());
  }
}

function extractPageSource(document, layout, defaults = {}) {
  const body = cloneBody(document);
  stripSharedChrome(body, {
    removeBackgrounds: layout === 'landing' || layout === 'blogIndex' || layout === 'blogArticle',
  });

  const main = layout === 'landing' ? null : document.querySelector('main');
  const bodyHtml = layout === 'landing'
    ? body.innerHTML.trim()
    : (main ? main.innerHTML : body.innerHTML).trim();

  return {
    pageId: defaults.pageId,
    layout,
    lang: defaults.lang,
    slug: defaults.slug,
    title: document.title.trim(),
    description: getMetaAttr(document, 'meta[name="description"]'),
    robots: getMetaAttr(document, 'meta[name="robots"]'),
    themeColor: getMetaAttr(document, 'meta[name="theme-color"]'),
    htmlClass: (document.documentElement.getAttribute('class') || '').trim(),
    bodyClass: (document.body.getAttribute('class') || '').trim(),
    bodyStyle: (document.body.getAttribute('style') || '').trim(),
    mainClass: main ? (main.getAttribute('class') || '').trim() : '',
    ogType: getMetaAttr(document, 'meta[property="og:type"]'),
    ogTitle: getMetaAttr(document, 'meta[property="og:title"]'),
    ogDescription: getMetaAttr(document, 'meta[property="og:description"]'),
    ogImage: getMetaAttr(document, 'meta[property="og:image"]'),
    ogImageAlt: getMetaAttr(document, 'meta[property="og:image:alt"]'),
    twitterCard: getMetaAttr(document, 'meta[name="twitter:card"]'),
    twitterTitle: getMetaAttr(document, 'meta[name="twitter:title"]'),
    twitterDescription: getMetaAttr(document, 'meta[name="twitter:description"]'),
    twitterImage: getMetaAttr(document, 'meta[name="twitter:image"]'),
    twitterImageAlt: getMetaAttr(document, 'meta[name="twitter:image:alt"]'),
    publishedTime: getMetaAttr(document, 'meta[property="article:published_time"]'),
    modifiedTime: getMetaAttr(document, 'meta[property="article:modified_time"]'),
    author: getMetaAttr(document, 'meta[property="article:author"]'),
    prevPath: absoluteToPath(getMetaAttr(document, 'link[rel="prev"]', 'href')),
    nextPath: absoluteToPath(getMetaAttr(document, 'link[rel="next"]', 'href')),
    preloadImage: getMetaAttr(document, 'link[rel="preload"][as="image"]', 'href'),
    jsonLd: collectJsonLd(document),
    activeNav:
      layout === 'content' ? null : layout === 'guides' ? 'guides' : 'resources',
    bodyHtml,
  };
}

function contentPath(kind, entryId, lang) {
  return path.join(DOCS_SRC_DIR, 'content', kind, entryId, `${lang}.md`);
}

function bootstrapStaticPages() {
  for (const page of staticPagesConfig.pages) {
    for (const lang of Object.keys(page.slugs)) {
      const slug = page.slugs[lang];
      const sourcePath =
        page.pageId === 'page.home' && lang === 'en'
          ? path.join(DOCS_DIR, 'index.html')
          : slug
            ? path.join(DOCS_DIR, lang, `${slug}.html`)
            : path.join(DOCS_DIR, lang, 'index.html');

      const document = readHtmlDocument(sourcePath);
      const source = extractPageSource(document, page.layout, {
        pageId: page.pageId,
        lang,
        slug,
      });

      writeSourceDocument(
        contentPath('pages', page.pageId, lang),
        { ...source, bodyHtml: undefined },
        `${source.bodyHtml}\n`
      );
    }
  }
}

function bootstrapBlogPages() {
  const manifest = readJson(BLOG_MANIFEST_PATH);
  const entries = manifest?.collections?.blog?.entries || {};

  for (const entry of Object.values(entries)) {
    for (const lang of Object.keys(entry.locales || {})) {
      const locale = entry.locales[lang];
      const sourcePath =
        entry.id === 'blog.index'
          ? path.join(DOCS_DIR, lang, 'blog', 'index.html')
          : path.join(DOCS_DIR, lang, 'blog', `${locale.slug}.html`);

      const document = readHtmlDocument(sourcePath);
      const source = extractPageSource(
        document,
        entry.id === 'blog.index' ? 'blogIndex' : 'blogArticle',
        {
          pageId: entry.id,
          lang,
          slug: locale.slug,
        }
      );

      writeSourceDocument(
        contentPath('blog', entry.id, lang),
        { ...source, bodyHtml: undefined },
        `${source.bodyHtml}\n`
      );
    }
  }
}

function bootstrapStaticFiles() {
  const files = [
    '_headers',
    '_redirects',
    '404.html',
    'index.html',
    'robots.txt',
    'vercel.json',
    'assetlinks.json',
    'favicon.ico',
    'favicon.png',
    'favicon.svg',
    'logo192.png',
    'logo512.png',
    'version.txt',
    path.join('.well-known', 'assetlinks.json'),
    path.join('auth', 'callback', 'index.html'),
  ];

  for (const relativePath of files) {
    const sourcePath = path.join(DOCS_DIR, relativePath);
    if (!fs.existsSync(sourcePath)) continue;
    copyFile(sourcePath, path.join(DOCS_SRC_DIR, 'static', relativePath));
  }
}

function main() {
  ensureDir(path.join(DOCS_SRC_DIR, 'content'));
  bootstrapStaticFiles();
  bootstrapStaticPages();
  bootstrapBlogPages();
  console.log('[docs-bootstrap-source] Bootstrapped docs-src content from docs/.');
}

main();
