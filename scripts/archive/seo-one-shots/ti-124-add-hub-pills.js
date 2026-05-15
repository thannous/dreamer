/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');

function readFileSafe(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeFileSafe(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function insertHubPill({ content, hubSlug, hubLabel }) {
  if (content.includes(`href="${hubSlug}"`)) return { content, modified: false };

  const headerMarker = '<header class="mb-12">';
  const metaRowMarker = '<div class="flex items-center gap-3 mb-6">';

  const headerIndex = content.indexOf(headerMarker);
  if (headerIndex === -1) return { content, modified: false };

  const metaRowIndex = content.indexOf(metaRowMarker, headerIndex);
  if (metaRowIndex === -1) return { content, modified: false };

  const afterMetaRow = metaRowIndex + metaRowMarker.length;
  const firstSpanClose = content.indexOf('</span>', afterMetaRow);
  if (firstSpanClose === -1) return { content, modified: false };

  const insertAt = firstSpanClose + '</span>'.length;

  const pill =
    `\n                    <a href="${hubSlug}" class="text-xs font-mono text-purple-200/70 border border-white/10 rounded-full px-3 py-1 hover:text-white hover:border-dream-salmon/30 transition-colors">${hubLabel}</a>`;

  const nextContent = content.slice(0, insertAt) + pill + content.slice(insertAt);
  return { content: nextContent, modified: true };
}

function updateFile({ lang, slug, hubSlug, hubLabel }) {
  const absPath = path.join(DOCS_DIR, lang, 'blog', `${slug}.html`);
  if (!fs.existsSync(absPath)) return false;

  const raw = readFileSafe(absPath);
  const res = insertHubPill({ content: raw, hubSlug, hubLabel });
  if (!res.modified) return false;

  writeFileSafe(absPath, res.content);
  console.log(`Updated ${lang}/blog/${slug}.html -> ${hubSlug}`);
  return true;
}

function main() {
  const silos = [
    {
      lang: 'fr',
      hubSlug: 'reve-lucide',
      hubLabel: 'Thématique : Rêve lucide',
      slugs: ['guide-reve-lucide-debutant', 'guide-incubation-reves', 'guide-paralysie-sommeil'],
    },
    {
      lang: 'fr',
      hubSlug: 'journal-de-reves',
      hubLabel: 'Thématique : Journal de rêves',
      slugs: [
        'guide-journal-reves',
        'comment-se-souvenir-de-ses-reves',
        'pourquoi-oublie-reves-reveil',
        'pourquoi-nous-revons-science',
        'sommeil-paradoxal-reves',
      ],
    },
    {
      lang: 'fr',
      hubSlug: 'signification-des-reves',
      hubLabel: 'Thématique : Signification des rêves',
      slugs: [
        'guide-cauchemars',
        'histoire-interpretation-reves',
        'reves-de-chute',
        'reves-de-grossesse',
        'reves-de-mort',
        'reves-de-serpents',
        'reves-de-voler',
        'reves-dents-qui-tombent',
        'reves-eau',
        'reves-etre-poursuivi',
        'reves-ex-partenaire',
        'reves-premonitoires-science',
        'reves-sante-mentale',
        'signification-reves-recurrents',
      ],
    },
    {
      lang: 'en',
      hubSlug: 'lucid-dreaming',
      hubLabel: 'Topic: Lucid dreaming',
      slugs: ['lucid-dreaming-beginners-guide', 'dream-incubation-guide', 'sleep-paralysis-guide'],
    },
    {
      lang: 'en',
      hubSlug: 'dream-journal',
      hubLabel: 'Topic: Dream journaling',
      slugs: ['dream-journal-guide', 'how-to-remember-dreams', 'why-we-forget-dreams', 'why-we-dream-science', 'rem-sleep-dreams'],
    },
    {
      lang: 'en',
      hubSlug: 'dream-meanings',
      hubLabel: 'Topic: Dream meanings',
      slugs: [
        'dream-interpretation-history',
        'recurring-dreams-meaning',
        'falling-dreams-meaning',
        'flying-dreams-meaning',
        'teeth-falling-out-dreams',
        'snake-dreams-meaning',
        'being-chased-dreams',
        'death-dreams-meaning',
        'water-dreams-meaning',
        'dreams-about-ex',
        'pregnancy-dreams-meaning',
        'precognitive-dreams-science',
        'dreams-mental-health',
        'stop-nightmares-guide',
      ],
    },
    {
      lang: 'es',
      hubSlug: 'suenos-lucidos',
      hubLabel: 'Tema: Sueños lúcidos',
      slugs: ['guia-suenos-lucidos-principiantes', 'guia-incubacion-suenos', 'guia-paralisis-sueno'],
    },
    {
      lang: 'es',
      hubSlug: 'diario-de-suenos',
      hubLabel: 'Tema: Diario de sueños',
      slugs: ['guia-diario-suenos', 'como-recordar-suenos', 'por-que-olvidamos-suenos', 'por-que-sonamos-ciencia', 'sueno-rem-suenos'],
    },
    {
      lang: 'es',
      hubSlug: 'significado-de-suenos',
      hubLabel: 'Tema: Significado de sueños',
      slugs: [
        'historia-interpretacion-suenos',
        'significado-suenos-recurrentes',
        'suenos-de-caer',
        'suenos-de-volar',
        'suenos-dientes-caen',
        'suenos-con-serpientes',
        'suenos-ser-perseguido',
        'suenos-de-muerte',
        'suenos-de-agua',
        'suenos-con-ex',
        'suenos-de-embarazo',
        'suenos-premonitorios-ciencia',
        'suenos-salud-mental',
        'guia-pesadillas',
      ],
    },
  ];

  let updated = 0;
  for (const silo of silos) {
    for (const slug of silo.slugs) {
      if (updateFile({ lang: silo.lang, slug, hubSlug: silo.hubSlug, hubLabel: silo.hubLabel })) updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} file(s).`);
}

main();

