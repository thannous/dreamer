#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Builds a unified content manifest for blog resources.
 *
 * Transitional source:
 * - Reads `data/blog-slugs.json` (legacy map).
 * Canonical output:
 * - Writes `data/content-manifest.json`.
 *
 * Usage:
 *   node scripts/build-content-manifest.js
 *   node scripts/build-content-manifest.js --check
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LEGACY_BLOG_SLUGS_PATH = path.join(ROOT_DIR, 'data', 'blog-slugs.json');
const CONTENT_MANIFEST_PATH = path.join(ROOT_DIR, 'data', 'content-manifest.json');

const DEFAULT_LANGUAGE = 'en';
const LANGUAGES = ['en', 'fr', 'es', 'de', 'it'];

const CHECK_ONLY = process.argv.includes('--check');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeSlug(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function sortArticleKeys(keys) {
  return [...keys].sort((a, b) => {
    if (a === 'index') return -1;
    if (b === 'index') return 1;
    return a.localeCompare(b);
  });
}

function createManifestEntry(articleKey, slugs) {
  const isIndex = articleKey === 'index';
  const id = isIndex ? 'blog.index' : `blog.${articleKey}`;
  const type = isIndex ? 'blogIndex' : 'blogArticle';

  const locales = {};
  for (const language of LANGUAGES) {
    const slug = normalizeSlug(slugs[language]);
    locales[language] = {
      slug,
      path: slug ? `/${language}/blog/${slug}` : `/${language}/blog/`,
    };
  }

  return {
    id,
    type,
    canonicalLanguage: DEFAULT_LANGUAGE,
    canonicalSlug: normalizeSlug(slugs[DEFAULT_LANGUAGE]),
    locales,
  };
}

function buildManifest() {
  if (!fs.existsSync(LEGACY_BLOG_SLUGS_PATH)) {
    throw new Error(`Missing legacy slug map: ${LEGACY_BLOG_SLUGS_PATH}`);
  }

  const legacy = readJson(LEGACY_BLOG_SLUGS_PATH);
  const articles = legacy?.articles ?? {};
  const articleKeys = sortArticleKeys(Object.keys(articles));

  const entries = {};
  const validationErrors = [];

  for (const articleKey of articleKeys) {
    const article = articles[articleKey];
    const slugs = article?.slugs ?? {};

    if (!article || typeof article !== 'object') {
      validationErrors.push(`Invalid article payload for key "${articleKey}"`);
      continue;
    }

    for (const language of LANGUAGES) {
      const rawSlug = slugs[language];
      if (typeof rawSlug !== 'string') {
        validationErrors.push(
          `Missing or invalid slug for article "${articleKey}" language "${language}"`,
        );
      } else if (articleKey !== 'index' && rawSlug.trim() === '') {
        validationErrors.push(
          `Empty slug for article "${articleKey}" language "${language}"`,
        );
      }
    }

    const entry = createManifestEntry(articleKey, slugs);
    entries[entry.id] = entry;
  }

  const manifest = {
    schemaVersion: 1,
    defaultLanguage: DEFAULT_LANGUAGE,
    languages: LANGUAGES,
    collections: {
      blog: {
        description: 'Unified blog content map for web and mobile.',
        entries,
      },
    },
  };

  return { manifest, validationErrors };
}

function main() {
  const { manifest, validationErrors } = buildManifest();
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

  if (validationErrors.length > 0) {
    console.error('[build-content-manifest] Validation errors:');
    for (const error of validationErrors) {
      console.error(`- ${error}`);
    }
    process.exit(2);
  }

  if (CHECK_ONLY) {
    if (!fs.existsSync(CONTENT_MANIFEST_PATH)) {
      console.error(`[build-content-manifest] Missing file: ${CONTENT_MANIFEST_PATH}`);
      process.exit(2);
    }

    const current = fs.readFileSync(CONTENT_MANIFEST_PATH, 'utf8');
    if (current !== serialized) {
      console.error('[build-content-manifest] content-manifest.json is out of date.');
      process.exit(2);
    }

    console.log('[build-content-manifest] OK: content-manifest.json is up to date.');
    return;
  }

  fs.writeFileSync(CONTENT_MANIFEST_PATH, serialized, 'utf8');
  const count = Object.keys(manifest.collections.blog.entries).length;
  console.log(
    `[build-content-manifest] Wrote ${CONTENT_MANIFEST_PATH} (${count} entries).`,
  );
}

main();
