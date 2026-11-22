const fs = require('node:fs');
const path = require('node:path');

const SYMBOL_FOLDERS = { en: 'symbols', fr: 'symboles', es: 'simbolos', de: 'traumsymbole', it: 'simboli' };

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) blocks.push(m[1]);
  return blocks;
}

function flattenJsonLd(value, out) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const v of value) flattenJsonLd(v, out);
    return;
  }
  if (typeof value !== 'object') return;
  out.push(value);
  if (value['@graph']) flattenJsonLd(value['@graph'], out);
}

function getJsonLdTypes(html) {
  const types = new Set();
  for (const raw of extractJsonLdBlocks(html)) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const objects = [];
    flattenJsonLd(parsed, objects);
    for (const obj of objects) {
      const t = obj['@type'];
      if (!t) continue;
      if (Array.isArray(t)) for (const x of t) types.add(String(x));
      else types.add(String(t));
    }
  }
  return types;
}

function classifyPageType(relativePath, html) {
  const rel = relativePath.split(path.sep).join('/');
  const types = getJsonLdTypes(html);
  if (types.has('BlogPosting')) return 'blog';
  if (types.has('ItemList')) return 'category';
  if (types.has('DefinedTerm')) return 'symbol';
  if (rel.includes('/blog/')) return 'blog';
  if (Object.values(SYMBOL_FOLDERS).some(folder => rel.includes('/' + folder + '/'))) return 'symbol';
  return 'page';
}

function indexOfTagOpen(html, tagName, fromIndex) {
  const needle = `<${tagName}`;
  let idx = html.indexOf(needle, fromIndex);
  while (idx !== -1) {
    const next = html[idx + needle.length];
    if (!next || /\s|>/.test(next)) return idx;
    idx = html.indexOf(needle, idx + 1);
  }
  return -1;
}

function indexOfTagClose(html, tagName, fromIndex) {
  const needle = `</${tagName}`;
  let idx = html.indexOf(needle, fromIndex);
  while (idx !== -1) {
    const next = html[idx + needle.length];
    if (!next || /\s|>/.test(next)) return idx;
    idx = html.indexOf(needle, idx + 1);
  }
  return -1;
}

function findBalancedTagBlock(html, openStartIndex, tagName) {
  const openEnd = html.indexOf('>', openStartIndex);
  if (openEnd === -1) return null;

  let depth = 1;
  let scan = openEnd + 1;

  while (scan < html.length) {
    const nextOpen = indexOfTagOpen(html, tagName, scan);
    const nextClose = indexOfTagClose(html, tagName, scan);
    if (nextClose === -1) return null;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      scan = nextOpen + 1;
      continue;
    }

    depth -= 1;
    const closeEnd = html.indexOf('>', nextClose);
    if (closeEnd === -1) return null;
    scan = closeEnd + 1;

    if (depth === 0) {
      return {
        start: openStartIndex,
        end: closeEnd + 1,
        innerStart: openEnd + 1,
        innerEnd: nextClose
      };
    }
  }

  return null;
}

function listWritingPages(root, scope, languageFilter) {
  const languages = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^[a-z]{2}$/.test(entry.name))
    .map(entry => entry.name)
    .filter(lang => !languageFilter || languageFilter.includes(lang));
  const targets = [];
  for (const collection of ['blog', 'symbols']) {
    if (scope !== 'all' && scope !== collection) continue;
    for (const lang of languages) {
      const folder = collection === 'blog' ? 'blog' : SYMBOL_FOLDERS[lang];
      if (!folder) continue;
      const dir = path.join(root, lang, folder);
      if (!fs.existsSync(dir)) continue;
      for (const filename of fs.readdirSync(dir)) {
        if (filename.endsWith('.html')) targets.push({ file: path.join(dir, filename), lang, scope: collection });
      }
    }
  }
  return targets;
}

module.exports = { classifyPageType, escapeRegExp, findBalancedTagBlock, indexOfTagOpen, listWritingPages };
