#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { SUPPORTED_LANGS, extractTitleTag, matchLineEndings } = require('./lib/docs-seo-utils');

const ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const DATA_DIR = path.join(DOCS_DIR, 'data');
const ROOT_DATA_DIR = path.join(ROOT, 'data');
const DOCS_SRC_DIR = path.join(ROOT, 'docs-src');
const DOMAIN = 'https://noctalia.app';
const DRY_RUN = process.argv.includes('--dry-run');

const SITE_CONFIG = fs.existsSync(path.join(DOCS_SRC_DIR, 'config', 'site.config.json'))
  ? JSON.parse(fs.readFileSync(path.join(DOCS_SRC_DIR, 'config', 'site.config.json'), 'utf8'))
  : { seoLinking: { featuredBlogEntries: [], featuredGuideEntries: [], featuredSymbols: [] } };

const LOCALES = Object.fromEntries(
  SUPPORTED_LANGS.map((lang) => {
    const localePath = path.join(DOCS_SRC_DIR, 'locales', `${lang}.json`);
    return [lang, fs.existsSync(localePath) ? JSON.parse(fs.readFileSync(localePath, 'utf8')) : {}];
  })
);

const COPY = {
  en: { label: 'Dream Guides', title: 'Dream Guides & Symbol Meanings | Noctalia', desc: "Browse Noctalia's dream guides: the dictionary plus themed pages for common, scary, positive, water, people, places, and transformation dreams.", intro: 'Start with the full dream symbols dictionary, then explore themed guides that group related dream patterns and meanings.', dictionary: 'Dream Symbols Dictionary', openDictionary: 'Open dictionary', openGuide: 'Open guide', browseAll: 'Browse all dream guides' },
  fr: { label: 'Guides des rêves', title: 'Guides des rêves et symboles oniriques | Noctalia', desc: 'Explorez les guides des rêves de Noctalia : dictionnaire des symboles, thèmes fréquents, cauchemars, eau, personnes, lieux et transformation.', intro: 'Commencez par le dictionnaire complet des symboles, puis explorez des guides thématiques qui regroupent des motifs oniriques proches.', dictionary: 'Dictionnaire des symboles de rêves', openDictionary: 'Ouvrir le dictionnaire', openGuide: 'Ouvrir le guide', browseAll: 'Parcourir tous les guides des rêves' },
  es: { label: 'Guías de sueños', title: 'Guías de sueños y significados de símbolos | Noctalia', desc: 'Explora las guías de sueños de Noctalia: diccionario de símbolos, sueños frecuentes, pesadillas, agua, personas, lugares y transformación.', intro: 'Empieza por el diccionario completo de símbolos y luego entra en guías temáticas que agrupan patrones y significados relacionados.', dictionary: 'Diccionario de símbolos de sueños', openDictionary: 'Abrir diccionario', openGuide: 'Abrir guía', browseAll: 'Ver todas las guías de sueños' },
  de: { label: 'Traumratgeber', title: 'Traumratgeber & Traumsymbole | Noctalia', desc: 'Entdecken Sie Noctalias Traumratgeber: Traumsymbole-Lexikon sowie Guides zu häufigen Träumen, Albträumen, Wasser, Personen, Orten und Wandel.', intro: 'Starten Sie mit dem vollständigen Traumsymbole-Lexikon und vertiefen Sie sich dann in thematische Ratgeber zu verwandten Traumthemen.', dictionary: 'Traumsymbole-Lexikon', openDictionary: 'Lexikon öffnen', openGuide: 'Ratgeber öffnen', browseAll: 'Alle Traumratgeber ansehen' },
  it: { label: 'Guide ai sogni', title: 'Guide ai sogni e significati dei simboli | Noctalia', desc: 'Esplora le guide ai sogni di Noctalia: dizionario dei simboli e percorsi su sogni comuni, incubi, acqua, persone, luoghi e trasformazione.', intro: 'Inizia dal dizionario completo dei simboli e poi approfondisci con guide tematiche che raggruppano schemi e significati collegati.', dictionary: 'Dizionario dei simboli dei sogni', openDictionary: 'Apri il dizionario', openGuide: 'Apri la guida', browseAll: 'Sfoglia tutte le guide ai sogni' },
};

const NO_RESULTS_TEXT = {
  en: 'No symbols found for',
  fr: 'Aucun symbole trouv\u00e9 pour',
  es: 'Ning\u00fan s\u00edmbolo encontrado para',
  de: 'Keine Symbole gefunden f\u00fcr',
  it: 'Nessun simbolo trovato per',
};

const HERO_SEARCH_PLACEHOLDERS = {
  en: 'Search a symbol (water, snake, falling\u2026)',
  fr: 'Rechercher un symbole (eau, serpent, chute\u2026)',
  es: 'Buscar un s\u00edmbolo (agua, serpiente, ca\u00edda\u2026)',
  de: 'Symbol suchen (Wasser, Schlange, Fallen\u2026)',
  it: 'Cerca un simbolo (acqua, serpente, caduta\u2026)',
};

const CATEGORY_ORDER = ['nature', 'animals', 'body', 'places', 'objects', 'actions', 'people', 'celestial'];
const CATEGORY_COLORS = { nature: '#4ade80', animals: '#fbbf24', body: '#f87171', places: '#60a5fa', objects: '#c084fc', actions: '#fb923c', people: '#f472b6', celestial: '#818cf8' };
const SYMBOL_PATHS = { en: 'symbols', fr: 'symboles', es: 'simbolos', de: 'traumsymbole', it: 'simboli' };

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), 'utf8'));
}

function readVersion() {
  return fs.readFileSync(path.join(DOCS_DIR, 'version.txt'), 'utf8').trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTitle(title) {
  return String(title || '').replace(/\s*\|\s*Noctalia\s*$/i, '').trim();
}

function stripSiteSuffix(title) {
  return normalizeTitle(title);
}

function renderJsonLd(data) {
  return `    <script type="application/ld+json">\n${JSON.stringify(data, null, 4)
    .replace(/</g, '\\u003c')
    .split('\n')
    .map((line) => `        ${line}`)
    .join('\n')}\n    </script>`;
}

function parseSourceDocument(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  return { meta: JSON.parse(match[1]), body: match[2] };
}

function getAndroidStoreUrl(lang) {
  const base = SITE_CONFIG.storeLinks?.androidBase || 'https://play.google.com/store/apps/details?id=com.tanuki75.noctalia';
  return `${base}&hl=${lang}`;
}

function renderFooterLinkList(links, { highlightFirst = false } = {}) {
  return links
    .map((link, index) => {
      const className = highlightFirst && index === 0
        ? 'text-dream-salmon'
        : 'hover:text-dream-salmon transition-colors';
      return `<li><a href="${link.href}" class="${className}">${escapeHtml(link.label)}</a></li>`;
    })
    .join('');
}

function buildSeoLinkData(lang, t, pages) {
  const blogManifest = JSON.parse(fs.readFileSync(path.join(ROOT_DATA_DIR, 'content-manifest.json'), 'utf8'));
  const blogEntries = blogManifest?.collections?.blog?.entries || {};
  const featuredResources = [
    { href: `/${lang}/blog/`, label: LOCALES[lang].resources || 'Resources' },
    ...((SITE_CONFIG.seoLinking?.featuredBlogEntries || []).map((entryId) => {
      const entry = blogEntries[entryId];
      const sourcePath = path.join(DOCS_SRC_DIR, 'content', 'blog', entryId, `${lang}.md`);
      if (!entry?.locales?.[lang] || !fs.existsSync(sourcePath)) return null;
      const { meta } = parseSourceDocument(fs.readFileSync(sourcePath, 'utf8'));
      return { href: entry.locales[lang].path, label: stripSiteSuffix(meta.title) };
    }).filter(Boolean))
  ];

  const featuredGuides = [
    { href: `/${lang}/guides/${t.dictionary_slug}`, label: LOCALES[lang].dreamDictionary || COPY[lang].dictionary },
    { href: `/${lang}/guides/`, label: COPY[lang].label },
    ...((SITE_CONFIG.seoLinking?.featuredGuideEntries || [])
      .map((entryId) => entryId.replace(/^guide\./, ''))
      .map((pageId) => pages.find((page) => page.id === pageId))
      .filter(Boolean)
      .map((page) => ({ href: `/${lang}/guides/${page.slugs[lang]}`, label: page[lang].title })))
  ];

  const symbolsData = readJson('dream-symbols.json');
  const popularSymbols = (SITE_CONFIG.seoLinking?.featuredSymbols || [])
    .map((symbolId) => (symbolsData.symbols || []).find((symbol) => symbol.id === symbolId))
    .filter(Boolean)
    .map((symbol) => ({ href: `/${lang}/${{ en: 'symbols', fr: 'symboles', es: 'simbolos', de: 'traumsymbole', it: 'simboli' }[lang]}/${symbol[lang].slug}`, label: symbol[lang].name }));

  return { featuredResources, featuredGuides, popularSymbols };
}

function renderLanguageDropdown(lang, currentPaths) {
  const labels = {
    en: { flag: '🇺🇸', name: 'English' },
    fr: { flag: '🇫🇷', name: 'Français' },
    es: { flag: '🇪🇸', name: 'Español' },
    de: { flag: '🇩🇪', name: 'Deutsch' },
    it: { flag: '🇮🇹', name: 'Italiano' }
  };

  return SUPPORTED_LANGS.map((candidate) => {
    const isActive = candidate === lang;
    const activeClass = isActive ? 'text-dream-salmon bg-dream-salmon/10' : 'text-purple-100/80 hover:text-white hover:bg-white/5';
    return `                        <a href="${currentPaths[candidate]}" hreflang="${candidate}" class="flex items-center gap-3 px-4 py-2 text-sm ${activeClass} transition-colors" role="menuitem">
                            <span class="w-5 text-center">${labels[candidate].flag}</span> ${labels[candidate].name}
                        </a>`;
  }).join('\n');
}

function renderGuidesNav(lang, t, currentPaths, activeLabel) {
  const locale = LOCALES[lang];
  return `    <nav class="fixed w-full z-50 top-0 left-0 px-4 md:px-6 py-4 md:py-6 transition-all duration-300" id="navbar">
        <div class="max-w-7xl mx-auto glass-panel rounded-full px-4 py-2 flex items-center justify-between gap-2 sm:px-6 sm:py-3 sm:gap-4">
            <a href="/${lang}/" class="flex items-center gap-2">
                <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>
                <span class="font-serif text-xl font-semibold tracking-wide text-dream-cream">Noctalia</span>
            </a>
            <div class="flex flex-wrap items-center gap-4 md:gap-8 text-sm font-sans text-purple-100/80">
                <a href="/${lang}/#${locale.navHowItWorksAnchor}" class="hidden lg:inline-flex hover:text-white transition-colors">${escapeHtml(locale.navHowItWorks)}</a>
                <a href="/${lang}/#${locale.navFeaturesAnchor}" class="hidden lg:inline-flex hover:text-white transition-colors">${escapeHtml(locale.navFeatures)}</a>
                <a href="/${lang}/blog/" class="hidden sm:inline-flex ${activeLabel === 'resources' ? 'text-dream-salmon' : 'hover:text-white'} transition-colors">${escapeHtml(locale.resources)}</a>
                <a href="/${lang}/guides/${t.dictionary_slug}" class="hidden sm:inline-flex ${activeLabel === 'dictionary' ? 'text-dream-salmon' : 'hover:text-white'} transition-colors">${escapeHtml(locale.dreamDictionary || COPY[lang].dictionary)}</a>
            </div>
            <div class="flex items-center gap-3">
                <div class="language-dropdown-wrapper relative" id="languageDropdown">
                    <button type="button"
                            class="glass-button px-3 py-2 rounded-full text-sm text-purple-100/80 border border-white/10 hover:border-dream-salmon hover:text-white transition-colors flex items-center gap-2"
                            aria-haspopup="true"
                            aria-expanded="false"
                            aria-label="Choose language"
                            id="languageDropdownButton">
                        <i data-lucide="languages" class="w-4 h-4"></i>
                        <span class="hidden sm:inline">${lang.toUpperCase()}</span>
                        <i data-lucide="chevron-down" class="w-3 h-3 transition-transform" id="dropdownChevron"></i>
                    </button>
                    <div class="language-dropdown-menu absolute right-0 top-full mt-2 glass-panel rounded-2xl py-2 min-w-[160px] hidden z-50"
                         role="menu" aria-labelledby="languageDropdownButton" id="languageDropdownMenu">
${renderLanguageDropdown(lang, currentPaths)}
                    </div>
                </div>
            </div>
        </div>
    </nav>`;
}

function renderGuidesFooter(lang, t, pages) {
  const locale = LOCALES[lang];
  const { featuredResources, featuredGuides, popularSymbols } = buildSeoLinkData(lang, t, pages);
  return `    <footer class="pb-10 pt-20 border-t border-white/5 px-6 bg-[#05020a]">
        <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-10 mb-16">
            <div class="xl:col-span-2">
                <a href="/${lang}/" class="flex items-center gap-2 mb-4">
                    <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>
                    <h4 class="font-serif text-2xl text-dream-cream">Noctalia</h4>
                </a>
                <p class="text-sm text-gray-500 max-w-xs mb-6">${escapeHtml(locale.footerTagline || COPY[lang].intro)}</p>
            </div>
            <div>
                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.resources || 'Resources')}</h5>
                <ul class="space-y-2 text-sm text-gray-500">${renderFooterLinkList(featuredResources, { highlightFirst: true })}
                </ul>
            </div>
            <div>
                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.dreamDictionary || COPY[lang].dictionary)}</h5>
                <ul class="space-y-2 text-sm text-gray-500">${renderFooterLinkList(featuredGuides, { highlightFirst: true })}
                </ul>
            </div>
            <div>
                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.popularSymbols || 'Popular Symbols')}</h5>
                <ul class="space-y-2 text-sm text-gray-500">${renderFooterLinkList(popularSymbols)}
                </ul>
            </div>
            <div>
                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.footerLegal || 'Legal')}</h5>
                <ul class="space-y-2 text-sm text-gray-500 mb-4">
                    <li><a href="/${lang}/${t.about_slug}" class="hover:text-dream-salmon transition-colors">${escapeHtml(t.about)}</a></li>
                    <li><a href="/${lang}/${t.legal_slug}" class="hover:text-dream-salmon transition-colors">${escapeHtml(t.legal_notice)}</a></li>
                    <li><a href="/${lang}/${t.privacy_slug}" class="hover:text-dream-salmon transition-colors">${escapeHtml(t.privacy)}</a></li>
                    <li><a href="/${lang}/${t.terms_slug}" class="hover:text-dream-salmon transition-colors">${escapeHtml(t.terms)}</a></li>
                </ul>
                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.footerDownload || 'Download')}</h5>
                <div class="flex flex-col gap-3">
                    <a href="${getAndroidStoreUrl(lang)}" class="glass-button px-4 py-2 rounded-lg flex items-center gap-3 text-left hover:bg-white/10">
                        <i data-lucide="play" class="w-5 h-5 fill-current"></i>
                        <div class="leading-none">
                            <div class="text-[9px] uppercase">${escapeHtml(locale.availableOn || 'Available on')}</div>
                            <div class="text-sm font-bold">${escapeHtml(locale.googlePlay || 'Google Play')}</div>
                        </div>
                    </a>
                </div>
            </div>
        </div>
        <div class="text-center pt-8 border-t border-white/5 text-[10px] text-gray-600 flex flex-col md:flex-row justify-between items-center">
            <span>${escapeHtml(locale.copyright || '© 2025 Noctalia Inc.')}</span>
            <span class="mt-2 md:mt-0 flex gap-2 items-center">${escapeHtml(locale.footerMadeWith || 'Made with')} <i data-lucide="heart" class="w-3 h-3 text-dream-salmon fill-current"></i> ${escapeHtml(locale.footerForDreamers || 'for dreamers')}</span>
        </div>
    </footer>`;
}

function replaceJsonLdBlock(html, matchFn, newData) {
  let replaced = false;
  const next = html.replace(/^[ \t]*<script\s+type=(["'])application\/ld\+json\1>\s*([\s\S]*?)\s*<\/script>/gim, (full, _q, jsonText) => {
    if (replaced) return full;
    try {
      const data = JSON.parse(jsonText.trim());
      if (!matchFn(data)) return full;
      replaced = true;
      return renderJsonLd(newData);
    } catch {
      return full;
    }
  });
  return { next, replaced };
}

function generateHubPage(lang, t, pages, version) {
  const copy = COPY[lang];
  const currentPaths = Object.fromEntries(SUPPORTED_LANGS.map((candidate) => [candidate, `/${candidate}/guides/`]));
  const cards = pages.map((page) => `            <a href="/${lang}/guides/${page.slugs[lang]}" class="card">
                <strong>${escapeHtml(page[lang].title)}</strong>
                <span>${escapeHtml(page[lang].metaDescription)}</span>
                <em>${escapeHtml(copy.openGuide)}</em>
            </a>`).join('\n');
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: pages.length + 1,
    itemListElement: [
      { '@type': 'ListItem', position: 1, url: `${DOMAIN}/${lang}/guides/${t.dictionary_slug}`, name: copy.dictionary },
      ...pages.map((page, index) => ({ '@type': 'ListItem', position: index + 2, url: `${DOMAIN}/${lang}/guides/${page.slugs[lang]}`, name: page[lang].title })),
    ],
  };
  const collection = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: copy.label, headline: copy.label, description: copy.desc, url: `${DOMAIN}/${lang}/guides/`, inLanguage: lang };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: t.home, item: `${DOMAIN}/${lang}/` }, { '@type': 'ListItem', position: 2, name: copy.label, item: `${DOMAIN}/${lang}/guides/` }] };
  return `<!DOCTYPE html>
<html lang="${lang}" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(copy.title)}</title>
    <meta name="description" content="${escapeHtml(copy.desc)}">
    <link rel="canonical" href="${DOMAIN}/${lang}/guides/">
${SUPPORTED_LANGS.map((targetLang) => `    <link rel="alternate" hreflang="${targetLang}" href="${DOMAIN}/${targetLang}/guides/">`).join('\n')}
    <link rel="alternate" hreflang="x-default" href="${DOMAIN}/en/guides/">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="64x64 48x48 32x32 16x16">
    <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">
    <link rel="apple-touch-icon" href="/logo192.png" sizes="192x192">
    <link rel="stylesheet" href="/css/styles.min.css?v=${version}">
    <link rel="stylesheet" href="/css/language-dropdown.css?v=${version}">
    <script src="/js/lucide.min.js?v=${version}" defer></script>
    <style>
        body { margin: 0; background: #0a0514; color: #f8f5ff; font-family: system-ui, sans-serif; }
        a { color: inherit; text-decoration: none; }
        .shell { max-width: 1120px; margin: 0 auto; padding: 128px 16px 72px; }
        .crumbs, .lede { color: rgba(226, 218, 255, 0.78); }
        .hero { padding: 32px 0 24px; }
        .hero h1 { font-size: clamp(2.4rem, 6vw, 4.4rem); line-height: 1.05; margin: 0 0 16px; }
        .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
        .card, .feature { display: grid; gap: 14px; padding: 24px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); background: rgba(20,10,40,0.5); }
        .feature { margin: 28px 0 36px; }
        .card strong, .feature strong { font-size: 1.1rem; }
        .card span, .feature span { color: rgba(226, 218, 255, 0.78); line-height: 1.55; }
        .card em, .feature em { color: #fda481; font-style: normal; font-weight: 600; }
        .section-title { font-size: 1.5rem; margin: 0 0 12px; }
    </style>
${renderJsonLd(collection)}
${renderJsonLd(itemList)}
${renderJsonLd(breadcrumb)}
</head>
<body class="bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden" style="background-color: #0a0514;">
    <div class="aurora-bg"></div>
    <div class="orb w-[70vw] h-[70vw] md:w-[40rem] md:h-[40rem] bg-purple-900/30 top-0 left-0"></div>
    <div class="orb w-[90vw] h-[90vw] md:w-[50rem] md:h-[50rem] bg-blue-900/20 bottom-0 right-0"></div>
${renderGuidesNav(lang, t, currentPaths, 'guides')}
    <main class="shell">
        <p class="crumbs"><a href="/${lang}/">${escapeHtml(t.home)}</a> / ${escapeHtml(copy.label)}</p>
        <section class="hero">
            <h1>${escapeHtml(copy.label)}</h1>
            <p class="lede">${escapeHtml(copy.intro)}</p>
        </section>
        <a href="/${lang}/guides/${t.dictionary_slug}" class="feature">
            <strong>${escapeHtml(copy.dictionary)}</strong>
            <span>${escapeHtml(copy.intro)}</span>
            <em>${escapeHtml(copy.openDictionary)}</em>
        </a>
        <h2 class="section-title">${escapeHtml(copy.label)}</h2>
        <div class="grid">
${cards}
        </div>
    </main>
${renderGuidesFooter(lang, t, pages)}
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            window.addEventListener('scroll', () => {
                const navbar = document.getElementById('navbar');
                if (navbar) {
                    navbar.classList.toggle('py-2', window.scrollY > 50);
                    navbar.classList.toggle('py-6', window.scrollY <= 50);
                }
            });
        });
    </script>
    <script src="/js/language-dropdown.js?v=${version}" defer></script>
</body>
</html>`;
}

function replaceFirst(html, regex, replacement, label) {
  if (!regex.test(html)) {
    throw new Error(`Missing ${label}`);
  }
  regex.lastIndex = 0;
  return html.replace(regex, replacement);
}

function replaceFirstOrKeep(html, currentRegex, replacement, alreadyRegex, label) {
  if (currentRegex.test(html)) {
    currentRegex.lastIndex = 0;
    return html.replace(currentRegex, replacement);
  }
  if (alreadyRegex && alreadyRegex.test(html)) {
    return html;
  }
  throw new Error(`Missing ${label}`);
}

function computeCategoryCounts() {
  const data = readJson('dream-symbols.json');
  const counts = {};
  (data.symbols || []).forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });
  return counts;
}

function extractLetterSet(html) {
  const letters = [];
  const re = /data-letter="([A-ZÀ-Ü])"/g;
  let m;
  while ((m = re.exec(html))) {
    if (!letters.includes(m[1])) letters.push(m[1]);
  }
  return letters;
}

function renderLayoutCss() {
  return `        /* == dict-layout == */
        #dictionaryLayout { display: flex; gap: 2rem; }
        #mainContentArea { flex: 1; min-width: 0; }
        #dictionarySidebar { display: none; }
        #categoryGridSection { display: none !important; }
        #mobilePills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 1rem; }
        .cat-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; border: 1px solid rgba(255,255,255,0.1); background: rgba(20,10,40,0.5); backdrop-filter: blur(8px); color: #e2daff; transition: all 0.2s ease; text-decoration: none; }
        .cat-pill:hover { border-color: rgba(253,164,129,0.3); color: #fda481; }
        .cat-pill .pill-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .cat-pill .pill-count { font-size: 0.7rem; opacity: 0.6; }
        #mobileAlpha { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-bottom: 1rem; }
        .mobile-alpha-link { min-width: 1.75rem; text-align: center; padding: 2px 4px; border-radius: 0.375rem; font-size: 0.8rem; color: rgba(196,181,253,0.75); transition: all 0.2s ease; text-decoration: none; }
        .mobile-alpha-link:hover { color: #FDA481; transform: scale(1.1); }
        .mobile-alpha-link.alpha-active { background: white; color: #0a0514 !important; font-weight: 700; transform: scale(1.05); }
        @media (min-width: 1024px) {
            #dictionarySidebar { display: block; width: 220px; flex-shrink: 0; position: sticky; top: 7rem; align-self: flex-start; max-height: calc(100vh - 8rem); overflow-y: auto; scrollbar-width: thin; scrollbar-color: #4c1d95 transparent; }
            #dictionarySidebar::-webkit-scrollbar { width: 4px; }
            #dictionarySidebar::-webkit-scrollbar-track { background: transparent; }
            #dictionarySidebar::-webkit-scrollbar-thumb { background: #4c1d95; border-radius: 2px; }
            #mobilePills, #mobileAlpha { display: none; }
            #stickyBar .sb-alpha { display: none; }
        }
        .sidebar-section { margin-bottom: 1.5rem; }
        .sidebar-heading { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(196,181,253,0.6); margin-bottom: 0.75rem; font-weight: 600; }
        .sidebar-cat-link { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; font-size: 0.82rem; color: #e2daff; transition: all 0.15s ease; text-decoration: none; }
        .sidebar-cat-link:hover { background: rgba(255,255,255,0.06); color: #fda481; }
        .sidebar-cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .sidebar-cat-count { margin-left: auto; font-size: 0.7rem; opacity: 0.5; }
        .sidebar-alpha-grid { display: flex; flex-wrap: wrap; gap: 2px; }
        .sidebar-alpha-link { min-width: 1.75rem; text-align: center; padding: 3px 4px; border-radius: 0.375rem; font-size: 0.8rem; color: rgba(196,181,253,0.75); transition: all 0.2s ease; text-decoration: none; }
        .sidebar-alpha-link:hover { color: #FDA481; transform: scale(1.1); }
        .sidebar-alpha-link.alpha-active { background: white; color: #0a0514 !important; font-weight: 700; transform: scale(1.05); }
        .hero-search, .search-input {
          background: rgba(255,255,255,0.08) !important;
          color: #f8f5ff !important;
          caret-color: #f8f5ff;
        }
        /* == /dict-layout == */`;
}

function renderSidebarHtml(lang, t, counts, letters) {
  const catNames = t.category_names || {};
  const catSlugs = t.category_slugs || {};
  const heading = t.categories_heading || 'Categories';
  const symbolPath = SYMBOL_PATHS[lang];
  const catLinks = CATEGORY_ORDER.map(cat => {
    const name = catNames[cat] || cat;
    const slug = catSlugs[cat] || cat;
    const count = counts[cat] || 0;
    const color = CATEGORY_COLORS[cat];
    return `                        <a href="/${lang}/${symbolPath}/${slug}" class="sidebar-cat-link">
                            <span class="sidebar-cat-dot" style="background:${color}"></span>
                            ${escapeHtml(name)}
                            <span class="sidebar-cat-count">${count}</span>
                        </a>`;
  }).join('\n');
  const alphaLinks = letters.map(l =>
    `                            <a href="#${l}" class="sidebar-alpha-link" data-letter="${l}">${l}</a>`
  ).join('\n');
  return `            <!-- dict-layout-open -->
            <div id="dictionaryLayout">
                <aside id="dictionarySidebar">
                    <div class="sidebar-section">
                        <div class="sidebar-heading">${escapeHtml(heading)}</div>
                        <div>
${catLinks}
                        </div>
                    </div>
                    <div class="sidebar-section">
                        <div class="sidebar-heading">A – Z</div>
                        <div class="sidebar-alpha-grid">
${alphaLinks}
                        </div>
                    </div>
                </aside>
                <div id="mainContentArea">
            <!-- /dict-layout-open -->`;
}

function renderMobilePillsHtml(lang, t, counts) {
  const catNames = t.category_names || {};
  const catSlugs = t.category_slugs || {};
  const symbolPath = SYMBOL_PATHS[lang];
  const pills = CATEGORY_ORDER.map(cat => {
    const name = catNames[cat] || cat;
    const slug = catSlugs[cat] || cat;
    const count = counts[cat] || 0;
    const color = CATEGORY_COLORS[cat];
    return `                    <a href="/${lang}/${symbolPath}/${slug}" class="cat-pill">
                        <span class="pill-dot" style="background:${color}"></span>
                        ${escapeHtml(name)}
                        <span class="pill-count">${count}</span>
                    </a>`;
  }).join('\n');
  return `            <!-- dict-pills -->
                <div id="mobilePills">
${pills}
                </div>
            <!-- /dict-pills -->`;
}

function renderMobileAlphaHtml(letters) {
  const links = letters.map(l =>
    `                    <a href="#${l}" class="mobile-alpha-link" data-letter="${l}">${l}</a>`
  ).join('\n');
  return `            <!-- dict-alpha-mobile -->
                <div id="mobileAlpha">
${links}
                </div>
            <!-- /dict-alpha-mobile -->`;
}

function patchDictionaryPage(lang, t) {
  const copy = COPY[lang];
  const absPath = path.join(DOCS_DIR, lang, 'guides', `${t.dictionary_slug}.html`);
  const originalRaw = fs.readFileSync(absPath, 'utf8');
  let next = originalRaw.replace(/\r\n/g, '\n');
  const pages = readJson('curation-pages.json').pages || [];
  const currentPaths = Object.fromEntries(
    SUPPORTED_LANGS.map((candidate) => [candidate, `/${candidate}/guides/${readJson('symbol-i18n.json')[candidate].dictionary_slug}`])
  );
  const canonical = `${DOMAIN}/${lang}/guides/${t.dictionary_slug}`;
  const guidesUrl = `${DOMAIN}/${lang}/guides/`;
  const pageTitle = normalizeTitle(extractTitleTag(next));
  const descriptionMatch = next.match(/<meta\b[^>]*\bname=(["'])description\1[^>]*\bcontent=(["'])(.*?)\2/i);
  const description = descriptionMatch ? descriptionMatch[3] : copy.dictionary;
  const imageMatch = next.match(/<meta\b[^>]*\bproperty=(["'])og:image\1[^>]*\bcontent=(["'])(.*?)\2/i);
  const image = imageMatch ? imageMatch[3] : `${DOMAIN}/img/og/noctalia-${lang}-1200x630.jpg`;
  const collection = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: pageTitle, headline: pageTitle, description, url: canonical, image, inLanguage: lang, isPartOf: { '@type': 'CollectionPage', name: copy.label, url: guidesUrl } };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: t.home, item: `${DOMAIN}/${lang}/` }, { '@type': 'ListItem', position: 2, name: copy.label, item: guidesUrl }, { '@type': 'ListItem', position: 3, name: pageTitle, item: canonical }] };
  next = replaceJsonLdBlock(next, (data) => data['@type'] === 'Article' || data['@type'] === 'CollectionPage', collection).next;
  next = replaceJsonLdBlock(next, (data) => data['@type'] === 'BreadcrumbList', breadcrumb).next;
  // Remove ALL existing language-dropdown.css links (deduplication), then add one fresh link
  next = next.replace(/[ \t]*<link rel="stylesheet" href="\/css\/language-dropdown\.css\?v=[^"]+">[ \t]*(?:\r?\n)?/gi, '');
  {
    const stylesMatch = next.match(/<link rel="stylesheet" href="\/css\/styles\.min\.css\?v=[^"]+">/i);
    if (!stylesMatch) throw new Error('Missing styles.min.css link');
    next = next.replace(
      /<link rel="stylesheet" href="\/css\/styles\.min\.css\?v=[^"]+">/i,
      `${stylesMatch[0]}\n    <link rel="stylesheet" href="/css/language-dropdown.css?v=${readVersion()}">`,
    );
  }
  next = replaceFirst(
    next,
    /[ \t]*<!-- Navbar -->[\s\S]*?<\/nav>/,
    `    <!-- Navbar -->
${renderGuidesNav(lang, t, currentPaths, 'dictionary')}`,
    'navbar block'
  );
  next = replaceFirst(next, /[ \t]*<nav class="text-sm text-purple-200\/(?:60|75) mb-8" aria-label="[^"]+">[\s\S]*?<\/nav>/, `            <nav class="text-sm text-purple-200/75 mb-8" aria-label="Breadcrumb">
                <ol class="flex items-center gap-2 flex-wrap" itemscope itemtype="https://schema.org/BreadcrumbList">
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/${lang}/" itemprop="item" class="hover:text-dream-salmon transition-colors"><span itemprop="name">${escapeHtml(t.home)}</span></a><meta itemprop="position" content="1"></li>
                    <li class="text-purple-400">/</li>
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/${lang}/guides/" itemprop="item" class="hover:text-dream-salmon transition-colors"><span itemprop="name">${escapeHtml(copy.label)}</span></a><meta itemprop="position" content="2"></li>
                    <li class="text-purple-400">/</li>
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/${lang}/guides/${t.dictionary_slug}" itemprop="item" class="text-dream-cream"><span itemprop="name">${escapeHtml(pageTitle)}</span></a><meta itemprop="position" content="3"></li>
                </ol>
            </nav>`, 'breadcrumb');
  next = replaceFirstOrKeep(
    next,
    new RegExp(`<a href="/${lang}/(?:blog|guides)/" class="hidden sm:inline-flex [^"]*">[^<]+</a>`),
    `<a href="/${lang}/guides/" class="hidden sm:inline-flex text-dream-salmon">${escapeHtml(copy.label)}</a>`,
    new RegExp(`<a href="/${lang}/guides/" class="hidden sm:inline-flex text-dream-salmon">${escapeHtml(copy.label)}</a>`),
    'navbar link',
  );
  next = replaceFirstOrKeep(
    next,
    new RegExp(`<li><a href="/${lang}/(?:blog|guides)/" class="[^"]*">[^<]+</a></li>`),
    `<li><a href="/${lang}/guides/" class="hover:text-dream-salmon transition-colors">${escapeHtml(copy.label)}</a></li>`,
    new RegExp(`<li><a href="/${lang}/guides/" class="hover:text-dream-salmon transition-colors">${escapeHtml(copy.label)}</a></li>`),
    'footer link',
  );
  // Remove the "browse all guides" hero link — redundant now that breadcrumb handles navigation
  next = next.replace(/[ \t]*<a\b[^>]*class="[^"]*\btext-xs\b[^"]*\bfont-mono\b[^"]*"[^>]*>[^<]*<\/a>[ \t]*(?:\r?\n)?/g, '');
  next = replaceFirst(
    next,
    /[ \t]*<!-- Footer -->[\s\S]*?<\/footer>/,
    `    <!-- Footer -->
${renderGuidesFooter(lang, t, pages)}`,
    'footer block'
  );
  next = replaceFirstOrKeep(
    next,
    /<script src="\/js\/language-dropdown\.js\?v=[^"]+" defer><\/script>/i,
    `<script src="/js/language-dropdown.js?v=${readVersion()}" defer></script>`,
    /<script src="\/js\/language-dropdown\.js\?v=[^"]+" defer><\/script>/i,
    'language dropdown script'
  );

  // ── Normalize spacing (EN is the reference) ────────────────────────
  next = next.replace(/<main class="pt-24 pb-20/g, '<main class="pt-32 pb-20');
  next = next.replace(/<header class="text-center mb-(?:4|16)">/g, '<header class="text-center mb-8">');

  // Remove "GUIDE DE RÉFÉRENCE" badge (only FR had it, inconsistent with other langs)
  next = next.replace(/[ \t]*<div class="inline-flex items-center gap-2 text-xs font-mono text-dream-salmon[^>]*>[\s\S]*?<\/div>\s*\n?/g, '');

  // Normalize h1 margin-bottom to mb-4 (FR had mb-6)
  next = next.replace(/(class="font-serif text-3xl md:text-5xl) mb-6 /g, '$1 mb-4 ');

  // Normalize paragraph margin-bottom to mb-6 (FR missing, DE/ES had mb-4)
  next = next.replace(
    /(class="text-lg text-purple-200\/80 leading-relaxed max-w-2xl mx-auto)(?: mb-4)?(")/g,
    '$1 mb-6$2'
  );

  // Ensure .letter-nav CSS rule exists (FR was missing it)
  if (!next.includes('.letter-nav {')) {
    next = next.replace(
      /(\.hero-search:focus)/,
      '.letter-nav { scroll-behavior: smooth; }\n        $1'
    );
  }

  // ── Dictionary layout: sidebar (desktop) + pills (mobile) ───────────
  // Cleanup previous injection (new markers)
  next = next.replace(/[ \t]*\/\* == dict-layout == \*\/[\s\S]*?\/\* == \/dict-layout == \*\/\n?/g, '');
  next = next.replace(/[ \t]*<!-- dict-pills -->[\s\S]*?<!-- \/dict-pills -->\s*/g, '');
  next = next.replace(/[ \t]*<!-- dict-alpha-mobile -->[\s\S]*?<!-- \/dict-alpha-mobile -->\s*/g, '');
  next = next.replace(/[ \t]*<!-- dict-layout-open -->[\s\S]*?<!-- \/dict-layout-open -->\s*/g, '');
  next = next.replace(/[ \t]*<!-- dict-layout-close -->[\s\S]*?<!-- \/dict-layout-close -->\s*/g, '');
  // Cleanup old sidebar implementation (no markers)
  next = next.replace(/[ \t]*<div id="mobileCategoryPills"[^>]*>[\s\S]*?<\/div>\s*/g, '');
  next = next.replace(/[ \t]*<div id="mobileAlphaStrip"[^>]*>[\s\S]*?<\/div>\s*/g, '');
  next = next.replace(/[ \t]*<div id="dictionaryLayout">\s*\n\s*<aside id="dictionarySidebar">[\s\S]*?<\/aside>\s*\n\s*<div id="mainContentArea">\s*/g, '');
  next = next.replace(/[ \t]*<\/div><!-- \/mainContentArea -->\s*\n\s*<\/div><!-- \/dictionaryLayout -->\s*/g, '');
  // Cleanup shared attributes/classes
  next = next.replace(/ id="categoryGridSection"/g, '');
  next = next.replace(/class="max-w-6xl mx-auto"/g, 'class="max-w-5xl mx-auto"');
  next = next.replace(/\.querySelectorAll\('\.letter-link, \.sidebar-alpha-link, \.mobile-alpha-link'\)/g, ".querySelectorAll('.letter-link')");

  const counts = computeCategoryCounts();
  const letters = extractLetterSet(next);

  // 1. Inject CSS (replace everything between .hero-search rule and </style>)
  next = next.replace(
    /(\.hero-search:focus\s*\{[^}]+\})[\s\S]*?(<\/style>)/,
    `$1\n${renderLayoutCss()}\n    $2`
  );

  // 2. Widen container for sidebar room
  next = next.replace('class="max-w-5xl mx-auto"', 'class="max-w-6xl mx-auto"');

  // 3. Insert mobile pills + alpha strip after </header>
  next = next.replace(
    /(<\/header>[ \t]*\n)/,
    `$1\n${renderMobilePillsHtml(lang, t, counts)}\n\n${renderMobileAlphaHtml(letters)}\n`
  );

  // 4. Add id="categoryGridSection" to category grid section (mb-6 or mb-12)
  next = next.replace(
    /(<section class="mb-(?:6|12)">\s*<h2[^>]*>[\s\S]*?grid grid-cols-2 md:grid-cols-4)/,
    (match) => match.replace(/<section class="mb-(?:6|12)">/, '<section id="categoryGridSection" class="mb-6">')
  );

  // 5. Insert layout wrapper + sidebar before category grid
  {
    const sidebarHtml = renderSidebarHtml(lang, t, counts, letters);
    next = next.replace(
      /([ \t]*<section id="categoryGridSection")/,
      `${sidebarHtml}\n$1`
    );
  }

  // 6. Close layout wrapper after symbolsList, before FAQ
  next = next.replace(
    /(<!-- FAQ)/,
    `<!-- dict-layout-close -->\n                </div><!-- /mainContentArea -->\n            </div><!-- /dictionaryLayout -->\n            <!-- /dict-layout-close -->\n\n            $1`
  );

  // Fix duplicate const stickyBar declaration (causes SyntaxError in EN)
  next = next.replace(
    /(const stickySearch[^\n]*\n)\s*const stickyBar = document\.getElementById\('stickyBar'\);\s*\n/,
    '$1'
  );

  // Inject missing hero search input (FR was missing it)
  if (!next.includes('id="heroSearch"')) {
    const placeholder = escapeHtml(HERO_SEARCH_PLACEHOLDERS[lang] || HERO_SEARCH_PLACEHOLDERS.en);
    const heroSearchHtml = `\n                <!-- Hero search -->\n                <div class="relative max-w-xl mx-auto">\n                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/50 pointer-events-none"></i>\n                    <input type="text" id="heroSearch" placeholder="${placeholder}"\n                        class="hero-search w-full bg-white/8 border border-white/15 rounded-full py-4 pl-12 pr-6 text-base text-dream-cream placeholder:text-purple-300/50 transition-colors">\n                </div>`;
    next = next.replace(/([ \t]*<\/header>)/, `${heroSearchHtml}\n$1`);
  }

  // Inject "no results" message (hidden by default) — placed right after </header> for visibility
  {
    const noResultsLabel = escapeHtml(NO_RESULTS_TEXT[lang] || NO_RESULTS_TEXT.en);
    // Remove previous injection
    next = next.replace(/[ \t]*<!-- dict-no-results -->[\s\S]*?<!-- \/dict-no-results -->\s*/g, '');
    next = next.replace(
      /(<\/header>[ \t]*\n)/,
      `$1\n            <!-- dict-no-results -->\n            <div id="noResults" style="display:none" class="text-center py-16 text-purple-200/60">\n                <i data-lucide="search-x" class="w-12 h-12 mx-auto mb-4 opacity-40"></i>\n                <p class="text-lg">${noResultsLabel} &laquo;<span id="noResultsQuery"></span>&raquo;</p>\n            </div>\n            <!-- /dict-no-results -->\n`
    );
  }

  // Patch filterSymbols to toggle "no results" message
  // First revert any previous patch to keep idempotent
  next = next.replace(/\n\s*const noResults = document\.getElementById\('noResults'\);\s*\n\s*const noResultsQuery = document\.getElementById\('noResultsQuery'\);/g, '');
  next = next.replace(/\n\s*if \(noResults\) noResults\.style\.display = 'none';/g, '');
  next = next.replace(/\n\s*const anyVisible = \[\.\.\.listSections\]\.some\(s => s\.style\.display !== 'none'\);\s*\n\s*if \(noResults\) \{ noResults\.style\.display = anyVisible \? 'none' : 'block'; \}\s*\n\s*if \(noResultsQuery\) \{ noResultsQuery\.textContent = query; \}/g, '');
  // Now apply
  next = next.replace(
    /function filterSymbols\(query\)\s*\{/,
    `function filterSymbols(query) {
                const noResults = document.getElementById('noResults');
                const noResultsQuery = document.getElementById('noResultsQuery');`
  );
  next = next.replace(
    /symbolCards\.forEach\(card => card\.style\.display = ''\);\s*\n\s*listSections\.forEach\(section => section\.style\.display = ''\);/,
    `symbolCards.forEach(card => card.style.display = '');
                    listSections.forEach(section => section.style.display = '');
                    if (noResults) noResults.style.display = 'none';`
  );
  next = next.replace(
    /(section\.style\.display = hasVisible \? '' : 'none';\s*\n\s*\}\);)\s*\n\s*\}/,
    `$1
                    const anyVisible = [...listSections].some(s => s.style.display !== 'none');
                    if (noResults) { noResults.style.display = anyVisible ? 'none' : 'block'; }
                    if (noResultsQuery) { noResultsQuery.textContent = query; }
                }`
  );

  // Remove auto-scroll (was added previously, clean up)
  next = next.replace(/\n\s*if \(e\.target\.value\.trim\(\)\) \{ document\.getElementById\('symbolsList'\)\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\); \}/g, '');

  // 7+8. Update JS selectors to include sidebar and mobile alpha links
  next = next.replace(
    ".querySelectorAll('.letter-link').forEach(link",
    ".querySelectorAll('.letter-link, .sidebar-alpha-link, .mobile-alpha-link').forEach(link"
  );
  next = next.replace(
    ".querySelectorAll('.letter-link').forEach(l ",
    ".querySelectorAll('.letter-link, .sidebar-alpha-link, .mobile-alpha-link').forEach(l "
  );

  const output = matchLineEndings(next, originalRaw);
  if (output !== originalRaw && !DRY_RUN) fs.writeFileSync(absPath, output, 'utf8');
  return output !== originalRaw;
}

function main() {
  const version = readVersion();
  const i18n = readJson('symbol-i18n.json');
  const pages = readJson('curation-pages.json').pages || [];
  let hubs = 0;
  let dictionaries = 0;
  for (const lang of SUPPORTED_LANGS) {
    const hubPath = path.join(DOCS_DIR, lang, 'guides', 'index.html');
    const hubHtml = generateHubPage(lang, i18n[lang], pages, version);
    const currentHub = fs.existsSync(hubPath) ? fs.readFileSync(hubPath, 'utf8') : null;
    if (currentHub !== hubHtml) {
      hubs += 1;
      if (!DRY_RUN) fs.writeFileSync(hubPath, hubHtml, 'utf8');
      console.log(`${DRY_RUN ? 'Would generate' : 'Generated'} docs/${lang}/guides/index.html`);
    }
    if (patchDictionaryPage(lang, i18n[lang])) {
      dictionaries += 1;
      console.log(`${DRY_RUN ? 'Would patch' : 'Patched'} docs/${lang}/guides/${i18n[lang].dictionary_slug}.html`);
    }
  }
  console.log(`[fix-guides-architecture] mode=${DRY_RUN ? 'dry-run' : 'write'} hubPages=${hubs} dictionaryPages=${dictionaries}`);
}

if (require.main === module) main();
