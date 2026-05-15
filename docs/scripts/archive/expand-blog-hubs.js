#!/usr/bin/env node
/**
 * Expand blog topic hubs (CollectionPage) that are below the content depth threshold.
 *
 * Targets pages like:
 * - en/blog/lucid-dreaming.html
 * - fr/blog/reve-lucide.html
 *
 * Usage:
 *   node scripts/expand-blog-hubs.js
 *   node scripts/expand-blog-hubs.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2).reduce((acc, raw) => {
  const arg = raw.startsWith('--') ? raw.slice(2) : raw;
  const [key, value] = arg.split('=');
  acc[key] = value === undefined ? true : value;
  return acc;
}, {});

const DRY_RUN = !!args['dry-run'];

function walkBlogHubFiles() {
  const langs = ['en', 'fr', 'es', 'de', 'it'];
  const out = [];
  for (const lang of langs) {
    const dir = path.join(DOCS_ROOT, lang, 'blog');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.html')) continue;
      if (f === 'index.html') continue;
      out.push(path.join(dir, f));
    }
  }
  return out;
}

function extractHtmlLang(html) {
  const m = html.match(/<html\s+[^>]*lang=["']([^"']+)["'][^>]*>/i);
  return m ? m[1] : null;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isCollectionPageHub(html) {
  return /"@type"\s*:\s*"CollectionPage"/.test(html);
}

function hasMarker(html) {
  return /data-blog-hub-expanded=["']true["']/.test(html);
}

function buildSection(lang) {
  const content = {
    en: {
      title: 'Quick start',
      p1: 'If you are new to this topic, focus on one small habit for a week. Consistency matters more than doing everything at once.',
      p2: 'Start with recall, then add one practice. Keep notes simple: what you saw, how you felt, and what changed during the dream.',
      bullets: ['Pick one guide from the list below.', 'Try it for 7 nights.', 'Review your notes and adjust.']
    },
    fr: {
      title: 'Bien commencer',
      p1: "Si vous débutez, choisissez une seule habitude pendant une semaine. La régularité compte plus que tout faire d'un coup.",
      p2: 'Commencez par le rappel des rêves, puis ajoutez une seule pratique. Notez simplement ce que vous avez vu, ce que vous avez ressenti et ce qui a changé dans le rêve.',
      bullets: ["Choisissez un guide ci-dessous.", 'Testez pendant 7 nuits.', 'Relisez vos notes et ajustez.']
    },
    es: {
      title: 'Para empezar',
      p1: 'Si eres principiante, elige un hábito pequeño durante una semana. La constancia importa más que hacerlo todo a la vez.',
      p2: 'Empieza con el recuerdo y luego añade una práctica. Anota lo básico: qué viste, qué sentiste y qué cambió en el sueño.',
      bullets: ['Elige una guía de la lista.', 'Pruébala durante 7 noches.', 'Revisa tus notas y ajusta.']
    },
    de: {
      title: 'Schnellstart',
      p1: 'Wenn du neu bist, konzentriere dich eine Woche lang auf eine kleine Gewohnheit. Regelmäßigkeit ist wichtiger als alles auf einmal.',
      p2: 'Beginne mit der Traumerinnerung und füge dann eine Übung hinzu. Notiere kurz, was du gesehen hast, was du gefühlt hast und was sich im Traum verändert hat.',
      bullets: ['Wähle eine Anleitung aus der Liste.', 'Probiere sie 7 Nächte lang.', 'Lies deine Notizen und passe an.']
    },
    it: {
      title: 'Per iniziare',
      p1: 'Se sei all’inizio, scegli una piccola abitudine per una settimana. La costanza conta più che fare tutto insieme.',
      p2: 'Parti dal ricordo dei sogni e poi aggiungi una pratica. Scrivi l’essenziale: cosa hai visto, cosa hai provato e cosa è cambiato nel sogno.',
      bullets: ['Scegli una guida dalla lista.', 'Provala per 7 notti.', 'Rileggi le note e aggiusta.']
    }
  };

  const c = content[lang] || content.en;
  const bullets = (c.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('');

  return `
<section class="glass-panel rounded-2xl p-6 md:p-8 mt-10 border border-dream-salmon/10" data-blog-hub-expanded="true">
  <h2 class="font-serif text-2xl text-dream-cream mb-4">${escapeHtml(c.title)}</h2>
  <div class="prose prose-invert prose-purple max-w-none text-gray-300 leading-relaxed space-y-4">
    <p>${escapeHtml(c.p1)}</p>
    <p>${escapeHtml(c.p2)}</p>
    <ul>${bullets}</ul>
  </div>
</section>
`;
}

function main() {
  const files = walkBlogHubFiles();
  let changed = 0;

  for (const abs of files) {
    const html = fs.readFileSync(abs, 'utf8');
    if (!isCollectionPageHub(html)) continue;
    if (hasMarker(html)) continue;

    const lang = extractHtmlLang(html) || path.relative(DOCS_ROOT, abs).split(path.sep)[0] || 'en';

    const headerClose = html.indexOf('</header>');
    if (headerClose === -1) continue;

    const insertAt = headerClose + '</header>'.length;
    const section = buildSection(lang);
    const next = html.slice(0, insertAt) + section + html.slice(insertAt);

    if (!DRY_RUN) fs.writeFileSync(abs, next, 'utf8');
    changed += 1;
  }

  console.log(`${DRY_RUN ? 'Dry-run' : 'Expanded'} blog hubs`);
  console.log(`- Changed: ${changed}`);
}

main();

