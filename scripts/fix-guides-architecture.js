#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { SUPPORTED_LANGS } = require('./lib/docs-seo-utils');
const { createRenderContext } = require('./lib/docs-components/context');
const { renderFooter: renderSharedFooter } = require('./lib/docs-components/footer');
const { renderNavigation } = require('./lib/docs-components/navigation');
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
const SITE_MANIFEST = fs.existsSync(path.join(ROOT_DATA_DIR, 'site-manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT_DATA_DIR, 'site-manifest.json'), 'utf8'))
  : { collections: { blog: { entries: {} } } };

const LOCALES = Object.fromEntries(
  SUPPORTED_LANGS.map((lang) => {
    const localePath = path.join(DOCS_SRC_DIR, 'locales', `${lang}.json`);
    return [lang, fs.existsSync(localePath) ? JSON.parse(fs.readFileSync(localePath, 'utf8')) : {}];
  })
);

function createGuidesShellContext(lang, currentPaths, activeNav) {
  const locales = Object.fromEntries(
    SUPPORTED_LANGS.map((candidate) => [
      candidate,
      { path: currentPaths[candidate] || `/${candidate}/guides/` },
    ])
  );

  return createRenderContext({
    manifest: SITE_MANIFEST,
    entryId: 'guide.index',
    meta: {
      lang,
      layout: 'generated',
      activeNav,
    },
    entryOverride: {
      id: `generated.guide.${activeNav}`,
      locales,
    },
  });
}

const COPY = {
  en: { label: 'Dream Guides', title: 'Dream Guides & Symbol Meanings | Noctalia', desc: "Browse Noctalia's dream guides: the dictionary plus themed pages for common, scary, positive, water, people, places, and transformation dreams.", intro: 'Start with the full dream symbols dictionary, then explore themed guides that group related dream patterns and meanings.', dictionary: 'Dream Symbols Dictionary', openDictionary: 'Open dictionary', openGuide: 'Open guide', browseAll: 'Browse all dream guides' },
  fr: { label: 'Guides des rêves', title: 'Guides des rêves et symboles oniriques | Noctalia', desc: 'Explorez les guides des rêves de Noctalia : dictionnaire des symboles, thèmes fréquents, cauchemars, eau, personnes, lieux et transformation.', intro: 'Commencez par le dictionnaire complet des symboles, puis explorez des guides thématiques qui regroupent des motifs oniriques proches.', dictionary: 'Dictionnaire des symboles de rêves', openDictionary: 'Ouvrir le dictionnaire', openGuide: 'Ouvrir le guide', browseAll: 'Parcourir tous les guides des rêves' },
  es: { label: 'Guías de sueños', title: 'Guías de sueños y significados de símbolos | Noctalia', desc: 'Explora las guías de sueños de Noctalia: diccionario de símbolos, sueños frecuentes, pesadillas, agua, personas, lugares y transformación.', intro: 'Empieza por el diccionario completo de símbolos y luego entra en guías temáticas que agrupan patrones y significados relacionados.', dictionary: 'Diccionario de símbolos de sueños', openDictionary: 'Abrir diccionario', openGuide: 'Abrir guía', browseAll: 'Ver todas las guías de sueños' },
  de: { label: 'Traumratgeber', title: 'Traumratgeber & Traumsymbole | Noctalia', desc: 'Entdecken Sie Noctalias Traumratgeber: Traumsymbole-Lexikon sowie Guides zu häufigen Träumen, Albträumen, Wasser, Personen, Orten und Wandel.', intro: 'Starten Sie mit dem vollständigen Traumsymbole-Lexikon und vertiefen Sie sich dann in thematische Ratgeber zu verwandten Traumthemen.', dictionary: 'Traumsymbole-Lexikon', openDictionary: 'Lexikon öffnen', openGuide: 'Ratgeber öffnen', browseAll: 'Alle Traumratgeber ansehen' },
  it: { label: 'Guide ai sogni', title: 'Guide ai sogni e significati dei simboli | Noctalia', desc: 'Esplora le guide ai sogni di Noctalia: dizionario dei simboli e percorsi su sogni comuni, incubi, acqua, persone, luoghi e trasformazione.', intro: 'Inizia dal dizionario completo dei simboli e poi approfondisci con guide tematiche che raggruppano schemi e significati collegati.', dictionary: 'Dizionario dei simboli dei sogni', openDictionary: 'Apri il dizionario', openGuide: 'Apri la guida', browseAll: 'Sfoglia tutte le guide ai sogni' },
};

const GUIDE_HUB_UI = {
  en: {
    eyebrow: 'Dream guides',
    heroIntro: 'Practical guides, accessible science, and keys to understand, interpret, and work with your dreams.',
    primaryCta: 'Explore the guides',
    secondaryCta: 'Open dictionary',
    chooseTitle: 'Choose your entry point',
    chooseIntro: 'Start with the dictionary or explore practical guides by theme.',
    featuredLabel: 'Dream dictionary',
    dictionarySummary: 'Access our complete dictionary of more than 2000 symbols and interpretations.',
    dictionaryCta: 'Consult the dictionary',
    trustVerified: 'Verified content',
    trustVerifiedDesc: 'Guides written with sleep and dream research references.',
    trustUpdated: 'Updated regularly',
    trustUpdatedDesc: 'New guides and research added over time.',
    trustAccessible: 'Accessible to all',
    trustAccessibleDesc: 'Clear, practical content for every level.',
    symbolCount: 'symbols explored',
    pathSymbols: 'Symbols',
    pathSymbolsDesc: 'Understand the meaning of the most common dream symbols.',
    pathNightmares: 'Nightmares',
    pathNightmaresDesc: 'Decode your nocturnal fears to better tame them.',
    pathLucid: 'Lucid dream',
    pathLucidDesc: 'Learn to become aware and orient your dreams.'
  },
  fr: {
    eyebrow: 'Guides des rêves',
    heroIntro: 'Des guides pratiques, une science accessible et des clés pour comprendre, interpréter et travailler avec vos rêves.',
    primaryCta: 'Explorer les guides',
    secondaryCta: 'Dictionnaire',
    chooseTitle: "Choisissez votre point d'entrée",
    chooseIntro: 'Commencez par le dictionnaire ou explorez nos guides pratiques par thématique.',
    featuredLabel: 'Dictionnaire des rêves',
    dictionarySummary: 'Accédez à notre dictionnaire complet de plus de 2000 symboles et leurs interprétations.',
    dictionaryCta: 'Consulter le dictionnaire',
    trustVerified: 'Contenus vérifiés',
    trustVerifiedDesc: 'Guides rédigés avec des références sur le rêve et le sommeil.',
    trustUpdated: 'Mise à jour régulière',
    trustUpdatedDesc: 'De nouveaux guides et recherches ajoutés avec le temps.',
    trustAccessible: 'Accessible à tous',
    trustAccessibleDesc: 'Des contenus clairs et pratiques, pour tous les niveaux.',
    symbolCount: 'symboles explorés',
    pathSymbols: 'Symboles',
    pathSymbolsDesc: 'Comprenez la signification des symboles oniriques les plus courants.',
    pathNightmares: 'Cauchemars',
    pathNightmaresDesc: 'Décryptez vos peurs nocturnes pour mieux les apprivoiser.',
    pathLucid: 'Rêve lucide',
    pathLucidDesc: 'Apprenez à prendre conscience et à orienter vos rêves.'
  },
  es: {
    eyebrow: 'Guías de sueños',
    heroIntro: 'Guías prácticas, ciencia accesible y claves para comprender, interpretar y trabajar con tus sueños.',
    primaryCta: 'Explorar guías',
    secondaryCta: 'Diccionario',
    chooseTitle: 'Elige tu punto de entrada',
    chooseIntro: 'Empieza por el diccionario o explora nuestras guías prácticas por tema.',
    featuredLabel: 'Diccionario de sueños',
    dictionarySummary: 'Accede a nuestro diccionario completo de más de 2000 símbolos e interpretaciones.',
    dictionaryCta: 'Consultar diccionario',
    trustVerified: 'Contenido verificado',
    trustVerifiedDesc: 'Guías basadas en referencias sobre sueños y sueño.',
    trustUpdated: 'Actualización regular',
    trustUpdatedDesc: 'Nuevas guías e investigaciones añadidas con el tiempo.',
    trustAccessible: 'Accesible para todos',
    trustAccessibleDesc: 'Contenidos claros y prácticos para todos los niveles.',
    symbolCount: 'símbolos explorados',
    pathSymbols: 'Símbolos',
    pathSymbolsDesc: 'Comprende el significado de los símbolos oníricos más comunes.',
    pathNightmares: 'Pesadillas',
    pathNightmaresDesc: 'Descifra tus miedos nocturnos para apaciguarlos.',
    pathLucid: 'Sueño lúcido',
    pathLucidDesc: 'Aprende a tomar conciencia y orientar tus sueños.'
  },
  de: {
    eyebrow: 'Traumratgeber',
    heroIntro: 'Praktische Ratgeber, verständliche Wissenschaft und Schlüssel, um Ihre Träume zu verstehen und zu deuten.',
    primaryCta: 'Ratgeber erkunden',
    secondaryCta: 'Lexikon',
    chooseTitle: 'Wählen Sie Ihren Einstieg',
    chooseIntro: 'Starten Sie im Lexikon oder erkunden Sie praktische Ratgeber nach Thema.',
    featuredLabel: 'Traumlexikon',
    dictionarySummary: 'Greifen Sie auf unser vollständiges Lexikon mit über 2000 Symbolen und Deutungen zu.',
    dictionaryCta: 'Lexikon öffnen',
    trustVerified: 'Geprüfte Inhalte',
    trustVerifiedDesc: 'Ratgeber mit Bezügen zu Traum- und Schlafforschung.',
    trustUpdated: 'Regelmäßig aktualisiert',
    trustUpdatedDesc: 'Neue Ratgeber und Forschung werden ergänzt.',
    trustAccessible: 'Für alle zugänglich',
    trustAccessibleDesc: 'Klare und praktische Inhalte für jedes Niveau.',
    symbolCount: 'Symbole erklärt',
    pathSymbols: 'Symbole',
    pathSymbolsDesc: 'Verstehen Sie die häufigsten Traumsymbole.',
    pathNightmares: 'Albträume',
    pathNightmaresDesc: 'Entschlüsseln Sie nächtliche Ängste und lernen Sie damit umzugehen.',
    pathLucid: 'Klartraum',
    pathLucidDesc: 'Lernen Sie, im Traum bewusst zu werden.'
  },
  it: {
    eyebrow: 'Guide ai sogni',
    heroIntro: 'Guide pratiche, scienza accessibile e chiavi per comprendere, interpretare e lavorare con i tuoi sogni.',
    primaryCta: 'Esplora le guide',
    secondaryCta: 'Dizionario',
    chooseTitle: 'Scegli il tuo punto di partenza',
    chooseIntro: 'Inizia dal dizionario o esplora le guide pratiche per tema.',
    featuredLabel: 'Dizionario dei sogni',
    dictionarySummary: 'Accedi al nostro dizionario completo con oltre 2000 simboli e interpretazioni.',
    dictionaryCta: 'Consulta il dizionario',
    trustVerified: 'Contenuti verificati',
    trustVerifiedDesc: 'Guide basate su riferimenti su sogni e sonno.',
    trustUpdated: 'Aggiornamento regolare',
    trustUpdatedDesc: 'Nuove guide e ricerche aggiunte nel tempo.',
    trustAccessible: 'Accessibile a tutti',
    trustAccessibleDesc: 'Contenuti chiari e pratici per ogni livello.',
    symbolCount: 'simboli esplorati',
    pathSymbols: 'Simboli',
    pathSymbolsDesc: 'Comprendi i simboli onirici più comuni.',
    pathNightmares: 'Incubi',
    pathNightmaresDesc: 'Decifra le paure notturne per gestirle meglio.',
    pathLucid: 'Sogno lucido',
    pathLucidDesc: 'Impara a diventare consapevole e orientare i sogni.'
  }
};

const GUIDE_HUB_BLOG_SLUGS = {
  lucid: {
    en: 'lucid-dreaming-beginners-guide',
    fr: 'guide-reve-lucide-debutant',
    es: 'guia-suenos-lucidos-principiantes',
    de: 'leitfaden-zum-klartraeumen-fuer-anfaenger-uebernehmen-sie-die-kontrolle-ueber-ihre-naechte',
    it: 'guida-ai-sogni-lucidi-per-principianti-prendi-il-controllo-delle-tue-notti'
  },
  sleepScience: {
    en: 'why-we-dream-science',
    fr: 'pourquoi-nous-revons-science',
    es: 'por-que-sonamos-ciencia',
    de: 'warum-traeumen-wir-die-wissenschaft-hinter-ihren-naechtlichen-abenteuern',
    it: 'perche-sogniamo-la-scienza-dietro-le-tue-avventure-notturne'
  },
  journal: {
    en: 'dream-journal-guide',
    fr: 'guide-journal-reves',
    es: 'guia-diario-suenos',
    de: 'dream-journaling-der-vollstaendige-leitfaden-zum-aufzeichnen-ihrer-naechtlichen-abenteuer',
    it: 'dream-journaling-la-guida-completa-per-registrare-le-tue-avventure-notturne'
  },
  emotions: {
    en: 'dreams-mental-health',
    fr: 'reves-sante-mentale',
    es: 'suenos-salud-mental',
    de: 'traeume-und-psychische-gesundheit-wie-ihr-schlaf-ihren-geist-offenbart',
    it: 'sogni-e-salute-mentale-come-il-tuo-sonno-rivela-la-tua-mente'
  }
};

const GUIDE_HUB_BENTO_COPY = {
  en: [
    { key: 'understand', label: 'Practical guide', title: 'Understand your dreams', desc: 'The fundamentals for decoding the language of your unconscious.', tone: 'salmon' },
    { key: 'science', label: 'Science', title: 'Sleep and dreams', desc: 'What science reveals about your nights and dreams.', tone: 'violet' },
    { key: 'interpretation', label: 'Interpretation', title: 'Interpretation methods', desc: 'Concrete techniques to analyze your dreams with more accuracy.', tone: 'rose' },
    { key: 'journal', label: 'Practice', title: 'Dream journal', desc: 'Methods and advice for keeping an effective journal.', tone: 'gold' },
    { key: 'emotions', label: 'Therapies', title: 'Dreams and emotions', desc: 'Use your dreams as a tool for self-knowledge and transformation.', tone: 'green' },
    { key: 'spirituality', label: 'Spirituality', title: 'Dreams and spirituality', desc: 'Explore the spiritual and symbolic dimension of your dreams.', tone: 'blue' }
  ],
  fr: [
    { key: 'understand', label: 'Guide pratique', title: 'Comprendre ses rêves', desc: 'Les fondamentaux pour décrypter le langage de votre inconscient.', tone: 'salmon' },
    { key: 'science', label: 'Science', title: 'Le sommeil et les rêves', desc: 'Ce que la science révèle sur vos nuits et vos rêves.', tone: 'violet' },
    { key: 'interpretation', label: 'Interprétation', title: "Méthodes d'interprétation", desc: 'Techniques concrètes pour analyser vos rêves avec justesse.', tone: 'rose' },
    { key: 'journal', label: 'Pratique', title: 'Journal de rêves', desc: 'Méthodes et conseils pour tenir un journal efficace.', tone: 'gold' },
    { key: 'emotions', label: 'Thérapies', title: 'Rêves et émotions', desc: 'Utiliser vos rêves comme outil de connaissance et de transformation.', tone: 'green' },
    { key: 'spirituality', label: 'Spiritualité', title: 'Rêves et spiritualité', desc: 'Explorer la dimension spirituelle et symbolique de vos rêves.', tone: 'blue' }
  ],
  es: [
    { key: 'understand', label: 'Guía práctica', title: 'Comprender tus sueños', desc: 'Los fundamentos para descifrar el lenguaje de tu inconsciente.', tone: 'salmon' },
    { key: 'science', label: 'Ciencia', title: 'El sueño y los sueños', desc: 'Lo que la ciencia revela sobre tus noches y tus sueños.', tone: 'violet' },
    { key: 'interpretation', label: 'Interpretación', title: 'Métodos de interpretación', desc: 'Técnicas concretas para analizar tus sueños con precisión.', tone: 'rose' },
    { key: 'journal', label: 'Práctica', title: 'Diario de sueños', desc: 'Métodos y consejos para llevar un diario eficaz.', tone: 'gold' },
    { key: 'emotions', label: 'Terapias', title: 'Sueños y emociones', desc: 'Usa tus sueños como herramienta de conocimiento y transformación.', tone: 'green' },
    { key: 'spirituality', label: 'Espiritualidad', title: 'Sueños y espiritualidad', desc: 'Explora la dimensión espiritual y simbólica de tus sueños.', tone: 'blue' }
  ],
  de: [
    { key: 'understand', label: 'Praxisratgeber', title: 'Träume verstehen', desc: 'Die Grundlagen, um die Sprache Ihres Unbewussten zu entschlüsseln.', tone: 'salmon' },
    { key: 'science', label: 'Wissenschaft', title: 'Schlaf und Träume', desc: 'Was die Wissenschaft über Ihre Nächte und Träume zeigt.', tone: 'violet' },
    { key: 'interpretation', label: 'Deutung', title: 'Deutungsmethoden', desc: 'Konkrete Techniken, um Träume genauer zu analysieren.', tone: 'rose' },
    { key: 'journal', label: 'Praxis', title: 'Traumtagebuch', desc: 'Methoden und Tipps für ein wirksames Traumtagebuch.', tone: 'gold' },
    { key: 'emotions', label: 'Therapie', title: 'Träume und Gefühle', desc: 'Nutzen Sie Träume als Werkzeug für Erkenntnis und Wandel.', tone: 'green' },
    { key: 'spirituality', label: 'Spiritualität', title: 'Träume und Spiritualität', desc: 'Erkunden Sie die spirituelle und symbolische Dimension Ihrer Träume.', tone: 'blue' }
  ],
  it: [
    { key: 'understand', label: 'Guida pratica', title: 'Comprendere i sogni', desc: "Le basi per decifrare il linguaggio dell'inconscio.", tone: 'salmon' },
    { key: 'science', label: 'Scienza', title: 'Sonno e sogni', desc: 'Cosa rivela la scienza sulle tue notti e sui tuoi sogni.', tone: 'violet' },
    { key: 'interpretation', label: 'Interpretazione', title: 'Metodi di interpretazione', desc: 'Tecniche concrete per analizzare i sogni con precisione.', tone: 'rose' },
    { key: 'journal', label: 'Pratica', title: 'Diario dei sogni', desc: 'Metodi e consigli per tenere un diario efficace.', tone: 'gold' },
    { key: 'emotions', label: 'Terapie', title: 'Sogni ed emozioni', desc: 'Usa i sogni come strumento di conoscenza e trasformazione.', tone: 'green' },
    { key: 'spirituality', label: 'Spiritualità', title: 'Sogni e spiritualità', desc: 'Esplora la dimensione spirituale e simbolica dei tuoi sogni.', tone: 'blue' }
  ]
};

const GUIDE_CARD_META = {
  'most-common-dream-symbols': { icon: 'sparkles', tone: 'salmon' },
  'scary-dream-symbols': { icon: 'moon', tone: 'violet' },
  'positive-dream-symbols': { icon: 'sun', tone: 'gold' },
  'animal-dream-symbols': { icon: 'paw-print', tone: 'green' },
  'water-dream-symbols': { icon: 'waves', tone: 'cyan' },
  'death-transformation-dreams': { icon: 'refresh-cw', tone: 'rose' },
  'people-in-dreams': { icon: 'users', tone: 'pink' },
  'dream-locations': { icon: 'map', tone: 'blue' }
};

const CATEGORY_ORDER = ['nature', 'animals', 'body', 'places', 'objects', 'actions', 'people', 'celestial'];
const CATEGORY_COLORS = { nature: '#4ade80', animals: '#fbbf24', body: '#f87171', places: '#60a5fa', objects: '#c084fc', actions: '#fb923c', people: '#f472b6', celestial: '#818cf8' };
const SYMBOL_PATHS = { en: 'symbols', fr: 'symboles', es: 'simbolos', de: 'traumsymbole', it: 'simboli' };
const DICTIONARY_UI_COPY = {
  en: { categoriesShort: 'categories', quickBrowseHelp: 'Choose a category or use A-Z to jump straight to the right symbol.', clearSearch: 'Clear search', activeSearchLabel: 'Active search' },
  fr: { categoriesShort: 'catégories', quickBrowseHelp: 'Choisissez une catégorie ou utilisez A-Z pour aller droit au bon symbole.', clearSearch: 'Vider la recherche', activeSearchLabel: 'Recherche active' },
  es: { categoriesShort: 'categorías', quickBrowseHelp: 'Elige una categoría o usa A-Z para ir directamente al símbolo adecuado.', clearSearch: 'Borrar búsqueda', activeSearchLabel: 'Búsqueda activa' },
  de: { categoriesShort: 'Kategorien', quickBrowseHelp: 'Wähle eine Kategorie oder nutze A-Z, um direkt zum richtigen Symbol zu springen.', clearSearch: 'Suche löschen', activeSearchLabel: 'Aktive Suche' },
  it: { categoriesShort: 'categorie', quickBrowseHelp: 'Scegli una categoria oppure usa A-Z per arrivare subito al simbolo giusto.', clearSearch: 'Cancella ricerca', activeSearchLabel: 'Ricerca attiva' },
};

function formatSearchStatus(lang, uiCopy, count, query) {
  const quoted = `«${query}»`;
  if (lang === 'fr') return `${uiCopy.activeSearchLabel} ${quoted} · ${count} résultat(s)`;
  if (lang === 'es') return `${uiCopy.activeSearchLabel} ${quoted} · ${count} resultado(s)`;
  if (lang === 'de') return `${uiCopy.activeSearchLabel} ${quoted} · ${count} Treffer`;
  if (lang === 'it') return `${uiCopy.activeSearchLabel} ${quoted} · ${count} risultato/i`;
  return `${uiCopy.activeSearchLabel} ${quoted} · ${count} result(s)`;
}

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

const RELATED_ARTICLE_IDS = {
  'recurring-dreams-meaning': 'blog.recurring-dreams-meaning',
  'how-to-remember-dreams': 'blog.how-to-remember-dreams',
  'dream-journal-guide': 'blog.dream-journal-guide',
};

function resolveLocalizedRelatedArticleHref(lang, href) {
  const match = String(href || '').match(/\.\.\/blog\/([^/?#]+)/);
  if (!match) return href;

  const entryId = RELATED_ARTICLE_IDS[match[1]];
  if (!entryId) return href;

  const localizedPath = SITE_MANIFEST.collections?.blog?.entries?.[entryId]?.locales?.[lang]?.path;
  return localizedPath || href;
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

function renderGuidesMobilePanel(lang, t, currentPaths) {
  const locale = LOCALES[lang];
  const linkClass = 'block px-4 py-3 text-sm text-purple-100/80 hover:text-white hover:bg-white/5 transition-colors';
  const langLabels = { en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch', it: 'Italiano' };
  const langLinks = SUPPORTED_LANGS.map((candidate) => {
    const activeClass = candidate === lang ? ' text-dream-salmon' : '';
    return `                    <a href="${currentPaths[candidate]}" hreflang="${candidate}" class="${linkClass}${activeClass}">${langLabels[candidate]}</a>`;
  }).join('\n');

  return `        <div id="mobileMenuPanel" class="hidden px-4 pb-4 pt-2">
            <div class="glass-panel rounded-2xl py-2">
                <a href="/${lang}/blog/" class="${linkClass}">${escapeHtml(locale.resources)}</a>
                <a href="/${lang}/guides/" class="${linkClass}">${escapeHtml(locale.dreamGuides)}</a>
                <a href="/${lang}/guides/${t.dictionary_slug}" class="${linkClass}">${escapeHtml(locale.dreamDictionary || COPY[lang].dictionary)}</a>
                <div class="border-t border-white/10 mt-2 pt-2">
${langLinks}
                </div>
            </div>
        </div>`;
}

function renderGuidesNav(lang, t, currentPaths, activeLabel) {
  return renderNavigation(createGuidesShellContext(lang, currentPaths, activeLabel));
}

function renderGuidesFooter(lang, t, pages, currentPaths, activeNav = 'guides') {
  return renderSharedFooter(createGuidesShellContext(lang, currentPaths, activeNav));
}

function guideCardMeta(pageId) {
  return GUIDE_CARD_META[pageId] || { icon: 'book-open', tone: 'salmon' };
}

function formatGuideSymbolCount(lang, count) {
  const ui = GUIDE_HUB_UI[lang] || GUIDE_HUB_UI.en;
  return `${count} ${ui.symbolCount}`;
}

function renderGuideHubStyles() {
  return `    <style>
        body { margin: 0; background: #0a0514; color: #f8f5ff; font-family: system-ui, sans-serif; }
        a { color: inherit; text-decoration: none; }
        .noctalia-premium-nav { background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; }
        .noctalia-premium-nav.py-2 { background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; box-shadow: none; }
        .noctalia-premium-nav-inner {
          width: 100%;
          max-width: 1720px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: clamp(1rem, 3vw, 3.5rem);
        }
        .noctalia-premium-links {
          justify-content: center;
          flex-wrap: nowrap;
          gap: clamp(1.4rem, 3.4vw, 4rem);
          min-width: 0;
        }
        .noctalia-premium-nav-actions { justify-content: flex-end; }
        .noctalia-premium-action { display: inline-flex; }
        .noctalia-premium-download { display: inline-flex; align-items: center; justify-content: center; color: rgba(237, 225, 255, 0.86); background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); }
        .noctalia-premium-download:hover { color: #fff; background: rgba(255, 255, 255, 0.10); border-color: rgba(253, 164, 129, 0.35); }
        .guides-page {
          position: relative;
          isolation: isolate;
          min-height: 100vh;
          overflow-x: hidden;
          background: #0a0514;
        }
        .guides-page::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            linear-gradient(180deg, rgba(6, 3, 14, 0.42) 0%, rgba(8, 4, 18, 0.28) 45%, #090413 96%),
            linear-gradient(90deg, rgba(4, 2, 10, 0.48) 0%, rgba(4, 2, 10, 0.12) 44%, rgba(4, 2, 10, 0.32) 100%),
            radial-gradient(circle at 24% 22%, rgba(253, 164, 129, 0.12), transparent 20rem),
            url('/img/guides/noctalia-guides-hub-bg.webp') center top / cover no-repeat,
            linear-gradient(135deg, #10051b 0%, #090412 48%, #160822 100%);
        }
        .guides-shell {
          position: relative;
          z-index: 2;
          width: 100%;
          margin: 0 auto;
          padding: 0;
        }
        .guides-hero {
          position: relative;
          min-height: 27rem;
          padding: 6.65rem clamp(1rem, 4vw, 4.75rem) 2rem;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: clamp(2rem, 4.4vw, 5.2rem);
          align-items: center;
          overflow: hidden;
          border-bottom: 0;
          background: transparent;
        }
        .guides-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          display: none;
          background: none;
        }
        .guides-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          margin-bottom: 1rem;
          color: #fda481;
          font-size: 0.76rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 800;
        }
        .guides-title {
          max-width: 11ch;
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(4rem, 5.55vw, 6.7rem);
          line-height: 0.94;
          letter-spacing: 0;
          color: transparent;
          background: linear-gradient(180deg, #ffffff 0%, #c9b7ff 58%, rgba(168, 101, 231, 0.72) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          text-wrap: balance;
        }
        .guides-lede {
          max-width: 45rem;
          margin: 1.15rem 0 0;
          color: rgba(226,218,255,0.86);
          font-size: clamp(1.05rem, 1.25vw, 1.25rem);
          line-height: 1.55;
        }
        .guides-actions { display: flex; flex-wrap: wrap; gap: 0.9rem; margin-top: 1.65rem; }
        .guides-hero > div {
          max-width: 58rem;
        }
        .guides-button {
          min-height: 3.25rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.7rem;
          padding: 0.95rem 1.5rem;
          border-radius: 999px;
          font-weight: 800;
          border: 1px solid rgba(255,255,255,0.13);
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .guides-button:hover { transform: translateY(-1px); }
        .guides-button-primary { background: #fda481; color: #0a0514; border-color: rgba(253,164,129,0.9); }
        .guides-button-secondary { background: rgba(255,255,255,0.055); color: #f8f5ff; backdrop-filter: blur(16px); }
        .guides-paths {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          padding: 1.6rem 1.3rem;
          border: 1px solid rgba(226,218,255,0.24);
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(25, 15, 50, 0.58), rgba(16, 8, 31, 0.68));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 80px rgba(0,0,0,0.32);
          backdrop-filter: blur(20px);
        }
        .guides-paths-section {
          position: relative;
          z-index: 1;
          padding: 1rem clamp(1rem, 4vw, 4.75rem) 3rem;
          background: transparent;
        }
        .guides-paths-section .guides-section-head {
          max-width: 42rem;
          min-height: 0;
          margin-bottom: 1rem;
        }
        .guides-path-card, .guides-card, .guides-dictionary-card {
          position: relative;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(226,218,255,0.16);
          background: rgba(18, 9, 33, 0.68);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.28);
          backdrop-filter: blur(18px);
        }
        .guides-path-card {
          min-height: 14.6rem;
          padding: 0.15rem clamp(1rem, 2vw, 2rem);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          border: 0;
          border-right: 1px solid rgba(226,218,255,0.16);
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
        }
        .guides-path-card:last-child { border-right: 0; }
        .guides-card::before, .guides-dictionary-card::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0.74;
          pointer-events: none;
          background: radial-gradient(circle at 78% 20%, var(--guide-tone, rgba(253,164,129,0.26)), transparent 52%);
        }
        .guides-path-icon, .guides-card-icon {
          position: relative;
          width: 3.6rem;
          height: 3.6rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          color: #fda481;
          background: rgba(253,164,129,0.09);
          border: 1px solid rgba(253,164,129,0.18);
        }
        .guides-path-icon {
          width: 5.7rem;
          height: 5.7rem;
          margin: 0 auto 0.9rem;
          border-color: rgba(226,138,255,0.42);
          box-shadow: inset 0 0 28px rgba(190,119,255,0.18);
        }
        .guides-path-title, .guides-card-title, .guides-dictionary-title {
          position: relative;
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          color: #fff7f0;
          line-height: 1.06;
          letter-spacing: 0;
          text-wrap: balance;
          overflow-wrap: anywhere;
        }
        .guides-path-title { font-size: clamp(1.28rem, 1.38vw, 1.58rem); color: #fda481; }
        .guides-path-desc, .guides-card-desc, .guides-dictionary-desc {
          position: relative;
          color: rgba(226,218,255,0.78);
          line-height: 1.5;
        }
        .guides-path-desc { margin: 0.55rem auto 1.15rem; max-width: 14rem; font-size: 0.9rem; }
        .guides-path-arrow, .guides-card-arrow {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: #fda481;
          font-weight: 800;
        }
        .guides-section {
          position: relative;
          z-index: 1;
          padding: 2rem clamp(1rem, 4vw, 4.75rem) 2rem;
          background: transparent;
        }
        .guides-section h2 {
          margin: 0;
          max-width: 18ch;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.8rem, 2.2vw, 2.65rem);
          line-height: 0.96;
          letter-spacing: 0;
          color: #fff7f0;
          text-shadow: 0 2px 18px rgba(0,0,0,0.55);
        }
        .guides-section-copy { margin: 0; color: rgba(226,218,255,0.78); font-size: 1rem; line-height: 1.65; }
        .guides-section-head {
          text-shadow: 0 2px 16px rgba(0,0,0,0.48);
        }
        .guides-entry-layout {
          display: grid;
          grid-template-columns: minmax(340px, 0.58fr) minmax(0, 1fr);
          gap: 1rem;
          align-items: stretch;
        }
        .guides-entry-left {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }
        .guides-section-head {
          min-height: 5.65rem;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 0.6rem;
        }
        .guides-bento {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-auto-rows: 10.15rem;
          gap: 0.8rem;
        }
        .guides-dictionary-card {
          min-height: 0;
          flex: 1 1 auto;
          min-height: 18.45rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: clamp(1.15rem, 2vw, 1.65rem);
          background:
            linear-gradient(90deg, rgba(18,8,31,0.96), rgba(18,8,31,0.58)),
            url('/img/blog/dream-symbols-dictionary.webp') center right / cover no-repeat;
        }
        .guides-dictionary-cta {
          position: relative;
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.72rem 1rem;
          border-radius: 999px;
          border: 1px solid rgba(226,218,255,0.24);
          background: rgba(255,255,255,0.04);
          color: #fff7f0;
          font-weight: 700;
          font-size: 0.9rem;
        }
        .guides-feature-label, .guides-card-kicker {
          position: relative;
          display: inline-flex;
          width: fit-content;
          padding: 0.42rem 0.68rem;
          border-radius: 999px;
          border: 1px solid rgba(253,164,129,0.22);
          color: #fda481;
          background: rgba(253,164,129,0.08);
          font-size: 0.72rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          font-weight: 900;
        }
        .guides-dictionary-title { margin-top: 1rem; max-width: 10ch; font-size: clamp(1.85rem, 2.35vw, 2.85rem); line-height: 0.98; }
        .guides-dictionary-desc { display: block; max-width: 21rem; margin: 0.85rem 0 0; }
        .guides-card {
          min-height: 0;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
          background:
            linear-gradient(90deg, rgba(18,8,31,0.96), rgba(18,8,31,0.72), rgba(18,8,31,0.22)),
            var(--guide-image) center right / cover no-repeat;
        }
        .guides-card:hover, .guides-path-card:hover, .guides-dictionary-card:hover {
          transform: translateY(-2px);
          border-color: rgba(253,164,129,0.34);
        }
        .guides-card-title { margin-top: 0.75rem; font-size: clamp(1.18rem, 1.32vw, 1.62rem); }
        .guides-card-desc {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          max-width: 15rem;
          margin: 0.55rem 0 0.65rem;
          font-size: 0.82rem;
        }
        .guides-card-meta { position: relative; display: flex; align-items: center; justify-content: space-between; color: rgba(226,218,255,0.66); font-size: 0.82rem; }
        .guides-card[data-tone="violet"] { --guide-tone: rgba(178,129,255,0.33); }
        .guides-card[data-tone="gold"] { --guide-tone: rgba(251,191,36,0.26); }
        .guides-card[data-tone="green"] { --guide-tone: rgba(74,222,128,0.22); }
        .guides-card[data-tone="cyan"] { --guide-tone: rgba(96,200,255,0.28); }
        .guides-card[data-tone="rose"] { --guide-tone: rgba(244,114,182,0.25); }
        .guides-card[data-tone="pink"] { --guide-tone: rgba(244,114,182,0.30); }
        .guides-card[data-tone="blue"] { --guide-tone: rgba(96,165,250,0.28); }
        .guides-trust {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.7rem;
          margin-top: 1.6rem;
          padding: 1.2rem 1.4rem;
          border-radius: 10px;
          border: 1px solid rgba(226,218,255,0.17);
          background: rgba(18, 9, 33, 0.62);
          backdrop-filter: blur(16px);
        }
        .guides-trust-item { display: flex; align-items: center; gap: 1rem; padding: 0 1.1rem; border-right: 1px solid rgba(226,218,255,0.16); }
        .guides-trust-item:last-child { border-right: 0; }
        .guides-trust-icon { width: 3.1rem; height: 3.1rem; flex: 0 0 auto; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; color: #fda481; border: 1px solid rgba(226,138,255,0.36); background: rgba(253,164,129,0.07); }
        .guides-trust strong { display: block; color: #fff7f0; font-weight: 600; margin-bottom: 0.25rem; }
        .guides-trust span { color: rgba(226,218,255,0.7); font-size: 0.86rem; line-height: 1.35; }
        @media (max-width: 1180px) {
          .guides-hero { grid-template-columns: 1fr; min-height: auto; padding-top: 7rem; }
          .guides-paths { grid-template-columns: repeat(3, minmax(13rem, 1fr)); overflow-x: auto; }
          .guides-entry-layout { grid-template-columns: 1fr; }
          .guides-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .guides-title { max-width: 16ch; }
        }
        @media (max-width: 980px) {
          .noctalia-premium-nav-inner { display: flex; justify-content: space-between; }
          .noctalia-premium-nav-actions { margin-left: auto; }
          .noctalia-premium-links { display: none; }
          .noctalia-premium-download, .noctalia-premium-about { display: none; }
          #navMobileGuideLink, #mobileMenuButton { display: inline-flex; }
        }
        @media (max-width: 520px) {
          .noctalia-premium-nav-inner { padding-left: 1rem; padding-right: 1rem; }
          .noctalia-premium-brand-text { font-size: 1.35rem; }
          #navMobileGuideLink { display: none; }
        }
        @media (max-width: 720px) {
          .guides-page { background-position: center top; }
          .guides-hero { padding: 6.5rem 1rem 2rem; }
          .guides-paths-section { padding: 0 1rem 2rem; }
          .guides-title { font-size: clamp(3.35rem, 17vw, 5.2rem); max-width: 9ch; }
          .guides-lede { font-size: 1rem; }
          .guides-actions { flex-direction: column; }
          .guides-button { width: 100%; }
          .guides-paths { grid-template-columns: 1fr; overflow: visible; padding: 0; }
          .guides-path-card { min-height: 13.5rem; border-right: 0; border-bottom: 1px solid rgba(226,218,255,0.14); padding: 1.2rem; }
          .guides-path-card:last-child { border-bottom: 0; }
          .guides-section { margin-top: 2rem; }
          .guides-section h2 { font-size: clamp(2rem, 10vw, 3.2rem); max-width: 10ch; }
          .guides-bento { grid-template-columns: 1fr; }
          .guides-dictionary-card { grid-column: auto; grid-row: auto; min-height: 22rem; }
          .guides-card { min-height: 15rem; }
          .guides-trust { grid-template-columns: 1fr; }
          .guides-trust-item { border-right: 0; border-bottom: 1px solid rgba(226,218,255,0.14); padding: 1rem 0; }
          .guides-trust-item:last-child { border-bottom: 0; }
        }
    </style>`;
}

function renderPathCard({ href, icon, title, desc, tone }) {
  return `                <a href="${href}" class="guides-path-card" style="--guide-tone:${tone}">
                    <span class="guides-path-icon"><i data-lucide="${icon}" class="w-7 h-7"></i></span>
                    <span>
                        <h2 class="guides-path-title">${escapeHtml(title)}</h2>
                        <p class="guides-path-desc">${escapeHtml(desc)}</p>
                        <span class="guides-path-arrow"><i data-lucide="arrow-right" class="w-4 h-4"></i></span>
                    </span>
                </a>`;
}

function renderGuideCard(lang, copy, page) {
  const meta = guideCardMeta(page.id);
  return `            <a href="/${lang}/guides/${page.slugs[lang]}" class="guides-card" data-tone="${meta.tone}">
                <span>
                    <span class="guides-card-icon"><i data-lucide="${meta.icon}" class="w-6 h-6"></i></span>
                    <span class="guides-card-kicker">${escapeHtml(formatGuideSymbolCount(lang, page.symbols?.length || 0))}</span>
                    <h3 class="guides-card-title">${escapeHtml(page[lang].title)}</h3>
                    <span class="guides-card-desc">${escapeHtml(page[lang].metaDescription)}</span>
                </span>
                <span class="guides-card-meta">
                    <span>${escapeHtml(copy.openGuide)}</span>
                    <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
                </span>
            </a>`;
}

function resolveGuideHubCardHref(lang, t, pages, card) {
  if (card.key === 'science') return `/${lang}/blog/${GUIDE_HUB_BLOG_SLUGS.sleepScience[lang]}`;
  if (card.key === 'journal') return `/${lang}/blog/${GUIDE_HUB_BLOG_SLUGS.journal[lang]}`;
  if (card.key === 'emotions') return `/${lang}/blog/${GUIDE_HUB_BLOG_SLUGS.emotions[lang]}`;
  if (card.key === 'interpretation') return `/${lang}/guides/${t.dictionary_slug}`;
  if (card.key === 'spirituality') {
    const page = pages.find((candidate) => candidate.id === 'death-transformation-dreams') || pages[5] || pages[0];
    return `/${lang}/guides/${page.slugs[lang]}`;
  }
  const page = pages.find((candidate) => candidate.id === 'most-common-dream-symbols') || pages[0];
  return `/${lang}/guides/${page.slugs[lang]}`;
}

function guideHubCardImage(card) {
  const images = {
    understand: '/img/blog/why-we-forget-dreams.webp',
    science: '/img/blog/why-we-dream-science.webp',
    interpretation: '/img/blog/recurring-dreams-meaning.webp',
    journal: '/img/blog/dream-journal-guide.webp',
    emotions: '/img/blog/dreams-mental-health.webp',
    spirituality: '/img/blog/dream-interpretation-history.webp'
  };
  return images[card.key] || '/img/guides/noctalia-guides-hub-bg.webp';
}

function renderHubBentoCard(lang, t, pages, card) {
  const href = resolveGuideHubCardHref(lang, t, pages, card);
  return `                <a href="${href}" class="guides-card" data-tone="${card.tone}" style="--guide-image: url('${guideHubCardImage(card)}')">
                    <span>
                        <span class="guides-card-kicker">${escapeHtml(card.label)}</span>
                        <h3 class="guides-card-title">${escapeHtml(card.title)}</h3>
                        <span class="guides-card-desc">${escapeHtml(card.desc)}</span>
                    </span>
                    <span class="guides-card-meta">
                        <span></span>
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </span>
                </a>`;
}

function generateHubPage(lang, t, pages, version) {
  const copy = COPY[lang];
  const ui = GUIDE_HUB_UI[lang] || GUIDE_HUB_UI.en;
  const currentPaths = Object.fromEntries(SUPPORTED_LANGS.map((candidate) => [candidate, `/${candidate}/guides/`]));
  const symbolCount = (readJson('dream-symbols.json').symbols || []).length;
  const scaryPage = pages.find((page) => page.id === 'scary-dream-symbols') || pages[1];
  const pathCards = [
    renderPathCard({
      href: `/${lang}/guides/${t.dictionary_slug}`,
      icon: 'aperture',
      title: ui.pathSymbols,
      desc: ui.pathSymbolsDesc,
      tone: 'rgba(253,164,129,0.28)'
    }),
    renderPathCard({
      href: `/${lang}/guides/${scaryPage.slugs[lang]}`,
      icon: 'moon',
      title: ui.pathNightmares,
      desc: ui.pathNightmaresDesc,
      tone: 'rgba(178,129,255,0.32)'
    }),
    renderPathCard({
      href: `/${lang}/blog/${GUIDE_HUB_BLOG_SLUGS.lucid[lang]}`,
      icon: 'moon',
      title: ui.pathLucid,
      desc: ui.pathLucidDesc,
      tone: 'rgba(244,114,182,0.24)'
    })
  ].join('\n');
  const cards = (GUIDE_HUB_BENTO_COPY[lang] || GUIDE_HUB_BENTO_COPY.en).map((card) => renderHubBentoCard(lang, t, pages, card)).join('\n');
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
${renderGuideHubStyles()}
${renderJsonLd(collection)}
${renderJsonLd(itemList)}
${renderJsonLd(breadcrumb)}
</head>
<body class="bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden">
    <div class="guides-page">
${renderGuidesNav(lang, t, currentPaths, 'guides')}
    <main class="guides-shell">
        <section class="guides-hero" aria-labelledby="guidesTitle">
            <div>
                <h1 id="guidesTitle" class="guides-title">${escapeHtml(copy.label)}</h1>
                <p class="guides-lede">${escapeHtml(ui.heroIntro)}</p>
            </div>
        </section>
        <section id="guidesBento" class="guides-section">
            <div class="guides-entry-layout">
                <div class="guides-entry-left">
                    <div class="guides-section-head">
                        <h2>${escapeHtml(ui.chooseTitle)}</h2>
                        <p class="guides-section-copy">${escapeHtml(ui.chooseIntro)}</p>
                    </div>
                    <a href="/${lang}/guides/${t.dictionary_slug}" class="guides-dictionary-card">
                        <span>
                            <span class="guides-feature-label">${escapeHtml(ui.featuredLabel)}</span>
                            <h3 class="guides-dictionary-title">${escapeHtml(lang === 'fr' ? 'Le sens de vos rêves' : copy.dictionary)}</h3>
                            <span class="guides-dictionary-desc">${escapeHtml(ui.dictionarySummary)}</span>
                        </span>
                        <span>
                            <span class="guides-dictionary-cta"><i data-lucide="book-open" class="w-4 h-4"></i>${escapeHtml(ui.dictionaryCta)}</span>
                        </span>
                    </a>
                </div>
                <div class="guides-bento">
${cards}
                </div>
            </div>
            <div class="guides-trust" aria-label="${escapeHtml(ui.trustVerified)}">
                <div class="guides-trust-item">
                    <span class="guides-trust-icon"><i data-lucide="badge-check" class="w-5 h-5"></i></span>
                    <span><strong>${escapeHtml(ui.trustVerified)}</strong><span>${escapeHtml(ui.trustVerifiedDesc)}</span></span>
                </div>
                <div class="guides-trust-item">
                    <span class="guides-trust-icon"><i data-lucide="calendar-sync" class="w-5 h-5"></i></span>
                    <span><strong>${escapeHtml(ui.trustUpdated)}</strong><span>${escapeHtml(ui.trustUpdatedDesc)}</span></span>
                </div>
                <div class="guides-trust-item">
                    <span class="guides-trust-icon"><i data-lucide="compass" class="w-5 h-5"></i></span>
                    <span><strong>${escapeHtml(ui.trustAccessible)}</strong><span>${escapeHtml(ui.trustAccessibleDesc)}</span></span>
                </div>
            </div>
        </section>
        <section class="guides-paths-section" aria-labelledby="guidesPathsTitle">
            <div class="guides-section-head">
                <h2 id="guidesPathsTitle">${escapeHtml(ui.chooseTitle)}</h2>
                <p class="guides-section-copy">${escapeHtml(ui.chooseIntro)}</p>
            </div>
            <div class="guides-paths" aria-label="${escapeHtml(ui.chooseTitle)}">
${pathCards}
            </div>
        </section>
    </main>
${renderGuidesFooter(lang, t, pages, currentPaths, 'guides')}
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            window.addEventListener('scroll', () => {
                const navbar = document.getElementById('navbar');
                if (navbar) {
                    navbar.classList.toggle('py-3', window.scrollY > 50);
                    navbar.classList.toggle('py-5', window.scrollY <= 50);
                    navbar.classList.toggle('bg-dream-dark/75', window.scrollY > 50);
                    navbar.classList.toggle('backdrop-blur-md', window.scrollY > 50);
                }
            });
        });
    </script>
    <script src="/js/language-dropdown.js?v=${version}" defer></script>
    <script src="/js/mobile-menu.js?v=${version}" defer></script>
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
        :root { --dictionary-edge: clamp(1rem, 4vw, 4.75rem); }
        #dictionaryLayout { display: block; }
        #mainContentArea { flex: 1; min-width: 0; }
        #dictionarySidebar { display: none !important; }
        #categoryGridSection { display: block; }
        #categoryGridSection[hidden] { display: none !important; }
        #mobilePills, #mobileAlpha { display: none !important; }
        .cat-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; border: 1px solid rgba(255,255,255,0.1); background: rgba(20,10,40,0.5); backdrop-filter: blur(8px); color: #e2daff; transition: all 0.2s ease; text-decoration: none; }
        .cat-pill:hover { border-color: rgba(253,164,129,0.3); color: #fda481; }
        .cat-pill .pill-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .cat-pill .pill-count { font-size: 0.7rem; opacity: 0.6; }
        #mobileAlpha { display: none !important; flex-wrap: wrap; gap: 4px; justify-content: center; margin-bottom: 1rem; }
        .mobile-alpha-link { min-width: 1.75rem; text-align: center; padding: 2px 4px; border-radius: 0.375rem; font-size: 0.8rem; color: rgba(196,181,253,0.75); transition: all 0.2s ease; text-decoration: none; }
        .mobile-alpha-link:hover { color: #FDA481; transform: scale(1.1); }
        .mobile-alpha-link.alpha-active { background: white; color: #0a0514 !important; font-weight: 700; transform: scale(1.05); }
        body.dictionary-page {
          position: relative;
          isolation: isolate;
          background: #0a0514;
        }
        body.dictionary-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(5, 2, 12, 0.62) 0%, rgba(8, 3, 17, 0.42) 38%, #090413 94%),
            linear-gradient(90deg, rgba(5, 2, 12, 0.72) 0%, rgba(5, 2, 12, 0.22) 48%, rgba(5, 2, 12, 0.58) 100%),
            radial-gradient(ellipse at 76% 28%, rgba(253, 164, 129, 0.14), transparent 24rem),
            url('/img/blog/dream-symbols-dictionary.webp') center top / cover no-repeat,
            linear-gradient(135deg, #12051d 0%, #0a0514 45%, #130822 100%);
        }
        .dictionary-page .aurora-bg,
        .dictionary-page .orb {
          display: none;
        }
        .dictionary-main {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: none;
          padding: 0 0 5rem !important;
        }
        .dictionary-shell {
          width: 100%;
          max-width: none;
          margin: 0;
        }
        .dictionary-shell > nav[aria-label="Breadcrumb"] {
          display: none;
        }
        .dictionary-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-items: end;
          gap: clamp(1.5rem, 4vw, 5rem);
          min-height: 35rem;
          margin-bottom: 0;
          padding: 8.1rem clamp(1rem, 4vw, 4.75rem) 3.2rem;
          text-align: left;
          background: transparent;
        }
        .dictionary-hero-copy {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          min-width: 0;
        }
        .dictionary-hero-kicker {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 0.72rem;
          border-radius: 9999px;
          border: 1px solid rgba(253,164,129,0.22);
          background: rgba(253,164,129,0.09);
          color: rgba(253,164,129,0.96);
          font-size: 0.74rem;
          line-height: 1;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }
        .dictionary-header h1 {
          width: min(100%, 16ch);
          max-width: none;
          margin: 0;
          font-size: clamp(4rem, 6.1vw, 7.4rem);
          line-height: 0.91;
          letter-spacing: 0;
        }
        .dictionary-hero-intro {
          max-width: 44rem;
          color: rgba(237,225,255,0.78);
          font-size: clamp(1rem, 1.6vw, 1.2rem);
          line-height: 1.55;
        }
        #heroSearchShell {
          max-width: 49rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          filter: drop-shadow(0 1.25rem 2.5rem rgba(0,0,0,0.26));
        }
        .dictionary-hero-search-input {
          position: relative;
          flex: 1;
          min-width: 0;
        }
        #heroSearchShell .hero-search {
          min-height: 4rem;
          border-color: rgba(255,255,255,0.2) !important;
          background: rgba(12,7,25,0.74) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(253,164,129,0.08);
        }
        #heroSearchShell .search-clear {
          position: static;
          transform: none;
          width: 4rem;
          height: 4rem;
          flex: 0 0 4rem;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(12,7,25,0.74);
        }
        .quick-browse-panel {
          width: calc(100% - (var(--dictionary-edge) * 2));
          max-width: none;
          margin-left: var(--dictionary-edge);
          margin-right: var(--dictionary-edge);
          padding: clamp(1rem, 2vw, 1.35rem);
          margin-bottom: 1.75rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(12, 7, 25, 0.72);
        }
        .quick-browse-panel[hidden] { display: none !important; }
        .quick-browse-alpha {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem;
          margin-bottom: 1rem;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }
        .quick-browse-alpha .letter-link {
          min-width: 2.25rem;
          min-height: 2.25rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.7rem;
          background: rgba(255,255,255,0.045);
          color: rgba(226,218,255,0.78) !important;
          font-weight: 700;
          text-decoration: none;
          transform: none;
        }
        .quick-browse-alpha .letter-link:hover {
          background: rgba(253,164,129,0.14);
          color: #fff !important;
          transform: translateY(-1px);
        }
        .quick-browse-alpha .letter-link.alpha-active {
          background: rgba(255,255,255,0.92);
          color: #0a0514 !important;
          transform: none;
        }
        .quick-browse-copy {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.9rem;
        }
        .quick-browse-copy p {
          color: rgba(226,218,255,0.72);
          font-size: 0.92rem;
        }
        .category-browse-grid {
          display: grid;
          grid-template-columns: repeat(8, minmax(0, 1fr));
          gap: 0.85rem;
          grid-auto-flow: dense;
        }
        .category-browse-card {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 0.75rem;
          grid-column: span 2;
          padding: 1rem 0.9rem;
          border-radius: 0.85rem;
          border: 1px solid color-mix(in srgb, var(--cat-color) 23%, rgba(255,255,255,0.05));
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--cat-color) 12%, transparent), rgba(255,255,255,0.028));
          text-decoration: none;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .category-browse-card:hover {
          transform: translateY(-2px);
          border-color: color-mix(in srgb, var(--cat-color) 45%, rgba(255,255,255,0.08));
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--cat-color) 18%, transparent), rgba(255,255,255,0.04));
        }
        .category-browse-icon {
          width: 2.35rem;
          height: 2.35rem;
          border-radius: 0.72rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: color-mix(in srgb, var(--cat-color) 16%, rgba(255,255,255,0.04));
          color: color-mix(in srgb, var(--cat-color) 84%, #fff);
          flex-shrink: 0;
        }
        .category-browse-meta {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.18rem;
        }
        .category-browse-title {
          color: #f8f5ff;
          font-family: Georgia, serif;
          font-size: 1rem;
        }
        .category-browse-count {
          color: rgba(196,181,253,0.72);
          font-size: 0.8rem;
        }
        .symbol-card {
          position: relative;
          overflow: hidden;
          min-height: 14.25rem;
          display: flex;
          flex-direction: column;
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--cat-color) 10%, transparent), transparent 45%),
            rgba(14, 8, 28, 0.88);
          border-color: rgba(255,255,255,0.075) !important;
          transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease, box-shadow 0.22s ease;
        }
        .symbol-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg, color-mix(in srgb, var(--cat-color) 54%, transparent), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,0.04), transparent 42%);
          opacity: 0.26;
        }
        .symbol-card > * {
          position: relative;
          z-index: 1;
        }
        .symbol-card:hover {
          transform: translateY(-3px);
          border-color: color-mix(in srgb, var(--cat-color) 42%, rgba(255,255,255,0.08)) !important;
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--cat-color) 14%, transparent), transparent 45%),
            rgba(18, 10, 34, 0.96);
          box-shadow: 0 1rem 2.5rem rgba(0,0,0,0.24);
        }
        .symbol-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.8rem;
        }
        .symbol-card-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.36rem 0.62rem;
          border-radius: 9999px;
          background: rgba(255,255,255,0.055);
          color: rgba(248,245,255,0.78);
          font-size: 0.72rem;
          letter-spacing: 0.02em;
        }
        .symbol-card-arrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.85rem;
          height: 1.85rem;
          border-radius: 9999px;
          background: rgba(255,255,255,0.045);
          color: rgba(196,181,253,0.72);
          font-size: 0.95rem;
          transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }
        .symbol-card:hover .symbol-card-arrow {
          background: color-mix(in srgb, var(--cat-color) 20%, rgba(255,255,255,0.04));
          color: #fff;
          transform: translate(1px, -1px);
        }
        .symbol-card-title-link h3 {
          font-size: clamp(1.35rem, 1.7vw, 1.75rem);
          line-height: 1.05;
        }
        .symbol-card-desc {
          color: rgba(226,218,255,0.84);
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
          overflow: hidden;
          min-height: 4.5rem;
        }
        .symbol-card-question {
          margin-top: auto;
          padding-top: 0.85rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          color: rgba(196,181,253,0.82);
        }
        #symbolsList > section {
          scroll-margin-top: var(--dictionary-scroll-offset, 8rem);
        }
        #dictionaryLayout,
        #mobilePills,
        #mobileAlpha,
        #searchFeedback,
        #noResults,
        #mainContentArea > section,
        #symbolsList {
          width: 100%;
          max-width: none;
          margin-left: 0;
          margin-right: 0;
          padding-left: var(--dictionary-edge);
          padding-right: var(--dictionary-edge);
        }
        #symbolsList > section {
          padding-left: 0;
          padding-right: 0;
        }
        #symbolsList > section > .grid {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
          grid-auto-flow: dense;
        }
        #searchFeedback, #noResults {
          scroll-margin-top: var(--dictionary-scroll-offset, 8rem);
        }
        .search-feedback {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.9rem;
          padding: 0.9rem 1rem;
          margin-bottom: 1rem;
          border-radius: 1rem;
          border: 1px solid rgba(253,164,129,0.12);
          background: rgba(18, 10, 34, 0.88);
        }
        #searchFeedback[hidden],
        #noResults[hidden] {
          display: none !important;
        }
        .search-feedback-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .search-feedback-label {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(253,164,129,0.8);
        }
        .search-feedback-text {
          color: rgba(248,245,255,0.92);
          font-size: 0.95rem;
          line-height: 1.35;
        }
        .search-feedback-clear {
          flex-shrink: 0;
          padding: 0.55rem 0.85rem;
          border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.05);
          color: rgba(248,245,255,0.86);
          font-size: 0.82rem;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .search-feedback-clear:hover {
          background: rgba(253,164,129,0.14);
          border-color: rgba(253,164,129,0.22);
        }
        @media (min-width: 768px) {
          .dictionary-header { margin-bottom: 0; }
          #symbolsList > section:nth-child(3n + 1) .symbol-card:first-child,
          #symbolsList > section:nth-child(4n + 2) .symbol-card:nth-child(2) {
            grid-row: span 2;
            min-height: 18.5rem;
          }
        }
        @media (max-width: 1180px) {
          .dictionary-header {
            grid-template-columns: 1fr;
            align-items: start;
            min-height: auto;
            padding-top: 7rem;
          }
          .category-browse-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .category-browse-card {
            grid-column: span 2;
          }
        }
        @media (max-width: 767px) {
          :root { --dictionary-edge: 1rem; }
          .dictionary-header {
            grid-template-columns: 1fr;
            min-height: auto;
            gap: 1rem;
            padding: 5.9rem 1rem 1.45rem;
          }
          .dictionary-header h1 {
            width: 100%;
            max-width: 10.5ch;
            font-size: clamp(3.05rem, 15vw, 4.75rem);
          }
          .dictionary-hero-intro {
            font-size: 0.98rem;
          }
          .quick-browse-alpha {
            gap: 0.28rem;
          }
          .quick-browse-alpha .letter-link {
            min-width: 2rem;
          }
          #dictionaryLayout,
          #mobilePills,
          #mobileAlpha,
          #searchFeedback,
          #noResults,
          #mainContentArea > section,
          #symbolsList,
          .quick-browse-panel {
            width: 100%;
          }
          .quick-browse-panel {
            width: calc(100% - 2rem);
            margin-left: 1rem;
            margin-right: 1rem;
          }
          .category-browse-grid,
          #symbolsList > section > .grid {
            grid-template-columns: 1fr;
          }
          .quick-browse-panel {
            padding: 1rem;
          }
          .quick-browse-alpha {
            display: none;
          }
          .quick-browse-copy {
            margin-bottom: 0.85rem;
          }
          .quick-browse-copy h2 {
            font-size: 1.35rem;
          }
          .quick-browse-copy p {
            font-size: 0.86rem;
            line-height: 1.45;
          }
          .category-browse-grid {
            display: flex;
            gap: 0.7rem;
            margin-left: -1rem;
            margin-right: -1rem;
            padding: 0 1rem 0.2rem;
            overflow-x: auto;
            overscroll-behavior-inline: contain;
            scroll-padding-inline: 1rem;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
          }
          .category-browse-grid::-webkit-scrollbar {
            display: none;
          }
          .category-browse-card {
            flex: 0 0 9rem;
            min-height: 6.9rem;
            align-items: flex-start;
            gap: 0.55rem;
            padding: 0.8rem 0.72rem;
            border-radius: 0.78rem;
            flex-direction: column;
            scroll-snap-align: start;
          }
          .category-browse-icon {
            width: 2rem;
            height: 2rem;
            border-radius: 0.62rem;
          }
          .category-browse-icon .w-5 {
            width: 1rem;
            height: 1rem;
          }
          .category-browse-title {
            font-size: 0.95rem;
          }
          .category-browse-count {
            font-size: 0.76rem;
          }
          #mobileAlpha { display: flex !important; }
          #searchFeedback { display: none !important; }
          body.dictionary-search-active #stickyBar,
          body.dictionary-search-active #mobileAlpha {
            display: none !important;
          }
          .search-feedback {
            align-items: flex-start;
            flex-direction: column;
          }
          .search-feedback-clear {
            width: 100%;
            justify-content: center;
          }
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
  const uiCopy = DICTIONARY_UI_COPY[lang] || DICTIONARY_UI_COPY.en;
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
    const color = CATEGORY_COLORS[cat] || '#c084fc';
    return `                    <a href="/${lang}/${symbolPath}/${catSlug}" class="category-browse-card group" style="--cat-color:${color}">
                        <span class="category-browse-icon">
                            <i data-lucide="${icon}" class="w-5 h-5"></i>
                        </span>
                        <span class="category-browse-meta">
                            <span class="category-browse-title group-hover:text-dream-salmon transition-colors">${escapeHtml(catName)}</span>
                            <span class="category-browse-count">${count} ${escapeHtml(t.symbols_in_category || 'symbols')}</span>
                        </span>
                    </a>`;
  }).join('\n');

  // ── Build symbol sections HTML ───────────────────────────────────────
  const symbolSectionsHtml = letters.map((letter) => {
    const syms = groups[letter];
    const cards = syms.map((sym) => {
      const s = sym[lang];
      const dataSymbol = escapeHtml(s.slug + ' ' + s.slug + ' ' + s.slug);
      const askText = s.askYourself?.[0] || '';
      const catName = (t.category_names || {})[sym.category] || sym.category;
      const catColor = CATEGORY_COLORS[sym.category] || '#c084fc';
      return `
                        <div class="symbol-card glass-panel rounded-xl p-5 border border-transparent" data-symbol="${dataSymbol}" style="--cat-color:${catColor}">
                            <div class="symbol-card-top">
                                <span class="symbol-card-tag">
                                    <span class="sidebar-cat-dot" style="background:${catColor}"></span>
                                    ${escapeHtml(catName)}
                                </span>
                                <span class="symbol-card-arrow" aria-hidden="true">↗</span>
                            </div>
                            <a href="/${lang}/${symbolPath}/${s.slug}" class="symbol-card-title-link block hover:opacity-90 transition-opacity"><h3 class="font-serif text-xl text-dream-cream mb-3">${escapeHtml(s.name)}</h3></a>
                            <p class="symbol-card-desc text-sm mb-0">${escapeHtml(s.shortDescription)}</p>
                            <div class="symbol-card-question text-xs">
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

  const heroCopy = {
    en: { atlas: 'Dream atlas', guide: 'Search, filter, then open the symbol that matches your dream.' },
    fr: { atlas: 'Atlas onirique', guide: 'Recherchez, filtrez, puis ouvrez le symbole qui correspond à votre rêve.' },
    es: { atlas: 'Atlas onírico', guide: 'Busca, filtra y abre el símbolo que coincide con tu sueño.' },
    de: { atlas: 'Traumatlas', guide: 'Suche, filtere und öffne das Symbol, das zu deinem Traum passt.' },
    it: { atlas: 'Atlante onirico', guide: 'Cerca, filtra e apri il simbolo che corrisponde al tuo sogno.' },
  }[lang] || {};

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
    `                    <a href="${resolveLocalizedRelatedArticleHref(lang, article.href)}" class="glass-panel rounded-xl p-6 block hover:border-dream-salmon/30 border border-transparent transition-colors">
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
        .noctalia-premium-nav { background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; }
        .noctalia-premium-nav.py-2 { background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; box-shadow: none; }
        .noctalia-premium-nav-inner {
          width: 100%;
          max-width: 1720px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: clamp(1rem, 3vw, 3.5rem);
        }
        .noctalia-premium-links {
          justify-content: center;
          flex-wrap: nowrap;
          gap: clamp(1.4rem, 3.4vw, 4rem);
          min-width: 0;
        }
        .noctalia-premium-nav-actions { justify-content: flex-end; }
        .noctalia-premium-action { display: inline-flex; }
        .noctalia-premium-download { display: inline-flex; align-items: center; justify-content: center; color: rgba(237, 225, 255, 0.86); background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); }
        .noctalia-premium-download:hover { color: #fff; background: rgba(255, 255, 255, 0.10); border-color: rgba(253, 164, 129, 0.35); }
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
            position: fixed;
            top: var(--sticky-bar-top, 5.5rem);
            left: 50%;
            transform: translateX(-50%);
            z-index: 45;
            width: min(calc(100vw - 2rem), 70rem);
            display: none;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease, transform 0.2s ease;
        }
        #stickyBar.sb-visible { display: block; opacity: 1; pointer-events: auto; }
        #stickyBar .sb-inner {
            display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
        }
        #stickyBar .sb-search { position: relative; flex-shrink: 0; width: min(22rem, 100%); }
        #stickyBar .sb-alpha { display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; align-items: center; flex: 1; min-width: 0; }
        .sticky-status {
          display: none;
          align-items: center;
          gap: 0.45rem;
          padding: 0.4rem 0.7rem;
          border-radius: 9999px;
          background: rgba(253,164,129,0.12);
          color: rgba(253,164,129,0.96);
          font-size: 0.78rem;
          line-height: 1.2;
          flex-shrink: 0;
        }
        #stickyBar.search-active .sticky-status {
          display: inline-flex;
        }
        .search-clear {
          position: absolute;
          right: 0.8rem;
          top: 50%;
          transform: translateY(-50%);
          z-index: 2;
          width: 2rem;
          height: 2rem;
          border-radius: 9999px;
          border: 0;
          background: rgba(255,255,255,0.08);
          color: rgba(248,245,255,0.76);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .search-clear:hover {
          background: rgba(253,164,129,0.18);
          color: #fff;
        }
        .search-clear[hidden] { display: none !important; }
        /* Hero search */
        .hero-search:focus { outline: none; border-color: #FDA481; }
        @media (max-width: 767px) {
            #stickyBar {
                width: calc(100vw - 1rem);
                top: var(--sticky-bar-top, 4.8rem);
            }
            #stickyBar .sb-inner {
                gap: 0.75rem;
            }
            .sticky-status {
                width: 100%;
                order: 3;
            }
        }
        @media (max-width: 1100px) {
            .noctalia-premium-download,
            .noctalia-premium-about { display: none; }
            .noctalia-premium-links { gap: clamp(1rem, 2.5vw, 2rem); }
        }
        @media (max-width: 860px) {
            .noctalia-premium-nav-inner { display: flex; justify-content: space-between; }
            .noctalia-premium-nav-actions { margin-left: auto; }
            .noctalia-premium-links { display: none; }
            #navMobileGuideLink,
            #mobileMenuButton { display: inline-flex; }
        }
        @media (max-width: 520px) {
            .noctalia-premium-nav-inner { padding-left: 1rem; padding-right: 1rem; }
            .noctalia-premium-brand-text { font-size: 1.35rem; }
            #navMobileGuideLink { display: none; }
        }
${renderLayoutCss()}
    </style>

${renderJsonLd(collection)}

${renderJsonLd(faqPageLd)}

${renderJsonLd(breadcrumb)}
</head>

<body class="dictionary-page bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden" style="background-color: #0a0514;">

    <div class="aurora-bg"></div>
    <div class="orb w-[70vw] h-[70vw] md:w-[40rem] md:h-[40rem] bg-purple-900/30 top-0 left-0"></div>
    <div class="orb w-[90vw] h-[90vw] md:w-[50rem] md:h-[50rem] bg-blue-900/20 bottom-0 right-0"></div>

    <!-- Navbar -->
${renderGuidesNav(lang, t, currentPaths, 'dictionary')}

    <main class="dictionary-main pt-28 pb-20 px-4">
        <div class="dictionary-shell mx-auto">

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
            <header class="dictionary-header">
                <div class="dictionary-hero-copy">
                    <span class="dictionary-hero-kicker">${escapeHtml(heroCopy.atlas)}</span>
                    <h1 class="font-serif text-3xl md:text-5xl lg:text-[3.4rem] mb-0 text-transparent bg-clip-text bg-gradient-to-b from-white via-dream-lavender to-purple-400/55 leading-tight max-w-4xl">
                        ${escapeHtml(dc.h1_text)}
                    </h1>
                    <p class="dictionary-hero-intro">${escapeHtml(heroCopy.guide)}</p>

                    <!-- Hero search -->
                    <div id="heroSearchShell" class="relative w-full">
                        <div class="dictionary-hero-search-input">
                            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/50 pointer-events-none"></i>
                            <input type="text" id="heroSearch" placeholder="${escapeHtml(dc.hero_search_placeholder)}"
                                class="hero-search w-full bg-white/8 border border-white/15 rounded-full py-4 pl-12 pr-14 text-base text-dream-cream placeholder:text-purple-200/55 transition-colors">
                        </div>
                        <button type="button" id="heroSearchClear" class="search-clear" aria-label="${escapeHtml(uiCopy.clearSearch)}" title="${escapeHtml(uiCopy.clearSearch)}" onclick="document.getElementById('heroSearch').value='';document.getElementById('heroSearch').dispatchEvent(new Event('input',{bubbles:true}));" hidden>
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
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
                        <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/50 pointer-events-none"></i>
                        <input type="text" id="stickySearch" placeholder="${escapeHtml(dc.sticky_search_placeholder)}"
                            class="search-input w-full rounded-full py-2 pl-12 pr-14 text-sm text-dream-cream transition-colors"
                            style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);outline:none;">
                        <button type="button" id="stickySearchClear" class="search-clear" aria-label="${escapeHtml(uiCopy.clearSearch)}" title="${escapeHtml(uiCopy.clearSearch)}" onclick="document.getElementById('stickySearch').value='';document.getElementById('stickySearch').dispatchEvent(new Event('input',{bubbles:true}));" hidden>
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div id="stickySearchStatus" class="sticky-status" hidden>
                        <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                        <span id="stickySearchStatusText"></span>
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
            <section id="categoryGridSection" class="quick-browse-panel glass-panel rounded-3xl">
                <div class="quick-browse-alpha letter-nav" aria-label="Alphabet">
${stickyAlphaLinks}
                </div>
                <div class="quick-browse-copy">
                    <div>
                        <h2 class="font-serif text-xl md:text-2xl text-dream-cream flex items-center gap-3">
                            <i data-lucide="grid-3x3" class="w-5 h-5 text-dream-salmon"></i>
                            ${escapeHtml(dc.browse_by_category)}
                        </h2>
                    </div>
                    <p>${escapeHtml(uiCopy.quickBrowseHelp)}</p>
                </div>
                <div class="category-browse-grid">
${catGridCards}
                </div>
            </section>

            <div id="searchFeedback" class="search-feedback" hidden>
                <div class="search-feedback-copy">
                    <span class="search-feedback-label">${escapeHtml(uiCopy.activeSearchLabel)}</span>
                    <span id="searchFeedbackText" class="search-feedback-text"></span>
                </div>
                <button type="button" id="searchFeedbackClear" class="search-feedback-clear" onclick="document.getElementById('heroSearch').value='';document.getElementById('heroSearch').dispatchEvent(new Event('input',{bubbles:true}));">${escapeHtml(uiCopy.clearSearch)}</button>
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
${renderGuidesFooter(lang, t, pages, currentPaths, 'dictionary')}

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            const navbar = document.getElementById('navbar');
            const stickyBar = document.getElementById('stickyBar');
            const symbolCards = document.querySelectorAll('.symbol-card');
            const listSections = document.querySelectorAll('#symbolsList > section');

            // ── Navbar scroll effect ──────────────────────────────────────
            window.addEventListener('scroll', () => {
                if (navbar) {
                    navbar.classList.toggle('py-3', window.scrollY > 50);
                    navbar.classList.toggle('py-5', window.scrollY <= 50);
                }
            });

            function updateSectionScrollOffset() {
                if (!stickyBar) return;
                const navbarHeight = navbar?.getBoundingClientRect().height || 0;
                const stickyTop = Math.ceil(navbarHeight + 12);
                stickyBar.style.setProperty('--sticky-bar-top', \`\${stickyTop}px\`);
                const stickyHeight = stickyBar.classList.contains('sb-visible') ? stickyBar.getBoundingClientRect().height : 0;
                const offset = Math.ceil(stickyTop + stickyHeight + 16);
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
                let visibleCount = 0;
                if (q === '') {
                    symbolCards.forEach(card => card.style.display = '');
                    listSections.forEach(section => section.style.display = '');
                    if (noResults) noResults.style.display = 'none';
                    visibleCount = symbolCards.length;
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
                            if (visible) {
                                hasVisible = true;
                                visibleCount += 1;
                            }
                        });
                        section.style.display = hasVisible ? '' : 'none';
                    });
                    const anyVisible = [...listSections].some(s => s.style.display !== 'none');
                    if (noResults) { noResults.style.display = anyVisible ? 'none' : 'block'; }
                    if (noResultsQuery) { noResultsQuery.textContent = query; }
                }
                return visibleCount;
            }

            // Hero search + sticky bar show/hide
            const heroSearch = document.getElementById('heroSearch');
            const stickySearch = document.getElementById('stickySearch');
            const heroSearchClear = document.getElementById('heroSearchClear');
            const stickySearchClear = document.getElementById('stickySearchClear');
            const heroHeader = heroSearch.closest('header');
            const categoryGridSection = document.getElementById('categoryGridSection');
            const searchFeedback = document.getElementById('searchFeedback');
            const searchFeedbackText = document.getElementById('searchFeedbackText');
            const searchFeedbackClear = document.getElementById('searchFeedbackClear');
            const stickySearchStatus = document.getElementById('stickySearchStatus');
            const stickySearchStatusText = document.getElementById('stickySearchStatusText');
            const symbolsListEl = document.getElementById('symbolsList');
            let revealSearchAreaTimer = null;
            const searchResultWord = ${JSON.stringify(
              lang === 'fr' ? 'résultat(s)' :
              lang === 'es' ? 'resultado(s)' :
              lang === 'de' ? 'Treffer' :
              lang === 'it' ? 'risultato/i' :
              'result(s)'
            )};

            function buildSearchStatus(query, count) {
                return \`${escapeHtml(uiCopy.activeSearchLabel)} «\${query}» · \${count} \${searchResultWord}\`;
            }

            function revealSearchArea(query, visibleCount) {
                if (!window.matchMedia('(max-width: 767px)').matches) return;
                if (!query.trim()) return;
                const firstVisibleCard = visibleCount > 0
                    ? [...document.querySelectorAll('.symbol-card')].find((card) => getComputedStyle(card).display !== 'none')
                    : null;
                const target = visibleCount > 0 ? firstVisibleCard || symbolsListEl : document.getElementById('noResults');
                if (!target) return;
                const rect = target.getBoundingClientRect();
                const visibleHeight = window.visualViewport?.height || window.innerHeight;
                const threshold = Math.min(window.innerHeight, visibleHeight) * 0.44;
                if (rect.top > threshold || rect.top < 0) {
                    const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dictionary-scroll-offset')) || 0;
                    const keyboardLift = window.visualViewport ? Math.max(0, window.innerHeight - window.visualViewport.height) : 0;
                    const nextTop = target.getBoundingClientRect().top + window.scrollY - offset - Math.min(keyboardLift, 220) + 12;
                    window.scrollTo({ top: Math.max(nextTop, 0), behavior: 'smooth' });
                }
            }

            function scheduleRevealSearchArea(query, visibleCount) {
                if (revealSearchAreaTimer) {
                    window.clearTimeout(revealSearchAreaTimer);
                    revealSearchAreaTimer = null;
                }
                if (!query.trim()) return;
                revealSearchAreaTimer = window.setTimeout(() => {
                    revealSearchArea(query, visibleCount);
                    revealSearchAreaTimer = null;
                }, 180);
            }

            function updateSearchUi(query, visibleCount) {
                const hasQuery = query.trim().length > 0;
                const isMobile = window.matchMedia('(max-width: 767px)').matches;
                const mobileSearchActive = hasQuery && isMobile;
                if (categoryGridSection) {
                    categoryGridSection.hidden = hasQuery;
                }
                if (searchFeedback) {
                    searchFeedback.hidden = !hasQuery;
                }
                if (stickySearchStatus) {
                    stickySearchStatus.hidden = !(hasQuery && (!window.matchMedia('(max-width: 767px)').matches || mobileSearchActive));
                }
                stickyBar?.classList.toggle('search-active', hasQuery && (!window.matchMedia('(max-width: 767px)').matches || mobileSearchActive));
                document.body.classList.toggle('dictionary-search-active', mobileSearchActive);
                if (searchFeedbackText) {
                    searchFeedbackText.textContent = hasQuery ? buildSearchStatus(query, visibleCount) : '';
                }
                if (stickySearchStatusText) {
                    stickySearchStatusText.textContent = hasQuery ? buildSearchStatus(query, visibleCount) : '';
                }
            }

            function setSearchValue(nextValue, source = 'hero') {
                heroSearch.value = nextValue;
                stickySearch.value = nextValue;
                const hasValue = nextValue.trim().length > 0;
                const isMobile = window.matchMedia('(max-width: 767px)').matches;
                if (heroSearchClear) heroSearchClear.hidden = !hasValue;
                if (stickySearchClear) stickySearchClear.hidden = !hasValue;
                const visibleCount = filterSymbols(nextValue);
                updateSearchUi(nextValue, visibleCount);
                if (hasValue && isMobile && source !== 'hero') {
                    stickyBar?.classList.add('sb-visible');
                    updateSectionScrollOffset();
                }
                scheduleRevealSearchArea(nextValue, visibleCount);
                if (source === 'sticky') {
                    stickySearch.focus({ preventScroll: true });
                }
            }

            function syncStickyBarVisibility() {
                if (!heroHeader || !stickyBar) return;
                const heroBottom = heroHeader.getBoundingClientRect().bottom;
                const navbarHeight = navbar?.getBoundingClientRect().height || 0;
                const shouldShow = heroBottom <= navbarHeight + 24;
                stickyBar.classList.toggle('sb-visible', shouldShow);
                updateSectionScrollOffset();
            }

            syncStickyBarVisibility();
            window.addEventListener('scroll', syncStickyBarVisibility, { passive: true });
            window.addEventListener('resize', syncStickyBarVisibility);

            heroSearch.addEventListener('input', (e) => {
                setSearchValue(e.target.value, 'hero');
            });
            heroSearch.addEventListener('blur', () => {
                if (window.matchMedia('(max-width: 767px)').matches && heroSearch.value.trim()) {
                    setSearchValue(heroSearch.value, 'sticky');
                }
            });
            stickySearch.addEventListener('input', (e) => {
                setSearchValue(e.target.value, 'sticky');
            });
            heroSearchClear?.addEventListener('click', () => {
                setSearchValue('', 'hero');
                heroSearch.focus({ preventScroll: true });
            });
            stickySearchClear?.addEventListener('click', () => {
                setSearchValue('', 'sticky');
            });
            searchFeedbackClear?.addEventListener('click', () => {
                setSearchValue('', 'hero');
                heroSearch.focus({ preventScroll: true });
            });
            setSearchValue(heroSearch.value || '');

            // ── Smooth scroll for letter navigation ───────────────────────
            document.querySelectorAll('.letter-link, .sidebar-alpha-link, .mobile-alpha-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = document.querySelector(link.getAttribute('href'));
                    updateSectionScrollOffset();
                    if (target) {
                        setActiveAlpha(link.dataset.letter);
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });

            // ── Active letter tracking (IntersectionObserver) ─────────────
            function setActiveAlpha(letter) {
                document.querySelectorAll('.letter-link, .sidebar-alpha-link, .mobile-alpha-link').forEach(l => {
                    l.classList.toggle('alpha-active', l.dataset.letter === letter);
                });
            }
            function syncActiveAlphaFromScroll() {
                const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dictionary-scroll-offset')) || 0;
                let activeSection = listSections[0]?.id || null;
                listSections.forEach((section) => {
                    if (section.style.display === 'none') return;
                    const top = section.getBoundingClientRect().top;
                    if (top - offset <= 24) {
                        activeSection = section.id;
                    }
                });
                if (activeSection) setActiveAlpha(activeSection);
            }
            syncActiveAlphaFromScroll();
            window.addEventListener('scroll', syncActiveAlphaFromScroll, { passive: true });
            window.addEventListener('resize', syncActiveAlphaFromScroll);

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
    <script src="/js/mobile-menu.js?v=${version}" defer></script>
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
