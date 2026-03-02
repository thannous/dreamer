#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Audits parity between:
 * - Canonical manifest: `data/content-manifest.json`
 * - Published web pages: `docs/{lang}/blog/*.html`
 * - Mobile references: `docs/data/dream-symbols.json` -> relatedArticles
 * - Legacy map: `data/blog-slugs.json` (compatibility check)
 *
 * Usage:
 *   node scripts/audit-content-parity.js
 *   node scripts/audit-content-parity.js --strict-mobile
 *   node scripts/audit-content-parity.js --json
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const CONTENT_MANIFEST_PATH = path.join(ROOT_DIR, 'data', 'content-manifest.json');
const LEGACY_BLOG_SLUGS_PATH = path.join(ROOT_DIR, 'data', 'blog-slugs.json');
const SYMBOLS_PATH = path.join(ROOT_DIR, 'docs', 'data', 'dream-symbols.json');

const args = new Set(process.argv.slice(2));
const strictMobile = args.has('--strict-mobile');
const jsonOutput = args.has('--json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asSortedArray(set) {
  return [...set].sort();
}

function setDiff(left, right) {
  return new Set([...left].filter((value) => !right.has(value)));
}

function listDocsBlogSlugs(language) {
  const dir = path.join(DOCS_DIR, language, 'blog');
  if (!fs.existsSync(dir)) return new Set();
  const slugs = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.html') && name !== 'index.html')
    .map((name) => name.replace(/\.html$/, ''));
  return new Set(slugs);
}

function createSetMap(languages) {
  return Object.fromEntries(languages.map((language) => [language, new Set()]));
}

function validateAndExtractManifest(manifest) {
  const errors = [];
  const languages = manifest?.languages;
  const entries = manifest?.collections?.blog?.entries;
  const defaultLanguage = manifest?.defaultLanguage;

  if (!Array.isArray(languages) || languages.length === 0) {
    errors.push('Invalid manifest: "languages" must be a non-empty array.');
    return { errors, languages: [], defaultLanguage: '', slugsByLanguage: {} };
  }

  if (typeof defaultLanguage !== 'string' || !languages.includes(defaultLanguage)) {
    errors.push('Invalid manifest: "defaultLanguage" must exist in "languages".');
  }

  if (!entries || typeof entries !== 'object') {
    errors.push('Invalid manifest: "collections.blog.entries" is missing.');
    return { errors, languages, defaultLanguage, slugsByLanguage: {} };
  }

  const slugsByLanguage = createSetMap(languages);
  const seenIds = new Set();

  for (const [entryId, entry] of Object.entries(entries)) {
    if (seenIds.has(entryId)) {
      errors.push(`Duplicate manifest entry id "${entryId}".`);
      continue;
    }
    seenIds.add(entryId);

    const type = entry?.type;
    const locales = entry?.locales;

    if (type !== 'blogArticle' && type !== 'blogIndex') {
      errors.push(
        `Invalid type for "${entryId}": expected "blogArticle" or "blogIndex", got "${type}".`,
      );
      continue;
    }

    if (!locales || typeof locales !== 'object') {
      errors.push(`Invalid locales object for "${entryId}".`);
      continue;
    }

    for (const language of languages) {
      const locale = locales[language];
      const slug = typeof locale?.slug === 'string' ? locale.slug.trim() : null;

      if (slug == null) {
        errors.push(`Missing slug for "${entryId}" language "${language}".`);
        continue;
      }

      if (type === 'blogArticle' && slug.length === 0) {
        errors.push(`Empty article slug for "${entryId}" language "${language}".`);
        continue;
      }

      if (type === 'blogIndex' && slug.length > 0) {
        errors.push(`Index slug must be empty for "${entryId}" language "${language}".`);
        continue;
      }

      if (type === 'blogArticle') {
        if (slugsByLanguage[language].has(slug)) {
          errors.push(`Duplicate slug "${slug}" for language "${language}".`);
          continue;
        }
        slugsByLanguage[language].add(slug);
      }
    }
  }

  return { errors, languages, defaultLanguage, slugsByLanguage };
}

function extractLegacySlugs(legacyMap, languages) {
  const out = createSetMap(languages);
  const articles = legacyMap?.articles ?? {};

  for (const [key, article] of Object.entries(articles)) {
    if (key === 'index') continue;
    for (const language of languages) {
      const slug = typeof article?.slugs?.[language] === 'string'
        ? article.slugs[language].trim()
        : '';
      if (slug) out[language].add(slug);
    }
  }

  return out;
}

function extractMobileRelatedSlugs(symbolsData, languages) {
  const relatedSlugs = createSetMap(languages);
  const emptyByLanguage = Object.fromEntries(languages.map((language) => [language, 0]));

  const symbols = Array.isArray(symbolsData?.symbols) ? symbolsData.symbols : [];
  for (const symbol of symbols) {
    const related = symbol?.relatedArticles;
    for (const language of languages) {
      const slug = typeof related?.[language] === 'string'
        ? related[language].trim()
        : '';
      if (!slug) {
        emptyByLanguage[language] += 1;
        continue;
      }
      relatedSlugs[language].add(slug);
    }
  }

  return {
    symbolCount: symbols.length,
    relatedSlugs,
    emptyByLanguage,
  };
}

function toCountMap(setMap, languages) {
  return Object.fromEntries(languages.map((language) => [language, setMap[language].size]));
}

function compareSetMaps(left, right, languages) {
  return Object.fromEntries(
    languages.map((language) => [
      language,
      {
        leftMissingInRight: asSortedArray(setDiff(left[language], right[language])),
        rightMissingInLeft: asSortedArray(setDiff(right[language], left[language])),
      },
    ]),
  );
}

function hasSetDiffs(diffMap, languages) {
  return languages.some(
    (language) =>
      diffMap[language].leftMissingInRight.length > 0 ||
      diffMap[language].rightMissingInLeft.length > 0,
  );
}

function formatList(items) {
  if (items.length === 0) return '(none)';
  return items.join(', ');
}

function main() {
  if (!fs.existsSync(CONTENT_MANIFEST_PATH)) {
    console.error(`Missing manifest: ${CONTENT_MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest = readJson(CONTENT_MANIFEST_PATH);
  const extracted = validateAndExtractManifest(manifest);
  const { errors: manifestErrors, languages, slugsByLanguage: manifestSlugs } = extracted;

  if (languages.length === 0) {
    console.error('Cannot continue: manifest has no valid languages.');
    process.exit(1);
  }

  const docsSlugs = Object.fromEntries(
    languages.map((language) => [language, listDocsBlogSlugs(language)]),
  );
  const docsVsManifest = compareSetMaps(manifestSlugs, docsSlugs, languages);

  const legacySlugs = fs.existsSync(LEGACY_BLOG_SLUGS_PATH)
    ? extractLegacySlugs(readJson(LEGACY_BLOG_SLUGS_PATH), languages)
    : createSetMap(languages);
  const manifestVsLegacy = compareSetMaps(manifestSlugs, legacySlugs, languages);

  const mobile = fs.existsSync(SYMBOLS_PATH)
    ? extractMobileRelatedSlugs(readJson(SYMBOLS_PATH), languages)
    : {
        symbolCount: 0,
        relatedSlugs: createSetMap(languages),
        emptyByLanguage: Object.fromEntries(languages.map((language) => [language, 0])),
      };

  const mobileUnknownSlugs = Object.fromEntries(
    languages.map((language) => [
      language,
      asSortedArray(setDiff(mobile.relatedSlugs[language], manifestSlugs[language])),
    ]),
  );

  const mobileMissingCoverage = Object.fromEntries(
    languages.map((language) => [
      language,
      asSortedArray(setDiff(manifestSlugs[language], mobile.relatedSlugs[language])),
    ]),
  );

  const docsParityIssues = hasSetDiffs(docsVsManifest, languages);
  const legacyParityIssues = hasSetDiffs(manifestVsLegacy, languages);
  const mobileUnknownIssues = languages.some(
    (language) => mobileUnknownSlugs[language].length > 0,
  );
  const mobileCoverageIssues = languages.some(
    (language) => mobileMissingCoverage[language].length > 0,
  );

  const blockingIssues =
    manifestErrors.length > 0 ||
    docsParityIssues ||
    legacyParityIssues ||
    mobileUnknownIssues ||
    (strictMobile && mobileCoverageIssues);

  const report = {
    strictMobile,
    status: blockingIssues ? 'failed' : 'ok',
    languages,
    counts: {
      manifestBlogArticles: toCountMap(manifestSlugs, languages),
      docsBlogArticles: toCountMap(docsSlugs, languages),
      mobileRelatedArticleSlugs: toCountMap(mobile.relatedSlugs, languages),
      mobileEmptyRelatedArticlesByLanguage: mobile.emptyByLanguage,
      mobileSymbolCount: mobile.symbolCount,
    },
    issues: {
      manifestErrors,
      docsVsManifest,
      manifestVsLegacy,
      mobileUnknownSlugs,
      mobileMissingCoverage,
    },
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('[audit-content-parity] Languages:', languages.join(', '));
    console.log('[audit-content-parity] Manifest blog article counts:', report.counts.manifestBlogArticles);
    console.log('[audit-content-parity] Docs blog article counts:', report.counts.docsBlogArticles);
    console.log('[audit-content-parity] Mobile related article counts:', report.counts.mobileRelatedArticleSlugs);
    console.log(
      '[audit-content-parity] Mobile empty relatedArticles per language:',
      report.counts.mobileEmptyRelatedArticlesByLanguage,
    );

    if (manifestErrors.length > 0) {
      console.log('\nManifest validation errors:');
      for (const error of manifestErrors) {
        console.log(`- ${error}`);
      }
    }

    if (docsParityIssues) {
      console.log('\nDocs vs manifest parity issues:');
      for (const language of languages) {
        const missingInDocs = docsVsManifest[language].leftMissingInRight;
        const extraInDocs = docsVsManifest[language].rightMissingInLeft;
        if (missingInDocs.length === 0 && extraInDocs.length === 0) continue;
        console.log(`- ${language}`);
        console.log(`  manifest missing in docs: ${formatList(missingInDocs)}`);
        console.log(`  docs missing in manifest: ${formatList(extraInDocs)}`);
      }
    }

    if (legacyParityIssues) {
      console.log('\nManifest vs legacy blog-slugs.json differences:');
      for (const language of languages) {
        const missingInLegacy = manifestVsLegacy[language].leftMissingInRight;
        const extraInLegacy = manifestVsLegacy[language].rightMissingInLeft;
        if (missingInLegacy.length === 0 && extraInLegacy.length === 0) continue;
        console.log(`- ${language}`);
        console.log(`  manifest missing in legacy: ${formatList(missingInLegacy)}`);
        console.log(`  legacy missing in manifest: ${formatList(extraInLegacy)}`);
      }
    }

    if (mobileUnknownIssues) {
      console.log('\nInvalid mobile relatedArticles slugs (not found in manifest):');
      for (const language of languages) {
        if (mobileUnknownSlugs[language].length === 0) continue;
        console.log(`- ${language}: ${formatList(mobileUnknownSlugs[language])}`);
      }
    }

    if (mobileCoverageIssues) {
      const label = strictMobile ? 'Mobile coverage gaps (strict):' : 'Mobile coverage gaps (non-blocking):';
      console.log(`\n${label}`);
      for (const language of languages) {
        if (mobileMissingCoverage[language].length === 0) continue;
        console.log(`- ${language}: ${mobileMissingCoverage[language].length} missing articles`);
      }
    }
  }

  if (blockingIssues) {
    process.exitCode = 2;
    return;
  }

  process.exitCode = 0;
}

main();
