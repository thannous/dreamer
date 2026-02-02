#!/usr/bin/env node
/**
 * AI Writing "Fix" (deterministic, content-only)
 *
 * Applies conservative text rewrites to reduce common AI-writing tells:
 * - reduce em dashes (—)
 * - soften/replace some connector phrases
 * - remove some filler/intensifiers when used as sentence openers or comma asides
 * - replace a few overused adjectives/adverbs with simpler equivalents
 *
 * Default is dry-run. Use --write to apply changes.
 *
 * Usage:
 *   node scripts/ai-writing-fix.js
 *   node scripts/ai-writing-fix.js --only-below=8.5 --write
 *   node scripts/ai-writing-fix.js --scope=blog --lang=fr,es --only-below=8.5 --write
 *   node scripts/ai-writing-fix.js --files=en/blog/how-to-remember-dreams.html,en/symbols/train.html --write
 */

const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.join(__dirname, '..');
const LEXICON_PATH = path.join(DOCS_ROOT, 'data', 'ai-writing-lexicons.json');
const REPORTS_DIR = path.join(DOCS_ROOT, 'reports');

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const args = process.argv.slice(2).reduce((acc, raw) => {
  const arg = raw.startsWith('--') ? raw.slice(2) : raw;
  const [key, value] = arg.split('=');
  acc[key] = value === undefined ? true : value;
  return acc;
}, {});

const WRITE = Boolean(args.write);
const SCOPE = (args.scope || 'all').toString(); // all | blog | symbols
const LANG_FILTER = args.lang ? args.lang.toString().split(',').map((s) => s.trim()).filter(Boolean) : null;
const ONLY_BELOW = args['only-below'] !== undefined ? Number(args['only-below']) : null;
const LIMIT = args.limit !== undefined ? Number(args.limit) : null;
const INCLUDE_INDEX = Boolean(args['include-index']);
const FILES = args.files ? args.files.toString().split(',').map((s) => s.trim()).filter(Boolean) : null;
const REPORT_JSON = args.report ? args.report.toString() : null;

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonOrExit(jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    console.error(`Missing: ${path.relative(DOCS_ROOT, jsonPath)}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function looksLikeBlogIndex(html, filePath) {
  const rel = path.relative(DOCS_ROOT, filePath).replace(/\\/g, '/');
  if (rel.endsWith('/blog/index.html')) return true;
  return /<html[^>]*class=["'][^"']*\bblog-index\b/i.test(html);
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

function classifyPageType({ filePath, html }) {
  const rel = path.relative(DOCS_ROOT, filePath).replace(/\\/g, '/');
  const types = getJsonLdTypes(html);
  if (types.has('BlogPosting')) return 'blog';
  if (types.has('ItemList')) return 'category';
  if (types.has('DefinedTerm')) return 'symbol';
  if (rel.includes('/blog/')) return 'blog';
  if (
    rel.includes('/symbols/') ||
    rel.includes('/symboles/') ||
    rel.includes('/simbolos/') ||
    rel.includes('/traumsymbole/') ||
    rel.includes('/simboli/')
  )
    return 'symbol';
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

function findMainBlock(html) {
  const open = indexOfTagOpen(html, 'main', 0);
  if (open === -1) return null;
  return findBalancedTagBlock(html, open, 'main');
}

function isVoidTag(tagName) {
  return (
    tagName === 'br' ||
    tagName === 'hr' ||
    tagName === 'img' ||
    tagName === 'input' ||
    tagName === 'meta' ||
    tagName === 'link' ||
    tagName === 'source' ||
    tagName === 'track' ||
    tagName === 'wbr' ||
    tagName === 'area' ||
    tagName === 'base' ||
    tagName === 'col' ||
    tagName === 'embed' ||
    tagName === 'param'
  );
}

function parseTagName(tag) {
  const m = tag.match(/^<\/?\s*([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function tagHasAttr(tag, attr, value) {
  const re = new RegExp(`${attr}=["']([^"']+)["']`, 'i');
  const m = tag.match(re);
  if (!m) return false;
  if (value === undefined) return true;
  return m[1] === value;
}

function shouldIgnoreTag(tagName, tagRaw) {
  if (!tagName) return false;
  if (tagName === 'script' || tagName === 'style') return true;
  if (tagName === 'pre' || tagName === 'code' || tagName === 'kbd') return true;
  if (tagName === 'nav') return true;
  if (tagName === 'section' && tagHasAttr(tagRaw, 'id', 'sources')) return true;
  if (tagName === 'section' && /data-blog-(nav|related)=/i.test(tagRaw)) return true;
  if (tagName === 'section' && /aria-label=["']Related dream symbols["']/i.test(tagRaw)) return true;
  if (tagName === 'aside' && /aria-label=["']Disclaimer["']/i.test(tagRaw)) return true;
  return false;
}

function preserveCaseLike(source, replacement) {
  if (!replacement) return replacement;
  const first = source.trim().charAt(0);
  if (!first) return replacement;
  if (first.toUpperCase() === first && first.toLowerCase() !== first) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function fixEmDashes(text, stats) {
  const before = (text.match(/—/g) || []).length;
  if (before === 0) return text;
  // Conservative: replace em dash with comma spacing. Then clean doubled commas/spaces.
  let out = text.replace(/[ \t]*—[ \t]*/g, ', ');
  out = out
    .replace(/,[ \t]*,/g, ', ')
    .replace(/[ \t]+,/g, ',')
    .replace(/[ \t]{2,}/g, ' ');
  const after = (out.match(/—/g) || []).length;
  stats.emDashRemoved += Math.max(0, before - after);
  return out;
}

function applyWordReplacements(text, replacements, stats) {
  if (!replacements) return text;
  let out = text;
  for (const [from, to] of Object.entries(replacements)) {
    if (!from || !to) continue;
    const escaped = escapeRegExp(from);
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'giu');
    out = out.replace(re, (m) => {
      stats.wordReplacements += 1;
      return preserveCaseLike(m, to);
    });
  }
  return out;
}

function applyConnectorReplacements(text, connectorReplacements, stats) {
  if (!connectorReplacements) return text;
  let out = text;

  const entries = Object.entries(connectorReplacements).sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, replacementRaw] of entries) {
    const replacement = replacementRaw ?? '';
    if (!phrase) continue;
    const escaped = escapeRegExp(phrase);

    // Sentence open: "X. De plus, ..." -> "X. Aussi, ..." OR drop
    const startRe = new RegExp(`(^|[.!?][ \\t\\n]+)(${escaped})([ \\t]*,[ \\t]*|[ \\t]+)`, 'giu');
    out = out.replace(startRe, (m, p1, p2, p3) => {
      stats.connectorsChanged += 1;
      const rep = preserveCaseLike(p2, replacement);
      if (!rep) return p1;
      return `${p1}${rep} `;
    });

    // Mid-sentence: ", de plus," -> "," (or ", aussi,")
    const midCommaRe = new RegExp(`,[ \\t]*(${escaped})[ \\t]*,`, 'giu');
    out = out.replace(midCommaRe, (m, p1) => {
      stats.connectorsChanged += 1;
      const rep = preserveCaseLike(p1, replacement);
      if (!rep) return ',';
      return `, ${rep},`;
    });

    // ", de plus " -> ", " (or ", aussi ")
    const midRe = new RegExp(`,[ \\t]*(${escaped})[ \\t]+`, 'giu');
    out = out.replace(midRe, (m, p1) => {
      stats.connectorsChanged += 1;
      const rep = preserveCaseLike(p1, replacement);
      if (!rep) return ', ';
      return `, ${rep} `;
    });
  }

  out = out.replace(/[ \t]{2,}/g, ' ');
  return out;
}

function removeFillers(text, fillers, stats) {
  if (!fillers || fillers.length === 0) return text;
  let out = text;

  const words = fillers.slice().sort((a, b) => b.length - a.length);
  for (const w of words) {
    const escaped = escapeRegExp(w);

    // Sentence open: "..., Really, ..." -> "..., ..."
    const startRe = new RegExp(`(^|[.!?][ \\t\\n]+)(${escaped})([ \\t]*,[ \\t]*|[ \\t]+)`, 'giu');
    out = out.replace(startRe, (m, p1) => {
      stats.fillersRemoved += 1;
      return p1;
    });

    // Comma asides: ", really," -> ","
    const asideRe = new RegExp(`,[ \\t]*(${escaped})[ \\t]*,`, 'giu');
    out = out.replace(asideRe, () => {
      stats.fillersRemoved += 1;
      return ',';
    });

    // Parenthetical: "(really)" -> ""
    const parenRe = new RegExp(`\\([ \\t]*(${escaped})[ \\t]*\\)`, 'giu');
    out = out.replace(parenRe, () => {
      stats.fillersRemoved += 1;
      return '';
    });
  }

  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+,/g, ',')
    .replace(/,[ \t]*,/g, ', ');
  return out;
}

function transformContentHtml(mainHtml, lang, lexicon) {
  const stats = {
    emDashRemoved: 0,
    connectorsChanged: 0,
    fillersRemoved: 0,
    wordReplacements: 0
  };

  const ignoreStack = [];
  let ignoredCount = 0;

  const tagRe = /<[^>]+>/g;
  let lastIndex = 0;
  let out = '';

  function currentIgnored() {
    return ignoredCount > 0;
  }

  for (const match of mainHtml.matchAll(tagRe)) {
    const tag = match[0];
    const idx = match.index;
    const textChunk = mainHtml.slice(lastIndex, idx);
    if (textChunk) {
      if (currentIgnored()) {
        out += textChunk;
      } else {
        // Preserve formatting whitespace while still rewriting the meaningful core text.
        const leadingWs = (textChunk.match(/^[ \t\r\n]+/) || [''])[0];
        const trailingWs = (textChunk.match(/[ \t\r\n]+$/) || [''])[0];
        const core = textChunk.slice(leadingWs.length, textChunk.length - trailingWs.length);

        if (!/[\p{L}\p{N}—–]/u.test(core)) {
          out += textChunk;
        } else {
          let t = core;
          t = fixEmDashes(t, stats);
          t = applyConnectorReplacements(t, lexicon.connectorReplacements, stats);
          t = removeFillers(t, lexicon.fillerWords, stats);
          t = applyWordReplacements(t, lexicon.replacements, stats);
          out += leadingWs + t + trailingWs;
        }
      }
    }

    const tagName = parseTagName(tag);
    const isEnd = /^<\//.test(tag);
    const isSelfClosing = /\/>$/.test(tag) || (tagName ? isVoidTag(tagName) : false);

    if (!tagName || isSelfClosing) {
      out += tag;
      lastIndex = idx + tag.length;
      continue;
    }

    if (!isEnd) {
      const parentIgnored = currentIgnored();
      const localIgnore = parentIgnored ? true : shouldIgnoreTag(tagName, tag);
      ignoreStack.push({ tagName, ignored: localIgnore });
      if (localIgnore) ignoredCount += 1;
    } else {
      // Pop until matching tag (best-effort for imperfect HTML)
      for (let i = ignoreStack.length - 1; i >= 0; i -= 1) {
        const entry = ignoreStack.pop();
        if (entry.ignored) ignoredCount -= 1;
        if (entry.tagName === tagName) break;
      }
      if (ignoredCount < 0) ignoredCount = 0;
    }

    out += tag;
    lastIndex = idx + tag.length;
  }

  const tail = mainHtml.slice(lastIndex);
  if (tail) {
    if (currentIgnored()) out += tail;
    else {
      const leadingWs = (tail.match(/^[ \t\r\n]+/) || [''])[0];
      const trailingWs = (tail.match(/[ \t\r\n]+$/) || [''])[0];
      const core = tail.slice(leadingWs.length, tail.length - trailingWs.length);
      if (!/[\p{L}\p{N}—–]/u.test(core)) out += tail;
      else {
        let t = core;
        t = fixEmDashes(t, stats);
        t = applyConnectorReplacements(t, lexicon.connectorReplacements, stats);
        t = removeFillers(t, lexicon.fillerWords, stats);
        t = applyWordReplacements(t, lexicon.replacements, stats);
        out += leadingWs + t + trailingWs;
      }
    }
  }

  return { html: out, stats };
}

function detectLangFromPath(filePath) {
  const rel = path.relative(DOCS_ROOT, filePath);
  const first = rel.split(path.sep)[0];
  return first || null;
}

function listTargets() {
  const languages = fs
    .readdirSync(DOCS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => /^[a-z]{2}$/.test(name));
  const filteredLangs = LANG_FILTER ? languages.filter((l) => LANG_FILTER.includes(l)) : languages;

  const targets = [];

  if (SCOPE === 'all' || SCOPE === 'blog') {
    for (const lang of filteredLangs) {
      const dir = path.join(DOCS_ROOT, lang, 'blog');
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.html')) continue;
        targets.push(path.join(dir, f));
      }
    }
  }

  if (SCOPE === 'all' || SCOPE === 'symbols') {
    const symbolsFolders = { en: 'symbols', fr: 'symboles', es: 'simbolos', de: 'traumsymbole', it: 'simboli' };
    for (const lang of filteredLangs) {
      const folder = symbolsFolders[lang];
      if (!folder) continue;
      const dir = path.join(DOCS_ROOT, lang, folder);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.html')) continue;
        targets.push(path.join(dir, f));
      }
    }
  }

  return targets;
}

function findLatestAuditReportJson() {
  if (!fs.existsSync(REPORTS_DIR)) return null;
  const files = fs.readdirSync(REPORTS_DIR).filter((f) => /^ai-writing-audit-.*\.json$/.test(f));
  if (files.length === 0) return null;
  const withTime = files
    .map((f) => {
      const p = path.join(REPORTS_DIR, f);
      return { file: p, mtime: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return withTime[0].file;
}

function buildScoreIndexFromReport(reportPath) {
  const report = readJsonOrExit(reportPath);
  const map = new Map();
  for (const r of report.results || []) {
    const rel = path.relative(DOCS_ROOT, r.file).replace(/\\/g, '/');
    map.set(rel, r.score10);
  }
  return map;
}

function main() {
  const lexicons = readJsonOrExit(LEXICON_PATH);
  const langs = lexicons.languages || {};

  let candidates = FILES
    ? FILES.map((p) => (path.isAbsolute(p) ? p : path.join(DOCS_ROOT, p)))
    : listTargets();

  candidates = candidates.filter((p) => fs.existsSync(p));

  let scoreIndex = null;
  if (ONLY_BELOW !== null) {
    const reportPath = REPORT_JSON ? (path.isAbsolute(REPORT_JSON) ? REPORT_JSON : path.join(DOCS_ROOT, REPORT_JSON)) : findLatestAuditReportJson();
    if (!reportPath) {
      console.error('No audit report JSON found to use with --only-below. Run: node scripts/ai-writing-audit.js');
      process.exit(1);
    }
    scoreIndex = buildScoreIndexFromReport(reportPath);
  }

  const stamp = nowStamp();
  const backupRoot = path.join(REPORTS_DIR, 'ai-writing-fix-backups', stamp);
  if (WRITE) ensureDirSync(backupRoot);

  const results = [];
  let processed = 0;

  for (const filePath of candidates) {
    if (LIMIT !== null && processed >= LIMIT) break;

    const lang = detectLangFromPath(filePath);
    const lex = langs[lang];
    if (!lex) continue;

    const html = fs.readFileSync(filePath, 'utf8');

    if (!INCLUDE_INDEX && looksLikeBlogIndex(html, filePath)) continue;

    const rel = path.relative(DOCS_ROOT, filePath).replace(/\\/g, '/');
    if (ONLY_BELOW !== null) {
      const score = scoreIndex ? scoreIndex.get(rel) : null;
      if (score === undefined || score === null) continue;
      if (!(score < ONLY_BELOW)) continue;
    }

    const pageType = classifyPageType({ filePath, html });
    if (SCOPE === 'blog' && pageType !== 'blog') continue;
    if (SCOPE === 'symbols' && !(pageType === 'symbol' || pageType === 'category')) continue;

    const mainBlock = findMainBlock(html);
    if (!mainBlock) continue;

    const mainHtml = html.slice(mainBlock.start, mainBlock.end);
    const { html: fixedMainHtml, stats } = transformContentHtml(mainHtml, lang, lex);

    if (fixedMainHtml === mainHtml) continue;

    const newHtml = html.slice(0, mainBlock.start) + fixedMainHtml + html.slice(mainBlock.end);

    if (WRITE) {
      const backupPath = path.join(backupRoot, rel);
      ensureDirSync(path.dirname(backupPath));
      fs.writeFileSync(backupPath, html, 'utf8');
      fs.writeFileSync(filePath, newHtml, 'utf8');
    }

    results.push({ file: rel, lang, pageType, stats });
    processed += 1;
  }

  const changed = results.length;
  const totals = results.reduce(
    (acc, r) => {
      acc.emDashRemoved += r.stats.emDashRemoved;
      acc.connectorsChanged += r.stats.connectorsChanged;
      acc.fillersRemoved += r.stats.fillersRemoved;
      acc.wordReplacements += r.stats.wordReplacements;
      return acc;
    },
    { emDashRemoved: 0, connectorsChanged: 0, fillersRemoved: 0, wordReplacements: 0 }
  );

  console.log(`${WRITE ? 'Applied' : 'Dry-run'} AI-writing fixes`);
  console.log(`- Files changed: ${changed}`);
  console.log(`- em dashes removed: ${totals.emDashRemoved}`);
  console.log(`- connectors changed: ${totals.connectorsChanged}`);
  console.log(`- fillers removed: ${totals.fillersRemoved}`);
  console.log(`- word replacements: ${totals.wordReplacements}`);
  if (WRITE) console.log(`- Backups: ${path.relative(DOCS_ROOT, backupRoot)}`);

  if (!WRITE && changed > 0) {
    console.log(`Tip: re-run with --write to apply these changes.`);
  }
}

main();
