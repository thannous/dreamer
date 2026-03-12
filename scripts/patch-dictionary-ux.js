#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Applies the UX overhaul (hero search, sticky bar, intermediate CTA,
 * FAQ/CTA reorder, 3-col related articles, contrast fixes, JS update)
 * to FR, ES, DE, IT dictionary pages.
 */
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'docs');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Per-language config ───────────────────────────────────────────────────────
const LANGS = {
  fr: {
    file: 'fr/guides/dictionnaire-symboles-reves.html',
    heroPlaceholder: 'Rechercher un symbole (eau, serpent, chute…)',
    stickyPlaceholder: 'Rechercher…',
    ctaHeading: 'Prêt à décoder <em class="text-dream-salmon not-italic">vos</em> rêves\u00a0?',
    ctaSub: 'Analyse IA personnalisée selon le contexte de votre rêve.',
    ctaBtn: 'Essayer Noctalia',
    relArticles: [
      { href: '../blog/signification-reves-recurrents', tag: 'Interprétation', title: 'Rêves récurrents : significations', desc: 'Pourquoi certains rêves reviennent encore et encore.' },
      { href: '../blog/comment-se-souvenir-de-ses-reves', tag: 'Guide', title: 'Comment se souvenir de ses rêves', desc: 'Techniques pour améliorer votre mémoire onirique.' },
      { href: '../blog/journal-de-reves', tag: 'Pratique', title: 'Tenir un journal de rêves', desc: 'Commencez votre journal onirique dès ce soir.' },
    ],
    relTitle: 'Articles connexes',
  },
  es: {
    file: 'es/guides/diccionario-simbolos-suenos.html',
    heroPlaceholder: 'Buscar un símbolo (agua, serpiente, caída…)',
    stickyPlaceholder: 'Buscar símbolo…',
    ctaHeading: '¿Listo para descifrar <em class="text-dream-salmon not-italic">tus</em> sueños?',
    ctaSub: 'Análisis IA personalizado según el contexto de tu sueño.',
    ctaBtn: 'Probar Noctalia',
    relArticles: [
      { href: '../blog/significado-suenos-recurrentes', tag: 'Interpretación', title: 'Sueños recurrentes: significados', desc: 'Por qué ciertos sueños siguen volviendo.' },
      { href: '../blog/como-recordar-suenos', tag: 'Guía', title: 'Cómo Recordar tus Sueños', desc: 'Técnicas para mejorar tu recuerdo de sueños.' },
      { href: '../blog/guia-diario-suenos', tag: 'Práctica', title: 'Cómo Llevar un Diario de Sueños', desc: 'Empieza tu diario de sueños esta noche.' },
    ],
    relTitle: 'Artículos relacionados',
  },
  de: {
    file: 'de/guides/traumsymbole-lexikon.html',
    heroPlaceholder: 'Symbol suchen (Wasser, Schlange, Fallen…)',
    stickyPlaceholder: 'Symbol suchen…',
    ctaHeading: 'Bereit, <em class="text-dream-salmon not-italic">deine</em> Träume zu entschlüsseln?',
    ctaSub: 'KI-Analyse, die auf den Kontext deines Traums zugeschnitten ist.',
    ctaBtn: 'Noctalia ausprobieren',
    relArticles: [
      { href: '../blog/wiederkehrende-traeume-bedeuten-ihre-verborgenen-botschaften-verstehen', tag: 'Deutung', title: 'Wiederkehrende Träume: Bedeutungen', desc: 'Warum manche Träume immer wiederkehren.' },
      { href: '../blog/so-erinnern-sie-sich-an-ihre-traeume-10-effektive-techniken', tag: 'Ratgeber', title: 'Wie du dich an deine Träume erinnerst', desc: 'Techniken zur Verbesserung deiner Traumerinnerung.' },
      { href: '../blog/dream-journaling-der-vollstaendige-leitfaden-zum-aufzeichnen-ihrer-naechtlichen-abenteuer', tag: 'Praxis', title: 'Traumtagebuch führen', desc: 'Beginne noch heute Nacht mit deinem Traumtagebuch.' },
    ],
    relTitle: 'Verwandte Artikel',
  },
  it: {
    file: 'it/guides/dizionario-simboli-sogni.html',
    heroPlaceholder: 'Cerca un simbolo (acqua, serpente, caduta…)',
    stickyPlaceholder: 'Cerca simbolo…',
    ctaHeading: 'Pronto a decifrare <em class="text-dream-salmon not-italic">i tuoi</em> sogni?',
    ctaSub: 'Analisi IA personalizzata in base al contesto del tuo sogno.',
    ctaBtn: 'Prova Noctalia',
    relArticles: [
      { href: '../blog/significato-dei-sogni-ricorrenti-comprendere-i-loro-messaggi-nascosti', tag: 'Interpretazione', title: 'Sogni ricorrenti: significati', desc: 'Perché certi sogni continuano a tornare.' },
      { href: '../blog/come-ricordare-i-tuoi-sogni-10-tecniche-efficaci', tag: 'Guida', title: 'Come ricordare i sogni', desc: 'Tecniche per migliorare il ricordo dei tuoi sogni.' },
      { href: '../blog/dream-journaling-la-guida-completa-per-registrare-le-tue-avventure-notturne', tag: 'Pratica', title: 'Tenere un diario dei sogni', desc: 'Inizia il tuo diario onirico questa sera.' },
    ],
    relTitle: 'Articoli correlati',
  },
};

// ── CSS block to inject (same for all langs) ──────────────────────────────────
const CSS_EXTRA = `        .letter-link { transition: all 0.2s ease; min-width: 1.75rem; text-align: center; border-radius: 0.375rem; padding: 2px 4px; }
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
        .hero-search:focus { outline: none; border-color: #FDA481; }`;

// ── Shared JS block (same for all langs) ──────────────────────────────────────
const JS_BLOCK = `    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

            // ── Navbar scroll effect ──────────────────────────────────────
            window.addEventListener('scroll', () => {
                const navbar = document.getElementById('navbar');
                if (navbar) { navbar.classList.toggle('py-2', window.scrollY > 50); navbar.classList.toggle('py-6', window.scrollY <= 50); }
            });

            // ── Symbol card clickability (keyboard accessible) ────────────
            const symbolCards = document.querySelectorAll('.symbol-card');
            const listSections = document.querySelectorAll('#symbolsList > section');

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
                baby: 'people', bird: 'animals', blood: 'body', bridge: 'places', lost: 'actions',
                car: 'objects', cat: 'animals', 'being-chased': 'actions', child: 'people', clothes: 'objects',
                cliff: 'places', crying: 'actions', death: 'actions', 'deceased-person': 'people', dog: 'animals',
                door: 'objects', exam: 'actions', elevator: 'objects', 'ex-partner': 'people',
                falling: 'actions', fire: 'nature', flying: 'actions', forest: 'nature', flood: 'nature',
                house: 'places', horse: 'animals', hospital: 'places', key: 'objects', lion: 'animals',
                mirror: 'objects', money: 'objects', moon: 'celestial', mountain: 'nature', mouth: 'body',
                naked: 'body', night: 'celestial', ocean: 'nature', path: 'places', phone: 'objects',
                plane: 'objects', pregnancy: 'body', rain: 'nature', rainbow: 'celestial', running: 'actions',
                snake: 'animals', spider: 'animals', stairs: 'places', sun: 'celestial', school: 'places',
                storm: 'nature', swimming: 'actions', teeth: 'body', train: 'objects', tree: 'nature',
                water: 'nature', wedding: 'actions', wolf: 'animals'
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
                const q = query.toLowerCase().trim();
                if (q === '') {
                    symbolCards.forEach(card => card.style.display = '');
                    listSections.forEach(section => section.style.display = '');
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
                }
            }

            // Hero search + sticky bar show/hide
            const heroSearch = document.getElementById('heroSearch');
            const stickySearch = document.getElementById('stickySearch');
            const stickyBar = document.getElementById('stickyBar');
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
            document.querySelectorAll('.letter-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = document.querySelector(link.getAttribute('href'));
                    if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                });
            });

            // ── Active letter tracking (IntersectionObserver) ─────────────
            function setActiveAlpha(letter) {
                document.querySelectorAll('.letter-link').forEach(l => {
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
    </script>`;

function buildStickyBar(letters, placeholder) {
  const letterLinks = letters.map(l =>
    `                        <a href="#${l}" class="letter-link text-sm" style="color:rgba(196,181,253,0.75);" data-letter="${l}">${l}</a>`
  ).join('\n');
  return `            <!-- Sticky Search + Alphabet bar (above categories) -->
            <div id="stickyBar" class="glass-panel rounded-2xl p-4 mb-8">
                <div class="sb-inner">
                    <!-- Compact search -->
                    <div class="sb-search">
                        <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/50 pointer-events-none"></i>
                        <input type="text" id="stickySearch" placeholder="${placeholder}"
                            class="search-input w-full rounded-full py-2 pl-10 pr-4 text-sm text-dream-cream transition-colors"
                            style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);outline:none;">
                    </div>
                    <!-- Alphabet -->
                    <div class="sb-alpha letter-nav">
${letterLinks}
                    </div>
                    <!-- Back to top -->
                    <button id="backToTop" class="glass-button rounded-full text-purple-300/70 hover:text-white transition-colors" aria-label="Back to top" title="Back to top" style="display:none;flex-shrink:0;padding:6px;">
                        <i data-lucide="arrow-up" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>`;
}

function buildRelatedArticles(cfg) {
  const cards = cfg.relArticles.map(a => `                    <a href="${a.href}" class="glass-panel rounded-xl p-6 block hover:border-dream-salmon/30 border border-transparent transition-colors">
                        <span class="text-xs text-dream-salmon uppercase mb-2 block">${a.tag}</span>
                        <h3 class="font-serif text-lg text-dream-cream mb-2">${a.title}</h3>
                        <p class="text-sm text-gray-300">${a.desc}</p>
                    </a>`).join('\n');
  return `            <!-- Related Articles -->
            <section class="mt-16 max-w-4xl mx-auto">
                <h2 class="font-serif text-2xl text-dream-cream mb-8">${cfg.relTitle}</h2>
                <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
${cards}
                </div>
            </section>`;
}

function patchLang(lang, cfg) {
  const absPath = path.join(DOCS, cfg.file);
  let html = fs.readFileSync(absPath, 'utf8').replace(/\r\n/g, '\n');
  const original = html;

  // 1. Replace CSS block: add sticky bar + letter-link styles
  html = html.replace(
    /\.letter-nav \{ scroll-behavior: smooth; \}\n        \.letter-link \{ transition: all 0\.2s ease; \}\n        \.letter-link:hover, \.letter-link\.active \{ color: #FDA481; transform: scale\(1\.1\); \}\n        \.search-input:focus \{ outline: none; border-color: #FDA481; \}/,
    CSS_EXTRA
  );

  // 2. Compact hero: remove REFERENCE GUIDE badge div + wrap, keep browse link, add hero search
  // Find the header block and replace it
  html = html.replace(
    /[ \t]*<!-- Header -->\n\t+<header class="text-center mb-16">\n\t+.*?GUIDE.*?\n\t+.*?\n\t+<\/div>[\s\S]*?<\/header>/,
    (match) => {
      // Extract h1 content
      const h1Match = match.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      const h1 = h1Match ? h1Match[0] : '';
      // Extract p description
      const pMatch = match.match(/<p class="text-lg[^>]*>([\s\S]*?)<\/p>/);
      const p = pMatch ? pMatch[0].replace('text-lg text-purple-200/80', 'text-lg text-purple-200/80').replace(/mb-\d+/, '') : '';
      // Extract browse link href
      const browseMatch = match.match(/<a href="([^"]+)" class="inline-flex items-center gap-2 text-xs font-mono[^"]*">[^<]+<\/a>/);
      const browseHref = browseMatch ? browseMatch[1] : `/${lang}/guides/`;
      const browseText = browseMatch ? browseMatch[0].match(/>([^<]+)<\/a>/)[1] : '';
      return `            <!-- Header -->
            <header class="text-center mb-8">
                <a href="${browseHref}" class="inline-flex items-center gap-2 text-xs font-mono text-purple-200/70 border border-white/10 rounded-full px-4 py-2 hover:text-white hover:border-dream-salmon/30 transition-colors mb-5">${browseText}</a>

                ${h1.replace('mb-6', 'mb-4')}

                ${p.replace('<p class="text-lg text-purple-200/80 leading-relaxed max-w-2xl mx-auto">', '<p class="text-lg text-purple-200/80 leading-relaxed max-w-2xl mx-auto mb-6">')}

                <!-- Hero search -->
                <div class="relative max-w-xl mx-auto">
                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/50 pointer-events-none"></i>
                    <input type="text" id="heroSearch" placeholder="${cfg.heroPlaceholder}"
                        class="hero-search w-full bg-white/8 border border-white/15 rounded-full py-4 pl-12 pr-6 text-base text-dream-cream placeholder:text-purple-300/50 transition-colors">
                </div>
            </header>`;
    }
  );

  // 3. Find the letter sections to extract letters for the sticky bar
  const letterMatches = [...html.matchAll(/<section id="([A-Z])" class="mb-12">/g)].map(m => m[1]);
  const stickyBarHtml = buildStickyBar(letterMatches.length ? letterMatches : ['B','C','D','E','F','H','K','L','M','N','O','P','R','S','T','W'], cfg.stickyPlaceholder);

  // 4. Insert sticky bar before categories section, remove old search section
  // Find the categories section (first <section class="mb-12"> after header)
  html = html.replace(
    /[ \t]*<!-- (?:Parcourir par catégorie|Browse by Category|Buscar por categoría|Browse nach Kategorie|Sfoglia per categoria|Categorías|Kategorien|Categorie|Catégories|Parcourir par cat[^>]*)? -->\n[ \t]*<section class="mb-12">\n[ \t]*<h2[^>]*>\n[ \t]*<i data-lucide="grid-3x3"/,
    (match) => `\n${stickyBarHtml}\n\n${match.trim()}`
  );

  // 5. Remove old Search & Navigation section
  html = html.replace(
    /\n[ \t]*<!-- (?:Search &amp; Navigation|Recherche et navigation|Búsqueda y navegación|Suche &amp; Navigation|Ricerca e navigazione|Search & Navigation)[^-]*-->\n[ \t]*<div class="glass-panel rounded-2xl p-6 mb-12">[\s\S]*?<\/div>\n/,
    '\n'
  );

  // 6. Add intermediate CTA before symbolsList
  const ctaHtml = `\n            <!-- Intermediate CTA -->
            <div class="glass-panel rounded-2xl p-5 mb-12 flex items-center justify-between flex-wrap gap-4 border border-dream-salmon/10">
                <div>
                    <p class="font-serif text-dream-cream text-lg">${cfg.ctaHeading}</p>
                    <p class="text-sm text-purple-200/70 mt-1">${cfg.ctaSub}</p>
                </div>
                <a href="/${lang}/" class="inline-flex items-center gap-2 px-6 py-3 bg-dream-salmon text-dream-dark rounded-full font-bold hover:bg-dream-salmon/90 transition-colors text-sm shrink-0">
                    ${cfg.ctaBtn} <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </a>
            </div>\n`;
  html = html.replace(/\n[ \t]*<!-- Symbols Dictionary -->/, ctaHtml + '\n            <!-- Symbols Dictionary -->');

  // 7. Swap CTA and FAQ (FAQ before CTA)
  // Match the CTA section followed by FAQ section
  html = html.replace(
    /([ \t]*<!-- CTA Section -->[\s\S]*?<\/aside>)\n\n([ \t]*<!-- FAQ Section -->[\s\S]*?<\/section>)/,
    '$2\n\n$1'
  );

  // 8. Update FAQ answer text-gray-400 -> text-gray-300
  html = html.replace(/(<p class="mt-4 text-sm )text-gray-400( leading-relaxed">)/g, '$1text-gray-300$2');

  // 9. Replace Related Articles section
  html = html.replace(
    /[ \t]*<!-- Related Articles -->[\s\S]*?<\/section>\n\n[ \t]*<\/div>\n[ \t]*<\/main>/,
    `${buildRelatedArticles(cfg)}\n\n        </div>\n    </main>`
  );

  // 10. Contrast: symbol counts /60 -> /80
  html = html.replace(/text-purple-300\/60(?=")/g, 'text-purple-300/80');

  // 11. Replace JS block
  html = html.replace(
    /[ \t]*<script>\n[ \t]*document\.addEventListener\('DOMContentLoaded'[\s\S]*?<\/script>/,
    JS_BLOCK
  );

  if (html === original) {
    console.log(`[SKIP] ${cfg.file} — no changes detected`);
    return false;
  }
  if (!DRY_RUN) {
    fs.writeFileSync(absPath, html, 'utf8');
    console.log(`[OK]   ${cfg.file}`);
  } else {
    console.log(`[DRY]  ${cfg.file} — would patch`);
  }
  return true;
}

// Run
let patched = 0;
for (const [lang, cfg] of Object.entries(LANGS)) {
  if (patchLang(lang, cfg)) patched++;
}
console.log(`\nDone. mode=${DRY_RUN ? 'dry-run' : 'write'} patched=${patched}/${Object.keys(LANGS).length}`);
