#!/usr/bin/env node
/**
 * Add a Dream Symbols module to each localized blog index page.
 *
 * Goal: strengthen internal linking from blog -> dictionary/categories/symbols.
 *
 * Usage:
 *   node scripts/add-blog-index-symbol-module.js --dry-run
 *   node scripts/add-blog-index-symbol-module.js --apply
 *
 * Notes:
 * - Inserts the module just before `<!-- Search and Filters -->` when present.
 * - Skips files that already contain `<!-- Dream Symbols Module Start -->`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const APPLY = !!args.apply;
const DRY_RUN = !!args['dry-run'] || !APPLY;

const DOCS_ROOT = path.join(__dirname, '..');

const LANGS = ['en', 'fr', 'es', 'de', 'it'];
const SYMBOLS_PATH_SEGMENT = {
  en: 'symbols',
  fr: 'symboles',
  es: 'simbolos',
  de: 'traumsymbole',
  it: 'simboli'
};

const INSERT_BEFORE_MARKER = '<!-- Search and Filters -->';
const START_MARKER = '<!-- Dream Symbols Module Start -->';
const END_MARKER = '<!-- Dream Symbols Module End -->';

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(DOCS_ROOT, relPath), 'utf8'));
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTopSymbols(symbolsData) {
  // Prefer priority=1, then fill with priority=2. Keep stable ordering.
  const all = (symbolsData.symbols || []).slice();
  all.sort((a, b) => {
    const pa = Number(a.priority || 999);
    const pb = Number(b.priority || 999);
    if (pa !== pb) return pa - pb;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  // Keep 8 maximum; if fewer available, that's fine.
  return all.slice(0, 8);
}

function moduleStrings(lang) {
  const t = {
    en: {
      h2: 'Explore Dream Symbols',
      p: 'Jump from articles to the dictionary: browse categories or open a symbol to learn its meaning.',
      cta: 'Open the dictionary',
      cats: 'Browse by category',
      popular: 'Popular symbols'
    },
    fr: {
      h2: 'Explorer les symboles',
      p: 'Passez des articles au dictionnaire : explorez les catégories ou ouvrez un symbole pour sa signification.',
      cta: 'Ouvrir le dictionnaire',
      cats: 'Par catégorie',
      popular: 'Symboles populaires'
    },
    es: {
      h2: 'Explorar símbolos',
      p: 'Pasa de los artículos al diccionario: explora categorías o abre un símbolo para ver su significado.',
      cta: 'Abrir el diccionario',
      cats: 'Por categoría',
      popular: 'Símbolos populares'
    },
    de: {
      h2: 'Traumsymbole entdecken',
      p: 'Von Artikeln direkt ins Lexikon: Kategorien durchstöbern oder ein Symbol öffnen und seine Bedeutung lesen.',
      cta: 'Zum Lexikon',
      cats: 'Nach Kategorie',
      popular: 'Beliebte Symbole'
    },
    it: {
      h2: 'Esplora i simboli',
      p: 'Dagli articoli al dizionario: esplora le categorie o apri un simbolo per scoprirne il significato.',
      cta: 'Apri il dizionario',
      cats: 'Per categoria',
      popular: 'Simboli popolari'
    }
  };
  return t[lang] || t.en;
}

function renderModuleHtml({ lang, dictionarySlug, categories, topSymbols }) {
  const t = moduleStrings(lang);
  const symbolsSeg = SYMBOLS_PATH_SEGMENT[lang];

  const categoryChips = categories
    .map(({ id, slug, label }) => {
      return `                    <a href="/${lang}/${symbolsSeg}/${slug}" class="glass-button inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm text-purple-100/80 border border-white/10 hover:border-dream-salmon hover:text-white transition-colors">${escapeHtml(label)}</a>`;
    })
    .join('\n');

  const popularChips = topSymbols
    .map((s) => {
      const slug = s?.[lang]?.slug;
      const name = s?.[lang]?.name;
      if (!slug || !name) return null;
      return `                    <a href="/${lang}/${symbolsSeg}/${slug}" class="glass-button inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm text-purple-100/80 border border-white/10 hover:border-dream-salmon hover:text-white transition-colors">${escapeHtml(name)}</a>`;
    })
    .filter(Boolean)
    .join('\n');

  return [
    '',
    `                ${START_MARKER}`,
    '                <section class="mb-16" aria-label="Dream symbols">',
    '                    <div class="glass-panel rounded-3xl p-8 md:p-10 border border-dream-salmon/20">',
    '                        <div class="flex items-center justify-center gap-3 mb-4">',
    '                            <i data-lucide="sparkles" class="w-6 h-6 text-dream-salmon"></i>',
    `                            <h2 class="font-serif text-2xl md:text-3xl text-dream-cream">${escapeHtml(t.h2)}</h2>`,
    '                        </div>',
    `                        <p class="text-sm md:text-base text-purple-200/70 max-w-3xl mx-auto text-center">${escapeHtml(t.p)}</p>`,
    '',
    '                        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">',
    `                            <a href="/${lang}/guides/${dictionarySlug}" class="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold bg-dream-salmon text-dream-dark hover:bg-dream-salmon/90 transition-colors">`,
    `                                ${escapeHtml(t.cta)} <i data-lucide="arrow-right" class="w-4 h-4"></i>`,
    '                            </a>',
    '                        </div>',
    '',
    `                        <h3 class="mt-10 font-serif text-lg text-dream-cream text-center">${escapeHtml(t.cats)}</h3>`,
    '                        <div class="mt-4 flex flex-wrap items-center justify-center gap-2">',
    categoryChips,
    '                        </div>',
    '',
    `                        <h3 class="mt-10 font-serif text-lg text-dream-cream text-center">${escapeHtml(t.popular)}</h3>`,
    '                        <div class="mt-4 flex flex-wrap items-center justify-center gap-2">',
    popularChips,
    '                        </div>',
    '                    </div>',
    '                </section>',
    `                ${END_MARKER}`,
    ''
  ].join('\n');
}

function main() {
  const i18n = readJson('data/symbol-i18n.json');
  const symbolsData = readJson('data/dream-symbols.json');

  const topSymbols = getTopSymbols(symbolsData);
  const categoriesById = symbolsData.categories || {};

  // Build an ordered list of categories using the i18n slugs (stable and complete).
  const categories = (lang) => {
    const slugs = i18n?.[lang]?.category_slugs || {};
    return Object.keys(slugs)
      .sort()
      .map((id) => ({
        id,
        slug: slugs[id],
        label: categoriesById?.[id]?.[lang] || id
      }));
  };

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const lang of LANGS) {
    const rel = path.join(lang, 'blog', 'index.html');
    const abs = path.join(DOCS_ROOT, rel);
    if (!fs.existsSync(abs)) {
      console.error(`❌ Missing file: ${rel}`);
      missing += 1;
      continue;
    }

    let html = fs.readFileSync(abs, 'utf8');
    if (html.includes(START_MARKER)) {
      console.log(`ℹ️  Skip (already has module): ${rel}`);
      skipped += 1;
      continue;
    }

    const dictionarySlug = i18n?.[lang]?.dictionary_slug;
    if (!dictionarySlug) {
      console.error(`❌ Missing i18n dictionary_slug for lang "${lang}" (data/symbol-i18n.json)`);
      missing += 1;
      continue;
    }

    const insertIdx = html.indexOf(INSERT_BEFORE_MARKER);
    if (insertIdx === -1) {
      console.error(`❌ Could not find insertion marker in ${rel}: ${INSERT_BEFORE_MARKER}`);
      missing += 1;
      continue;
    }

    const block = renderModuleHtml({
      lang,
      dictionarySlug,
      categories: categories(lang),
      topSymbols
    });

    html = html.slice(0, insertIdx) + block + html.slice(insertIdx);

    if (DRY_RUN) {
      console.log(`✅ Would update: ${rel}`);
      updated += 1;
      continue;
    }

    fs.writeFileSync(abs, html);
    console.log(`✅ Updated: ${rel}`);
    updated += 1;
  }

  const mode = DRY_RUN ? 'dry-run' : 'apply';
  console.log(`\nDone (${mode}). Updated=${updated}, Skipped=${skipped}, Missing/Errors=${missing}`);

  if (missing) process.exit(1);
}

main();

