#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const {
  readSourceDocument,
  walkFiles,
  writeSourceDocument,
} = require('./lib/docs-source-utils');

const ROOT_DIR = path.resolve(__dirname, '..');
const BLOG_SRC_DIR = path.join(ROOT_DIR, 'docs-src', 'content', 'blog');
const DOMAIN = 'https://noctalia.app';
const LANGS = ['en', 'fr', 'es', 'de', 'it'];

function isItemList(value) {
  const type = value?.['@type'];
  if (Array.isArray(type)) return type.includes('ItemList');
  return type === 'ItemList';
}

function parseJsonLdBlocks(meta) {
  return (meta.jsonLd || []).map((raw) => JSON.parse(raw));
}

function serializeJsonLdBlocks(blocks) {
  return blocks.map((block) => JSON.stringify(block, null, 2));
}

function stripNoctaliaTitle(title) {
  return String(title || '').replace(/\s*\|\s*Noctalia\s*$/i, '').trim();
}

function loadArticleBySlug(lang) {
  const index = new Map();
  const files = walkFiles(BLOG_SRC_DIR, (filePath) => filePath.endsWith(`${path.sep}${lang}.md`));

  for (const filePath of files) {
    const { meta, body } = readSourceDocument(filePath);
    if (!meta.slug || meta.pageId === 'blog.index') continue;

    const dom = new JSDOM(body);
    const h1 = dom.window.document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
    index.set(meta.slug, {
      slug: meta.slug,
      url: `${DOMAIN}/${lang}/blog/${meta.slug}`,
      name: h1 || stripNoctaliaTitle(meta.title) || meta.slug,
    });
  }

  return index;
}

function collectVisibleArticleSlugs(body) {
  const dom = new JSDOM(body);
  const links = Array.from(dom.window.document.querySelectorAll('article a[href]'));
  const seen = new Set();
  const slugs = [];

  for (const link of links) {
    const href = String(link.getAttribute('href') || '').trim();
    if (!href || href.startsWith('#')) continue;
    if (/^(https?:|mailto:|tel:)/i.test(href)) continue;
    if (href.startsWith('/') || href.includes('/') || href.includes('.')) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    slugs.push(href);
  }

  return slugs;
}

function buildItemList(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: item.url,
      name: item.name,
    })),
  };
}

function processLang(lang) {
  const indexPath = path.join(BLOG_SRC_DIR, 'blog.index', `${lang}.md`);
  const { meta, body } = readSourceDocument(indexPath);
  const articleBySlug = loadArticleBySlug(lang);
  const slugs = collectVisibleArticleSlugs(body);
  const items = slugs.map((slug) => articleBySlug.get(slug)).filter(Boolean);
  const blocks = parseJsonLdBlocks(meta);
  const itemListIndex = blocks.findIndex(isItemList);

  if (itemListIndex === -1) {
    blocks.push(buildItemList(items));
  } else {
    blocks[itemListIndex] = buildItemList(items);
  }

  const nextMeta = { ...meta, jsonLd: serializeJsonLdBlocks(blocks) };
  writeSourceDocument(indexPath, nextMeta, body);
  return { lang, items: items.length };
}

function main() {
  const results = LANGS.map(processLang);
  for (const result of results) {
    console.log(`[fix-blog-index-itemlist-source] ${result.lang}: ${result.items} items`);
  }
}

main();
