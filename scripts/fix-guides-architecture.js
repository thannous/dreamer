#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { SUPPORTED_LANGS } = require('./lib/docs-seo-utils');
const { renderViewTransitionHeadStyles } = require('./lib/docs-view-transitions');

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
${renderViewTransitionHeadStyles()}
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

function computeCategoryCounts() {
  const data = readJson('dream-symbols.json');
  const counts = {};
  (data.symbols || []).forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });
  return counts;
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

const OG_LOCALES = { en: 'en_US', fr: 'fr_FR', es: 'es_ES', de: 'de_DE', it: 'it_IT' };
const CATEGORY_ICONS = { nature: 'leaf', animals: 'paw-print', body: 'user', places: 'home', objects: 'package', actions: 'zap', people: 'users', celestial: 'star' };

function generateDictionaryPage(lang, t) {
  const copy = COPY[lang];
  const version = readVersion();
  const dictContent = readJson('dictionary-content.json');
  const dc = dictContent[lang];
  const symbolsData = readJson('dream-symbols.json');
  const i18n = readJson('symbol-i18n.json');
  const pages = readJson('curation-pages.json').pages || [];
  const counts = computeCategoryCounts();
  const symbolPath = SYMBOL_PATHS[lang];

  const canonical = `${DOMAIN}/${lang}/guides/${t.dictionary_slug}`;
  const guidesUrl = `${DOMAIN}/${lang}/guides/`;
  const ogImage = `${DOMAIN}/img/og/noctalia-${lang}-1200x630.jpg`;
  const pageTitle = normalizeTitle(dc.page_title);

  // ── Build current paths for language switcher ────────────────────────
  const currentPaths = Object.fromEntries(
    SUPPORTED_LANGS.map((candidate) => [candidate, `/${candidate}/guides/${i18n[candidate].dictionary_slug}`])
  );

  // ── Build symbols grouped by first letter ────────────────────────────
  const allSymbols = symbolsData.symbols || [];
  const sorted = [...allSymbols].sort((a, b) => (a[lang].name).localeCompare(b[lang].name, lang));
  const groups = {};
  sorted.forEach((sym) => {
    const firstChar = sym[lang].name[0].toUpperCase();
    if (!groups[firstChar]) groups[firstChar] = [];
    groups[firstChar].push(sym);
  });
  const letters = Object.keys(groups).sort((a, b) => a.localeCompare(b, lang));

  // ── Build symbol categories map for JS ───────────────────────────────
  const symbolCatEntries = allSymbols
    .map((sym) => `                '${sym[lang].slug}': '${sym.category}'`)
    .join(',\n');

  // ── Build category grid HTML ─────────────────────────────────────────
  const catGridCards = CATEGORY_ORDER.map((cat) => {
    const catName = (t.category_names || {})[cat] || cat;
    const catSlug = (t.category_slugs || {})[cat] || cat;
    const icon = CATEGORY_ICONS[cat] || 'circle';
    const count = counts[cat] || 0;
    return `                    <a href="/${lang}/${symbolPath}/${catSlug}" class="glass-panel rounded-xl p-5 text-center border border-transparent hover:border-dream-salmon/30 transition-all group">
                        <i data-lucide="${icon}" class="w-8 h-8 mx-auto mb-3 text-dream-salmon"></i>
                        <h3 class="font-serif text-dream-cream mb-1 group-hover:text-dream-salmon transition-colors">${escapeHtml(catName)}</h3>
                        <span class="text-xs text-purple-300/80">${count} ${escapeHtml(t.symbols_in_category || 'symbols')}</span>
                    </a>`;
  }).join('\n');

  // ── Build symbol sections HTML ───────────────────────────────────────
  const symbolSectionsHtml = letters.map((letter) => {
    const syms = groups[letter];
    const cards = syms.map((sym) => {
      const s = sym[lang];
      const dataSymbol = escapeHtml(s.slug + ' ' + s.slug + ' ' + s.slug);
      const askText = (s.askYourself || []).join(' ');
      return `
                        <div class="symbol-card glass-panel rounded-xl p-5 border border-transparent" data-symbol="${dataSymbol}">
                            <a href="/${lang}/${symbolPath}/${s.slug}" class="block hover:opacity-80 transition-opacity"><h3 class="font-serif text-lg text-dream-cream mb-2">${escapeHtml(s.name)}</h3></a>
                            <p class="text-sm text-gray-300 mb-3">${escapeHtml(s.shortDescription)}</p>
                            <div class="text-xs text-purple-300/80">
                                <strong class="text-dream-salmon">${escapeHtml(dc.ask_yourself_label)}</strong> ${escapeHtml(askText)}
                            </div>
                        </div>`;
    }).join('\n');
    return `                <section id="${letter}" class="mb-12">
                    <h2 class="font-serif text-2xl text-dream-salmon mb-6 flex items-center gap-3">
                        <span class="w-10 h-10 rounded-full bg-dream-salmon/10 flex items-center justify-center">${letter}</span>
                        ${escapeHtml(dc.section_heading)} ${letter}
                    </h2>
                    <div class="grid md:grid-cols-2 gap-4">${cards}
                    </div>
                </section>`;
  }).join('\n\n');

  // ── Build sticky bar letter links ────────────────────────────────────
  const stickyAlphaLinks = letters.map((l) =>
    `                        <a href="#${l}" class="letter-link text-sm" style="color:rgba(196,181,253,0.75);" data-letter="${l}">${l}</a>`
  ).join('\n');

  // ── Build FAQ HTML ───────────────────────────────────────────────────
  const faqHtml = (dc.faq || []).map((item) =>
    `                    <details class="glass-panel rounded-xl p-4 group cursor-pointer">
                        <summary class="font-medium flex justify-between items-center text-dream-cream">
                            ${escapeHtml(item.q)}
                            <i data-lucide="chevron-down" class="w-5 h-5 transition-transform group-open:rotate-180 text-dream-salmon"></i>
                        </summary>
                        <p class="mt-4 text-sm text-gray-300 leading-relaxed">
                            ${escapeHtml(item.a)}
                        </p>
                    </details>`
  ).join('\n');

  // ── Build related articles HTML ──────────────────────────────────────
  const relatedHtml = (dc.related_articles || []).map((article) =>
    `                    <a href="${article.href}" class="glass-panel rounded-xl p-6 block hover:border-dream-salmon/30 border border-transparent transition-colors">
                        <span class="text-xs text-dream-salmon uppercase mb-2 block">${escapeHtml(article.tag)}</span>
                        <h3 class="font-serif text-lg text-dream-cream mb-2">${escapeHtml(article.title)}</h3>
                        <p class="text-sm text-gray-300">${escapeHtml(article.desc)}</p>
                    </a>`
  ).join('\n');

  // ── Build JSON-LD ────────────────────────────────────────────────────
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    headline: pageTitle,
    description: dc.meta_description,
    url: canonical,
    image: ogImage,
    inLanguage: lang,
    isPartOf: { '@type': 'CollectionPage', name: copy.label, url: guidesUrl },
  };
  const faqPageLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (dc.faq || []).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `${DOMAIN}/${lang}/` },
      { '@type': 'ListItem', position: 2, name: copy.label, item: guidesUrl },
      { '@type': 'ListItem', position: 3, name: pageTitle, item: canonical },
    ],
  };

  // ── Build hreflang links ─────────────────────────────────────────────
  const hreflangLinks = SUPPORTED_LANGS.map((targetLang) =>
    `    <link rel="alternate" hreflang="${targetLang}" href="${DOMAIN}/${targetLang}/guides/${i18n[targetLang].dictionary_slug}">`
  ).join('\n');

  // ── Build OG locale alternates ───────────────────────────────────────
  const ogLocaleAlts = SUPPORTED_LANGS
    .filter((l) => l !== lang)
    .map((l) => `    <meta property="og:locale:alternate" content="${OG_LOCALES[l]}">`)
    .join('\n');

  // ── Assemble full HTML ───────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="${lang}" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(dc.page_title)}</title>
    <meta name="description"
        content="${escapeHtml(dc.meta_description)}">
    <link rel="canonical" href="${canonical}">
${hreflangLinks}
    <link rel="alternate" hreflang="x-default" href="${DOMAIN}/en/guides/${i18n.en.dictionary_slug}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="64x64 48x48 32x32 16x16">
    <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">

    <link rel="apple-touch-icon" href="/logo192.png" sizes="192x192">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(dc.og_title)}">
    <meta property="og:description" content="${escapeHtml(dc.og_description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:site_name" content="Noctalia">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:locale" content="${OG_LOCALES[lang]}">
${ogLocaleAlts}
    <meta property="article:published_time" content="2025-01-06">
    <meta property="article:author" content="Noctalia">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@NoctaliaDreams">
    <meta name="twitter:title" content="${escapeHtml(dc.twitter_title)}">
    <meta name="twitter:description" content="${escapeHtml(dc.twitter_description)}">
    <meta name="twitter:image" content="${ogImage}">
    <meta name="twitter:image:alt" content="${escapeHtml(dc.og_title)}">
    <!-- Preload critical fonts -->
    <link rel="preload" href="/fonts/Outfit-Regular.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Outfit-Bold.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Fraunces-Variable.woff2" as="font" type="font/woff2" crossorigin>
    <!-- Compiled Tailwind CSS -->
    <link rel="stylesheet" href="/css/styles.min.css?v=${version}">
    <link rel="stylesheet" href="/css/language-dropdown.css?v=${version}">
${renderViewTransitionHeadStyles()}
<!-- Lucide Icons (deferred) -->
    <script src="/js/lucide.min.js?v=${version}" defer></script>

    <style>
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0a0514; }
        ::-webkit-scrollbar-thumb { background: #4c1d95; border-radius: 4px; }
        .aurora-bg {
            background: radial-gradient(at 0% 0%, hsla(253, 16%, 7%, 1) 0, transparent 50%),
                radial-gradient(at 50% 0%, hsla(260, 39%, 20%, 1) 0, transparent 50%),
                radial-gradient(at 100% 0%, hsla(339, 49%, 20%, 1) 0, transparent 50%);
            background-size: 200% 200%; animation: aurora 20s ease infinite;
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1;
        }
        .orb { position: absolute; border-radius: 50%; filter: blur(100px); z-index: -1; opacity: 0.5; max-width: 100vw; max-height: 100vw; }
        .glass-panel {
            background: rgba(20, 10, 40, 0.4); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .glass-button { background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.15); transition: all 0.3s ease; }
        .glass-button:hover { background: rgba(255, 255, 255, 0.15); }
        @keyframes aurora { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        html, body { overflow-x: hidden; }
        .symbol-card { transition: all 0.3s ease; }
        .symbol-card:hover { transform: translateY(-2px); border-color: rgba(253, 164, 129, 0.3); }
        .symbol-card:focus { outline: none; border-color: rgba(253, 164, 129, 0.3); box-shadow: 0 0 0 2px rgba(253, 164, 129, 0.25); }
        .letter-nav { scroll-behavior: smooth; }
        .letter-link { transition: all 0.2s ease; min-width: 1.75rem; text-align: center; border-radius: 0.375rem; padding: 2px 4px; }
        .letter-link:hover { color: #FDA481; transform: scale(1.1); }
        .letter-link.alpha-active { background: white; color: #0a0514 !important; font-weight: 700; transform: scale(1.05); }
        .search-input:focus { outline: none; border-color: #FDA481; }
        /* Sticky search + alpha bar */
        #stickyBar {
            position: sticky; top: 4.5rem; z-index: 40;
            opacity: 0; pointer-events: none;
            transition: opacity 0.25s ease;
        }
        #stickyBar.sb-visible { opacity: 1; pointer-events: auto; }
        #stickyBar .sb-inner {
            display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
        }
        #stickyBar .sb-search { position: relative; flex-shrink: 0; width: 13rem; }
        #stickyBar .sb-alpha { display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; align-items: center; flex: 1; min-width: 0; }
        /* Hero search */
        .hero-search:focus { outline: none; border-color: #FDA481; }
${renderLayoutCss()}
    </style>

${renderJsonLd(collection)}

${renderJsonLd(faqPageLd)}

${renderJsonLd(breadcrumb)}
</head>

<body class="bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden" style="background-color: #0a0514;">

    <div class="aurora-bg"></div>
    <div class="orb w-[70vw] h-[70vw] md:w-[40rem] md:h-[40rem] bg-purple-900/30 top-0 left-0"></div>
    <div class="orb w-[90vw] h-[90vw] md:w-[50rem] md:h-[50rem] bg-blue-900/20 bottom-0 right-0"></div>

    <!-- Navbar -->
${renderGuidesNav(lang, t, currentPaths, 'dictionary')}

    <main class="pt-32 pb-20 px-4">
        <div class="max-w-6xl mx-auto">

            <!-- Breadcrumb -->
            <nav class="text-sm text-purple-200/75 mb-8" aria-label="Breadcrumb">
                <ol class="flex items-center gap-2 flex-wrap" itemscope itemtype="https://schema.org/BreadcrumbList">
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/${lang}/" itemprop="item" class="hover:text-dream-salmon transition-colors"><span itemprop="name">${escapeHtml(t.home)}</span></a><meta itemprop="position" content="1"></li>
                    <li class="text-purple-400">/</li>
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/${lang}/guides/" itemprop="item" class="hover:text-dream-salmon transition-colors"><span itemprop="name">${escapeHtml(copy.label)}</span></a><meta itemprop="position" content="2"></li>
                    <li class="text-purple-400">/</li>
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/${lang}/guides/${t.dictionary_slug}" itemprop="item" class="text-dream-cream"><span itemprop="name">${escapeHtml(pageTitle)}</span></a><meta itemprop="position" content="3"></li>
                </ol>
            </nav>

            <!-- Header -->
            <header class="text-center mb-8">

                <h1 class="font-serif text-3xl md:text-5xl mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white via-dream-lavender to-purple-400/50 leading-tight">
                    ${escapeHtml(dc.h1_text)}
                </h1>

                <p class="text-lg text-purple-200/80 leading-relaxed max-w-2xl mx-auto mb-6">
                    ${escapeHtml(dc.intro_paragraph)}
                </p>

                <!-- Hero search -->
                <div class="relative max-w-xl mx-auto">
                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/50 pointer-events-none"></i>
                    <input type="text" id="heroSearch" placeholder="${escapeHtml(dc.hero_search_placeholder)}"
                        class="hero-search w-full bg-white/8 border border-white/15 rounded-full py-4 pl-12 pr-6 text-base text-dream-cream placeholder:text-purple-300/50 transition-colors">
                </div>
            </header>

            <!-- dict-no-results -->
            <div id="noResults" style="display:none" class="text-center py-16 text-purple-200/60">
                <i data-lucide="search-x" class="w-12 h-12 mx-auto mb-4 opacity-40"></i>
                <p class="text-lg">${escapeHtml(dc.no_results_text)} &laquo;<span id="noResultsQuery"></span>&raquo;</p>
            </div>
            <!-- /dict-no-results -->

${renderMobilePillsHtml(lang, t, counts)}

${renderMobileAlphaHtml(letters)}

<!-- Sticky Search + Alphabet bar (above categories) -->
            <div id="stickyBar" class="glass-panel rounded-2xl p-4 mb-8">
                <div class="sb-inner">
                    <!-- Compact search -->
                    <div class="sb-search">
                        <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/50 pointer-events-none"></i>
                        <input type="text" id="stickySearch" placeholder="${escapeHtml(dc.sticky_search_placeholder)}"
                            class="search-input w-full rounded-full py-2 pl-10 pr-4 text-sm text-dream-cream transition-colors"
                            style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);outline:none;">
                    </div>
                    <!-- Alphabet -->
                    <div class="sb-alpha letter-nav">
${stickyAlphaLinks}
                    </div>
                    <!-- Back to top -->
                    <button id="backToTop" class="glass-button rounded-full text-purple-300/70 hover:text-white transition-colors" aria-label="Back to top" title="Back to top" style="display:none;flex-shrink:0;padding:6px;">
                        <i data-lucide="arrow-up" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <!-- Browse by Category -->
${renderSidebarHtml(lang, t, counts, letters)}
<section id="categoryGridSection" class="mb-6">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="grid-3x3" class="w-6 h-6 text-dream-salmon"></i>
                    ${escapeHtml(dc.browse_by_category)}
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
${catGridCards}
                </div>
            </section>

            <!-- Intermediate CTA -->
            <div class="glass-panel rounded-2xl p-5 mb-12 flex items-center justify-between flex-wrap gap-4 border border-dream-salmon/10">
                <div>
                    <p class="font-serif text-dream-cream text-lg">${dc.cta_title.replace(/<em>/g, '<em class="text-dream-salmon not-italic">')}</p>
                    <p class="text-sm text-purple-200/70 mt-1">${escapeHtml(dc.cta_subtitle)}</p>
                </div>
                <a href="/${lang}/" class="inline-flex items-center gap-2 px-6 py-3 bg-dream-salmon text-dream-dark rounded-full font-bold hover:bg-dream-salmon/90 transition-colors text-sm shrink-0">
                    ${escapeHtml(dc.cta_button)} <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </a>
            </div>

            <!-- Symbols Dictionary -->
            <div id="symbolsList">
${symbolSectionsHtml}

            </div>
<!-- dict-layout-close -->
                </div><!-- /mainContentArea -->
            </div><!-- /dictionaryLayout -->
            <!-- /dict-layout-close -->

            <!-- FAQ Section (before CTA to address objections first) -->
            <section class="mt-16 max-w-3xl mx-auto">
                <h2 class="font-serif text-2xl text-dream-cream mb-8">${escapeHtml(dc.faq_title)}</h2>
                <div class="space-y-4">
${faqHtml}
                </div>
            </section>

            <!-- CTA Section -->
            <aside class="glass-panel rounded-3xl p-8 md:p-10 mt-16 text-center border border-dream-salmon/20">
                <div class="w-16 h-16 bg-dream-salmon/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i data-lucide="sparkles" class="w-8 h-8 text-dream-salmon"></i>
                </div>
                <h3 class="font-serif text-2xl md:text-3xl mb-4 text-dream-cream">${escapeHtml(dc.analyze_heading)}</h3>
                <p class="text-purple-200/70 mb-6 max-w-lg mx-auto">
                    ${escapeHtml(dc.analyze_text)}
                </p>
                <a href="${getAndroidStoreUrl(lang)}" class="inline-flex items-center gap-2 px-8 py-4 bg-dream-salmon text-dream-dark rounded-full font-bold hover:bg-dream-salmon/90 transition-colors">
                    ${escapeHtml(dc.cta_button)} <i data-lucide="arrow-right" class="w-5 h-5"></i>
                </a>
            </aside>

            <!-- Related Articles -->
            <section class="mt-16 max-w-4xl mx-auto">
                <h2 class="font-serif text-2xl text-dream-cream mb-8">${escapeHtml(dc.related_heading)}</h2>
                <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
${relatedHtml}
                </div>
            </section>

        </div>
    </main>

    <!-- Footer -->
${renderGuidesFooter(lang, t, pages)}

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            const navbar = document.getElementById('navbar');
            const stickyBar = document.getElementById('stickyBar');
            const symbolCards = document.querySelectorAll('.symbol-card');
            const listSections = document.querySelectorAll('#symbolsList > section');

            // ── Navbar scroll effect ──────────────────────────────────────
            window.addEventListener('scroll', () => {
                if (navbar) { navbar.classList.toggle('py-2', window.scrollY > 50); navbar.classList.toggle('py-6', window.scrollY <= 50); }
            });

            function updateSectionScrollOffset() {
                if (!stickyBar) return;
                const stickyTop = parseFloat(window.getComputedStyle(stickyBar).top) || 0;
                const navbarHeight = navbar?.getBoundingClientRect().height || 0;
                const offset = Math.ceil(Math.max(navbarHeight, stickyTop) + stickyBar.getBoundingClientRect().height + 16);
                document.documentElement.style.setProperty('--dictionary-scroll-offset', \`\${offset}px\`);
            }

            updateSectionScrollOffset();
            window.addEventListener('resize', updateSectionScrollOffset);

            // ── Symbol card clickability (keyboard accessible) ────────────

            symbolCards.forEach((card) => {
                const link = card.querySelector('a[href]');
                if (!link) return;
                const href = link.getAttribute('href');
                if (!href) return;
                card.style.cursor = 'pointer';
                card.setAttribute('role', 'link');
                card.setAttribute('tabindex', '0');
                const title = card.querySelector('h3')?.textContent?.trim();
                if (title) card.setAttribute('aria-label', title);
                link.setAttribute('tabindex', '-1');
                const navigate = (openInNewTab = false) => {
                    if (openInNewTab) { window.open(href, '_blank', 'noopener'); return; }
                    window.location.href = href;
                };
                card.addEventListener('click', (e) => {
                    if (e.target.closest('a')) return;
                    if (e.metaKey || e.ctrlKey) { navigate(true); return; }
                    navigate(false);
                });
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(e.metaKey || e.ctrlKey); }
                });
            });

            // ── Category color borders (JS-driven) ───────────────────────
            const symbolCategories = {
${symbolCatEntries}
            };
            const categoryColors = {
                nature: '#4ade80', animals: '#fbbf24', body: '#f87171',
                places: '#60a5fa', objects: '#c084fc', actions: '#fb923c',
                people: '#f472b6', celestial: '#818cf8'
            };
            symbolCards.forEach((card) => {
                const link = card.querySelector('a[href]');
                if (!link) return;
                const slug = link.getAttribute('href').split('/').pop();
                const cat = symbolCategories[slug];
                if (cat) {
                    card.style.borderLeft = '3px solid ' + categoryColors[cat];
                    card.dataset.category = cat;
                }
            });

            // ── Shared search filter ──────────────────────────────────────
            function filterSymbols(query) {
                const noResults = document.getElementById('noResults');
                const noResultsQuery = document.getElementById('noResultsQuery');
                const q = query.toLowerCase().trim();
                if (q === '') {
                    symbolCards.forEach(card => card.style.display = '');
                    listSections.forEach(section => section.style.display = '');
                    if (noResults) noResults.style.display = 'none';
                } else {
                    listSections.forEach(section => {
                        const cards = section.querySelectorAll('.symbol-card');
                        let hasVisible = false;
                        cards.forEach(card => {
                            const symbolData = card.dataset.symbol || '';
                            const title = card.querySelector('h3')?.textContent?.toLowerCase() || '';
                            const content = card.querySelector('p')?.textContent?.toLowerCase() || '';
                            const visible = symbolData.includes(q) || title.includes(q) || content.includes(q);
                            card.style.display = visible ? '' : 'none';
                            if (visible) hasVisible = true;
                        });
                        section.style.display = hasVisible ? '' : 'none';
                    });
                    const anyVisible = [...listSections].some(s => s.style.display !== 'none');
                    if (noResults) { noResults.style.display = anyVisible ? 'none' : 'block'; }
                    if (noResultsQuery) { noResultsQuery.textContent = query; }
                }
            }

            // Hero search + sticky bar show/hide
            const heroSearch = document.getElementById('heroSearch');
            const stickySearch = document.getElementById('stickySearch');
            const heroHeader = heroSearch.closest('header');
            const heroObserver = new IntersectionObserver(([entry]) => {
                stickyBar.classList.toggle('sb-visible', !entry.isIntersecting);
            }, { threshold: 0 });
            heroObserver.observe(heroHeader);

            heroSearch.addEventListener('input', (e) => {
                stickySearch.value = e.target.value;
                filterSymbols(e.target.value);
            });
            stickySearch.addEventListener('input', (e) => {
                heroSearch.value = e.target.value;
                filterSymbols(e.target.value);
            });

            // ── Smooth scroll for letter navigation ───────────────────────
            document.querySelectorAll('.letter-link, .sidebar-alpha-link, .mobile-alpha-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = document.querySelector(link.getAttribute('href'));
                    updateSectionScrollOffset();
                    if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                });
            });

            // ── Active letter tracking (IntersectionObserver) ─────────────
            function setActiveAlpha(letter) {
                document.querySelectorAll('.letter-link, .sidebar-alpha-link, .mobile-alpha-link').forEach(l => {
                    l.classList.toggle('alpha-active', l.dataset.letter === letter);
                });
            }
            const alphaObserver = new IntersectionObserver((entries) => {
                entries.forEach(e => { if (e.isIntersecting) setActiveAlpha(e.target.id); });
            }, { rootMargin: '-5% 0px -80% 0px' });
            listSections.forEach(s => alphaObserver.observe(s));

            // ── Back-to-top button ────────────────────────────────────────
            const backToTop = document.getElementById('backToTop');
            window.addEventListener('scroll', () => {
                backToTop.style.display = window.scrollY > 400 ? 'flex' : 'none';
            }, { passive: true });
            backToTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    </script>
    <script src="/js/language-dropdown.js?v=${version}" defer></script>
</body>
</html>`;
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
    const dictPath = path.join(DOCS_DIR, lang, 'guides', `${i18n[lang].dictionary_slug}.html`);
    const dictHtml = generateDictionaryPage(lang, i18n[lang]);
    const currentDict = fs.existsSync(dictPath) ? fs.readFileSync(dictPath, 'utf8') : null;
    if (currentDict !== dictHtml) {
      dictionaries += 1;
      if (!DRY_RUN) fs.writeFileSync(dictPath, dictHtml, 'utf8');
      console.log(`${DRY_RUN ? 'Would generate' : 'Generated'} docs/${lang}/guides/${i18n[lang].dictionary_slug}.html`);
    }
  }
  console.log(`[fix-guides-architecture] mode=${DRY_RUN ? 'dry-run' : 'write'} hubPages=${hubs} dictionaryPages=${dictionaries}`);
}

if (require.main === module) main();
