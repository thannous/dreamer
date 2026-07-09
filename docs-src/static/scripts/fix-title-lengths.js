#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.resolve(__dirname, '..');

const LANGUAGES = ['en', 'fr', 'es', 'de', 'it'];
const SYMBOLS_PATH = {
  en: 'symbols',
  fr: 'symboles',
  es: 'simbolos',
  de: 'traumsymbole',
  it: 'simboli'
};

const CURATION_META_TITLE_OVERRIDES = {
  'most-common-dream-symbols': {
    fr: '20 symboles de rêves courants'
  },
  'scary-dream-symbols': {
    fr: 'Symboles de rêves effrayants',
    es: 'Símbolos de sueños aterradores',
    de: 'Angsteinflößende Traumsymbole',
    it: 'Simboli dei sogni spaventosi'
  },
  'positive-dream-symbols': {
    fr: 'Symboles de rêves positifs',
    es: 'Símbolos de sueños positivos',
    de: 'Positive Traumsymbole',
    it: 'Simboli dei sogni positivi'
  },
  'animal-dream-symbols': {
    fr: "Symboles de rêves d'animaux",
    es: 'Símbolos de sueños con animales',
    it: 'Simboli dei sogni con animali'
  },
  'water-dream-symbols': {
    fr: "Symboles de rêves d'eau",
    es: 'Símbolos de sueños con agua',
    it: 'Simboli dei sogni con acqua'
  },
  'death-transformation-dreams': {
    en: 'Death & Transformation in Dreams',
    fr: 'Mort et transformation dans les rêves',
    es: 'Muerte y transformación en los sueños',
    de: 'Tod und Verwandlung in Träumen',
    it: 'Morte e trasformazione nei sogni'
  },
  'people-in-dreams': {
    fr: 'Les personnes dans les rêves',
    de: 'Menschen in Träumen'
  },
  'dream-locations': {
    fr: 'Les lieux dans les rêves',
    es: 'Lugares en los sueños: significado',
    it: 'Luoghi nei sogni: significato'
  }
};

const BLOG_TITLE_OVERRIDES = {
  'de/blog/bedeutung-von-fallenden-traeumen-warum-sie-vom-fallen-traeumen.html': 'Fallende Träume: Bedeutung und Deutung',
  'de/blog/dream-journaling-der-vollstaendige-leitfaden-zum-aufzeichnen-ihrer-naechtlichen-abenteuer.html': 'Traumtagebuch: Leitfaden für den Einstieg',
  'de/blog/schwangerschaftstraeume-was-sie-bedeuten-auch-wenn-sie-nicht-schwanger-sind.html': 'Schwangerschaftsträume: Bedeutung und Ursachen',
  'de/blog/traeume-ueber-deinen-ex-was-sie-wirklich-bedeuten.html': 'Ex-Träume: Bedeutung und Deutung',
  'de/blog/traeume-und-psychische-gesundheit-wie-ihr-schlaf-ihren-geist-offenbart.html': 'Träume und psychische Gesundheit',
  'de/blog/warum-traeumen-wir-die-wissenschaft-hinter-ihren-naechtlichen-abenteuern.html': 'Warum träumen wir? Die Wissenschaft erklärt',
  'de/blog/wassertraeume-bedeutung-von-ertrinkungs-ozean-und-ueberschwemmungstraeumen.html': 'Wasserträume: Bedeutung und Deutung',
  'it/blog/perche-sogniamo-la-scienza-dietro-le-tue-avventure-notturne.html': 'Perché sogniamo? La scienza spiegata',
  'it/blog/sogni-acquatici-significato-dei-sogni-di-annegamento-oceano-e-inondazione.html': "Sogni d'acqua: significato e simbolismo"
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(DOCS_ROOT, relativePath), 'utf8'));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceTitleTag(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)} | Noctalia</title>`);
}

function replaceMetaContent(html, attrName, attrValue, content) {
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attrName}="${escapeRegExp(attrValue)}")[^>]*>`, 'i');
  return html.replace(matcher, (tag) => {
    if (!/content="/i.test(tag)) return tag;
    return tag.replace(/content="[^"]*"/i, `content="${escapeHtml(content)}"`);
  });
}

function updateHeadTitles(filePath, title, options = {}) {
  if (!fs.existsSync(filePath)) return false;

  const html = fs.readFileSync(filePath, 'utf8');
  let next = replaceTitleTag(html, title);

  next = replaceMetaContent(next, 'property', 'og:title', title);
  next = replaceMetaContent(next, 'name', 'twitter:title', title);

  if (options.updateImageAlts) {
    next = replaceMetaContent(next, 'property', 'og:image:alt', title);
    next = replaceMetaContent(next, 'name', 'twitter:image:alt', title);
  }

  if (next === html) return false;
  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

function applySymbolTitleFixes() {
  const symbols = readJson('data/dream-symbols.json').symbols;
  const i18n = readJson('data/symbol-i18n.json');
  let updated = 0;

  for (const symbol of symbols) {
    for (const lang of LANGUAGES) {
      if (!symbol[lang]?.slug || !symbol[lang]?.name) continue;
      const metaTitleLabel = symbol[lang].seoTitle || symbol[lang].name;
      const metaTitle = i18n[lang].meta_title_template.replace(/{symbol}/g, metaTitleLabel);
      const filePath = path.join(DOCS_ROOT, lang, SYMBOLS_PATH[lang], `${symbol[lang].slug}.html`);
      if (updateHeadTitles(filePath, metaTitle, { updateImageAlts: true })) {
        updated++;
      }
    }
  }

  return updated;
}

function applyGuideTitleFixes() {
  const curationPages = readJson('data/curation-pages.json').pages;
  let updated = 0;

  for (const page of curationPages) {
    const overrides = CURATION_META_TITLE_OVERRIDES[page.id];
    if (!overrides) continue;

    for (const lang of Object.keys(overrides)) {
      const slug = page.slugs?.[lang];
      if (!slug) continue;
      const filePath = path.join(DOCS_ROOT, lang, 'guides', `${slug}.html`);
      if (updateHeadTitles(filePath, overrides[lang], { updateImageAlts: true })) {
        updated++;
      }
    }
  }

  return updated;
}

function applyBlogTitleFixes() {
  let updated = 0;

  for (const [relativePath, title] of Object.entries(BLOG_TITLE_OVERRIDES)) {
    const filePath = path.join(DOCS_ROOT, relativePath);
    if (updateHeadTitles(filePath, title)) {
      updated++;
    }
  }

  return updated;
}

function main() {
  const symbolsUpdated = applySymbolTitleFixes();
  const guidesUpdated = applyGuideTitleFixes();
  const blogsUpdated = applyBlogTitleFixes();

  console.log(`Updated symbol pages: ${symbolsUpdated}`);
  console.log(`Updated guide pages: ${guidesUpdated}`);
  console.log(`Updated blog pages: ${blogsUpdated}`);
}

main();
