#!/usr/bin/env node
/**
 * add-blog-inline-symbol-links.js
 *
 * Scans blog article body text for mentions of dream symbols and wraps the
 * first unlinked occurrence with a contextual link to the symbol page.
 *
 * This adds inline links within <p> tags (not bottom CTA sections).
 * It complements the existing add-blog-symbol-ctas.js which adds pill-style
 * section links at the end of articles.
 *
 * Usage:
 *   node scripts/add-blog-inline-symbol-links.js --dry-run
 *   node scripts/add-blog-inline-symbol-links.js --apply
 *   node scripts/add-blog-inline-symbol-links.js --apply --lang=en
 *   node scripts/add-blog-inline-symbol-links.js --dry-run --verbose
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────

const MAX_NEW_LINKS = 8;
const LINK_CLASS = 'text-dream-salmon hover:underline';
const DOCS_ROOT = path.join(__dirname, '..', 'docs');
const DREAM_SYMBOLS_PATH = path.join(DOCS_ROOT, 'data', 'dream-symbols.json');

const SYMBOLS_PATH = {
  en: 'symbols',
  fr: 'symboles',
  es: 'simbolos',
  de: 'traumsymbole',
  it: 'simboli',
};

const LANGUAGES = ['en', 'fr', 'es', 'de', 'it'];

// Symbols whose names are too generic — skip them to avoid false positives
const SKIP_IDS = new Set([
  'running',      // "running water", "running from" — too ambiguous
  'path',         // "path to success" — too common
  'lost',         // "lost interest" — too common in non-dream context
  'clothes',      // "clothes" is OK but low value
  'night',        // "per night", "every night" — temporal, not the darkness symbol
  'key',          // "key to", "key finding" — adjective meaning "important"
  'sun',          // "in the sun" — too generic for a 3-letter word
]);

// Individual terms to exclude from matching (auto-generated but too ambiguous)
const SKIP_TERMS = new Set([
  'test',         // verb "to test" ≠ exam symbol
  'tests',        // same
  'sea',          // "sea of data", "overseas" — too common
  'road',         // "road to recovery" — too common as metaphor
]);

// Extra match terms per symbol id per language (beyond auto-generated)
const EXTRA_TERMS = {
  en: {
    teeth:            ['tooth'],
    chase:            ['chased', 'being chased'],
    ocean:            ['sea'],
    exam:             ['exams'],  // note: 'test' excluded — too generic as a verb
    nudity:           ['naked', 'nude'],
    'deceased-person':['deceased person', 'dead relative', 'dead loved one'],
    night:            ['darkness', 'dark night'],
    'ex-partner':     ['ex-partner', 'ex partner'],
    swimming:         ['swim', 'swam'],
    crying:           ['cry', 'cried'],
    pregnancy:        ['pregnant'],
    wedding:          ['married', 'marriage'],
  },
  fr: {
    teeth:            ['dent'],
    ocean:            ['oc\u00e9an'],
    night:            ['obscurit\u00e9', 'nuit noire'],
    pregnancy:        ['enceinte'],
    nudity:           ['nu', 'nue'],
    'deceased-person':['personne d\u00e9c\u00e9d\u00e9e', 'proche d\u00e9c\u00e9d\u00e9'],
  },
  es: {
    teeth:            ['diente'],
    ocean:            ['mar'],
    night:            ['oscuridad'],
    pregnancy:        ['embarazada'],
    nudity:           ['desnudo', 'desnuda'],
  },
  de: {
    teeth:            ['Zahn'],
    ocean:            ['Ozean'],
    night:            ['Dunkelheit'],
    pregnancy:        ['schwanger'],
    nudity:           ['nackt', 'Nacktheit'],
  },
  it: {
    teeth:            ['dente'],
    ocean:            ['mare'],
    night:            ['oscurit\u00e0'],
    pregnancy:        ['incinta'],
    nudity:           ['nudo', 'nuda'],
  },
};

// ─── Argument parsing ────────────────────────────────────────────────────────

const cliArgs = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const APPLY = !!cliArgs.apply;
const DRY_RUN = !!cliArgs['dry-run'] || !APPLY;
const LANG_FILTER = cliArgs.lang || null;
const VERBOSE = !!cliArgs.verbose;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a word-boundary regex that handles Unicode/accented characters.
 * Standard \b only treats [a-zA-Z0-9_] as word chars; accented chars
 * like é, ü, ñ get mis-handled. We use lookahead/lookbehind instead.
 */
function wordBoundaryRegex(term) {
  const escaped = escapeRegex(term);
  // Treat any letter (\w plus Latin accented range) as a word character
  return new RegExp(
    `(?<![\\w\\u00C0-\\u024F])(${escaped})(?![\\w\\u00C0-\\u024F])`,
    'i'
  );
}

/**
 * Build search terms for a symbol in a given language.
 * Returns array of { term, regex } sorted longest-first.
 */
function buildMatchTerms(symbol, lang) {
  const data = symbol[lang];
  if (!data?.name || !data?.slug) return [];

  const terms = new Set();

  // Split by "/" to get name variants (e.g. "Chase / Being Chased")
  const slashParts = data.name.split('/').map(s => s.trim());
  for (const part of slashParts) {
    // Remove parenthetical (e.g. "Teeth (losing teeth)" → "Teeth")
    const clean = part.replace(/\s*\(.*?\)\s*/, '').trim();
    if (clean.length >= 3) terms.add(clean);
  }

  // Language-specific auto-generated variations (English only)
  if (lang === 'en') {
    for (const t of [...terms]) {
      const lower = t.toLowerCase();
      // Simple English plurals
      if (
        t.length >= 4 &&
        !lower.endsWith('s') &&
        !lower.endsWith('sh') &&
        !lower.endsWith('ing')
      ) {
        if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) {
          terms.add(t.slice(0, -1) + 'ies');
        } else if (lower.endsWith('f')) {
          terms.add(t.slice(0, -1) + 'ves');
        } else {
          terms.add(t + 's');
        }
      }
    }
  }

  // Add manual extra terms
  const extras = EXTRA_TERMS[lang]?.[symbol.id];
  if (extras) {
    for (const e of extras) terms.add(e);
  }

  // Build regex patterns, sorted longest-first so multi-word matches take priority
  return [...terms]
    .filter(t => t.length >= 3 && !SKIP_TERMS.has(t.toLowerCase()))
    .sort((a, b) => b.length - a.length)
    .map(t => ({ term: t, regex: wordBoundaryRegex(t) }));
}

/**
 * Try to link ONE occurrence of a symbol in an HTML chunk.
 * Splits by existing <a> tags to avoid modifying already-linked text.
 * Returns { html, linked, matchedText }.
 */
function linkSymbolInHtml(html, slug, matchTerms, lang) {
  // Split HTML into segments: <a>...</a> tags (keep intact) and everything else
  const parts = html.split(/(<a\s[^>]*>[\s\S]*?<\/a>)/gi);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Skip <a> tag segments
    if (/^<a\s/i.test(part)) continue;

    // Skip segments with no letter content
    if (!/[a-zA-Z\u00C0-\u024F]/.test(part.replace(/<[^>]*>/g, ''))) continue;

    for (const { regex } of matchTerms) {
      const match = part.match(regex);
      if (!match) continue;

      const matchIdx = match.index;
      const beforeMatch = part.slice(0, matchIdx);

      // Verify match is not inside an HTML tag attribute (between < and >)
      const lastOpen = beforeMatch.lastIndexOf('<');
      const lastClose = beforeMatch.lastIndexOf('>');
      if (lastOpen > lastClose) continue;

      const href = `../${SYMBOLS_PATH[lang]}/${slug}`;
      const anchor = `<a class="${LINK_CLASS}" href="${href}">${match[1]}</a>`;
      parts[i] =
        part.slice(0, matchIdx) + anchor + part.slice(matchIdx + match[0].length);

      return { html: parts.join(''), linked: true, matchedText: match[1] };
    }
  }

  return { html, linked: false, matchedText: null };
}

/**
 * Determine the end of the "linkable zone" — article body content
 * before CTA sections, navigation, and footer elements.
 */
function findContentEndIndex(html) {
  const markers = [
    '<!-- Related Symbols Start -->',
    '<!-- Blog Nav Start -->',
    '<!-- Symbol Guide CTA',
  ];

  let endIdx = html.length;
  for (const marker of markers) {
    const idx = html.indexOf(marker);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }

  // Also stop before the app-download CTA <aside> (if present in latter half)
  const ctaLabels =
    /Try Noctalia|Essayer Noctalia|Prueba Noctalia|Noctalia testen|Prova Noctalia|Decode Your|Analysez vos|Descifra tus|Entschl.sseln Sie|Decodifica i/i;
  const asideRe = /<aside\b[^>]*>[\s\S]*?<\/aside>/gi;
  let m;
  while ((m = asideRe.exec(html)) !== null) {
    if (m.index < endIdx && m.index > endIdx * 0.4 && ctaLabels.test(m[0])) {
      endIdx = m.index;
      break;
    }
  }

  return endIdx;
}

/**
 * Process a single blog article: find symbol mentions in <p> tags and link them.
 */
function processArticle(html, symbolTerms, lang) {
  const contentEnd = findContentEndIndex(html);
  const content = html.slice(0, contentEnd);
  const after = html.slice(contentEnd);

  // Detect which symbols are already linked (any link type) in the content zone
  const linkedSymbolSlugs = new Set();
  const existingRe = new RegExp(
    `href="(?:\\.\\./)?(?:${Object.values(SYMBOLS_PATH).join('|')})/([^"]+)"`,
    'gi'
  );
  let m;
  while ((m = existingRe.exec(content)) !== null) {
    linkedSymbolSlugs.add(m[1]);
  }

  const linkedIds = new Set();
  for (const st of symbolTerms) {
    if (linkedSymbolSlugs.has(st.slug)) linkedIds.add(st.id);
  }

  let modified = content;
  let linksAdded = 0;
  const addedLinks = [];

  // Process symbols in priority order (highest-traffic symbols first)
  for (const { id, slug, terms } of symbolTerms) {
    if (linksAdded >= MAX_NEW_LINKS) break;
    if (linkedIds.has(id)) continue;

    // Try to link in the first matching <p> tag
    let found = false;
    modified = modified.replace(
      /<p\b([^>]*)>([\s\S]*?)<\/p>/gi,
      (fullMatch, attrs, inner) => {
        if (found) return fullMatch;

        const result = linkSymbolInHtml(inner, slug, terms, lang);
        if (result.linked) {
          found = true;
          linksAdded++;
          linkedIds.add(id);
          addedLinks.push({ id, matchedText: result.matchedText, slug });
          return `<p${attrs}>${result.html}</p>`;
        }
        return fullMatch;
      }
    );
  }

  return {
    html: modified + after,
    linksAdded,
    addedLinks,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(DREAM_SYMBOLS_PATH)) {
    console.error(`Missing ${DREAM_SYMBOLS_PATH}`);
    process.exit(1);
  }

  const { symbols } = JSON.parse(fs.readFileSync(DREAM_SYMBOLS_PATH, 'utf8'));
  const symbolsById = new Map(symbols.map(s => [s.id, s]));

  let totalFiles = 0;
  let totalLinksAdded = 0;
  let filesModified = 0;
  let filesSkipped = 0;
  const symbolLinkCounts = {};

  const langs = LANG_FILTER ? [LANG_FILTER] : LANGUAGES;

  for (const lang of langs) {
    const blogDir = path.join(DOCS_ROOT, lang, 'blog');
    if (!fs.existsSync(blogDir)) {
      console.error(`Blog directory not found: ${blogDir}`);
      continue;
    }

    // Build match terms for each symbol in this language
    const symbolTerms = [];
    for (const symbol of symbols) {
      if (SKIP_IDS.has(symbol.id)) continue;
      const data = symbol[lang];
      if (!data?.slug) continue;

      const terms = buildMatchTerms(symbol, lang);
      if (terms.length === 0) continue;

      symbolTerms.push({
        id: symbol.id,
        slug: data.slug,
        priority: symbol.priority || 99,
        terms,
      });
    }

    // Sort by priority (P1 symbols first, then P2, etc.)
    symbolTerms.sort((a, b) => a.priority - b.priority);

    const files = fs
      .readdirSync(blogDir)
      .filter(f => f.endsWith('.html') && f !== 'index.html')
      .sort();

    if (VERBOSE) {
      console.log(`\n── ${lang.toUpperCase()} (${files.length} articles, ${symbolTerms.length} symbols) ──`);
    }

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(blogDir, file);
      const html = fs.readFileSync(filePath, 'utf8');

      const result = processArticle(html, symbolTerms, lang);

      if (result.linksAdded > 0) {
        filesModified++;
        totalLinksAdded += result.linksAdded;

        if (VERBOSE || DRY_RUN) {
          console.log(
            `${DRY_RUN ? '[DRY RUN] ' : '\u2705 '}${lang}/${file}: +${result.linksAdded} links`
          );
          for (const link of result.addedLinks) {
            console.log(
              `    \u2192 "${link.matchedText}" \u2192 ../${SYMBOLS_PATH[lang]}/${link.slug}`
            );
            symbolLinkCounts[link.id] = (symbolLinkCounts[link.id] || 0) + 1;
          }
        }

        if (APPLY) {
          fs.writeFileSync(filePath, result.html, 'utf8');
        }
      } else {
        filesSkipped++;
        if (VERBOSE) {
          console.log(`  \u23ed  ${lang}/${file}: no new links needed`);
        }
      }
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`${DRY_RUN ? '\uD83D\uDD0D DRY RUN' : '\u2705 APPLIED'} \u2014 Results:`);
  console.log(`  Files scanned:   ${totalFiles}`);
  console.log(`  Files modified:  ${filesModified}`);
  console.log(`  Files unchanged: ${filesSkipped}`);
  console.log(`  Total new links: ${totalLinksAdded}`);

  if (Object.keys(symbolLinkCounts).length > 0) {
    console.log(`\n  Most-linked symbols:`);
    const sorted = Object.entries(symbolLinkCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [id, count] of sorted) {
      console.log(`    ${id}: ${count} articles`);
    }
  }

  console.log('═'.repeat(55));

  if (DRY_RUN && totalLinksAdded > 0) {
    console.log('\nRun with --apply to write changes.');
  }
}

main();
