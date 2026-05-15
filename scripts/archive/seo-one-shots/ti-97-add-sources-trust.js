#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * TI-97 P0 — Sources & "trust"
 *
 * Adds to each blog article page:
 * - a "Sources / Further reading" section + last-updated date
 * - article:modified_time meta
 * - JSON-LD dateModified update
 *
 * This script is intentionally dependency-free (string-based HTML edits).
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const UPDATED_ISO = '2025-12-26';

function formatUpdatedDate(lang) {
  const localesByLang = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };
  const formatter = new Intl.DateTimeFormat(localesByLang[lang] ?? 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return formatter.format(new Date(`${UPDATED_ISO}T00:00:00Z`));
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function uniqueByUrl(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

function getLanguageFromPath(filePath) {
  const parts = filePath.split(path.sep);
  const lang = parts[0];
  if (lang === 'fr' || lang === 'en' || lang === 'es') return lang;
  return null;
}

function getSlugFromPath(filePath) {
  const base = path.basename(filePath);
  return base.replace(/\.html$/i, '');
}

function getCategoriesForSlug(slug) {
  const categories = new Set();

  categories.add('dreamResearchBasics');

  if (/rem|sommeil-paradoxal|sueno-rem/.test(slug)) categories.add('remSleep');
  if (/paralysis|paralysie|paralisis/.test(slug)) categories.add('sleepParalysis');
  if (/nightmares|cauchemars|pesadillas/.test(slug)) categories.add('nightmares');
  if (/mental-health|sante-mentale|salud-mental/.test(slug)) categories.add('mentalHealth');
  if (/remember|souvenir|recordar/.test(slug)) categories.add('dreamRecall');
  if (/lucid|lucide|lucidos/.test(slug)) categories.add('lucidDreaming');
  if (/dream-journal|journal-reves|diario-suenos|diario/.test(slug)) categories.add('dreamJournal');
  if (/incubation|incubacion/.test(slug)) categories.add('dreamIncubation');
  if (/history|histoire|historia/.test(slug)) categories.add('history');
  if (/precognitive|premonitoires|premonitorios/.test(slug)) categories.add('precognitive');

  if (
    /being-chased|etre-poursuivi|ser-perseguido|falling|de-chute|de-caer|flying|de-voler|de-volar|teeth|dents|dientes|water|eau|agua|snake|serpents|serpientes|death|mort|muerte|pregnancy|grossesse|embarazo|recurring|recurrents|recurrentes|dreams-about-ex|ex-partenaire|con-ex/.test(
      slug,
    )
  ) {
    categories.add('typicalDreamThemes');
  }

  return categories;
}

const SOURCES = {
  dreamResearchBasics: [
    { title: 'APA Dictionary of Psychology — Dream', url: 'https://dictionary.apa.org/dream' },
    {
      title: 'Nielsen (2010) — Dream analysis and classification (review, PubMed)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/20416888/',
    },
    {
      title: 'DreamResearch.net — G. William Domhoff (dream research overview)',
      url: 'https://dreamresearch.net/',
    },
  ],
  typicalDreamThemes: [
    {
      title: 'Schredl (2010) — Frequency of typical dream themes (PubMed)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/20620045/',
    },
    {
      title: 'Nielsen et al. (2003) — Typical dreams and common themes (PubMed)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/12927121/',
    },
  ],
  remSleep: [
    {
      title:
        'Aserinsky & Kleitman (1953) — Discovery of REM sleep (Science, PubMed abstract)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/13089671/',
    },
    { title: 'AASM Sleep Education — Sleep stages', url: 'https://sleepeducation.org/sleep-stages/' },
    {
      title: 'NINDS — Brain Basics: Understanding Sleep',
      url: 'https://www.ninds.nih.gov/health-information/public-education/brain-basics/brain-basics-understanding-sleep',
    },
  ],
  sleepParalysis: [
    {
      title: 'Mayo Clinic — Sleep paralysis (symptoms & causes)',
      url: 'https://www.mayoclinic.org/diseases-conditions/sleep-paralysis/symptoms-causes/syc-20352606',
    },
    {
      title: 'Sharpless & Barber (2011) — Sleep paralysis prevalence (PubMed)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/21411265/',
    },
    {
      title: 'Sleep Foundation — Sleep paralysis overview',
      url: 'https://www.sleepfoundation.org/parasomnias/sleep-paralysis',
    },
  ],
  nightmares: [
    {
      title: 'AASM Sleep Education — Nightmares',
      url: 'https://sleepeducation.org/sleep-disorders/nightmares/',
    },
    {
      title: 'Mayo Clinic — Nightmare disorder',
      url: 'https://www.mayoclinic.org/diseases-conditions/nightmare/symptoms-causes/syc-20353515',
    },
    {
      title: 'VA National Center for PTSD — Nightmares',
      url: 'https://www.ptsd.va.gov/understand/related/nightmares.asp',
    },
  ],
  mentalHealth: [
    {
      title: 'NIMH — Mental Health Information',
      url: 'https://www.nimh.nih.gov/health',
    },
    {
      title: 'WHO — Mental health (fact sheets)',
      url: 'https://www.who.int/health-topics/mental-health',
    },
    {
      title: 'VA National Center for PTSD — Nightmares',
      url: 'https://www.ptsd.va.gov/understand/related/nightmares.asp',
    },
  ],
  dreamRecall: [
    { title: 'Sleep Foundation — Dream recall', url: 'https://www.sleepfoundation.org/dreams/dream-recall' },
    { title: 'AASM Sleep Education — Sleep stages', url: 'https://sleepeducation.org/sleep-stages/' },
  ],
  lucidDreaming: [
    {
      title:
        'Voss et al. (2009) — Lucid dreaming as a hybrid state (Sleep, PubMed)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/19750924/',
    },
    {
      title: 'LaBerge (1985) — Lucid dreaming research (overview)',
      url: 'https://www.lucidity.com/',
    },
    {
      title: 'Sleep Foundation — Lucid dreaming',
      url: 'https://www.sleepfoundation.org/dreams/lucid-dreaming',
    },
  ],
  dreamJournal: [
    {
      title: 'APA Dictionary — Memory',
      url: 'https://dictionary.apa.org/memory',
    },
    { title: 'Sleep Foundation — Dream recall', url: 'https://www.sleepfoundation.org/dreams/dream-recall' },
  ],
  dreamIncubation: [
    {
      title: 'Sleep Foundation — Lucid dreaming (techniques & safety)',
      url: 'https://www.sleepfoundation.org/dreams/lucid-dreaming',
    },
    {
      title:
        'Krakow et al. (2001) — Imagery Rehearsal Therapy for nightmares (PubMed)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/11384503/',
    },
  ],
  history: [
    {
      title: 'Britannica — Dream',
      url: 'https://www.britannica.com/science/dream-psychology',
    },
    {
      title: 'Freud (1900) — The Interpretation of Dreams (public domain)',
      url: 'https://www.gutenberg.org/ebooks/15489',
    },
  ],
  precognitive: [
    {
      title: 'APA Dictionary — Confirmation bias',
      url: 'https://dictionary.apa.org/confirmation-bias',
    },
    {
      title: 'APA Dictionary — Apophenia',
      url: 'https://dictionary.apa.org/apophenia',
    },
    {
      title: 'Stanford Encyclopedia of Philosophy — Philosophy of cognitive biases (overview)',
      url: 'https://plato.stanford.edu/entries/confirmation-bias/',
    },
  ],
};

function buildSourcesForSlug(slug) {
  const categories = getCategoriesForSlug(slug);
  const sources = [];
  for (const category of categories) {
    sources.push(...(SOURCES[category] ?? []));
  }
  return uniqueByUrl(sources);
}

function buildSectionHtml({ lang, slug }) {
  const updatedDisplay = formatUpdatedDate(lang);

  const titles = {
    fr: 'Sources / Pour aller plus loin',
    en: 'Sources / Further Reading',
    es: 'Fuentes / Para Ir Más Lejos',
  };

  const updatedLabels = {
    fr: `Mis à jour le ${updatedDisplay}`,
    en: `Last updated: ${updatedDisplay}`,
    es: `Actualizado el ${updatedDisplay}`,
  };

  const sources = buildSourcesForSlug(slug);
  const sourcesList = sources
    .map(
      (s) =>
        `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          s.title,
        )}</a></li>`,
    )
    .join('\n                    ');

  return `
            <!-- Sources / Trust (TI-97) -->
            <section class="mt-16 glass-panel rounded-2xl p-6" id="sources">
                <h2 class="font-serif text-2xl text-dream-cream mb-4">${titles[lang] ?? titles.en}</h2>
                <ul class="mt-6 space-y-2 text-sm text-gray-400">
                    ${sourcesList}
                </ul>
                <p class="mt-6 text-xs text-purple-200/60">${updatedLabels[lang] ?? updatedLabels.en}</p>
            </section>
`;
}

function ensureArticleModifiedMeta(html) {
  if (/article:modified_time/i.test(html)) return html;
  return html.replace(
    /(<meta\s+property=(["'])article:published_time\2\s+content=(["'])\d{4}-\d{2}-\d{2}\3\s*>\s*\r?\n)/i,
    `$1    <meta property="article:modified_time" content="${UPDATED_ISO}">\n`,
  );
}

function updateJsonLdDateModified(html) {
  return html.replace(/("dateModified"\s*:\s*")\d{4}-\d{2}-\d{2}(")/, `$1${UPDATED_ISO}$2`);
}

function injectSourcesSection(html, { lang, slug }) {
  const sectionHtml = buildSectionHtml({ lang, slug });

  // If a TI-97 sources block already exists, replace it in-place so the script is idempotent.
  const blockStart = '<!-- Sources / Trust (TI-97) -->';
  const existingIdx = html.indexOf(blockStart);
  if (existingIdx !== -1) {
    const afterStart = existingIdx + blockStart.length;
    const endCandidates = [];

    const commentMarker = '<!-- Related Articles -->';
    const nextComment = html.indexOf(commentMarker, afterStart);
    if (nextComment !== -1) endCandidates.push(nextComment);

    const relatedSections = [
      /(\n\s*<section[^>]*class=(["'])mt-16\2[^>]*>\s*\n\s*<h2[^>]*>\s*Articles Connexes\s*<\/h2>)/i,
      /(\n\s*<section[^>]*class=(["'])mt-16\2[^>]*>\s*\n\s*<h2[^>]*>\s*Related Articles\s*<\/h2>)/i,
      /(\n\s*<section[^>]*class=(["'])mt-16\2[^>]*>\s*\n\s*<h2[^>]*>\s*Art[ií]culos Relacionados\s*<\/h2>)/i,
    ];
    for (const re of relatedSections) {
      const m = html.slice(afterStart).match(re);
      if (m?.index != null) endCandidates.push(afterStart + m.index);
    }

    const articleEndIdx = html.indexOf('</article>', afterStart);
    if (articleEndIdx !== -1) endCandidates.push(articleEndIdx);

    const end = endCandidates.length ? Math.min(...endCandidates) : -1;
    if (end === -1) throw new Error(`[inject] Unable to find end of TI-97 block for slug=${slug}`);

    const tail = html.slice(end).replace(/^(?:\s*\r?\n)+/, '\n');
    return html.slice(0, existingIdx).replace(/\s*$/, '') + sectionHtml + tail;
  }

  const commentMarker = '<!-- Related Articles -->';
  if (html.includes(commentMarker)) {
    return html.replace(commentMarker, `${sectionHtml}\n            ${commentMarker}`);
  }

  const fallbackByLang = {
    fr: /(\n\s*<section[^>]*class=(["'])mt-16\2[^>]*>\s*\n\s*<h2[^>]*>\s*Articles Connexes\s*<\/h2>)/i,
    en: /(\n\s*<section[^>]*class=(["'])mt-16\2[^>]*>\s*\n\s*<h2[^>]*>\s*Related Articles\s*<\/h2>)/i,
    es: /(\n\s*<section[^>]*class=(["'])mt-16\2[^>]*>\s*\n\s*<h2[^>]*>\s*Art[ií]culos Relacionados\s*<\/h2>)/i,
  };

  const fallback = fallbackByLang[lang] ?? fallbackByLang.en;
  if (fallback.test(html)) {
    return html.replace(fallback, `${sectionHtml}$1`);
  }

  // Last resort: inject before closing article.
  const articleEnd = /\n\s*<\/article>\s*\n/i;
  if (!articleEnd.test(html)) {
    throw new Error(`[inject] Missing injection point for slug=${slug}`);
  }
  return html.replace(articleEnd, `${sectionHtml}\n$&`);
}

function findBlogArticleFiles() {
  const langs = ['fr', 'en', 'es'];
  const out = [];
  for (const lang of langs) {
    const dir = path.join(DOCS_DIR, lang, 'blog');
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.html')) continue;
      if (entry === 'index.html') continue;
      out.push(path.join(lang, 'blog', entry));
    }
  }
  return out.sort();
}

function main() {
  const files = findBlogArticleFiles();
  const changed = [];

  for (const relPath of files) {
    const absPath = path.join(DOCS_DIR, relPath);
    const lang = getLanguageFromPath(relPath);
    const slug = getSlugFromPath(relPath);
    const original = fs.readFileSync(absPath, 'utf8');

    let next = original;
    next = ensureArticleModifiedMeta(next);
    next = updateJsonLdDateModified(next);
    next = injectSourcesSection(next, { lang, slug });

    if (next !== original) {
      fs.writeFileSync(absPath, next, 'utf8');
      changed.push(relPath);
    }
  }

  if (!changed.length) {
    console.log('No changes needed.');
    return;
  }

  console.log(`Updated ${changed.length} file(s):`);
  for (const file of changed) console.log(`- ${file}`);
}

main();
