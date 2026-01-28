#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Cross-linking plan verifier for blog -> symbol + dictionary hub links.
 *
 * Why this exists:
 * - Prevent cross-language leaks (e.g. /fr/symboles links inside EN pages)
 * - Ensure the planned posts actually got a "Related Symbols" block
 * - Ensure dictionary hub links exist where required
 *
 * Usage:
 *   node scripts/check-blog-crosslinking-plan.js
 *   node scripts/check-blog-crosslinking-plan.js --strict
 *   node scripts/check-blog-crosslinking-plan.js --only=en
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function parseArg(prefix) {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walkFiles(dirAbs, { ignoreDirs } = {}) {
  const results = [];
  const stack = [dirAbs];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs && ignoreDirs.has(entry.name)) continue;
        stack.push(full);
        continue;
      }
      if (entry.isFile()) results.push(full);
    }
  }
  return results;
}

function stripQueryAndHash(raw) {
  const hashIndex = raw.indexOf('#');
  const queryIndex = raw.indexOf('?');
  const cut = Math.min(
    hashIndex === -1 ? raw.length : hashIndex,
    queryIndex === -1 ? raw.length : queryIndex
  );
  return raw.slice(0, cut);
}

function isSkippableUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return true;
  if (trimmed.includes('{{') || trimmed.includes('}}')) return true;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('mailto:')) return true;
  if (lower.startsWith('tel:')) return true;
  if (lower.startsWith('sms:')) return true;
  if (lower.startsWith('javascript:')) return true;
  if (lower.startsWith('data:')) return true;
  return false;
}

function normalizeInternalPath(posixPath) {
  const cleaned = String(posixPath || '').replace(/\0/g, '');
  const normalized = path.posix.normalize(cleaned);
  if (normalized === '.') return '';
  return normalized;
}

function hasExtension(posixPath) {
  const base = path.posix.basename(posixPath);
  return base.includes('.') && !base.startsWith('.');
}

function resolvePrettyUrlToFile(relativeFilesSet, urlPathPosix) {
  const urlPath = normalizeInternalPath(urlPathPosix);
  const withoutLeading = urlPath.replace(/^\/+/, '');

  if (!withoutLeading || withoutLeading === '') {
    return relativeFilesSet.has('index.html') ? 'index.html' : null;
  }

  if (urlPath.endsWith('/')) {
    const candidate = `${withoutLeading}index.html`;
    return relativeFilesSet.has(candidate) ? candidate : null;
  }

  if (hasExtension(urlPath)) {
    return relativeFilesSet.has(withoutLeading) ? withoutLeading : null;
  }

  const htmlCandidate = `${withoutLeading}.html`;
  if (relativeFilesSet.has(htmlCandidate)) return htmlCandidate;

  const indexCandidate = `${withoutLeading}/index.html`;
  if (relativeFilesSet.has(indexCandidate)) return indexCandidate;

  return null;
}

function classifyInternalLikeHref(raw) {
  const trimmed = String(raw || '').trim();
  if (isSkippableUrl(trimmed)) return { kind: 'skip' };
  if (trimmed.startsWith('#')) return { kind: 'skip' };
  // We only care about internal links in the docs tree; absolute http(s) is ignored here.
  if (/^(https?:)?\/\//i.test(trimmed)) return { kind: 'skip' };
  return { kind: 'internal', path: stripQueryAndHash(trimmed) };
}

function extractLinksFromHtml(content) {
  const dom = new JSDOM(content);
  const { document } = dom.window;
  const links = [];
  for (const el of document.querySelectorAll('a[href]')) {
    const href = el.getAttribute('href');
    if (href) links.push({ href, text: (el.textContent || '').trim() });
  }
  return { dom, links };
}

function getSectionBetweenMarkers(rawHtml, startMarker, endMarker) {
  const start = rawHtml.indexOf(startMarker);
  const end = rawHtml.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) return null;
  return rawHtml.slice(start + startMarker.length, end);
}

function removeBetweenMarkers(rawHtml, startMarker, endMarker) {
  const start = rawHtml.indexOf(startMarker);
  const end = rawHtml.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) return rawHtml;
  return rawHtml.slice(0, start) + rawHtml.slice(end + endMarker.length);
}

const PLAN = {
  en: {
    blogDir: 'en/blog',
    symbolsDir: 'en/symbols',
    dictionaryPretty: '../guides/dream-symbols-dictionary',
    allowedSymbolHrefPrefixes: ['../symbols/', '/en/symbols/'],
    forbiddenAbsPrefixes: ['/fr/symboles/', '/es/simbolos/'],
    relatedMarkers: { start: '<!-- Related Symbols Start -->', end: '<!-- Related Symbols End -->' },
    priority1: [
      { slug: 'water-dreams-meaning', primary: 'water' },
      { slug: 'snake-dreams-meaning', primary: 'snake' },
      { slug: 'falling-dreams-meaning', primary: 'falling' },
      { slug: 'teeth-falling-out-dreams', primary: 'teeth' },
      { slug: 'being-chased-dreams', primary: 'being-chased' },
      { slug: 'death-dreams-meaning', primary: 'death' },
      { slug: 'flying-dreams-meaning', primary: 'flying' }
    ],
    priority2: [
      { slug: 'dream-meanings' },
      { slug: 'recurring-dreams-meaning' },
      { slug: 'dreams-about-ex' },
      { slug: 'pregnancy-dreams-meaning' },
      { slug: 'stop-nightmares-guide' },
      { slug: 'dream-interpretation-history' }
    ],
    priority3: [
      { slug: 'dream-journal-guide' },
      { slug: 'dream-journal' },
      { slug: 'how-to-remember-dreams' },
      { slug: 'lucid-dreaming-beginners-guide' },
      { slug: 'dreams-mental-health' }
    ]
  },
  fr: {
    blogDir: 'fr/blog',
    symbolsDir: 'fr/symboles',
    dictionaryPretty: '../guides/dictionnaire-symboles-reves',
    allowedSymbolHrefPrefixes: ['../symboles/', '/fr/symboles/'],
    forbiddenAbsPrefixes: ['/en/symbols/', '/es/simbolos/'],
    relatedMarkers: { start: '<!-- Related Symbols Start -->', end: '<!-- Related Symbols End -->' },
    priority1: [
      { slug: 'reves-eau', primary: 'eau' },
      { slug: 'reves-de-serpents', primary: 'serpent' },
      { slug: 'reves-de-chute', primary: 'chute' },
      { slug: 'reves-dents-qui-tombent', primary: 'dents' },
      { slug: 'reves-etre-poursuivi', primary: 'poursuite' },
      { slug: 'reves-de-mort', primary: 'mort' },
      { slug: 'reves-de-voler', primary: 'voler' }
    ],
    priority2: [
      { slug: 'signification-des-reves' },
      { slug: 'signification-reves-recurrents' },
      { slug: 'reves-ex-partenaire' },
      { slug: 'reves-de-grossesse' },
      { slug: 'guide-cauchemars' },
      { slug: 'histoire-interpretation-reves' }
    ],
    priority3: [
      { slug: 'guide-journal-reves' },
      { slug: 'journal-de-reves' },
      { slug: 'comment-se-souvenir-de-ses-reves' },
      { slug: 'guide-reve-lucide-debutant' },
      { slug: 'reves-sante-mentale' }
    ]
  },
  es: {
    blogDir: 'es/blog',
    symbolsDir: 'es/simbolos',
    dictionaryPretty: '../guides/diccionario-simbolos-suenos',
    allowedSymbolHrefPrefixes: ['../simbolos/', '/es/simbolos/'],
    forbiddenAbsPrefixes: ['/en/symbols/', '/fr/symboles/'],
    relatedMarkers: { start: '<!-- Related Symbols Start -->', end: '<!-- Related Symbols End -->' },
    priority1: [
      { slug: 'suenos-de-agua', primary: 'agua' },
      { slug: 'suenos-con-serpientes', primary: 'serpiente' },
      { slug: 'suenos-de-caer', primary: 'caida' },
      { slug: 'suenos-dientes-caen', primary: 'dientes' },
      { slug: 'suenos-ser-perseguido', primary: 'persecucion' },
      { slug: 'suenos-de-muerte', primary: 'muerte' },
      { slug: 'suenos-de-volar', primary: 'volar' }
    ],
    priority2: [
      { slug: 'significado-de-suenos' },
      { slug: 'significado-suenos-recurrentes' },
      { slug: 'suenos-con-ex' },
      { slug: 'suenos-de-embarazo' },
      { slug: 'guia-pesadillas' },
      { slug: 'historia-interpretacion-suenos' }
    ],
    priority3: [
      { slug: 'guia-diario-suenos' },
      { slug: 'diario-de-suenos' },
      { slug: 'como-recordar-suenos' },
      { slug: 'guia-suenos-lucidos-principiantes' },
      { slug: 'suenos-salud-mental' }
    ]
  }
};

function uniq(arr) {
  return [...new Set(arr)];
}

function main() {
  const only = parseArg('--only=');
  const strict = process.argv.includes('--strict');

  const langs = only ? [only] : Object.keys(PLAN);
  for (const lang of langs) {
    if (!PLAN[lang]) {
      console.error(`Unknown --only=${lang}. Expected one of: ${Object.keys(PLAN).join(', ')}`);
      process.exit(2);
    }
  }

  const docsDirAbs = path.resolve(path.join(__dirname, '../docs'));
  if (!fs.existsSync(docsDirAbs)) {
    console.error(`docs/ not found at: ${docsDirAbs}`);
    process.exit(2);
  }

  const ignoreDirs = new Set(['node_modules', '.git', 'templates']);
  const allFilesAbs = walkFiles(docsDirAbs, { ignoreDirs });
  const relativeFiles = allFilesAbs.map((abs) => toPosix(path.relative(docsDirAbs, abs)));
  const relativeFilesSet = new Set(relativeFiles);

  const errors = [];
  const warnings = [];

  const push = (level, msg) => {
    if (level === 'error') errors.push(msg);
    else warnings.push(msg);
  };
  const pushPlanned = (level, msg) => {
    // Missing planned edits are warnings during rollout; use --strict to fail.
    if (!strict) return push('warn', msg);
    return push(level, msg);
  };

  for (const lang of langs) {
    const cfg = PLAN[lang];
    const allPlanned = [
      ...cfg.priority1.map((p) => ({ ...p, kind: 'p1' })),
      ...cfg.priority2.map((p) => ({ ...p, kind: 'p2' })),
      ...cfg.priority3.map((p) => ({ ...p, kind: 'p3' }))
    ];

    console.log(`\n=== ${lang.toUpperCase()} ===`);

    for (const p of allPlanned) {
      const fileRel = `${cfg.blogDir}/${p.slug}.html`;
      const fileAbs = path.join(docsDirAbs, fileRel);
      if (!fs.existsSync(fileAbs)) {
        push('error', `[${lang}] Missing blog file: ${fileRel}`);
        continue;
      }

      const raw = fs.readFileSync(fileAbs, 'utf8');
      let hasRelatedMarkers = false;
      let hasDictionary = false;
      let hasContextualRelativeSymbolLink = false;

      // Cross-language leak check (absolute URL style).
      for (const badPrefix of cfg.forbiddenAbsPrefixes) {
        if (raw.includes(`href="${badPrefix}`) || raw.includes(`href='${badPrefix}`)) {
          push('error', `[${lang}] Cross-language symbol link found in ${fileRel} (prefix ${badPrefix})`);
        }
      }

      // Tier 2 block expectations for Priority 1/2.
      const expectsRelatedBlock = p.kind === 'p1' || p.kind === 'p2';
      const rawWithoutRelated = expectsRelatedBlock
        ? removeBetweenMarkers(raw, cfg.relatedMarkers.start, cfg.relatedMarkers.end)
        : raw;

      if (expectsRelatedBlock) {
        const sectionHtml = getSectionBetweenMarkers(raw, cfg.relatedMarkers.start, cfg.relatedMarkers.end);
        hasRelatedMarkers = Boolean(sectionHtml);
        if (!sectionHtml) {
          pushPlanned('error', `[${lang}] Missing Related Symbols markers in ${fileRel}`);
        } else {
          const { links } = extractLinksFromHtml(sectionHtml);
          const symbolHrefs = links
            .map((l) => l.href)
            .filter((href) => cfg.allowedSymbolHrefPrefixes.some((pre) => href.startsWith(pre)));

          const uniqueSymbolHrefs = uniq(symbolHrefs);
          if (uniqueSymbolHrefs.length < 3 || uniqueSymbolHrefs.length > 5) {
            push(
              'warn',
              `[${lang}] Related Symbols count should be 3-5 in ${fileRel} (found ${uniqueSymbolHrefs.length})`
            );
          }

          if (p.primary) {
            const expectedAny = cfg.allowedSymbolHrefPrefixes.map((pre) => `${pre}${p.primary}`);
            if (!expectedAny.some((exp) => uniqueSymbolHrefs.includes(exp))) {
              push(
                'warn',
                `[${lang}] Related Symbols block missing primary symbol (${p.primary}) in ${fileRel}`
              );
            }
          }
        }
      }

      // Tier 1 (contextual) sanity: at least one *relative* symbol link outside the Related Symbols block.
      if (p.kind === 'p1' || p.kind === 'p2') {
        const relativePrefix = cfg.allowedSymbolHrefPrefixes.find((pfx) => pfx.startsWith('../'));
        const { links } = extractLinksFromHtml(rawWithoutRelated);
        const hasRelativeSymbol = links.some((l) => relativePrefix && l.href.startsWith(relativePrefix));
        hasContextualRelativeSymbolLink = Boolean(hasRelativeSymbol);
        if (!hasRelativeSymbol) push('warn', `[${lang}] No contextual *relative* symbol links found in ${fileRel}`);

        // Optional signal: if a `.prose` container exists, prefer at least 1 symbol link inside it.
        const { dom } = extractLinksFromHtml(rawWithoutRelated);
        const prose = dom.window.document.querySelector('.prose');
        if (prose) {
          const proseLinks = [...prose.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter(Boolean);
          const proseHasSymbol = proseLinks.some((href) => cfg.allowedSymbolHrefPrefixes.some((pre) => href.startsWith(pre)));
          if (!proseHasSymbol) push('warn', `[${lang}] Consider adding a symbol link inside .prose in ${fileRel}`);
        }
      }

      // Dictionary hub link required for Priority 3.
      const expectsDictionary = p.kind === 'p3';
      if (expectsDictionary) {
        const hasPretty = raw.includes(`href="${cfg.dictionaryPretty}"`) || raw.includes(`href='${cfg.dictionaryPretty}'`);
        const hasAbs =
          raw.includes(`href="/${lang}/guides/${path.posix.basename(cfg.dictionaryPretty)}"`) ||
          raw.includes(`href='/${lang}/guides/${path.posix.basename(cfg.dictionaryPretty)}'`);
        hasDictionary = hasPretty || hasAbs;
        if (!hasDictionary) {
          pushPlanned('error', `[${lang}] Missing dictionary hub link (${cfg.dictionaryPretty}) in ${fileRel}`);
        }
      }

      // Ensure that any symbol links we add resolve to an actual symbol file (avoid typos).
      const { links } = extractLinksFromHtml(raw);
      const pageDirPosix = path.posix.dirname(toPosix(fileRel));

      for (const l of links) {
        const classified = classifyInternalLikeHref(l.href);
        if (classified.kind !== 'internal') continue;

        // Only validate symbol links for this language.
        const isSymbol = cfg.allowedSymbolHrefPrefixes.some((pre) => classified.path.startsWith(pre));
        if (!isSymbol) continue;

        const isRootRelative = classified.path.startsWith('/');
        const base = isRootRelative ? '' : pageDirPosix === '.' ? '' : `${pageDirPosix}/`;
        const combined = normalizeInternalPath(isRootRelative ? classified.path : `${base}${classified.path}`);
        const targetRel = resolvePrettyUrlToFile(relativeFilesSet, combined);
        if (!targetRel) {
          push('error', `[${lang}] Broken symbol link in ${fileRel}: href="${l.href}" (resolved ${combined})`);
          continue;
        }

        // Should not happen if we always prefix links with the current language.
        if (!targetRel.startsWith(`${lang}/`)) {
          push('error', `[${lang}] Link resolves outside language in ${fileRel}: href="${l.href}" -> ${targetRel}`);
        }

        // Must land under the symbols directory for the same language.
        const expectedPrefix = `${lang}/${path.posix.basename(cfg.symbolsDir)}/`;
        if (!targetRel.startsWith(expectedPrefix)) {
          push('warn', `[${lang}] Symbol-like link does not resolve to symbols dir in ${fileRel}: href="${l.href}" -> ${targetRel}`);
        }
      }

      // Progress line
      let status = 'DONE';
      if (p.kind === 'p1' || p.kind === 'p2') {
        if (!hasRelatedMarkers || !hasContextualRelativeSymbolLink) status = 'TODO';
      } else if (p.kind === 'p3') {
        if (!hasDictionary) status = 'TODO';
      }
      console.log(`- ${p.slug}: ${status}`);
    }
  }

  if (warnings.length) {
    console.log('\nWarnings');
    for (const w of warnings) console.log(`- ${w}`);
  }
  if (errors.length) {
    console.log('\nErrors');
    for (const e of errors) console.log(`- ${e}`);
  }

  if (errors.length || (strict && warnings.length)) process.exit(1);
  console.log('\n✅ Cross-linking plan checks passed.');
}

main();
