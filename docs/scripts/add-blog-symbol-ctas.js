#!/usr/bin/env node
/**
 * Add "Related Symbols" CTAs to blog posts that currently have no symbol links.
 *
 * Usage:
 *   node scripts/add-blog-symbol-ctas.js --dry-run
 *   node scripts/add-blog-symbol-ctas.js --apply
 *
 * Notes:
 * - Inserts the section just before `<!-- Blog Nav Start -->` when present.
 * - Skips files that already contain `<!-- Related Symbols Start -->`.
 */

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
const DREAM_SYMBOLS_PATH = path.join(DOCS_ROOT, 'data', 'dream-symbols.json');

const BLOG_NAV_MARKER = '<!-- Blog Nav Start -->';
const RELATED_MARKER = '<!-- Related Symbols Start -->';

// 4 links per article, by symbol id.
const MAPPING = {
  en: {
    'en/blog/dream-incubation-guide.html': ['night', 'moon', 'key', 'door'],
    'en/blog/dream-journal-guide.html': ['water', 'teeth', 'snake', 'chase'],
    'en/blog/dream-journal.html': ['water', 'teeth', 'falling', 'flying'],
    'en/blog/dreams-mental-health.html': ['teeth', 'exam', 'chase', 'falling'],
    'en/blog/how-to-remember-dreams.html': ['night', 'water', 'teeth', 'falling'],
    'en/blog/lucid-dreaming-beginners-guide.html': ['flying', 'falling', 'night', 'door'],
    'en/blog/lucid-dreaming.html': ['flying', 'falling', 'night', 'door'],
    'en/blog/precognitive-dreams-science.html': ['moon', 'sun', 'storm', 'rainbow'],
    'en/blog/rem-sleep-dreams.html': ['night', 'moon', 'water', 'storm'],
    'en/blog/sleep-paralysis-guide.html': ['night', 'death', 'mouth', 'chase'],
    'en/blog/why-we-dream-science.html': ['water', 'death', 'chase', 'falling'],
    'en/blog/why-we-forget-dreams.html': ['night', 'phone', 'key', 'train']
  },
  fr: {
    'fr/blog/guide-incubation-reves.html': ['night', 'moon', 'key', 'door'],
    'fr/blog/guide-journal-reves.html': ['water', 'teeth', 'snake', 'chase'],
    'fr/blog/journal-de-reves.html': ['water', 'teeth', 'falling', 'flying'],
    'fr/blog/reves-sante-mentale.html': ['teeth', 'exam', 'chase', 'falling'],
    'fr/blog/comment-se-souvenir-de-ses-reves.html': ['night', 'water', 'teeth', 'falling'],
    'fr/blog/guide-reve-lucide-debutant.html': ['flying', 'falling', 'night', 'door'],
    'fr/blog/reve-lucide.html': ['flying', 'falling', 'night', 'door'],
    'fr/blog/reves-premonitoires-science.html': ['moon', 'sun', 'storm', 'rainbow'],
    'fr/blog/sommeil-paradoxal-reves.html': ['night', 'moon', 'water', 'storm'],
    'fr/blog/guide-paralysie-sommeil.html': ['night', 'death', 'mouth', 'chase'],
    'fr/blog/pourquoi-nous-revons-science.html': ['water', 'death', 'chase', 'falling'],
    'fr/blog/pourquoi-oublie-reves-reveil.html': ['night', 'phone', 'key', 'train']
  },
  es: {
    'es/blog/guia-incubacion-suenos.html': ['night', 'moon', 'key', 'door'],
    'es/blog/guia-diario-suenos.html': ['water', 'teeth', 'snake', 'chase'],
    'es/blog/diario-de-suenos.html': ['water', 'teeth', 'falling', 'flying'],
    'es/blog/suenos-salud-mental.html': ['teeth', 'exam', 'chase', 'falling'],
    'es/blog/como-recordar-suenos.html': ['night', 'water', 'teeth', 'falling'],
    'es/blog/guia-suenos-lucidos-principiantes.html': ['flying', 'falling', 'night', 'door'],
    'es/blog/suenos-lucidos.html': ['flying', 'falling', 'night', 'door'],
    'es/blog/suenos-premonitorios-ciencia.html': ['moon', 'sun', 'storm', 'rainbow'],
    'es/blog/sueno-rem-suenos.html': ['night', 'moon', 'water', 'storm'],
    'es/blog/guia-paralisis-sueno.html': ['night', 'death', 'mouth', 'chase'],
    'es/blog/por-que-sonamos-ciencia.html': ['water', 'death', 'chase', 'falling'],
    'es/blog/por-que-olvidamos-suenos.html': ['night', 'phone', 'key', 'train']
  }
};

const PATH_SEGMENT = { en: 'symbols', fr: 'symboles', es: 'simbolos' };

const OVERRIDE_LABELS = {
  chase: {
    en: 'Being Chased Dream Meaning',
    fr: "R\u00eaver d'\u00eatre poursuivi",
    es: 'So\u00f1ar con ser perseguido'
  }
};

function readJsonOrThrow(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function capFirstLower(str, locale) {
  const trimmed = String(str || '').trim();
  if (!trimmed) return trimmed;
  const first = trimmed.slice(0, 1).toLocaleLowerCase(locale);
  return first + trimmed.slice(1);
}

function baseNameForLabel(name) {
  // If a name contains a slash variant ("X / Y"), keep the first part by default.
  return String(name || '').split('/')[0].trim();
}

function frenchDePrefix(word) {
  const w = String(word || '').trim().toLocaleLowerCase('fr-FR');
  if (!w) return 'R\u00eaver de ';
  // Vowel or h => d'
  if (/^[aeiouy\u00e0\u00e2\u00e4\u00e6\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f6\u00f9\u00fb\u00fc\u0153h]/i.test(w)) {
    return "R\u00eaver d'";
  }
  return 'R\u00eaver de ';
}

function labelForSymbol(symbol, symbolId, lang) {
  const override = OVERRIDE_LABELS[symbolId]?.[lang];
  if (override) return override;

  const name = baseNameForLabel(symbol?.[lang]?.name);
  if (lang === 'en') return `${name} Dream Meaning`;

  if (lang === 'fr') {
    const nameLower = capFirstLower(name, 'fr-FR');
    const prefix = frenchDePrefix(nameLower);
    return `${prefix}${nameLower}`;
  }

  // es
  const nameLower = capFirstLower(name, 'es-ES');
  return `So\u00f1ar con ${nameLower}`;
}

function relatedSectionHtml({ lang, links }) {
  // Keep fixed strings as ASCII with escapes.
  const strings = {
    en: {
      aria: 'Related dream symbols',
      h2: 'Explore Related Symbols',
      p: 'Dive deeper into the symbols from this article:'
    },
    fr: {
      aria: 'Symboles de r\u00eaves associ\u00e9s',
      h2: 'Symboles associ\u00e9s',
      p: 'Explorez les symboles mentionn\u00e9s dans cet article :'
    },
    es: {
      aria: 'S\u00edmbolos de sue\u00f1os relacionados',
      h2: 'S\u00edmbolos relacionados',
      p: 'Explora los s\u00edmbolos mencionados en este art\u00edculo:'
    }
  };

  const t = strings[lang];
  const linksHtml = links
    .map(({ href, label }) => {
      return `                    <a href="${href}" class="inline-flex items-center gap-2 px-4 py-2 glass-button rounded-full text-sm hover:text-dream-salmon transition-colors">${label}</a>`;
    })
    .join('\n');

  return [
    '',
    '            <!-- Related Symbols Start -->',
    `            <section class="mt-12 mb-8" aria-label="${t.aria}">`,
    '                <h2 class="font-serif text-xl mb-4 text-dream-cream flex items-center gap-2">',
    '                    <i data-lucide="book-open" class="w-5 h-5 text-dream-salmon"></i>',
    `                    ${t.h2}`,
    '                </h2>',
    `                <p class="text-sm text-purple-300/60 mb-4">${t.p}</p>`,
    '                <div class="flex flex-wrap gap-3">',
    linksHtml,
    '                </div>',
    '            </section>',
    '            <!-- Related Symbols End -->',
    ''
  ].join('\n');
}

function main() {
  if (!fs.existsSync(DREAM_SYMBOLS_PATH)) {
    console.error(`Missing ${DREAM_SYMBOLS_PATH}`);
    process.exit(1);
  }

  const { symbols } = readJsonOrThrow(DREAM_SYMBOLS_PATH);
  const byId = new Map(symbols.map(s => [s.id, s]));

  const allTargets = Object.entries(MAPPING).flatMap(([lang, files]) =>
    Object.keys(files).map(f => ({ lang, relPath: f, symbolIds: files[f] }))
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const t of allTargets) {
    const absPath = path.join(DOCS_ROOT, t.relPath);
    if (!fs.existsSync(absPath)) {
      console.error(`❌ Missing file: ${t.relPath}`);
      errors++;
      continue;
    }

    let html = fs.readFileSync(absPath, 'utf8');

    if (html.includes(RELATED_MARKER)) {
      console.log(`ℹ️  Skip (already has related symbols): ${t.relPath}`);
      skipped++;
      continue;
    }

    // Resolve symbols and links.
    const seg = PATH_SEGMENT[t.lang];
    const links = [];

    for (const symbolId of t.symbolIds) {
      const symbol = byId.get(symbolId);
      if (!symbol) {
        console.error(`❌ Unknown symbol id "${symbolId}" referenced in mapping for ${t.relPath}`);
        errors++;
        continue;
      }

      const slug = symbol?.[t.lang]?.slug;
      if (!slug) {
        console.error(`❌ Missing slug for symbol "${symbolId}" in lang "${t.lang}" (${t.relPath})`);
        errors++;
        continue;
      }

      links.push({
        href: `../${seg}/${slug}`,
        label: labelForSymbol(symbol, symbolId, t.lang)
      });
    }

    if (links.length !== t.symbolIds.length) {
      // Already counted errors above.
      continue;
    }

    const block = relatedSectionHtml({ lang: t.lang, links });

    let inserted = false;
    const navIdx = html.indexOf(BLOG_NAV_MARKER);
    if (navIdx !== -1) {
      html = html.slice(0, navIdx) + block + html.slice(navIdx);
      inserted = true;
    } else {
      const articleCloseIdx = html.lastIndexOf('</article>');
      if (articleCloseIdx !== -1) {
        html = html.slice(0, articleCloseIdx) + block + html.slice(articleCloseIdx);
        inserted = true;
      }
    }

    if (!inserted) {
      console.error(`❌ Could not find insertion point in ${t.relPath} (missing markers)`);
      errors++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would update: ${t.relPath}`);
    } else {
      fs.writeFileSync(absPath, html, 'utf8');
      console.log(`✅ Updated: ${t.relPath}`);
    }

    updated++;
  }

  console.log(`\nDone. ${DRY_RUN ? 'Would update' : 'Updated'} ${updated} files. Skipped ${skipped}. Errors ${errors}.`);
  if (errors > 0) process.exit(1);
}

main();

