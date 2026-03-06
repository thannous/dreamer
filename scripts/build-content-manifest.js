#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Builds a unified content manifest for blog resources.
 *
 * Canonical source:
 * - `docs-src/content/blog/<entryId>/<lang>.md`
 *
 * Legacy fallback:
 * - `data/blog-slugs.json`
 */

const fs = require('fs');
const path = require('path');
const {
  DOCS_SRC_DIR,
  DATA_DIR,
  siteConfig,
} = require('./lib/docs-site-config');
const {
  readJson,
  readSourceDocument,
  toPosix,
  walkFiles,
} = require('./lib/docs-source-utils');

const CONTENT_MANIFEST_PATH = path.join(DATA_DIR, 'content-manifest.json');
const LEGACY_BLOG_SLUGS_PATH = path.join(DATA_DIR, 'blog-slugs.json');
const BLOG_SOURCE_DIR = path.join(DOCS_SRC_DIR, 'content', 'blog');
const CHECK_ONLY = process.argv.includes('--check');

function sortEntryIds(ids) {
  return [...ids].sort((a, b) => {
    if (a === 'blog.index') return -1;
    if (b === 'blog.index') return 1;
    return a.localeCompare(b);
  });
}

function manifestEntryFromSource(entryId, localizedMeta) {
  const locales = {};
  for (const lang of siteConfig.languages) {
    const slug = localizedMeta[lang]?.slug ?? '';
    locales[lang] = {
      slug,
      path: slug ? `/${lang}/blog/${slug}` : `/${lang}/blog/`,
    };
  }

  return {
    id: entryId,
    type: entryId === 'blog.index' ? 'blogIndex' : 'blogArticle',
    canonicalLanguage: siteConfig.defaultLanguage,
    canonicalSlug: localizedMeta[siteConfig.defaultLanguage]?.slug ?? '',
    locales,
  };
}

function buildFromSource() {
  if (!fs.existsSync(BLOG_SOURCE_DIR)) {
    return null;
  }

  const sourceFiles = walkFiles(BLOG_SOURCE_DIR, (filePath) => filePath.endsWith('.md'));
  if (sourceFiles.length === 0) return null;

  const grouped = new Map();
  const validationErrors = [];

  for (const filePath of sourceFiles) {
    const relativePath = toPosix(path.relative(BLOG_SOURCE_DIR, filePath));
    const [entryDir, fileName] = relativePath.split('/');
    const lang = path.basename(fileName, '.md');
    const { meta } = readSourceDocument(filePath);

    if (!siteConfig.languages.includes(lang)) {
      validationErrors.push(`Unsupported language "${lang}" in ${relativePath}`);
      continue;
    }

    if (meta.pageId && meta.pageId !== entryDir) {
      validationErrors.push(
        `Page id mismatch in ${relativePath}: expected "${entryDir}", got "${meta.pageId}"`
      );
    }

    if (!grouped.has(entryDir)) {
      grouped.set(entryDir, {});
    }

    grouped.get(entryDir)[lang] = {
      slug: typeof meta.slug === 'string' ? meta.slug.trim() : '',
    };
  }

  const entries = {};

  for (const entryId of sortEntryIds(grouped.keys())) {
    const localizedMeta = grouped.get(entryId);

    for (const lang of siteConfig.languages) {
      if (!localizedMeta[lang]) {
        validationErrors.push(`Missing ${lang} source for blog entry "${entryId}"`);
        continue;
      }

      if (entryId !== 'blog.index' && !localizedMeta[lang].slug) {
        validationErrors.push(`Empty slug for blog entry "${entryId}" language "${lang}"`);
      }
    }

    entries[entryId] = manifestEntryFromSource(entryId, localizedMeta);
  }

  return { entries, validationErrors };
}

function buildFromLegacy() {
  if (!fs.existsSync(LEGACY_BLOG_SLUGS_PATH)) {
    throw new Error(`Missing legacy slug map: ${LEGACY_BLOG_SLUGS_PATH}`);
  }

  const legacy = readJson(LEGACY_BLOG_SLUGS_PATH);
  const articles = legacy?.articles ?? {};
  const validationErrors = [];
  const entries = {};

  for (const articleKey of Object.keys(articles).sort()) {
    const article = articles[articleKey];
    const entryId = articleKey === 'index' ? 'blog.index' : `blog.${articleKey}`;
    const localizedMeta = {};

    for (const lang of siteConfig.languages) {
      const slug = typeof article?.slugs?.[lang] === 'string' ? article.slugs[lang].trim() : '';
      if (entryId !== 'blog.index' && !slug) {
        validationErrors.push(`Empty slug for legacy blog entry "${entryId}" language "${lang}"`);
      }
      localizedMeta[lang] = { slug };
    }

    entries[entryId] = manifestEntryFromSource(entryId, localizedMeta);
  }

  return { entries, validationErrors };
}

function buildManifest() {
  const built = buildFromSource() || buildFromLegacy();
  return {
    manifest: {
      schemaVersion: 1,
      defaultLanguage: siteConfig.defaultLanguage,
      languages: siteConfig.languages,
      collections: {
        blog: {
          description: 'Unified blog content map for web and mobile.',
          entries: built.entries,
        },
      },
    },
    validationErrors: built.validationErrors,
  };
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
  console.log(`[build-content-manifest] Wrote ${CONTENT_MANIFEST_PATH}`);
}

main();
