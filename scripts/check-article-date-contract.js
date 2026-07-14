#!/usr/bin/env node


'use strict';

const fs = require('fs');
const path = require('path');
const {
  DOCS_DIR,
  DOCS_SRC_DIR,
  ROOT_DIR,
  siteConfig,
} = require('./lib/docs-site-config');
const { readSourceDocument, walkFiles } = require('./lib/docs-source-utils');
const {
  ARTICLE_SCHEMA_TYPES,
  findFirstSchemaByType,
  parseContentDate,
  validateArticleDates,
} = require('./lib/article-date-contract');

function decodeXml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseSitemapLastmods(xml) {
  const map = new Map();
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = decodeXml(match[1].match(/<loc>([^<]+)<\/loc>/)?.[1]);
    const lastmod = match[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] || '';
    if (loc) map.set(loc, lastmod);
  }
  return map;
}

function parseJsonLdBlocks(html, filePath) {
  const blocks = [];
  for (const match of html.matchAll(/<script\b[^>]*type=(['"])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(match[2]));
    } catch (error) {
      throw new Error(`${filePath}: invalid JSON-LD (${error.message})`);
    }
  }
  return blocks;
}

function collectArticleSchemas(blocks) {
  const articles = [];
  function visit(node) {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.some((type) => ARTICLE_SCHEMA_TYPES.has(type))) articles.push(node);
    for (const value of Object.values(node)) visit(value);
  }
  for (const block of blocks) visit(block);
  return articles;
}

function collectInvalidReviewers(blocks) {
  const findings = [];
  function visit(node) {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (Object.hasOwn(node, 'reviewedBy')) {
      const reviewers = Array.isArray(node.reviewedBy) ? node.reviewedBy : [node.reviewedBy];
      for (const reviewer of reviewers) {
        const types = Array.isArray(reviewer?.['@type']) ? reviewer['@type'] : [reviewer?.['@type']];
        if (!types.includes('Person') || typeof reviewer?.name !== 'string' || !reviewer.name.trim()) {
          findings.push(reviewer);
        }
      }
    }
    for (const value of Object.values(node)) visit(value);
  }
  for (const block of blocks) visit(block);
  return findings;
}

function extractMetaValues(html, property) {
  const values = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const propertyValue = tag.match(/\bproperty=(['"])([^"']+)\1/i)?.[2];
    if (propertyValue !== property) continue;
    values.push(tag.match(/\bcontent=(['"])([^"']*)\1/i)?.[2] || '');
  }
  return values;
}

function checkRenderedArticleDates() {
  const errors = [];
  const sitemapPath = path.join(DOCS_DIR, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    return { articleCount: 0, errors: ['[article date contract] missing docs/sitemap.xml'] };
  }
  const sitemapLastmods = parseSitemapLastmods(fs.readFileSync(sitemapPath, 'utf8'));
  const files = walkFiles(
    path.join(DOCS_SRC_DIR, 'content', 'blog'),
    (filePath) => filePath.endsWith('.md')
  );
  let articleCount = 0;

  for (const sourcePath of files) {
    const { meta: sourceMeta } = readSourceDocument(sourcePath);
    if (sourceMeta.layout !== 'blogArticle') continue;
    if (findFirstSchemaByType(sourceMeta.jsonLd, 'CollectionPage')) continue;

    const meta = sourceMeta;
    const dates = validateArticleDates(meta);
    if (dates.errors.length > 0) {
      for (const error of dates.errors) {
        errors.push(`[article date source] ${path.relative(ROOT_DIR, sourcePath)}: ${error}`);
      }
      continue;
    }

    articleCount += 1;
    const outputPath = path.join(DOCS_DIR, meta.lang, 'blog', `${meta.slug}.html`);
    const relativeOutput = path.relative(ROOT_DIR, outputPath);
    if (!fs.existsSync(outputPath)) {
      errors.push(`[article date output] missing ${relativeOutput}`);
      continue;
    }
    const html = fs.readFileSync(outputPath, 'utf8');

    const modifiedMetaValues = extractMetaValues(html, 'article:modified_time');
    if (modifiedMetaValues.length !== 1 || modifiedMetaValues[0] !== dates.modified.raw) {
      errors.push(
        `[article date meta] ${relativeOutput}: expected exactly one article:modified_time=${dates.modified.raw}`
      );
    }

    const publishedMetaValues = extractMetaValues(html, 'article:published_time');
    if (publishedMetaValues.length !== 1 || publishedMetaValues[0] !== dates.published.raw) {
      errors.push(
        `[article date meta] ${relativeOutput}: expected exactly one article:published_time=${dates.published.raw}`
      );
    }

    const visibleDates = Array.from(
      html.matchAll(/<p\b[^>]*data-article-modified[^>]*>[\s\S]*?<time\b[^>]*datetime=(['"])([^"']+)\1[^>]*>[\s\S]*?<\/time>[\s\S]*?<\/p>/gi),
      (match) => match[2]
    );
    if (visibleDates.length !== 1 || visibleDates[0] !== dates.modified.raw) {
      errors.push(
        `[article visible date] ${relativeOutput}: expected exactly one visible time=${dates.modified.raw}`
      );
    }

    let articleSchemas = [];
    try {
      const jsonLdBlocks = parseJsonLdBlocks(html, relativeOutput);
      articleSchemas = collectArticleSchemas(jsonLdBlocks);
      const invalidReviewers = collectInvalidReviewers(jsonLdBlocks);
      if (invalidReviewers.length > 0) {
        errors.push(
          `[reviewer integrity] ${relativeOutput}: reviewedBy may only contain a named Person reviewer`
        );
      }
    } catch (error) {
      errors.push(`[article date JSON-LD] ${error.message}`);
    }
    if (articleSchemas.length === 0) {
      errors.push(`[article date JSON-LD] ${relativeOutput}: missing article schema`);
    }
    for (const schema of articleSchemas) {
      if (schema.datePublished !== dates.published.raw || schema.dateModified !== dates.modified.raw) {
        errors.push(
          `[article date JSON-LD] ${relativeOutput}: schema dates must equal front matter (${dates.published.raw}, ${dates.modified.raw})`
        );
      }
    }

    const canonicalUrl = `${siteConfig.domain}/${meta.lang}/blog/${meta.slug}`;
    const sitemapLastmod = sitemapLastmods.get(canonicalUrl);
    const expectedLastmod = parseContentDate(meta.modifiedTime)?.dateOnly;
    if (sitemapLastmod !== expectedLastmod) {
      errors.push(
        `[article sitemap date] ${relativeOutput}: expected ${expectedLastmod}, got ${sitemapLastmod || '<missing>'}`
      );
    }
  }

  return { articleCount, errors };
}

function main() {
  const result = checkRenderedArticleDates();
  if (result.errors.length > 0) {
    console.error(`[article-date-contract] Failed (${result.errors.length} issue(s)):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(
    `[article-date-contract] Passed: ${result.articleCount} articles use one explicit editorial date across visible HTML, meta, JSON-LD and sitemap.`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[article-date-contract] Failed: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = {
  checkRenderedArticleDates,
  collectArticleSchemas,
  collectInvalidReviewers,
  extractMetaValues,
  parseSitemapLastmods,
};
