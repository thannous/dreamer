#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  DOCS_DIR,
  DOCS_SRC_DIR,
  ROOT_DIR,
  siteConfig,
} = require('./lib/docs-site-config');
const { readSourceDocument } = require('./lib/docs-source-utils');

const SYMBOL_DIRECTORIES = {
  de: 'traumsymbole',
  en: 'symbols',
  es: 'simbolos',
  fr: 'symboles',
  it: 'simboli',
};

const QUICK_LOOKUP_MARKERS = {
  de: ['kurzdeutung'],
  en: ['quick symbol reference'],
  es: ['ficha rapida'],
  fr: ['fiche rapide'],
  it: ['scheda rapida'],
};

// Explicit pSEO ownership contract. Detailed editorial pages own scenario and
// context queries; programmatic symbol URLs remain quick lookup definitions.
const INTENT_OWNERSHIP = [
  {
    id: 'water',
    locales: siteConfig.languages,
    primary: { kind: 'blog', id: 'blog.water-dreams-meaning', intent: 'comprehensive scenarios' },
    secondary: { kind: 'symbol', id: 'water', intent: 'quick symbol lookup' },
  },
  {
    id: 'flying',
    locales: siteConfig.languages,
    primary: { kind: 'blog', id: 'blog.flying-dreams-meaning', intent: 'scenarios and lucid context' },
    secondary: { kind: 'symbol', id: 'flying', intent: 'quick symbol lookup' },
  },
  {
    id: 'teeth',
    locales: siteConfig.languages,
    primary: { kind: 'blog', id: 'blog.teeth-falling-out-dreams', intent: 'complete teeth scenarios' },
    secondary: { kind: 'symbol', id: 'teeth', intent: 'quick symbol lookup' },
  },
  {
    id: 'falling',
    locales: siteConfig.languages,
    primary: { kind: 'blog', id: 'blog.falling-dreams-meaning', intent: 'complete falling scenarios' },
    secondary: { kind: 'symbol', id: 'falling', intent: 'quick symbol lookup' },
  },
  {
    id: 'snake',
    locales: siteConfig.languages,
    primary: { kind: 'blog', id: 'blog.snake-dreams-meaning', intent: 'complete snake scenarios' },
    secondary: { kind: 'symbol', id: 'snake', intent: 'quick symbol lookup' },
  },
  {
    id: 'death',
    locales: siteConfig.languages,
    primary: { kind: 'blog', id: 'blog.death-dreams-meaning', intent: 'complete death scenarios' },
    secondary: { kind: 'symbol', id: 'death', intent: 'quick symbol lookup' },
  },
  {
    id: 'chase',
    locales: siteConfig.languages,
    primary: { kind: 'blog', id: 'blog.being-chased-dreams', intent: 'complete chase scenarios' },
    secondary: { kind: 'symbol', id: 'chase', intent: 'quick symbol lookup' },
  },
  {
    id: 'ex-partner',
    locales: siteConfig.languages,
    primary: { kind: 'blog', id: 'blog.dreams-about-ex', intent: 'complete ex-partner scenarios' },
    secondary: { kind: 'symbol', id: 'ex-partner', intent: 'quick symbol lookup' },
  },
  {
    id: 'pregnancy',
    locales: siteConfig.languages,
    primary: { kind: 'blog', id: 'blog.pregnancy-dreams-meaning', intent: 'complete pregnancy scenarios' },
    secondary: { kind: 'symbol', id: 'pregnancy', intent: 'quick symbol lookup' },
  },
  {
    id: 'baby',
    locales: siteConfig.languages,
    primary: { kind: 'blog', id: 'blog.pregnancy-dreams-meaning', intent: 'pregnancy and baby scenarios' },
    secondary: { kind: 'symbol', id: 'baby', intent: 'quick symbol lookup' },
  },
  {
    id: 'dictionary-vs-common',
    locales: siteConfig.languages,
    primary: { kind: 'dictionary-guide', intent: 'searchable 150-symbol atlas' },
    secondary: { kind: 'curated-common-guide', intent: 'curated 20-example guide' },
  },
  {
    id: 'es-flood',
    locales: ['es'],
    primary: { kind: 'blog', id: 'blog.water-dreams-meaning', intent: 'flood scenario query' },
    secondary: { kind: 'symbol', id: 'flood', intent: 'quick flood definition' },
  },
];

function loadData() {
  return {
    curation: JSON.parse(fs.readFileSync(path.join(DOCS_DIR, 'data', 'curation-pages.json'), 'utf8')),
    symbolI18n: JSON.parse(fs.readFileSync(path.join(DOCS_DIR, 'data', 'symbol-i18n.json'), 'utf8')),
    symbols: JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'dream-symbols.json'), 'utf8')),
  };
}

function resolveOwnedPath(owner, lang, data) {
  if (owner.kind === 'blog') {
    const sourcePath = path.join(DOCS_SRC_DIR, 'content', 'blog', owner.id, `${lang}.md`);
    const { meta } = readSourceDocument(sourcePath);
    return `/${lang}/blog/${meta.slug}`;
  }

  if (owner.kind === 'symbol') {
    const symbol = data.symbols.symbols.find((candidate) => candidate.id === owner.id);
    const locale = symbol?.[lang];
    const directory = SYMBOL_DIRECTORIES[lang];
    if (!locale?.slug || !directory) return null;
    return `/${lang}/${directory}/${locale.slug}`;
  }

  if (owner.kind === 'dictionary-guide') {
    const slug = data.symbolI18n?.[lang]?.dictionary_slug;
    return slug ? `/${lang}/guides/${slug}` : null;
  }

  if (owner.kind === 'curated-common-guide') {
    const page = data.curation.pages.find((candidate) => candidate.id === 'most-common-dream-symbols');
    const slug = page?.slugs?.[lang];
    return slug ? `/${lang}/guides/${slug}` : null;
  }

  return null;
}

function pagePathToFile(pagePath) {
  return path.join(DOCS_DIR, `${pagePath.replace(/^\/+/, '')}.html`);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIntentText(value) {
  return decodeHtml(value)
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\|\s*noctalia\s*$/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function extractPageSignals(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  return {
    title: decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]),
    description: decodeHtml(
      (html.match(/<meta\b(?=[^>]*name=(['"])description\1)[^>]*>/i)?.[0] || '').match(
        /content=(['"])([^"']*)\1/i
      )?.[2]
    ),
    h1: decodeHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]),
    quickIntent: /\bdata-page-intent=(['"])quick-symbol-reference\1/i.test(html),
  };
}

function hasQuickLookupMarker(signals, lang) {
  if (signals?.quickIntent) return true;
  const haystack = normalizeIntentText(
    [signals?.title, signals?.description, signals?.h1].filter(Boolean).join(' ')
  );
  return (QUICK_LOOKUP_MARKERS[lang] || []).some((marker) => haystack.includes(marker));
}

function semanticSimilarity(left, right) {
  const leftTokens = new Set(normalizeIntentText(left).split(/\s+/).filter(Boolean));
  const rightTokens = new Set(normalizeIntentText(right).split(/\s+/).filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 ? intersection / union : 0;
}

function extractInternalPaths(filePath, pagePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const paths = new Set();
  for (const match of html.matchAll(/<a\b[^>]*\bhref=(['"])([^"']+)\1/gi)) {
    const href = match[2];
    if (!href || /^(?:mailto:|tel:|javascript:|data:|#)/i.test(href)) continue;
    try {
      const url = new URL(href, `${siteConfig.domain}${pagePath}`);
      if (url.origin !== siteConfig.domain) continue;
      paths.add(url.pathname.replace(/\/$/, '') || '/');
    } catch {
      // Malformed hrefs are handled by the dedicated link checker.
    }
  }
  return paths;
}

function checkIntentOwnership() {
  const errors = [];
  const data = loadData();
  let pairCount = 0;

  for (const contract of INTENT_OWNERSHIP) {
    if (contract.primary.intent === contract.secondary.intent) {
      errors.push(`[intent contract] ${contract.id}: primary intents must be distinct`);
    }

    for (const lang of contract.locales) {
      pairCount += 1;
      const primaryPath = resolveOwnedPath(contract.primary, lang, data);
      const secondaryPath = resolveOwnedPath(contract.secondary, lang, data);
      if (!primaryPath || !secondaryPath || primaryPath === secondaryPath) {
        errors.push(`[intent ownership] ${contract.id}.${lang}: invalid or identical owned paths`);
        continue;
      }

      const primaryFile = pagePathToFile(primaryPath);
      const secondaryFile = pagePathToFile(secondaryPath);
      if (!fs.existsSync(primaryFile) || !fs.existsSync(secondaryFile)) {
        errors.push(
          `[intent ownership] ${contract.id}.${lang}: missing output (${primaryPath}, ${secondaryPath})`
        );
        continue;
      }

      const primary = extractPageSignals(primaryFile);
      const secondary = extractPageSignals(secondaryFile);
      if (
        contract.secondary.kind === 'symbol' &&
        !hasQuickLookupMarker(secondary, lang)
      ) {
        errors.push(
          `[intent marker] ${contract.id}.${lang}: the programmatic symbol page must declare a quick-reference intent`
        );
      }
      for (const field of ['title', 'description', 'h1']) {
        const primaryValue = normalizeIntentText(primary[field]);
        const secondaryValue = normalizeIntentText(secondary[field]);
        if (!primaryValue || !secondaryValue) {
          errors.push(`[intent ownership] ${contract.id}.${lang}: missing ${field}`);
        } else if (primaryValue === secondaryValue) {
          errors.push(
            `[intent collision] ${contract.id}.${lang}: ${field} is identical for ` +
              `"${contract.primary.intent}" and "${contract.secondary.intent}"`
          );
        } else if (semanticSimilarity(primaryValue, secondaryValue) >= 0.82) {
          errors.push(
            `[intent similarity] ${contract.id}.${lang}: ${field} is too similar for ` +
              `"${contract.primary.intent}" and "${contract.secondary.intent}"`
          );
        }
      }

      if (contract.primary.kind === 'blog' && contract.secondary.kind === 'symbol') {
        const normalizedPrimaryPath = primaryPath.replace(/\/$/, '') || '/';
        const normalizedSecondaryPath = secondaryPath.replace(/\/$/, '') || '/';
        const primaryLinks = extractInternalPaths(primaryFile, primaryPath);
        const secondaryLinks = extractInternalPaths(secondaryFile, secondaryPath);
        if (!primaryLinks.has(normalizedSecondaryPath)) {
          errors.push(
            `[intent crosslink] ${contract.id}.${lang}: article must link to ${secondaryPath}`
          );
        }
        if (!secondaryLinks.has(normalizedPrimaryPath)) {
          errors.push(
            `[intent crosslink] ${contract.id}.${lang}: symbol must link to ${primaryPath}`
          );
        }
      }
    }
  }

  return { errors, pairCount };
}

function main() {
  const result = checkIntentOwnership();
  if (result.errors.length > 0) {
    console.error(`[intent-ownership] Failed (${result.errors.length} issue(s)):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[intent-ownership] Passed: ${result.pairCount} locale-specific intent pairs are distinct.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[intent-ownership] Failed: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = {
  INTENT_OWNERSHIP,
  QUICK_LOOKUP_MARKERS,
  checkIntentOwnership,
  hasQuickLookupMarker,
  normalizeIntentText,
  resolveOwnedPath,
  semanticSimilarity,
};
