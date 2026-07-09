#!/usr/bin/env node
/**
 * AI Writing Detection Audit (heuristic)
 *
 * Scans generated HTML pages and scores "AI tell" patterns:
 * - Em dashes (—)
 * - Overused verbs/adjectives/transitions
 * - AI-ish opening/transitional/concluding phrases
 * - Filler words / empty intensifiers
 * - Academic-ish stock phrases
 * - A few structural patterns (lightweight)
 *
 * Usage:
 *   node scripts/ai-writing-audit.js
 *   node scripts/ai-writing-audit.js --scope=blog
 *   node scripts/ai-writing-audit.js --scope=symbols --lang=en,fr
 *   node scripts/ai-writing-audit.js --out=reports/ai-writing-audit.md
 */

const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.join(__dirname, '..');
const LEXICON_PATH = path.join(DOCS_ROOT, 'data', 'ai-writing-lexicons.json');

function readDocsAssetVersionOrNull() {
  const versionPath = path.join(DOCS_ROOT, 'version.txt');
  if (!fs.existsSync(versionPath)) return null;
  const version = fs.readFileSync(versionPath, 'utf8').trim();
  return version || null;
}

function isoDateFromDocsVersion(version) {
  const match = version.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().slice(0, 10);
}

const args = process.argv.slice(2).reduce((acc, raw) => {
  const arg = raw.startsWith('--') ? raw.slice(2) : raw;
  const [key, value] = arg.split('=');
  acc[key] = value === undefined ? true : value;
  return acc;
}, {});

const SCOPE = (args.scope || 'all').toString(); // all | blog | symbols
const LANG_FILTER = args.lang ? args.lang.toString().split(',').map((s) => s.trim()).filter(Boolean) : null;
const OUT_MD = args.out ? args.out.toString() : null;
const TOP_N = Number.isFinite(Number(args.top)) ? Number(args.top) : 3;

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listHtmlFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(dirPath, f));
}

function decodeHtmlEntities(input) {
  if (!input) return '';
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  };

  return input
    .replace(/&([a-z]+);/gi, (_, name) => named[name.toLowerCase()] ?? `&${name};`)
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      if (!Number.isFinite(code)) return _;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code)) return _;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _;
      }
    });
}

function normalizeForMatching(text) {
  return (text || '')
    .replace(/[’‘]/g, "'")
    .replace(/\u00A0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripNonContent(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return decodeHtmlEntities(match[1].trim()).replace(/\s+/g, ' ');
}

function extractCanonical(html) {
  const match = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i);
  if (!match) return null;
  const href = match[0].match(/href=["']([^"']+)["']/i);
  return href?.[1] || null;
}

function wordCount(text) {
  const tokens = (text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens.length;
}

function countChar(text, ch) {
  if (!text) return 0;
  let count = 0;
  for (const c of text) if (c === ch) count += 1;
  return count;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countPhraseOccurrences(normalizedText, normalizedPhrase) {
  if (!normalizedText || !normalizedPhrase) return 0;
  const escaped = escapeRegExp(normalizedPhrase);
  const re = new RegExp(escaped, 'g');
  let count = 0;
  for (const _ of normalizedText.matchAll(re)) count += 1;
  return count;
}

function countWholeWord(normalizedText, normalizedWord) {
  if (!normalizedText || !normalizedWord) return 0;
  const escaped = escapeRegExp(normalizedWord);
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gu');
  let count = 0;
  for (const _ of normalizedText.matchAll(re)) count += 1;
  return count;
}

function topEntries(map, topN) {
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
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

function detectLangFromPath(filePath) {
  const rel = path.relative(DOCS_ROOT, filePath);
  const first = rel.split(path.sep)[0];
  return first || null;
}

function classifyPage({ filePath, html }) {
  const rel = path.relative(DOCS_ROOT, filePath).replace(/\\/g, '/');
  const types = getJsonLdTypes(html);

  if (types.has('BlogPosting')) return { type: 'blog' };
  if (types.has('ItemList')) return { type: 'category' };
  if (types.has('DefinedTerm')) return { type: 'symbol' };

  // Fallbacks
  if (rel.includes('/blog/')) return { type: 'blog' };
  if (
    rel.includes('/symbols/') ||
    rel.includes('/symboles/') ||
    rel.includes('/simbolos/') ||
    rel.includes('/traumsymbole/') ||
    rel.includes('/simboli/')
  ) {
    return { type: 'symbol' };
  }

  return { type: 'page' };
}

function extractLargestTagBlock(html, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi');
  let best = null;
  for (const match of html.matchAll(re)) {
    const block = match[0];
    if (!best || block.length > best.length) best = block;
  }
  return best;
}

function extractTextFromHtmlFragment(fragment) {
  const withoutNonContent = stripNonContent(fragment);
  const withoutTags = withoutNonContent.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
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

function findProseDivBlocks(htmlFragment) {
  const blocks = [];
  let i = 0;
  while (i < htmlFragment.length) {
    const idx = indexOfTagOpen(htmlFragment, 'div', i);
    if (idx === -1) break;
    const openEnd = htmlFragment.indexOf('>', idx);
    if (openEnd === -1) break;
    const openTag = htmlFragment.slice(idx, openEnd + 1);
    if (!/class=["'][^"']*\bprose\b/i.test(openTag)) {
      i = openEnd + 1;
      continue;
    }
    const block = findBalancedTagBlock(htmlFragment, idx, 'div');
    if (!block) {
      i = openEnd + 1;
      continue;
    }
    blocks.push(block);
    i = block.end;
  }
  return blocks;
}

function extractTextForAudit({ html, pageType }) {
  const cleaned = stripNonContent(html);

  if (pageType === 'blog') {
    const article = extractLargestTagBlock(cleaned, 'article') || extractLargestTagBlock(cleaned, 'main') || cleaned;
    const proseBlocks = findProseDivBlocks(article);
    if (proseBlocks.length > 0) {
      const proseHtml = proseBlocks.map((b) => article.slice(b.start, b.end)).join('\n');
      return extractTextFromHtmlFragment(proseHtml);
    }
    return extractTextFromHtmlFragment(article);
  }

  const main = extractLargestTagBlock(cleaned, 'main') || extractLargestTagBlock(cleaned, 'article') || cleaned;
  return extractTextFromHtmlFragment(main);
}

function loadLexiconsOrExit() {
  if (!fs.existsSync(LEXICON_PATH)) {
    console.error(`Missing lexicon file: ${path.relative(DOCS_ROOT, LEXICON_PATH)}`);
    process.exit(1);
  }
  const json = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8'));
  const languages = json.languages || {};

  const normalized = {};
  for (const [lang, lex] of Object.entries(languages)) {
    const normalizedLex = {};
    for (const [key, value] of Object.entries(lex)) {
      if (Array.isArray(value)) normalizedLex[key] = value.map((s) => normalizeForMatching(String(s))).filter(Boolean);
    }
    normalized[lang] = normalizedLex;
  }

  return { raw: languages, normalized };
}

function detectStructuralPatterns(lang, normalizedText) {
  const hits = {};
  if (!normalizedText) return hits;

  if (lang === 'en') {
    hits.whether_three = (normalizedText.match(/whether\s+you're\s+a\s+[^.?!]{0,200},\s+[^.?!]{0,200},\s+or\s+[^.?!]{0,200}/g) || []).length;
    hits.not_just_also = (normalizedText.match(/it's\s+not\s+just\s+[^.?!]{0,200},\s+it's\s+also\s+[^.?!]{0,200}/g) || []).length;
    hits.by_gerund = (normalizedText.match(/(?:^|[.!?]\s+)by\s+[a-z]{3,}ing\b/g) || []).length;
  } else if (lang === 'fr') {
    hits.en_gerund = (normalizedText.match(/(?:^|[.!?]\s+)en\s+[\p{L}]{3,}ant\b/gu) || []).length;
  } else if (lang === 'es') {
    hits.al_infinitive = (normalizedText.match(/(?:^|[.!?]\s+)al\s+[\p{L}]{3,}(ar|er|ir)\b/gu) || []).length;
  } else if (lang === 'de') {
    hits.indem = (normalizedText.match(/(?:^|[.!?]\s+)indem\s+/g) || []).length;
  }

  return hits;
}

function analyzeText({ text, lang, lexicons }) {
  const normalizedText = normalizeForMatching(text);
  const words = wordCount(text);
  const lex = lexicons.normalized[lang] || null;

  const metrics = {
    words,
    emDash: countChar(text, '—'),
    enDash: countChar(text, '–')
  };

  const reasons = [];
  const structuralHits = detectStructuralPatterns(lang, normalizedText);

  function addTopWordReasons(key, label, wordsList, weightPerHit) {
    const counts = {};
    for (const w of wordsList) {
      const c = countWholeWord(normalizedText, w);
      if (c > 0) counts[w] = c;
    }
    const total = Object.values(counts).reduce((acc, c) => acc + c, 0);
    if (total > 0) {
      const top = topEntries(counts, TOP_N);
      reasons.push({
        key,
        label,
        count: total,
        examples: top.map(([w, c]) => `${w}×${c}`),
        weightPerHit
      });
    }
    return total;
  }

  function addTopPhraseReasons(key, label, phrases, weightPerHit) {
    const counts = {};
    for (const p of phrases) {
      const c = countPhraseOccurrences(normalizedText, p);
      if (c > 0) counts[p] = c;
    }
    const total = Object.values(counts).reduce((acc, c) => acc + c, 0);
    if (total > 0) {
      const top = topEntries(counts, TOP_N);
      reasons.push({
        key,
        label,
        count: total,
        examples: top.map(([p, c]) => `${p}×${c}`),
        weightPerHit
      });
    }
    return total;
  }

  let weightSum = 0;

  // Strong signal: em dashes
  const emDashWeight = 8;
  weightSum += metrics.emDash * emDashWeight;
  if (metrics.emDash > 0) {
    reasons.push({
      key: 'emDash',
      label: 'Em dashes (—)',
      count: metrics.emDash,
      examples: [],
      weightPerHit: emDashWeight
    });
  }

  if (lex) {
    weightSum += addTopWordReasons('overusedVerbs', 'Overused verbs', lex.overusedVerbs || [], 2) * 2;
    weightSum += addTopWordReasons('overusedAdjectives', 'Overused adjectives', lex.overusedAdjectives || [], 2) * 2;
    weightSum += addTopPhraseReasons('overusedTransitions', 'Overused transitions/connectors', lex.overusedTransitions || [], 2) * 2;
    weightSum += addTopPhraseReasons('openingPhrases', 'AI-ish openings', lex.openingPhrases || [], 7) * 7;
    weightSum += addTopPhraseReasons('transitionalPhrases', 'AI-ish transitions', lex.transitionalPhrases || [], 5) * 5;
    weightSum += addTopPhraseReasons('concludingPhrases', 'AI-ish conclusions', lex.concludingPhrases || [], 6) * 6;
    weightSum += addTopWordReasons('fillerWords', 'Filler / intensifiers', lex.fillerWords || [], 1) * 1;
    weightSum += addTopPhraseReasons('academicTells', 'Academic stock phrases', lex.academicTells || [], 3) * 3;
  }

  const structuralTotal = Object.values(structuralHits).reduce((acc, v) => acc + (v || 0), 0);
  if (structuralTotal > 0) {
    reasons.push({
      key: 'structuralPatterns',
      label: 'Structural patterns',
      count: structuralTotal,
      examples: Object.entries(structuralHits)
        .filter(([, v]) => v > 0)
        .slice(0, 3)
        .map(([k, v]) => `${k}×${v}`),
      weightPerHit: 6
    });
    weightSum += structuralTotal * 6;
  }

  // Normalize by length (per 1k words)
  const perK = weightSum / Math.max(1, words / 1000);
  const score10 = Math.max(0, Math.min(10, 10 - perK / 12));
  const grade =
    score10 >= 9 ? 'A' : score10 >= 8 ? 'B' : score10 >= 7 ? 'C' : score10 >= 6 ? 'D' : score10 >= 5 ? 'E' : 'F';

  const reasonsSorted = reasons
    .slice()
    .sort((a, b) => (b.weightPerHit || 1) * b.count - (a.weightPerHit || 1) * a.count)
    .slice(0, 6);

  return {
    words,
    metrics,
    perK: Number(perK.toFixed(2)),
    score10: Number(score10.toFixed(1)),
    grade,
    reasons: reasonsSorted,
    notes: lex ? [] : [`No lexicon for lang=${lang}. Only em dash + structural counted.`]
  };
}

function collectTargets() {
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
      for (const file of listHtmlFiles(dir)) targets.push({ file, lang, scope: 'blog' });
    }
  }

  if (SCOPE === 'all' || SCOPE === 'symbols') {
    const symbolsFolders = {
      en: 'symbols',
      fr: 'symboles',
      es: 'simbolos',
      de: 'traumsymbole',
      it: 'simboli'
    };
    for (const lang of filteredLangs) {
      const folder = symbolsFolders[lang];
      if (!folder) continue;
      const dir = path.join(DOCS_ROOT, lang, folder);
      for (const file of listHtmlFiles(dir)) targets.push({ file, lang, scope: 'symbols' });
    }
  }

  return { targets };
}

function formatReasonsInline(reasons) {
  if (!reasons || reasons.length === 0) return '';
  return reasons
    .map((r) => {
      const examples = r.examples && r.examples.length ? ` (${r.examples.slice(0, 3).join(', ')})` : '';
      return `${r.label}: ${r.count}${examples}`;
    })
    .join(' | ');
}

function writeMarkdownReport({ results, meta, outPath }) {
  const lines = [];
  lines.push(`# AI Writing Audit`);
  lines.push('');
  lines.push(`- Date: ${meta.date}`);
  lines.push(`- Scope: ${meta.scope}`);
  lines.push(`- Languages: ${meta.languages.join(', ')}`);
  lines.push(`- Files scanned: ${results.length}`);
  lines.push(`- Scoring: 0–10 (10 = fewer “AI tells”; heuristic)`);
  lines.push('');

  const byType = new Map();
  for (const r of results) {
    const key = `${r.type}:${r.lang}`;
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key).push(r);
  }

  const keys = Array.from(byType.keys()).sort();
  for (const key of keys) {
    const [type, lang] = key.split(':');
    const group = byType.get(key).slice().sort((a, b) => a.score10 - b.score10);

    lines.push(`## ${type.toUpperCase()} (${lang})`);
    lines.push('');
    lines.push(`| Score | Grade | Words | — | Title | File | Why (top signals) |`);
    lines.push(`|---:|:---:|---:|---:|---|---|---|`);

    for (const r of group) {
      const fileRel = path.relative(DOCS_ROOT, r.file).replace(/\\/g, '/');
      const title = (r.title || '').replace(/\|/g, '\\|');
      const why = formatReasonsInline(r.reasons).replace(/\|/g, '\\|');
      lines.push(`| ${r.score10.toFixed(1)} | ${r.grade} | ${r.words} | ${r.metrics.emDash} | ${title} | \`${fileRel}\` | ${why} |`);
    }
    lines.push('');
  }

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
}

function main() {
  const lexicons = loadLexiconsOrExit();
  const { targets } = collectTargets();

  const results = [];
  for (const t of targets) {
    const html = fs.readFileSync(t.file, 'utf8');
    const title = extractTitle(html) || path.basename(t.file);
    const canonical = extractCanonical(html);
    const { type } = classifyPage({ filePath: t.file, html });
    const text = extractTextForAudit({ html, pageType: type });
    const analysis = analyzeText({ text, lang: t.lang, lexicons });

    results.push({
      file: t.file,
      lang: t.lang,
      scope: t.scope,
      type,
      title,
      canonical,
      words: analysis.words,
      metrics: analysis.metrics,
      perK: analysis.perK,
      score10: analysis.score10,
      grade: analysis.grade,
      reasons: analysis.reasons,
      notes: analysis.notes
    });
  }

  const version = readDocsAssetVersionOrNull();
  const date = version ? isoDateFromDocsVersion(version) : new Date().toISOString().slice(0, 10);

  const reportDir = path.join(DOCS_ROOT, 'reports');
  ensureDirSync(reportDir);

  const outJson = path.join(reportDir, `ai-writing-audit-${date}.json`);
  fs.writeFileSync(
    outJson,
    JSON.stringify(
      {
        meta: {
          date,
          scope: SCOPE,
          languages: LANG_FILTER || 'all',
          filesScanned: results.length,
          version: version || null,
          lexiconVersion: fs.existsSync(LEXICON_PATH) ? JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8')).meta?.version || null : null
        },
        results
      },
      null,
      2
    ),
    'utf8'
  );

  const outMd = OUT_MD || path.join(reportDir, `ai-writing-audit-${date}.md`);
  writeMarkdownReport({
    results,
    meta: {
      date,
      scope: SCOPE,
      languages: LANG_FILTER || Array.from(new Set(results.map((r) => r.lang))).sort()
    },
    outPath: outMd
  });

  console.log(`Wrote:\n- ${path.relative(DOCS_ROOT, outMd)}\n- ${path.relative(DOCS_ROOT, outJson)}`);
}

main();

