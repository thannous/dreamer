#!/usr/bin/env node
/**
 * add-blogs-to-sitemap.js — Add missing blog URLs to sitemap.xml
 *
 * Reads unified content-manifest.json (fallback: blog-slugs.json) and
 * adds all blog articles + blog index pages to the existing sitemap
 * with proper hreflang annotations.
 *
 * Run: node scripts/add-blogs-to-sitemap.js
 */

const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.resolve(__dirname, '..');
const SITEMAP_PATH = path.join(DOCS_ROOT, 'sitemap.xml');
const CONTENT_MANIFEST_PATH = path.join(DOCS_ROOT, '..', 'data', 'content-manifest.json');
const BLOG_SLUGS_PATH = path.join(DOCS_ROOT, '..', 'data', 'blog-slugs.json');
const BASE_URL = 'https://noctalia.app';
const LANGS = ['en', 'fr', 'es', 'de', 'it'];
const TODAY = '2026-02-09';

function normalizeSlug(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function loadArticlesFromContentManifest() {
  if (!fs.existsSync(CONTENT_MANIFEST_PATH)) return null;

  const manifest = JSON.parse(fs.readFileSync(CONTENT_MANIFEST_PATH, 'utf-8'));
  const entries = manifest?.collections?.blog?.entries;
  if (!entries || typeof entries !== 'object') {
    throw new Error(`Invalid content manifest structure: ${CONTENT_MANIFEST_PATH}`);
  }

  const articles = {};
  for (const [entryId, entry] of Object.entries(entries)) {
    const type = entry?.type;
    if (type !== 'blogArticle' && type !== 'blogIndex') continue;

    const slugs = {};
    for (const lang of LANGS) {
      const slug = normalizeSlug(entry?.locales?.[lang]?.slug);
      slugs[lang] = slug;
    }

    const key = type === 'blogIndex' ? 'index' : normalizeSlug(entry?.canonicalSlug || entryId);
    if (!key) {
      throw new Error(`Invalid blog entry key for ${entryId} in ${CONTENT_MANIFEST_PATH}`);
    }

    articles[key] = { slugs };
  }

  return { articles };
}

function loadArticlesFromLegacyMap() {
  if (!fs.existsSync(BLOG_SLUGS_PATH)) {
    throw new Error(`Missing legacy blog map: ${BLOG_SLUGS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(BLOG_SLUGS_PATH, 'utf-8'));
}

function loadBlogData() {
  const fromManifest = loadArticlesFromContentManifest();
  if (fromManifest) {
    return { source: 'content-manifest.json', data: fromManifest };
  }
  return { source: 'blog-slugs.json (fallback)', data: loadArticlesFromLegacyMap() };
}

const { source: blogSource, data: blogData } = loadBlogData();
let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf-8');

// Check which blog URLs already exist
const existingUrls = new Set(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
);

let newEntries = '';
let addedCount = 0;

for (const [, article] of Object.entries(blogData.articles)) {
  const slugs = article.slugs;

  // For each language, generate a <url> entry
  for (const lang of LANGS) {
    const slug = slugs[lang];
    // Blog index: slug is empty → /{lang}/blog/
    // Blog article: /{lang}/blog/{slug}
    const urlPath = slug === '' || slug === undefined
      ? `${BASE_URL}/${lang}/blog/`
      : `${BASE_URL}/${lang}/blog/${slug}`;

    if (existingUrls.has(urlPath)) continue;

    const priority = slug === '' || slug === undefined ? '0.6' : '0.7';

    let entry = `  <url>\n`;
    entry += `    <loc>${urlPath}</loc>\n`;
    entry += `    <lastmod>${TODAY}</lastmod>\n`;
    entry += `    <priority>${priority}</priority>\n`;

    // Add hreflang for all languages
    for (const altLang of LANGS) {
      const altSlug = slugs[altLang];
      const altUrl = altSlug === '' || altSlug === undefined
        ? `${BASE_URL}/${altLang}/blog/`
        : `${BASE_URL}/${altLang}/blog/${altSlug}`;
      entry += `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${altUrl}"/>\n`;
    }

    // x-default points to English version
    const enSlug = slugs.en;
    const xDefaultUrl = enSlug === '' || enSlug === undefined
      ? `${BASE_URL}/en/blog/`
      : `${BASE_URL}/en/blog/${enSlug}`;
    entry += `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefaultUrl}"/>\n`;
    entry += `  </url>\n`;

    newEntries += entry;
    addedCount++;
  }
}

// Insert new entries before </urlset>
sitemap = sitemap.replace('</urlset>', newEntries + '</urlset>');

fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf-8');

// Count total URLs
const totalUrls = [...sitemap.matchAll(/<loc>/g)].length;

console.log(`Source: ${blogSource}`);
console.log(`Added ${addedCount} blog URLs to sitemap.xml`);
console.log(`Total sitemap URLs: ${totalUrls}`);
