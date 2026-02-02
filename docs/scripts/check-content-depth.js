#!/usr/bin/env node
/**
 * Content depth checks for the static docs output.
 *
 * Purpose:
 * - detect potentially "thin" indexable pages (heuristic) by word count
 * - report by page type to guide targeted improvements
 *
 * Usage:
 *   node scripts/check-content-depth.js
 *   node scripts/check-content-depth.js --fail
 */

'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const FAIL = !!args.fail;

const DOCS_ROOT = path.resolve(__dirname, '..');
const LANGS = ['en', 'fr', 'es', 'de', 'it'];
const LANG_DIRS = new Set(LANGS);
const SYMBOLS_PATH_SEGMENT = {
  en: 'symbols',
  fr: 'symboles',
  es: 'simbolos',
  de: 'traumsymbole',
  it: 'simboli'
};

const THRESHOLDS = {
  // Calibrated on current output distribution (symbol_page median ~550 words).
  symbol_page: 450,
  category_page: 300,
  guide_page: 500,
  blog_page: 500,
  blog_hub: 250,
  blog_index: 250
};

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walkFiles(dirAbs, predicate) {
  const out = [];
  const stack = [dirAbs];
  const ignoreDirNames = new Set([
    'templates',
    // Local tooling outputs/backups (not meant to be checked or deployed as site pages).
    'reports',
    // Agent/tooling folders that may exist under docs/ in local environments.
    '.agent',
    '.agents',
    '.claude',
    '.codex',
    '.gemini',
    '.github',
    '.windsurf'
  ]);
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.DS_Store') continue;
      if (ent.isDirectory() && ignoreDirNames.has(ent.name)) continue;
      const abs = path.join(current, ent.name);
      if (ent.isDirectory()) {
        stack.push(abs);
      } else if (!predicate || predicate(abs)) {
        out.push(abs);
      }
    }
  }
  return out;
}

function decodeEntities(str) {
  if (!str) return '';
  // Named entities used commonly in our output.
  const named = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'"
  };
  let out = String(str);
  for (const [k, v] of Object.entries(named)) out = out.split(k).join(v);
  // Numeric entities (decimal / hex).
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  return out;
}

function extractMetaRobotsContent(html) {
  const m1 = html.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  if (m1) return m1[1].trim();
  const m2 = html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']robots["'][^>]*>/i);
  return m2 ? m2[1].trim() : null;
}

function isNoindex(html) {
  const robots = extractMetaRobotsContent(html);
  return !!robots && robots.toLowerCase().includes('noindex');
}

function stripNonVisible(html) {
  let out = String(html || '');
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  out = out.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  out = out.replace(/<!--[\s\S]*?-->/g, ' ');
  out = out.replace(/<[^>]+>/g, ' ');
  out = decodeEntities(out);
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

function wordCount(visibleText) {
  if (!visibleText) return 0;
  const words = visibleText.split(' ').filter(Boolean);
  return words.length;
}

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(DOCS_ROOT, relPath), 'utf8'));
}

function classify(relHtml, i18nCategorySlugSets) {
  const posix = toPosix(relHtml);
  if (posix === 'index.html') return { type: 'utility_page', lang: null };
  const parts = posix.split('/');
  const top = parts[0];
  if (!LANG_DIRS.has(top)) return { type: 'utility_page', lang: null };

  const lang = top;
  const rest = parts.slice(1).join('/');

  if (rest === 'blog/index.html') return { type: 'blog_index', lang };
  if (rest.startsWith('blog/') && rest.endsWith('.html')) return { type: 'blog_page', lang };

  if (rest.startsWith('guides/') && rest.endsWith('.html')) return { type: 'guide_page', lang };

  const symbolsSeg = SYMBOLS_PATH_SEGMENT[lang];
  if (rest.startsWith(`${symbolsSeg}/`) && rest.endsWith('.html')) {
    const base = rest.replace(new RegExp(`^${symbolsSeg}/`), '').replace(/\.html$/, '');
    if (i18nCategorySlugSets?.[lang]?.has(base)) return { type: 'category_page', lang };
    return { type: 'symbol_page', lang };
  }

  return { type: 'utility_page', lang };
}

function main() {
  const i18n = loadJson('data/symbol-i18n.json');
  const i18nCategorySlugSets = Object.fromEntries(
    LANGS.map((l) => {
      const slugs = i18n?.[l]?.category_slugs || {};
      return [l, new Set(Object.values(slugs))];
    })
  );

  const htmlFilesAbs = walkFiles(DOCS_ROOT, (p) => p.endsWith('.html'));
  const htmlFilesRel = htmlFilesAbs.map((p) => path.relative(DOCS_ROOT, p)).sort();

  const findings = [];
  const summary = {
    scannedHtml: htmlFilesRel.length,
    indexableHtml: 0,
    warnings: 0
  };

  for (const relHtml of htmlFilesRel) {
    // Skip known utility sections that are always noindex via headers in prod.
    if (relHtml === '404.html') continue;
    if (toPosix(relHtml).startsWith('auth/')) continue;
    if (toPosix(relHtml).startsWith('templates/')) continue;
    if (toPosix(relHtml).startsWith('reports/')) continue;

    const abs = path.join(DOCS_ROOT, relHtml);
    const html = fs.readFileSync(abs, 'utf8');
    if (isNoindex(html)) continue;

    summary.indexableHtml += 1;

    let { type, lang } = classify(relHtml, i18nCategorySlugSets);
    // Blog topic hubs are intentionally shorter and use CollectionPage schema.
    if (type === 'blog_page' && /"@type"\s*:\s*"CollectionPage"/.test(html)) {
      type = 'blog_hub';
    }
    const visible = stripNonVisible(html);
    const wc = wordCount(visible);

    const threshold = THRESHOLDS[type];
    const isCriticalType = type === 'symbol_page' || type === 'category_page' || type === 'guide_page' || type === 'blog_page';

    if (threshold && wc < threshold) {
      summary.warnings += 1;
      findings.push({
        type,
        lang,
        relHtml,
        wordCount: wc,
        threshold,
        severity: FAIL && isCriticalType ? 'error' : 'warning'
      });
    }
  }

  // Output report
  console.log('Noctalia content depth check');
  console.log(JSON.stringify(summary, null, 2));

  if (!findings.length) return;

  const byType = new Map();
  for (const f of findings) {
    if (!byType.has(f.type)) byType.set(f.type, []);
    byType.get(f.type).push(f);
  }

  const types = Array.from(byType.keys()).sort();
  for (const t of types) {
    const rows = byType.get(t).slice().sort((a, b) => a.wordCount - b.wordCount);
    console.log(`\n${t} (${rows.length})`);
    for (const r of rows.slice(0, 30)) {
      console.log(`- [${r.severity}] ${r.relHtml}: ${r.wordCount} words (min ${r.threshold})`);
    }
    if (rows.length > 30) console.log(`... and ${rows.length - 30} more`);
  }

  if (FAIL) {
    const hardFails = findings.some((f) => f.severity === 'error');
    if (hardFails) process.exit(1);
  }
}

main();
