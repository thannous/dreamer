#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');
const { SUPPORTED_LANGS } = require('./lib/docs-seo-utils');
const { renderAhrefsAnalyticsScript } = require('./lib/ahrefs-analytics');
const { createRenderContext } = require('./lib/docs-components/context');
const { renderFooter: renderSharedFooter } = require('./lib/docs-components/footer');
const { renderNavigation } = require('./lib/docs-components/navigation');
const { renderViewTransitionHeadStyles } = require('./lib/docs-view-transitions');
const { materializeGeneratedPage } = require('./lib/generated-page-writer');
const {
  SYMBOL_ATLAS_COLUMNS,
  getSymbolAtlasPosition,
  normalizeDictionarySearchText,
  normalizePageTitle,
  prepareDictionarySymbols,
  scoreDictionarySearchMatch,
} = require('./lib/guide-dictionary-model');
const { inlineLucideIcons } = require('./lib/lucide-inline');
const { readSourceDocument } = require('./lib/docs-source-utils');
const {
  getPageImageSet,
  getPageResponsiveImages,
  readImageAssetRegistry,
  renderResponsivePicture,
} = require('./lib/image-seo-assets');
const { getPageIllustration } = require('./lib/page-illustrations');
const {
  SYMBOL_CARD_IMAGE_SIZES,
  SYMBOL_CARD_RESPONSIVE_WIDTHS,
  buildResponsiveSymbolImage,
  getGeneratedSymbolImage,
  loadSymbolImageRegistry,
} = require('./lib/symbol-image-assets');

const ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const DATA_DIR = path.join(DOCS_DIR, 'data');
const ROOT_DATA_DIR = path.join(ROOT, 'data');
const DOCS_SRC_DIR = path.join(ROOT, 'docs-src');
const DOMAIN = 'https://noctalia.app';
const DEFAULT_SOCIAL_IMAGE = `${DOMAIN}/img/og/noctalia-dreamscape-v2-1200x630.jpg`;
const DRY_RUN = process.argv.includes('--dry-run');
const SYMBOL_IMAGE_REGISTRY = loadSymbolImageRegistry();
const SYMBOL_IMAGE_ALT_SUFFIX = {
  de: 'Traumillustration',
  en: 'dream symbol illustration',
  es: 'ilustración de símbolo onírico',
  fr: 'illustration de symbole onirique',
  it: 'illustrazione di simbolo onirico',
};
const DICTIONARY_IMAGE_COPY = {
  de: {
    alt: 'Ein aufgeschlagenes Traumlexikon mit Schlüssel, Auge, Baum, Welle und Tür',
    caption: 'Traumsymbole werden hilfreicher, wenn sie mit Gefühlen, Kontext und persönlichen Assoziationen verbunden werden.',
  },
  en: {
    alt: 'An open dream dictionary surrounded by a key, eye, tree, wave and doorway',
    caption: 'Dream symbols become more useful when connected to emotion, context and personal associations.',
  },
  es: {
    alt: 'Un diccionario de sueños abierto rodeado de una llave, un ojo, un árbol, una ola y una puerta',
    caption: 'Los símbolos oníricos son más útiles cuando se relacionan con la emoción, el contexto y las asociaciones personales.',
  },
  fr: {
    alt: 'Un dictionnaire des rêves ouvert entouré d’une clé, d’un œil, d’un arbre, d’une vague et d’une porte',
    caption: 'Les symboles deviennent plus utiles lorsqu’ils sont reliés aux émotions, au contexte et aux associations personnelles.',
  },
  it: {
    alt: 'Un dizionario dei sogni aperto circondato da una chiave, un occhio, un albero, un’onda e una porta',
    caption: 'I simboli onirici diventano più utili quando sono collegati a emozioni, contesto e associazioni personali.',
  },
};
let IMAGE_SEO_REGISTRY = null;
try {
  IMAGE_SEO_REGISTRY = readImageAssetRegistry();
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

function resolveSymbolCardImage(symbolId, explicitIllustration) {
  const illustration =
    explicitIllustration?.src
      ? explicitIllustration
      : getGeneratedSymbolImage(symbolId, SYMBOL_IMAGE_REGISTRY);
  if (!illustration?.src) return null;

  const responsive = buildResponsiveSymbolImage(illustration, {
    fallbackWidth: SYMBOL_CARD_RESPONSIVE_WIDTHS[0],
    registry: SYMBOL_IMAGE_REGISTRY,
    widths: SYMBOL_CARD_RESPONSIVE_WIDTHS,
  });
  if (responsive) {
    return {
      ...responsive,
      sizes: SYMBOL_CARD_IMAGE_SIZES,
    };
  }

  const filePath = path.join(
    DOCS_SRC_DIR,
    'static',
    illustration.src.replace(/^\/+/, '')
  );
  if (!fs.existsSync(filePath)) return null;

  try {
    const dimensions = imageSize(fs.readFileSync(filePath));
    return {
      sizes: '',
      src: illustration.src,
      srcset: '',
      width: dimensions.width || 192,
      height: dimensions.height || 192,
    };
  } catch {
    return null;
  }
}

const SITE_CONFIG = fs.existsSync(path.join(DOCS_SRC_DIR, 'config', 'site.config.json'))
  ? JSON.parse(fs.readFileSync(path.join(DOCS_SRC_DIR, 'config', 'site.config.json'), 'utf8'))
  : { seoLinking: { featuredBlogEntries: [], featuredGuideEntries: [], featuredSymbols: [] } };
const SITE_MANIFEST = fs.existsSync(path.join(ROOT_DATA_DIR, 'site-manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT_DATA_DIR, 'site-manifest.json'), 'utf8'))
  : { collections: { blog: { entries: {} } } };

// Localized blog slug → article title (without the "| Noctalia" suffix), so
// symbol cards can say which related article they link to.
const BLOG_TITLES_BY_LANG = new Map();
function getBlogTitleBySlug(lang, slug) {
  if (!BLOG_TITLES_BY_LANG.has(lang)) {
    const map = new Map();
    const entries = SITE_MANIFEST.collections?.blog?.entries || {};
    for (const [id, entry] of Object.entries(entries)) {
      const localeSlug = entry.locales?.[lang]?.slug;
      if (!localeSlug) continue;
      const filePath = path.join(DOCS_SRC_DIR, 'content', 'blog', id, `${lang}.md`);
      if (!fs.existsSync(filePath)) continue;
      try {
        const { meta } = readSourceDocument(filePath);
        const title = normalizePageTitle(meta?.title).replace(/\s*[-–—]\s*Noctalia\s*$/i, '').trim();
        if (title) map.set(localeSlug, title);
      } catch {
        // Unreadable entry: the card falls back to the generic label.
      }
    }
    BLOG_TITLES_BY_LANG.set(lang, map);
  }
  return BLOG_TITLES_BY_LANG.get(lang).get(slug) || null;
}

function finalizeGeneratedHtml(html) {
  return inlineLucideIcons(html);
}

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
    dictionarySummary: 'Access our dictionary of 150 dream symbols with meanings and reflection prompts.',
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
    dictionarySummary: 'Accédez à notre dictionnaire de 150 symboles de rêves avec significations et questions de réflexion.',
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
    dictionarySummary: 'Accede a nuestro diccionario de 150 símbolos de sueños con significados y preguntas de reflexión.',
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
    dictionarySummary: 'Öffnen Sie unser Lexikon mit 150 Traumsymbolen, Bedeutungen und Reflexionsfragen.',
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
    dictionarySummary: 'Accedi al dizionario con 150 simboli dei sogni, significati e domande di riflessione.',
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

const GUIDE_HUB_DEPTH_COPY = {
  en: {
    title: 'How to use these guides',
    paragraphs: [
      'A dream guide works best when you start from the exact image that stayed with you after waking: a place, an animal, a person, a sensation, or a repeated action. Open the dictionary when you need a precise symbol, then use the themed guides when the dream belongs to a wider pattern such as fear, transformation, water, people, or familiar locations.',
      'Read each interpretation as a map, not a verdict. The same symbol can point to different meanings depending on your emotion in the dream, the role you played, and what is happening in your waking life. A dream about water, for example, can suggest emotional overload, renewal, memory, or uncertainty depending on whether you were swimming, drowning, watching waves, or crossing a river.',
      'For stronger results, compare the guide with a short dream journal entry. Note the date, the main feeling, the strongest image, and one real-life situation that might echo the dream. Patterns become clearer over several nights, especially for recurring dreams, nightmares, or dreams that appear during stress, exams, grief, relationship change, or creative work.',
      'Move from broad to specific: choose a theme first, then open the symbol page that matches the detail you remember most clearly. This keeps interpretation grounded and helps you avoid forcing one fixed meaning onto every dream.'
    ]
  },
  fr: {
    title: 'Comment utiliser ces guides',
    paragraphs: [
      "Un guide des rêves devient plus utile lorsque vous partez de l'image exacte qui reste au réveil : un lieu, un animal, une personne, une sensation ou une action répétée. Utilisez le dictionnaire pour un symbole précis, puis les guides thématiques quand le rêve appartient à un motif plus large comme la peur, la transformation, l'eau, les personnes ou les lieux familiers.",
      "Lisez chaque interprétation comme une carte, pas comme un verdict. Un même symbole peut changer de sens selon l'émotion ressentie, votre rôle dans la scène et ce qui se passe dans votre vie éveillée. Rêver d'eau peut par exemple évoquer une surcharge émotionnelle, un renouveau, un souvenir ou une incertitude selon que vous nagez, coulez, regardez des vagues ou traversez une rivière.",
      "Pour obtenir une lecture plus juste, comparez le guide avec une courte note de journal de rêves. Notez la date, l'émotion principale, l'image la plus forte et une situation réelle qui pourrait faire écho au rêve. Les motifs deviennent plus lisibles sur plusieurs nuits, surtout pour les rêves récurrents, les cauchemars ou les rêves liés au stress, aux examens, au deuil, aux changements relationnels ou à la créativité."
    ]
  },
  es: {
    title: 'Cómo usar estas guías',
    paragraphs: [
      'Una guía de sueños funciona mejor cuando empiezas por la imagen exacta que recuerdas al despertar: un lugar, un animal, una persona, una sensación o una acción repetida. Abre el diccionario cuando necesites un símbolo concreto y usa las guías temáticas cuando el sueño pertenezca a un patrón más amplio, como miedo, transformación, agua, personas o lugares familiares.',
      'Lee cada interpretación como un mapa, no como una sentencia. El mismo símbolo puede tener sentidos distintos según la emoción del sueño, el papel que tenías en la escena y lo que ocurre en tu vida despierta. Soñar con agua, por ejemplo, puede señalar carga emocional, renovación, memoria o incertidumbre según si nadabas, te hundías, mirabas olas o cruzabas un río.',
      'Para una lectura más precisa, compara la guía con una breve entrada de diario de sueños. Anota la fecha, la emoción principal, la imagen más intensa y una situación real que pueda resonar con el sueño. Los patrones aparecen con más claridad durante varias noches, sobre todo en sueños recurrentes, pesadillas o sueños que llegan con estrés, exámenes, duelo, cambios de relación o trabajo creativo.'
    ]
  },
  de: {
    title: 'So nutzen Sie diese Ratgeber',
    paragraphs: [
      'Ein Traumratgeber hilft am meisten, wenn Sie mit dem genauen Bild beginnen, das nach dem Aufwachen geblieben ist: ein Ort, ein Tier, eine Person, ein Gefühl oder eine wiederholte Handlung. Öffnen Sie das Lexikon für ein einzelnes Symbol und nutzen Sie die thematischen Ratgeber, wenn der Traum zu einem größeren Muster gehört, etwa Angst, Wandel, Wasser, Menschen oder vertrauten Orten.',
      'Lesen Sie jede Deutung als Orientierung, nicht als endgültiges Urteil. Dasselbe Symbol kann je nach Traumgefühl, Ihrer Rolle in der Szene und Ihrer aktuellen Lebenslage Unterschiedliches bedeuten. Wasser kann zum Beispiel emotionale Überforderung, Erneuerung, Erinnerung oder Unsicherheit anzeigen, je nachdem ob Sie schwimmen, untergehen, Wellen beobachten oder einen Fluss überqueren.',
      'Noch genauer wird die Deutung, wenn Sie den Ratgeber mit einem kurzen Traumtagebuch verbinden. Notieren Sie Datum, Hauptgefühl, stärkstes Bild und eine reale Situation, die zum Traum passen könnte. Muster werden über mehrere Nächte sichtbar, besonders bei wiederkehrenden Träumen, Albträumen oder Träumen, die während Stress, Prüfungen, Trauer, Beziehungswechseln oder kreativer Arbeit auftreten.',
      'Gehen Sie vom Allgemeinen zum Konkreten: Wählen Sie zuerst ein Thema und öffnen Sie danach die Symbolseite, die zum stärksten Detail passt. So bleibt die Deutung geerdet und Sie vermeiden, jedem Traum dieselbe feste Bedeutung aufzuzwingen. Wenn ein Symbol mehrdeutig bleibt, vergleichen Sie es mit einem zweiten Motiv aus demselben Traum, statt sofort eine einzige Erklärung zu wählen. Das macht die Auswertung stabiler.'
    ]
  },
  it: {
    title: 'Come usare queste guide',
    paragraphs: [
      "Una guida ai sogni è più utile quando parti dall'immagine precisa rimasta al risveglio: un luogo, un animale, una persona, una sensazione o un'azione ripetuta. Apri il dizionario quando ti serve un simbolo specifico e usa le guide tematiche quando il sogno fa parte di uno schema più ampio, come paura, trasformazione, acqua, persone o luoghi familiari.",
      "Leggi ogni interpretazione come una mappa, non come una sentenza. Lo stesso simbolo può cambiare significato in base all'emozione provata, al ruolo che avevi nella scena e a ciò che accade nella vita da sveglio. Sognare acqua, per esempio, può indicare sovraccarico emotivo, rinnovamento, memoria o incertezza a seconda che tu stia nuotando, affondando, guardando onde o attraversando un fiume.",
      'Per una lettura più precisa, confronta la guida con una breve nota nel diario dei sogni. Segna la data, l’emozione principale, l’immagine più forte e una situazione reale che potrebbe risuonare con il sogno. I pattern diventano più chiari su più notti, soprattutto con sogni ricorrenti, incubi o sogni legati a stress, esami, lutti, cambiamenti nelle relazioni o lavoro creativo.'
    ]
  }
};

const CATEGORY_ORDER = ['nature', 'animals', 'body', 'places', 'objects', 'actions', 'people', 'celestial'];
const CATEGORY_COLORS = { nature: '#4ade80', animals: '#fbbf24', body: '#f87171', places: '#60a5fa', objects: '#c084fc', actions: '#fb923c', people: '#f472b6', celestial: '#818cf8' };
const SYMBOL_PATHS = { en: 'symbols', fr: 'symboles', es: 'simbolos', de: 'traumsymbole', it: 'simboli' };
const DICTIONARY_UI_COPY = {
  en: {
    categoriesShort: 'categories',
    quickBrowseHelp: 'Choose a category or use A-Z to jump straight to the right symbol.',
    clearSearch: 'Clear search',
    activeSearchLabel: 'Active search',
    backToTop: 'Back to top',
    methodologyLink: 'How this catalog is maintained',
    storeCta: 'Install Noctalia free',
    detailsCta: 'See how Noctalia adds your context',
    platformNote: 'Android 13+ · Free account · Optional in-app purchases',
    proofItems: [
      { icon: 'mic-2', title: 'Voice or text', text: 'Capture a dream in seconds.' },
      { icon: 'sparkles', title: 'Personal reading', text: 'Symbols, emotions and context together.' },
      { icon: 'infinity', title: 'Unlimited saved dreams', text: 'With a free account.' },
    ],
    privacyLink: 'Read the privacy policy',
    viewSymbolCta: 'View symbol',
    relatedArticleLabel: 'Related article:',
    relatedGuideLabel: 'Related guide:',
  },
  fr: {
    categoriesShort: 'catégories',
    quickBrowseHelp: 'Choisissez une catégorie ou utilisez A-Z pour aller droit au bon symbole.',
    clearSearch: 'Vider la recherche',
    activeSearchLabel: 'Recherche active',
    backToTop: 'Revenir en haut',
    methodologyLink: 'Comment ce catalogue est maintenu',
    storeCta: 'Installer Noctalia gratuitement',
    detailsCta: 'Voir comment Noctalia relie votre contexte',
    platformNote: 'Android 13+ · Compte gratuit · Achats intégrés facultatifs',
    proofItems: [
      { icon: 'mic-2', title: 'Enregistrement par voix ou texte', text: 'Capturez un rêve en quelques secondes.' },
      { icon: 'sparkles', title: 'Lecture personnelle', text: 'Symboles, émotions et contexte réunis.' },
      { icon: 'infinity', title: 'Rêves sans limite', text: 'Avec un compte gratuit.' },
    ],
    privacyLink: 'Lire la politique de confidentialité',
    viewSymbolCta: 'Voir le symbole',
    relatedArticleLabel: 'Article lié :',
    relatedGuideLabel: 'Guide lié :',
  },
  es: {
    categoriesShort: 'categorías',
    quickBrowseHelp: 'Elige una categoría o usa A-Z para ir directamente al símbolo adecuado.',
    clearSearch: 'Borrar búsqueda',
    activeSearchLabel: 'Búsqueda activa',
    backToTop: 'Volver arriba',
    methodologyLink: 'Cómo se mantiene este catálogo',
    storeCta: 'Instalar Noctalia gratis',
    detailsCta: 'Ver cómo Noctalia añade tu contexto',
    platformNote: 'Android 13+ · Cuenta gratuita · Compras opcionales en la app',
    proofItems: [
      { icon: 'mic-2', title: 'Voz o texto', text: 'Captura un sueño en segundos.' },
      { icon: 'sparkles', title: 'Interpretación personal', text: 'Símbolos, emociones y contexto unidos.' },
      { icon: 'infinity', title: 'Sueños sin límite', text: 'Con una cuenta gratuita.' },
    ],
    privacyLink: 'Leer la política de privacidad',
    viewSymbolCta: 'Ver el símbolo',
    relatedArticleLabel: 'Artículo relacionado:',
    relatedGuideLabel: 'Guía relacionada:',
  },
  de: {
    categoriesShort: 'Kategorien',
    quickBrowseHelp: 'Wähle eine Kategorie oder nutze A-Z, um direkt zum richtigen Symbol zu springen.',
    clearSearch: 'Suche löschen',
    activeSearchLabel: 'Aktive Suche',
    backToTop: 'Nach oben',
    methodologyLink: 'So wird dieser Katalog gepflegt',
    storeCta: 'Noctalia kostenlos installieren',
    detailsCta: 'So bezieht Noctalia deinen Kontext ein',
    platformNote: 'Android 13+ · Kostenloses Konto · Optionale In-App-Käufe',
    proofItems: [
      { icon: 'mic-2', title: 'Sprache oder Text', text: 'Erfasse einen Traum in Sekunden.' },
      { icon: 'sparkles', title: 'Persönliche Deutung', text: 'Symbole, Gefühle und Kontext zusammen.' },
      { icon: 'infinity', title: 'Unbegrenzt viele Träume', text: 'Mit einem kostenlosen Konto.' },
    ],
    privacyLink: 'Datenschutzerklärung lesen',
    viewSymbolCta: 'Symbol ansehen',
    relatedArticleLabel: 'Verwandter Artikel:',
    relatedGuideLabel: 'Passender Leitfaden:',
  },
  it: {
    categoriesShort: 'categorie',
    quickBrowseHelp: 'Scegli una categoria oppure usa A-Z per arrivare subito al simbolo giusto.',
    clearSearch: 'Cancella ricerca',
    activeSearchLabel: 'Ricerca attiva',
    backToTop: 'Torna su',
    methodologyLink: 'Come viene mantenuto questo catalogo',
    storeCta: 'Installa Noctalia gratis',
    detailsCta: 'Scopri come Noctalia usa il tuo contesto',
    platformNote: 'Android 13+ · Account gratuito · Acquisti in-app facoltativi',
    proofItems: [
      { icon: 'mic-2', title: 'Voce o testo', text: 'Cattura un sogno in pochi secondi.' },
      { icon: 'sparkles', title: 'Lettura personale', text: 'Simboli, emozioni e contesto insieme.' },
      { icon: 'infinity', title: 'Sogni senza limiti', text: 'Con un account gratuito.' },
    ],
    privacyLink: 'Leggi l’informativa sulla privacy',
    viewSymbolCta: 'Vedi il simbolo',
    relatedArticleLabel: 'Articolo correlato:',
    relatedGuideLabel: 'Guida correlata:',
  },
};

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), 'utf8'));
}

// Cached across the 5 language builds — the extended catalog is ~1.6 MB.
let EXTENDED_SYMBOLS_CACHE = null;
function readExtendedSymbols() {
  if (!EXTENDED_SYMBOLS_CACHE) {
    try {
      EXTENDED_SYMBOLS_CACHE = readJson('dream-symbols-extended.json').symbols || {};
    } catch {
      EXTENDED_SYMBOLS_CACHE = {};
    }
  }
  return EXTENDED_SYMBOLS_CACHE;
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

function renderJsonLd(data) {
  return `    <script type="application/ld+json">\n${JSON.stringify(data, null, 4)
    .replace(/</g, '\\u003c')
    .split('\n')
    .map((line) => `        ${line}`)
    .join('\n')}\n    </script>`;
}

function homeUrl(lang) {
  return lang === 'en' ? DOMAIN : `${DOMAIN}/${lang}/`;
}

function homePath(lang) {
  return lang === 'en' ? '/' : `/${lang}/`;
}

function getAndroidStoreUrl(lang) {
  const base = SITE_CONFIG.storeLinks?.androidBase || 'https://play.google.com/store/apps/details?id=com.tanuki75.noctalia';
  return `${base}&hl=${lang}`;
}

function getManagedPagePath(entryId, lang, fallback = homePath(lang)) {
  return SITE_MANIFEST.collections?.pages?.entries?.[entryId]?.locales?.[lang]?.path || fallback;
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

function renderGuidesNav(lang, t, currentPaths, activeLabel) {
  return renderNavigation(createGuidesShellContext(lang, currentPaths, activeLabel));
}

function renderGuidesFooter(lang, t, pages, currentPaths, activeNav = 'guides') {
  return renderSharedFooter(createGuidesShellContext(lang, currentPaths, activeNav));
}

function renderGuideHubStyles() {
  return `    <style>
        body { margin: 0; background: #0a0514; color: #f8f5ff; font-family: system-ui, sans-serif; }
        a { color: inherit; text-decoration: none; }
        .noctalia-premium-nav { background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; }
        .noctalia-premium-nav.py-2 { background: rgba(10, 5, 20, 0.78); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24); }
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
        #mobileMenuPanel { position: relative; z-index: 60; }
        .mobile-menu-surface {
          background: #120720 !important;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .noctalia-premium-nav.mobile-menu-open,
        .noctalia-premium-nav:has(#mobileMenuButton[aria-expanded="true"]) {
          background: rgba(10, 5, 20, 0.92);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34);
        }
        .guides-page .nav-scroll-hidden {
          transform: translateY(0);
          opacity: 1;
          pointer-events: auto;
        }
        .guides-page .site-footer {
          position: relative;
          z-index: 2;
          background: #05020a !important;
        }
        .guides-page .site-footer > .grid {
          position: relative;
          z-index: 1;
        }
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
          position: relative;
          z-index: 2;
          max-width: 58rem;
        }
        .guides-hero[data-image-seo-hero="true"] {
          min-height: max(40rem, 78svh);
          align-items: end;
          isolation: isolate;
        }
        .guides-hero[data-image-seo-hero="true"]::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(7,3,15,0.16) 0%, rgba(7,3,15,0.26) 42%, rgba(7,3,15,0.95) 100%), linear-gradient(90deg, rgba(7,3,15,0.56), rgba(7,3,15,0.08) 58%, rgba(7,3,15,0.4));
        }
        .guides-hero-illustration {
          position: absolute;
          inset: 0;
          z-index: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          overflow: hidden;
        }
        .guides-hero-illustration picture, .guides-hero-illustration img { display: block; width: 100%; height: 100%; }
        .guides-hero-illustration img { object-fit: cover; object-position: center; }
        .guides-hero-illustration figcaption { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); clip-path: inset(50%); white-space: nowrap; border: 0; }
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
        .guides-card, .guides-dictionary-card {
          position: relative;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(226,218,255,0.16);
          background: rgba(18, 9, 33, 0.68);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.28);
          backdrop-filter: blur(18px);
        }
        .guides-card::before, .guides-dictionary-card::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0.74;
          pointer-events: none;
          background: radial-gradient(circle at 78% 20%, var(--guide-tone, rgba(253,164,129,0.26)), transparent 52%);
        }
        .guides-card-icon {
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
        .guides-card-title, .guides-dictionary-title {
          position: relative;
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          color: #fff7f0;
          line-height: 1.06;
          letter-spacing: 0;
          text-wrap: balance;
          overflow-wrap: anywhere;
        }
        .guides-card-desc, .guides-dictionary-desc {
          position: relative;
          color: rgba(226,218,255,0.78);
          line-height: 1.5;
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
          grid-auto-rows: minmax(10.15rem, auto);
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
        .guides-card:hover, .guides-dictionary-card:hover {
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
        .guides-depth {
          margin-top: 1.4rem;
          padding: clamp(1.35rem, 2.4vw, 2rem);
          border-radius: 10px;
          border: 1px solid rgba(226,218,255,0.14);
          background: rgba(9, 4, 20, 0.58);
          backdrop-filter: blur(14px);
        }
        .guides-depth h2 {
          margin: 0 0 1rem;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.65rem, 2vw, 2.35rem);
          line-height: 1.02;
          color: #fff7f0;
        }
        .guides-depth-copy {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }
        .guides-depth-copy p {
          margin: 0;
          color: rgba(226,218,255,0.78);
          font-size: 0.95rem;
          line-height: 1.65;
        }
        @media (max-width: 1180px) {
          .guides-hero { grid-template-columns: 1fr; min-height: auto; padding-top: 7rem; }
          .guides-entry-layout { grid-template-columns: 1fr; }
          .guides-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .guides-title { max-width: 16ch; }
          .guides-depth-copy { grid-template-columns: 1fr; }
        }
        @media (max-width: 980px) {
          .noctalia-premium-nav {
            background: rgba(10, 5, 20, 0.78);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
          }
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
          .guides-page .site-footer {
            padding: 2rem 1rem 1.75rem !important;
          }
          .guides-page .site-footer > .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1.5rem 1rem;
            margin-bottom: 2rem;
          }
          .guides-page .site-footer > .grid > :first-child {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 0.45rem 1rem;
            align-items: center;
            padding-bottom: 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }
          .guides-page .site-footer > .grid > :first-child > a {
            grid-column: 1;
            grid-row: 1;
            margin-bottom: 0;
          }
          .guides-page .site-footer > .grid > :first-child > p {
            grid-column: 1;
            grid-row: 2;
            margin-bottom: 0;
            max-width: 17rem;
          }
          .guides-page .site-footer > .grid > :first-child > div.flex {
            grid-column: 2;
            grid-row: 1 / span 2;
            gap: 0.45rem;
          }
          .guides-page .site-footer > .grid > :first-child > div.flex a {
            width: 2.35rem;
            height: 2.35rem;
          }
          .guides-page .site-footer h5 {
            margin-bottom: 0.65rem;
            font-size: 0.76rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(255, 247, 240, 0.92);
          }
          .guides-page .site-footer ul {
            font-size: 0.82rem;
            line-height: 1.35;
          }
          .guides-page .site-footer li + li {
            margin-top: 0.45rem;
          }
          .guides-page .site-footer > .border-t:last-child {
            padding-top: 1rem;
          }
          .guides-page { background-position: center top; }
          .guides-hero {
            min-height: clamp(34rem, 132vw, 46rem);
            padding: 5.35rem 1rem 2.25rem;
          }
          .guides-title { font-size: clamp(1.25rem, 5.6vw, 1.85rem); max-width: none; }
          .guides-lede {
            max-width: 20rem;
            margin-top: 0.85rem;
            font-size: 0.96rem;
            line-height: 1.45;
          }
          .guides-actions { flex-direction: column; }
          .guides-button { width: 100%; }
          .guides-section {
            margin-top: 0;
            padding-top: 0.5rem;
          }
          .guides-entry-left .guides-section-head {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }
          .guides-section h2 { font-size: clamp(1.15rem, 4.8vw, 1.45rem); max-width: none; }
          .guides-bento {
            display: flex;
            flex-direction: column;
            gap: 0.95rem;
          }
          .guides-dictionary-card {
            grid-column: auto;
            grid-row: auto;
            min-height: 13.5rem;
            padding: 1rem;
          }
          .guides-dictionary-title {
            margin-top: 0.7rem;
            font-size: clamp(1.2rem, 5vw, 1.5rem);
          }
          .guides-dictionary-desc {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            max-width: 18rem;
          }
          .guides-dictionary-cta { display: none; }
          .guides-card {
            min-height: 13rem;
            padding: 1rem;
            justify-content: space-between;
          }
          .guides-card-title { font-size: clamp(1.05rem, 4.6vw, 1.35rem); }
          .guides-card-desc {
            max-width: 18rem;
            font-size: 0.94rem;
            line-height: 1.45;
          }
          .guides-card-meta { margin-top: 1.2rem; }
          .guides-trust { grid-template-columns: 1fr; }
          .guides-trust-item { border-right: 0; border-bottom: 1px solid rgba(226,218,255,0.14); padding: 1rem 0; }
          .guides-trust-item:last-child { border-bottom: 0; }
        }
    </style>`;
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

function renderGuideDepthSection(lang) {
  const copy = GUIDE_HUB_DEPTH_COPY[lang] || GUIDE_HUB_DEPTH_COPY.en;
  return `            <section class="guides-depth" aria-labelledby="guidesDepthTitle">
                <h2 id="guidesDepthTitle">${escapeHtml(copy.title)}</h2>
                <div class="guides-depth-copy">
${copy.paragraphs.map((paragraph) => `                    <p>${escapeHtml(paragraph)}</p>`).join('\n')}
                </div>
            </section>`;
}

function generateHubPage(lang, t, pages, version) {
  const copy = COPY[lang];
  const ui = GUIDE_HUB_UI[lang] || GUIDE_HUB_UI.en;
  const currentPaths = Object.fromEntries(SUPPORTED_LANGS.map((candidate) => [candidate, `/${candidate}/guides/`]));
  const socialTitle = copy.title;
  const socialDescription = copy.desc;
  const pageIllustration = getPageIllustration('guide.index', lang, copy.label);
  const socialImage = pageIllustration
    ? `${DOMAIN}${pageIllustration.image.src}`
    : DEFAULT_SOCIAL_IMAGE;
  const socialImageWidth = pageIllustration?.image.width || 1200;
  const socialImageHeight = pageIllustration?.image.height || 630;
  const heroPicture = pageIllustration
    ? renderResponsivePicture(pageIllustration.registry, pageIllustration.ref, {
        figure: false,
        priority: true,
        sizes: '100vw',
        mobileSizes: '100vw',
      })
    : '';
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
  const collection = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: copy.label, headline: copy.label, description: copy.desc, url: `${DOMAIN}/${lang}/guides/`, inLanguage: lang, ...(pageIllustration ? { primaryImageOfPage: { '@type': 'ImageObject', url: socialImage, width: socialImageWidth, height: socialImageHeight } } : {}) };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: t.home, item: homeUrl(lang) }, { '@type': 'ListItem', position: 2, name: copy.label, item: `${DOMAIN}/${lang}/guides/` }] };
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
${renderAhrefsAnalyticsScript()}
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(socialTitle)}">
    <meta property="og:description" content="${escapeHtml(socialDescription)}">
    <meta property="og:url" content="${DOMAIN}/${lang}/guides/">
    <meta property="og:image" content="${socialImage}">
    <meta property="og:image:width" content="${socialImageWidth}">
    <meta property="og:image:height" content="${socialImageHeight}">
    <meta property="og:image:alt" content="${escapeHtml(pageIllustration?.ref.alt || copy.label)}">
    <meta property="og:site_name" content="Noctalia">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@NoctaliaDreams">
    <meta name="twitter:title" content="${escapeHtml(socialTitle)}">
    <meta name="twitter:description" content="${escapeHtml(socialDescription)}">
    <meta name="twitter:image" content="${socialImage}">
    <meta name="twitter:image:alt" content="${escapeHtml(pageIllustration?.ref.alt || copy.label)}">
    <link rel="stylesheet" href="/css/styles.min.css?v=${version}">
    <link rel="stylesheet" href="/css/language-dropdown.css?v=${version}">
${renderViewTransitionHeadStyles()}
${renderGuideHubStyles()}
${renderJsonLd(collection)}
${renderJsonLd(itemList)}
${renderJsonLd(breadcrumb)}
</head>
<body class="bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden">
    <div class="guides-page">
${renderGuidesNav(lang, t, currentPaths, 'guides')}
    <main class="guides-shell">
        <section class="guides-hero" aria-labelledby="guidesTitle"${pageIllustration ? ' data-image-seo-hero="true"' : ''}>
${pageIllustration ? `            <figure class="guides-hero-illustration" data-image-seo-role="editorial" data-image-asset-id="${escapeHtml(pageIllustration.image.assetId)}">
                ${heroPicture}
                <figcaption>${escapeHtml(pageIllustration.ref.caption)}</figcaption>
            </figure>` : ''}
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
${renderGuideDepthSection(lang)}
        </section>
    </main>
${renderGuidesFooter(lang, t, pages, currentPaths, 'guides')}
    </div>
    <script src="/js/site-shell.js?v=${version}" defer></script>
    <script src="/js/language-dropdown.js?v=${version}" defer></script>
    <script src="/js/mobile-menu.js?v=${version}" defer></script>
</body>
</html>`;
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
            linear-gradient(180deg, rgba(5, 2, 12, 0.7) 0%, rgba(8, 3, 17, 0.48) 34%, #090413 88%),
            linear-gradient(90deg, rgba(5, 2, 12, 0.76) 0%, rgba(5, 2, 12, 0.2) 48%, rgba(5, 2, 12, 0.62) 100%),
            radial-gradient(ellipse at 76% 28%, rgba(253, 164, 129, 0.14), transparent 24rem),
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
          --dictionary-hero-media-height: clamp(40rem, 78svh, 68rem);
          position: relative;
          isolation: isolate;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-items: end;
          overflow: hidden;
          min-height: var(--dictionary-hero-media-height);
          margin-bottom: 0;
          padding: 7.2rem clamp(1rem, 4vw, 4.75rem) 2.1rem;
          text-align: left;
          background: #0a0514;
        }
        .dictionary-header::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(5,2,12,0.94) 0%, rgba(5,2,12,0.78) 34%, rgba(5,2,12,0.34) 68%, rgba(5,2,12,0.5) 100%),
            linear-gradient(180deg, rgba(5,2,12,0.38) 0%, rgba(8,3,17,0.12) 48%, #090413 100%);
        }
        .dictionary-hero-image {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          margin: 0;
          border: 0;
          border-radius: 0;
          background: #0a0514;
          box-shadow: none;
        }
        .dictionary-hero-image picture {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
        }
        .dictionary-hero-image img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .dictionary-hero-image figcaption {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          clip-path: inset(50%);
          white-space: nowrap;
          border: 0;
        }
        .dictionary-educational-image figcaption {
          margin: 0;
          padding: 0.9rem 1rem 1rem;
          color: rgba(231,220,255,0.76);
          border-top: 1px solid rgba(255,255,255,0.1);
          background: #100a1a;
          font-size: 0.875rem;
          line-height: 1.55;
        }
        .dictionary-reflection-guide {
          width: min(calc(100% - (var(--dictionary-edge) * 2)), 920px);
          margin: 2.5rem auto 0;
          padding: 1.6rem 1.7rem 1.4rem;
        }
        .reflection-kicker {
          margin: 0 0 0.5rem;
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #fda481;
        }
        .dictionary-reflection-guide h2 {
          margin: 0 0 0.45rem;
          font-size: clamp(1.4rem, 2.2vw, 1.9rem);
          line-height: 1.15;
        }
        .reflection-deck {
          margin: 0 0 1.2rem;
          font-size: 0.92rem;
          color: rgba(226,218,255,0.78);
        }
        .reflection-steps {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
          gap: 0.7rem;
          margin: 0 0 1.1rem;
          padding: 0;
          list-style: none;
        }
        .reflection-step {
          display: flex;
          gap: 0.7rem;
          padding: 0.85rem 0.95rem;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.9rem;
          background: rgba(255,255,255,0.035);
        }
        .reflection-step-number {
          flex-shrink: 0;
          width: 1.7rem;
          height: 1.7rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          background: rgba(253,164,129,0.16);
          color: #fda481;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .reflection-step-body {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }
        .reflection-step-body strong {
          color: #f8f5ff;
          font-size: 0.92rem;
        }
        .reflection-step-question {
          font-size: 0.85rem;
          color: rgba(226,218,255,0.85);
        }
        .reflection-step-prompt {
          font-size: 0.78rem;
          color: rgba(196,181,253,0.72);
        }
        .reflection-footer {
          margin: 0;
          padding: 0.7rem 0.9rem;
          border-left: 3px solid rgba(253,164,129,0.55);
          border-radius: 0;
          background: rgba(253,164,129,0.07);
          font-size: 0.85rem;
          color: rgba(248,245,255,0.88);
        }
        .dictionary-educational-image {
          width: min(calc(100% - (var(--dictionary-edge) * 2)), 920px);
          margin: 2.5rem auto;
          padding: 0;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 1.25rem;
          background: radial-gradient(circle at 82% 12%, rgba(185,164,255,0.14), transparent 34%), #0a0612;
          box-shadow: 0 1.5rem 4rem rgba(0,0,0,0.24);
        }
        .dictionary-educational-image picture,
        .dictionary-educational-image img {
          display: block;
          width: 100%;
        }
        .dictionary-educational-image img {
          height: auto;
        }
        .dictionary-educational-image picture {
          aspect-ratio: 4 / 3;
        }
        @media (max-width: 640px) {
          .dictionary-educational-image picture {
            aspect-ratio: 3 / 4;
          }
        }
        .dictionary-hero-copy {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          width: min(100%, 48rem);
          min-width: 0;
        }
        .dictionary-hero-kicker {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: rgba(253,164,129,0.9);
          font-size: 0.76rem;
          line-height: 1.2;
          text-transform: uppercase;
          letter-spacing: 0.11em;
          font-weight: 700;
        }
        .dictionary-header h1 {
          width: min(100%, 18ch);
          max-width: none;
          margin: 0;
          font-size: clamp(3.25rem, 5vw, 5.8rem);
          line-height: 0.94;
          letter-spacing: 0;
          background: linear-gradient(180deg, #fff 0%, #f8f5ff 54%, rgba(226,218,255,0.9) 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          text-shadow: 0 1.2rem 3rem rgba(0,0,0,0.28);
        }
        .dictionary-hero-intro {
          max-width: 39rem;
          color: rgba(237,225,255,0.82);
          font-size: clamp(0.98rem, 1.3vw, 1.1rem);
          line-height: 1.5;
        }
        #heroSearchShell {
          max-width: 43rem;
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
          min-height: 3.7rem;
          border-color: rgba(255,255,255,0.2) !important;
          background: rgba(12,7,25,0.74) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(253,164,129,0.08);
        }
        #heroSearchShell .search-clear {
          position: static;
          transform: none;
          width: 3.7rem;
          height: 3.7rem;
          flex: 0 0 3.7rem;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(12,7,25,0.74);
        }
        .dictionary-conversion-links a {
          color: #fda481;
          text-decoration: underline;
          text-decoration-color: rgba(253,164,129,0.35);
          text-underline-offset: 0.2em;
        }
        .dictionary-conversion-links a:hover {
          color: #fff7f0;
          text-decoration-color: rgba(255,247,240,0.65);
        }
        .dictionary-discovery-only[hidden],
        #dictionary-grid[hidden] {
          display: none !important;
        }
        .dictionary-conversion {
          box-sizing: border-box;
          width: calc(100% - (var(--dictionary-edge) * 2));
          margin: 1.15rem var(--dictionary-edge) 1.8rem;
          padding: clamp(1.25rem, 2.4vw, 2rem);
          display: grid;
          grid-template-columns: minmax(18rem, 0.8fr) minmax(0, 1.2fr);
          gap: 1.4rem clamp(1.2rem, 3vw, 2.8rem);
          border: 1px solid rgba(253,164,129,0.22);
          border-radius: 1.35rem;
          background:
            radial-gradient(circle at 88% 12%, rgba(253,164,129,0.12), transparent 28rem),
            linear-gradient(145deg, rgba(27,13,43,0.96), rgba(12,7,25,0.9));
          box-shadow: 0 1.4rem 3.5rem rgba(0,0,0,0.2);
        }
        .dictionary-conversion-copy h2 {
          margin: 0.45rem 0 0.75rem;
          max-width: 17ch;
          color: #fff7f0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.7rem, 2.4vw, 2.45rem);
          line-height: 1.02;
        }
        .dictionary-conversion-copy > p:not(.dictionary-platform-note) {
          max-width: 35rem;
          margin: 0;
          color: rgba(226,218,255,0.8);
          line-height: 1.55;
        }
        .dictionary-conversion-kicker {
          color: #fda481;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }
        .dictionary-conversion-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.65rem;
          margin-top: 1.2rem;
        }
        .dictionary-store-cta,
        .dictionary-details-cta {
          min-height: 2.75rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.72rem 1rem;
          border-radius: 9999px;
          font-size: 0.9rem;
          font-weight: 800;
          line-height: 1.2;
          text-decoration: none;
        }
        .dictionary-store-cta {
          color: #0a0514;
          background: #fda481;
        }
        .dictionary-store-cta:hover { background: #ffb89b; }
        .dictionary-details-cta {
          color: #fff7f0;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.05);
        }
        .dictionary-details-cta:hover {
          border-color: rgba(253,164,129,0.42);
          background: rgba(253,164,129,0.08);
        }
        .dictionary-platform-note {
          margin: 0.75rem 0 0 !important;
          color: rgba(196,181,253,0.72) !important;
          font-size: 0.76rem;
          line-height: 1.4;
        }
        .dictionary-proof-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.7rem;
          /* Size the row to its content instead of stretching to the copy
             column's height, which left dead space under the card text. */
          align-content: center;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .dictionary-proof-item {
          min-width: 0;
          display: flex;
          align-items: flex-start;
          gap: 0.7rem;
          padding: 0.85rem;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.9rem;
          background: rgba(255,255,255,0.035);
        }
        .dictionary-proof-icon {
          width: 2.3rem;
          height: 2.3rem;
          flex: 0 0 2.3rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          color: #fda481;
          background: rgba(253,164,129,0.1);
        }
        .dictionary-proof-item strong {
          display: block;
          color: #fff7f0;
          font-size: 0.88rem;
          line-height: 1.25;
        }
        .dictionary-proof-item strong + span {
          display: block;
          margin-top: 0.3rem;
          color: rgba(226,218,255,0.7);
          font-size: 0.76rem;
          line-height: 1.45;
        }
        .dictionary-conversion-links {
          grid-column: 1 / -1;
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem 1.2rem;
          padding-top: 0.9rem;
          border-top: 1px solid rgba(255,255,255,0.08);
          font-size: 0.8rem;
        }
        .quick-browse-panel {
          position: relative;
          width: calc(100% - (var(--dictionary-edge) * 2));
          max-width: none;
          margin-left: var(--dictionary-edge);
          margin-right: var(--dictionary-edge);
          padding: clamp(0.75rem, 1.35vw, 1rem);
          margin-bottom: 1.15rem;
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
          margin-bottom: 0.62rem;
        }
        .quick-browse-copy h2 {
          font-size: clamp(1.35rem, 2.2vw, 2rem);
          line-height: 1.05;
        }
        .quick-browse-copy p {
          color: rgba(226,218,255,0.72);
          font-size: 0.84rem;
        }
        .category-browse-grid {
          /* Wrapping grid: all 8 categories stay visible (no clipped
             horizontal scroll, which hid the last chip on desktop). */
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.55rem;
        }
        .category-browse-card {
          position: relative;
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 0.5rem;
          min-height: 3.25rem;
          padding: 0.55rem 0.7rem;
          border-radius: 0.7rem;
          border: 1px solid color-mix(in srgb, var(--cat-color) 23%, rgba(255,255,255,0.05));
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--cat-color) 12%, transparent), rgba(255,255,255,0.028));
          text-decoration: none;
          overflow: hidden;
          transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .category-browse-card:hover {
          transform: translateY(-2px);
          border-color: color-mix(in srgb, var(--cat-color) 45%, rgba(255,255,255,0.08));
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--cat-color) 18%, transparent), rgba(255,255,255,0.04));
        }
        .category-browse-icon {
          position: absolute;
          right: -0.28rem;
          top: 50%;
          width: 3.2rem;
          height: 3.2rem;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: color-mix(in srgb, var(--cat-color) 16%, transparent);
          color: color-mix(in srgb, var(--cat-color) 84%, #fff);
          flex-shrink: 0;
          opacity: 0.34;
          transform: translateY(-50%);
        }
        .category-browse-icon .w-5 {
          width: 1.35rem;
          height: 1.35rem;
        }
        .category-browse-meta {
          position: relative;
          z-index: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.06rem;
        }
        .category-browse-title {
          color: #f8f5ff;
          font-family: Georgia, serif;
          font-size: 0.88rem;
          line-height: 1.05;
          white-space: nowrap;
        }
        .category-browse-count {
          color: rgba(196,181,253,0.72);
          font-size: 0.68rem;
          line-height: 1.1;
          white-space: nowrap;
        }
        .symbol-card {
          position: relative;
          overflow: hidden;
          min-height: 9.25rem;
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
            linear-gradient(90deg, rgba(8,4,18,0.45), rgba(8,4,18,0.94) 34%, rgba(8,4,18,0.98) 100%),
            linear-gradient(145deg, color-mix(in srgb, var(--cat-color) 24%, transparent), transparent 46%),
            linear-gradient(180deg, rgba(255,255,255,0.05), transparent 44%);
          opacity: 0.96;
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
          margin-bottom: 0.55rem;
        }
        .symbol-card-image-layer {
          position: absolute;
          inset: 0;
          display: block;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .symbol-card-image {
          display: block;
          width: min(42%, 15rem);
          height: 100%;
          opacity: 0.58;
          background-image:
            linear-gradient(90deg, rgba(5,2,10,0), rgba(5,2,10,0.52)),
            url('/img/symbols/dream-symbol-atlas-v2.webp');
          background-size:
            100% 100%,
            calc(var(--symbol-atlas-columns, 8) * 100%) calc(var(--symbol-atlas-rows, 8) * 100%);
          background-position: center, var(--symbol-x, 0%) var(--symbol-y, 0%);
          background-repeat: no-repeat;
          transform: scale(1.08);
          transform-origin: left center;
          filter: saturate(1.06) contrast(1.03);
          transition: transform 0.28s ease, opacity 0.28s ease, filter 0.28s ease;
        }
        img.symbol-card-image {
          object-fit: cover;
          object-position: center;
          background-image: none;
        }
        .symbol-card:hover .symbol-card-image {
          opacity: 0.68;
          transform: scale(1.12);
          filter: saturate(1.14) brightness(1.05);
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
          font-size: clamp(1.12rem, 1.25vw, 1.38rem);
          line-height: 1.05;
          margin-bottom: 0.48rem;
        }
        .symbol-card-title-link {
          padding-left: clamp(5.8rem, 14vw, 9.2rem);
        }
        .symbol-card-desc {
          color: rgba(226,218,255,0.84);
          display: block;
          overflow: visible;
          min-height: 0;
          font-size: 0.86rem;
          line-height: 1.48;
          padding-left: clamp(5.8rem, 14vw, 9.2rem);
        }
        .symbol-card-question {
          margin-top: 0.78rem;
          padding-top: 0.72rem;
          padding-left: clamp(5.8rem, 14vw, 9.2rem);
          border-top: 1px solid rgba(255,255,255,0.06);
          color: rgba(196,181,253,0.82);
        }
        .symbol-card-links {
          /* Stacked on purpose: side by side, the two arrowed links read as
             one connected unit ("Voir le symbole → Guide lié…"). */
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.4rem;
          margin-top: 0.72rem;
          padding-left: clamp(5.8rem, 14vw, 9.2rem);
        }
        .symbol-card-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.3rem 0.72rem;
          border: 1px solid rgba(253,164,129,0.32);
          border-radius: 9999px;
          background: rgba(253,164,129,0.08);
          font-size: 0.76rem;
          font-weight: 600;
          color: #fda481;
          text-decoration: none;
          transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .symbol-card:hover .symbol-card-cta,
        .symbol-card-cta:hover {
          color: #ffc9b0;
          border-color: rgba(253,164,129,0.5);
          background: rgba(253,164,129,0.15);
        }
        .symbol-card-cta-icon {
          width: 0.8rem;
          height: 0.8rem;
          flex-shrink: 0;
        }
        .symbol-card-related {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          min-width: 0;
          font-size: 0.74rem;
          color: rgba(196,181,253,0.78);
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .symbol-card-related:hover {
          color: #e2daff;
          text-decoration: underline;
        }
        .symbol-card-related-icon {
          width: 0.85rem;
          height: 0.85rem;
          flex-shrink: 0;
          opacity: 0.75;
        }
        #symbolsList > section > h2 {
          margin-bottom: 1rem;
          padding-bottom: 0.72rem;
          border-bottom: 1px solid rgba(253,164,129,0.14);
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
        #symbolsList {
          display: flex;
          flex-direction: column;
        }
        #symbolsList > section {
          padding-left: 0;
          padding-right: 0;
        }
        #symbolsList > section > .grid {
          /* auto-fill (not auto-fit): keep the empty track so a lone card in a
             single-symbol section (U, V, Z…) stays at normal card width
             instead of stretching to ~175 characters per line. */
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 27rem), 1fr));
          grid-auto-flow: dense;
        }
        #searchFeedback, #noResults {
          scroll-margin-top: var(--dictionary-scroll-offset, 8rem);
        }
        .dictionary-faq-section,
        .dictionary-related-section {
          box-sizing: border-box;
          width: 100%;
          padding-left: var(--dictionary-edge);
          padding-right: var(--dictionary-edge);
        }
        .dictionary-faq-section {
          max-width: calc(48rem + (var(--dictionary-edge) * 2));
        }
        .dictionary-related-section {
          max-width: calc(56rem + (var(--dictionary-edge) * 2));
        }
        .dictionary-page .site-footer {
          position: relative;
          z-index: 2;
          background: #05020a !important;
        }
        .dictionary-page .site-footer > .grid {
          position: relative;
          z-index: 1;
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
        }
        @media (max-width: 1180px) {
          .dictionary-header {
            grid-template-columns: 1fr;
            align-items: end;
            min-height: var(--dictionary-hero-media-height);
            padding-top: 6.6rem;
          }
        }
        @media (max-width: 767px) {
          :root { --dictionary-edge: 1rem; }
          .dictionary-page .site-footer {
            padding: 2rem 1rem 1.75rem !important;
          }
          .dictionary-page .site-footer > .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1.5rem 1rem;
            margin-bottom: 2rem;
          }
          .dictionary-page .site-footer > .grid > :first-child {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 0.45rem 1rem;
            align-items: center;
            padding-bottom: 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }
          .dictionary-page .site-footer > .grid > :first-child > a {
            grid-column: 1;
            grid-row: 1;
            margin-bottom: 0;
          }
          .dictionary-page .site-footer > .grid > :first-child > p {
            grid-column: 1;
            grid-row: 2;
            margin-bottom: 0;
            max-width: 17rem;
          }
          .dictionary-page .site-footer > .grid > :first-child > div.flex {
            grid-column: 2;
            grid-row: 1 / span 2;
            gap: 0.45rem;
          }
          .dictionary-page .site-footer > .grid > :first-child > div.flex a {
            width: 2.35rem;
            height: 2.35rem;
          }
          .dictionary-page .site-footer h5 {
            margin-bottom: 0.65rem;
            font-size: 0.76rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(255, 247, 240, 0.92);
          }
          .dictionary-page .site-footer ul {
            font-size: 0.82rem;
            line-height: 1.35;
          }
          .dictionary-page .site-footer li + li {
            margin-top: 0.45rem;
          }
          .dictionary-page .site-footer > .border-t:last-child {
            padding-top: 1rem;
          }
          .dictionary-header {
            --dictionary-hero-media-height: clamp(34rem, 145vw, 48rem);
            grid-template-columns: 1fr;
            min-height: var(--dictionary-hero-media-height);
            gap: 0.85rem;
            padding: 5.1rem 1rem 0.85rem;
          }
          .dictionary-hero-copy {
            gap: 0.85rem;
          }
          .dictionary-hero-kicker,
          .dictionary-hero-intro {
            display: none;
          }
          .dictionary-header h1 {
            width: 100%;
            max-width: none;
            font-size: clamp(1.25rem, 5.6vw, 1.85rem);
            line-height: 1.04;
          }
          #heroSearchShell .hero-search {
            min-height: 3.35rem;
            font-size: 0.94rem;
          }
          #heroSearchShell .search-clear {
            width: 3.35rem;
            height: 3.35rem;
            flex-basis: 3.35rem;
          }
          .dictionary-conversion {
            grid-template-columns: 1fr;
            gap: 0.55rem;
            margin-top: 1rem;
            padding: 0.9rem;
          }
          .dictionary-conversion-kicker {
            display: inline-flex;
            margin-bottom: 0.35rem;
          }
          .dictionary-conversion-copy h2 {
            margin: 0 0 0.65rem;
            max-width: none;
            font-size: 1.65rem;
            line-height: 1.08;
          }
          .dictionary-conversion-copy > p:not(.dictionary-platform-note) {
            font-size: 0.88rem;
            line-height: 1.45;
          }
          .dictionary-conversion-actions {
            align-items: stretch;
            margin-top: 1rem;
          }
          .dictionary-store-cta,
          .dictionary-details-cta {
            width: 100%;
          }
          .dictionary-store-cta {
            min-height: 3.2rem;
            padding-inline: 1.1rem;
            font-size: 0.95rem;
          }
          .dictionary-details-cta { display: none; }
          .dictionary-platform-note {
            margin-top: 0.55rem !important;
            font-size: 0.7rem;
          }
          .dictionary-proof-list {
            grid-template-columns: 1fr;
            gap: 0.4rem;
            margin-top: 0.65rem;
          }
          .dictionary-proof-item {
            min-height: 2.75rem;
            align-items: center;
            gap: 0.6rem;
            padding: 0.6rem 0.65rem;
          }
          .dictionary-proof-icon {
            width: 2rem;
            height: 2rem;
            flex-basis: 2rem;
          }
          .dictionary-proof-item strong + span {
            display: none;
          }
          .dictionary-conversion-links {
            grid-column: 1;
            padding-top: 0.65rem;
          }
          .dictionary-conversion-links > :first-child {
            display: none;
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
          #categoryGridSection {
            width: 100%;
            margin: 0.35rem 0 0.75rem;
            padding: 0.35rem 1rem 0;
            border: 0;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
          }
          #symbolsList > section > .grid { grid-template-columns: 1fr; }
          #symbolsList {
            padding-left: 0;
            padding-right: 0;
          }
          #symbolsList > section > h2 {
            margin-left: var(--dictionary-edge);
            margin-right: var(--dictionary-edge);
          }
          .quick-browse-panel { padding: 0.75rem; }
          #categoryGridSection { padding: 0.35rem 1rem 0; }
          .quick-browse-alpha {
            display: none;
          }
          .quick-browse-copy {
            margin-bottom: 0.55rem;
          }
          .quick-browse-copy h2 {
            gap: 0.5rem;
            font-size: 1.1rem;
          }
          .quick-browse-copy p {
            display: none;
          }
          .category-browse-grid {
            gap: 0.4rem;
          }
          .quick-browse-panel::after {
            display: none;
          }
          .category-browse-card {
            min-height: 2.75rem;
            flex-direction: column;
            justify-content: center;
            gap: 0.12rem;
            padding: 0.18rem 0.12rem;
            text-align: center;
          }
          .category-browse-icon {
            position: static;
            display: inline-flex;
            width: 0.9rem;
            height: 0.9rem;
            flex: 0 0 0.9rem;
            border-radius: 0;
            background: transparent;
            opacity: 0.86;
            transform: none;
          }
          .category-browse-icon .w-5 {
            width: 0.78rem;
            height: 0.78rem;
          }
          .category-browse-count { display: none; }
          .category-browse-meta {
            width: 100%;
            align-items: center;
          }
          .category-browse-title {
            font-family: inherit;
            max-width: 100%;
            overflow: hidden;
            font-size: 0.72rem;
            line-height: 1;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
          #mobileAlpha {
            box-sizing: border-box;
            display: flex !important;
            width: calc(100% - 2rem);
            margin: 0.1rem 1rem 0.75rem;
            padding: 0.25rem;
            flex-wrap: nowrap;
            justify-content: flex-start;
            gap: 0.2rem;
            overflow-x: auto;
            overscroll-behavior-inline: contain;
            scroll-snap-type: x proximity;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          #mobileAlpha::-webkit-scrollbar { display: none; }
          .mobile-alpha-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 2.75rem;
            min-width: 2.75rem;
            min-height: 2.75rem;
            padding: 0;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.045);
            scroll-snap-align: start;
          }
          #searchFeedback:not([hidden]) { display: flex !important; }
          body.dictionary-search-active #mobileAlpha {
            display: none !important;
          }
          body.dictionary-search-active #navbar,
          body.dictionary-search-active .dictionary-shell > nav[aria-label="Breadcrumb"],
          body.dictionary-search-active .dictionary-header {
            display: none !important;
          }
          body.dictionary-search-active #stickyBar {
            display: block !important;
            opacity: 1;
            transform: translate(-50%, 0);
          }
          body.dictionary-search-active .dictionary-main {
            padding-top: calc(var(--dictionary-scroll-offset, 9rem) + 0.5rem) !important;
          }
          .symbol-card {
            display: flow-root;
            min-height: 0;
            padding: 1rem;
          }
          .symbol-card-top {
            display: none;
          }
          .symbol-card-image-layer {
            position: relative;
            inset: auto;
            float: left;
            width: min(50%, 9.5rem);
            height: auto;
            aspect-ratio: 1 / 1;
            margin: -0.2rem 0.8rem 0.3rem -0.35rem;
            overflow: visible;
            shape-outside: inset(0 5% 0 0 round 8%);
            z-index: 0;
          }
          .symbol-card-image {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            aspect-ratio: 1 / 1;
            opacity: 0.7;
            transform: scale(1.06);
            transform-origin: center;
            filter: saturate(1.08) contrast(1.02) brightness(1.14);
            -webkit-mask-image: radial-gradient(circle at 45% 45%, #000 0 42%, rgba(0,0,0,0.9) 56%, transparent 78%);
            mask-image: radial-gradient(circle at 45% 45%, #000 0 42%, rgba(0,0,0,0.9) 56%, transparent 78%);
          }
          .symbol-card:hover .symbol-card-image {
            opacity: 0.74;
            transform: scale(1.1);
            filter: saturate(1.12) contrast(1.02) brightness(1.18);
          }
          .symbol-card-title-link,
          .symbol-card-desc,
          .symbol-card-question,
          .symbol-card-links {
            padding-left: 0;
          }
          .symbol-card-title-link h3 {
            font-size: 1.28rem;
            line-height: 1.05;
            margin: 0 0 0.45rem;
          }
          .symbol-card-desc {
            font-size: 0.92rem;
            line-height: 1.48;
            display: block;
            -webkit-line-clamp: unset;
            overflow: visible;
            min-height: 0;
          }
          .symbol-card-question {
            clear: both;
            margin-top: 0.7rem;
            padding-top: 0.65rem;
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
        @media (max-width: 359px) {
          .category-browse-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
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
  const presentLetters = new Set(letters);
  const displayLetters = buildDisplayLetters(letters, lang);
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
  const alphaLinks = displayLetters.map(l =>
    renderAlphaItem(l, presentLetters, 'sidebar-alpha-link', '                            ')
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

function renderMobileAlphaHtml(letters, lang) {
  const presentLetters = new Set(letters);
  const links = buildDisplayLetters(letters, lang).map(l =>
    renderAlphaItem(l, presentLetters, 'mobile-alpha-link', '                    ')
  ).join('\n');
  return `            <!-- dict-alpha-mobile -->
                <div id="mobileAlpha" role="navigation" aria-label="A – Z">
${links}
                </div>
            <!-- /dict-alpha-mobile -->`;
}

// Full A-Z scaffold for the alphabet bars: letters with no symbols render as
// disabled placeholders so the alphabet keeps a stable, scannable shape.
// Accented extras (FR É/Ê/Î, ES Á, DE Ü…) only appear when present.
const BASE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
function buildDisplayLetters(letters, lang) {
  return [...new Set([...BASE_ALPHABET, ...letters])].sort((a, b) => a.localeCompare(b, lang));
}
function renderAlphaItem(letter, presentLetters, cls, indent, anchorExtra = '') {
  return presentLetters.has(letter)
    ? `${indent}<a href="#${letter}" class="${cls}"${anchorExtra} data-letter="${letter}">${letter}</a>`
    : `${indent}<span class="${cls} is-empty" aria-hidden="true">${letter}</span>`;
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
  const symbolPath = SYMBOL_PATHS[lang];

  const canonical = `${DOMAIN}/${lang}/guides/${t.dictionary_slug}`;
  const guidesUrl = `${DOMAIN}/${lang}/guides/`;
  const canonicalPath = `/${lang}/guides/${t.dictionary_slug}`;
  const pageImageSet = IMAGE_SEO_REGISTRY
    ? getPageImageSet(IMAGE_SEO_REGISTRY, canonicalPath)
    : null;
  const pageImages = pageImageSet
    ? getPageResponsiveImages(IMAGE_SEO_REGISTRY, canonicalPath)
    : null;
  const dictionaryCopy = DICTIONARY_IMAGE_COPY[lang] || DICTIONARY_IMAGE_COPY.en;
  const editorialPicture = pageImageSet
    ? renderResponsivePicture(IMAGE_SEO_REGISTRY, pageImageSet.images.editorial, {
        figure: false,
        priority: true,
        sizes: '100vw',
      })
    : `<picture>
                        <source type="image/webp" srcset="/img/blog/dream-symbols-dictionary-480w.webp 480w, /img/blog/dream-symbols-dictionary-800w.webp 800w, /img/blog/dream-symbols-dictionary-1200w.webp 1200w" sizes="100vw">
                        <img src="/img/blog/dream-symbols-dictionary.webp" srcset="/img/blog/dream-symbols-dictionary-480w.webp 480w, /img/blog/dream-symbols-dictionary-800w.webp 800w, /img/blog/dream-symbols-dictionary-1200w.webp 1200w" sizes="100vw" width="1200" height="675" fetchpriority="high" decoding="async" alt="${escapeHtml(dictionaryCopy.alt)}">
                    </picture>`;
  const editorialCaption = pageImages?.editorial?.caption || dictionaryCopy.caption;
  const editorialAssetAttribute = pageImages?.editorial?.assetId
    ? ` data-image-asset-id="${escapeHtml(pageImages.editorial.assetId)}"`
    : '';
  const dictionaryHeroFigure = `<figure class="dictionary-hero-image" data-image-seo-role="editorial"${editorialAssetAttribute}>
                    ${editorialPicture}
                    <figcaption>${escapeHtml(editorialCaption)}</figcaption>
                </figure>`;
  // Real-text version of the reflection guide (h2 + steps) for every
  // language. The EN educational raster below stays as an illustration and
  // for the image-SEO contract; the text itself now lives in the DOM.
  const rg = dc.reflection_guide;
  const reflectionSection = rg ? `<section class="dictionary-reflection-guide glass-panel rounded-3xl" aria-labelledby="reflectionGuideTitle">
                    <p class="reflection-kicker">${escapeHtml(rg.kicker)}</p>
                    <h2 id="reflectionGuideTitle" class="font-serif text-dream-cream">${escapeHtml(rg.title)}</h2>
                    <p class="reflection-deck">${escapeHtml(rg.deck)}</p>
                    <ol class="reflection-steps">
${(rg.steps || []).map((step, index) => `                        <li class="reflection-step">
                            <span class="reflection-step-number" aria-hidden="true">${index + 1}</span>
                            <div class="reflection-step-body">
                                <strong>${escapeHtml(step.label)}</strong>
                                <span class="reflection-step-question">${escapeHtml(step.question)}</span>
                                <span class="reflection-step-prompt">${escapeHtml(step.prompt)}</span>
                            </div>
                        </li>`).join('\n')}
                    </ol>
                    <p class="reflection-footer">${escapeHtml(rg.footer)}</p>
                </section>` : '';
  const educationalFigure = pageImageSet && pageImages?.educational
    ? `<figure class="seo-image seo-image--educational dictionary-educational-image" data-image-seo-role="educational" data-image-asset-id="${escapeHtml(pageImages.educational.assetId)}">
                    ${renderResponsivePicture(IMAGE_SEO_REGISTRY, pageImageSet.images.educational, {
                      figure: false,
                      priority: false,
                      sizes: '(max-width: 640px) calc(100vw - 2.5rem), 920px',
                      mobileSizes: '(max-width: 640px) calc(100vw - 2.5rem), 640px',
                      describedBy: `image-caption-${String(pageImages.educational.assetId).replace(/[^a-z0-9]+/gi, '-')}`,
                    })}
                    <figcaption id="image-caption-${String(pageImages.educational.assetId).replace(/[^a-z0-9]+/gi, '-')}">${escapeHtml(pageImages.educational.caption)}</figcaption>
                </figure>`
    : '';
  const ogImage = pageImages?.editorial?.src
    ? `${DOMAIN}${pageImages.editorial.src}`
    : `${DOMAIN}/img/blog/dream-symbols-dictionary.webp`;
  const ogImageWidth = pageImages?.editorial?.width || 1200;
  const ogImageHeight = pageImages?.editorial?.height || 675;
  const pageTitle = normalizePageTitle(dc.page_title);

  // ── Build current paths for language switcher ────────────────────────
  const currentPaths = Object.fromEntries(
    SUPPORTED_LANGS.map((candidate) => [candidate, `/${candidate}/guides/${i18n[candidate].dictionary_slug}`])
  );

  // ── Build symbols grouped by first letter ────────────────────────────
  const allSymbols = symbolsData.symbols || [];
  const {
    categoryCounts: counts,
    groups,
    letters,
    symbolAtlasPositions,
    symbolAtlasRows,
  } = prepareDictionarySymbols(allSymbols, lang);

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
  const extendedSymbols = readExtendedSymbols();
  const symbolsById = new Map(allSymbols.map((sym) => [sym.id, sym]));
  const symbolSectionsHtml = letters.map((letter) => {
    const syms = groups[letter];
    const cards = syms.map((sym) => {
      const s = sym[lang];
      const dataSymbol = escapeHtml(s.slug);
      const askText = s.askYourself?.[0] || '';
      // Extra search corpus (data-search): related-symbol names, variation
      // contexts and the reflection question, minus words already visible on
      // the card — lets queries like "ocean"/"nager" reach the right symbol.
      const knownWords = new Set(
        `${s.name} ${s.slug} ${s.shortDescription}`.toLowerCase().split(/[^\p{L}\p{N}]+/u)
      );
      const relatedNames = (sym.relatedSymbols || [])
        .map((id) => symbolsById.get(id)?.[lang]?.name)
        .filter(Boolean);
      const variationContexts = (extendedSymbols[sym.id]?.[lang]?.variations || [])
        .map((variation) => variation?.context)
        .filter(Boolean);
      const searchTerms = [...new Set(
        [...relatedNames, ...variationContexts, askText]
          .join(' ')
          .split(/\s+/)
          .filter((word) => word && !knownWords.has(word.toLowerCase()))
      )].join(' ');
      const catName = (t.category_names || {})[sym.category] || sym.category;
      const catColor = CATEGORY_COLORS[sym.category] || '#c084fc';
      const atlasPosition = symbolAtlasPositions.get(sym.id) || getSymbolAtlasPosition(0);
      const cardImage = resolveSymbolCardImage(
        sym.id,
        extendedSymbols[sym.id]?.[lang]?.illustration
      );
      const cardImageHtml = cardImage
        ? `<img class="symbol-card-image" src="${cardImage.src}"${cardImage.srcset ? ` srcset="${cardImage.srcset}"` : ''}${cardImage.sizes ? ` sizes="${cardImage.sizes}"` : ''} width="${cardImage.width}" height="${cardImage.height}" loading="lazy" decoding="async" alt="${escapeHtml(`${s.name} — ${SYMBOL_IMAGE_ALT_SUFFIX[lang] || SYMBOL_IMAGE_ALT_SUFFIX.en}`)}">`
        : '<span class="symbol-card-image" aria-hidden="true"></span>';
      const relatedGuidePage = sym.relatedGuide
        ? pages.find((page) => page.id === sym.relatedGuide)
        : null;
      const relatedGuideSlug = relatedGuidePage?.slugs?.[lang];
      const relatedGuideTitle = normalizePageTitle(relatedGuidePage?.[lang]?.title);
      const relatedArticle = sym.relatedArticles?.[lang];
      let relatedArticleHtml = '';
      if (relatedGuideSlug && relatedGuideTitle) {
        relatedArticleHtml = `
                                <a href="/${lang}/guides/${relatedGuideSlug}" class="symbol-card-related">
                                    <i data-lucide="book-open" class="symbol-card-related-icon" aria-hidden="true"></i>
                                    ${escapeHtml(`${uiCopy.relatedGuideLabel} ${relatedGuideTitle}`)}
                                </a>`;
      } else if (relatedArticle) {
        const relatedTitle = getBlogTitleBySlug(lang, relatedArticle.split('#')[0]);
        const relatedText = relatedTitle
          ? `${uiCopy.relatedArticleLabel} ${relatedTitle}`
          : (i18n[lang]?.read_article || 'Read article');
        relatedArticleHtml = `
                                <a href="/${lang}/blog/${relatedArticle}" class="symbol-card-related">
                                    <i data-lucide="book-open" class="symbol-card-related-icon" aria-hidden="true"></i>
                                    ${escapeHtml(relatedText)}
                                </a>`;
      }
      const cardLinksHtml = `
                            <div class="symbol-card-links">
                                <a href="/${lang}/${symbolPath}/${s.slug}" class="symbol-card-cta" tabindex="-1">
                                    ${escapeHtml(uiCopy.viewSymbolCta)}
                                    <i data-lucide="chevron-right" class="symbol-card-cta-icon" aria-hidden="true"></i>
                                </a>${relatedArticleHtml}
                            </div>`;
      return `
                        <div class="symbol-card glass-panel rounded-xl p-5 border border-transparent" data-symbol="${dataSymbol}"${searchTerms ? ` data-search="${escapeHtml(searchTerms)}"` : ''} style="--cat-color:${catColor};--symbol-x:${atlasPosition.x};--symbol-y:${atlasPosition.y};--symbol-atlas-columns:${SYMBOL_ATLAS_COLUMNS};--symbol-atlas-rows:${symbolAtlasRows}">
                            <div class="symbol-card-image-layer">
                                ${cardImageHtml}
                            </div>
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
                            ${cardLinksHtml}
                        </div>`;
    }).join('\n');
    return `                <section id="${letter}" class="mb-12">
                    <h2 class="font-serif text-2xl text-dream-salmon mb-6 flex items-center" aria-label="${escapeHtml(`${dc.section_heading} ${letter}`)}">
                        <span class="w-10 h-10 rounded-full bg-dream-salmon/10 flex items-center justify-center" aria-hidden="true">${letter}</span>
                    </h2>
                    <div class="grid md:grid-cols-2 gap-4">${cards}
                    </div>
                </section>`;
  }).join('\n\n');

  // ── Build sticky bar letter links ────────────────────────────────────
  const presentLetters = new Set(letters);
  const displayLetters = buildDisplayLetters(letters, lang);
  const stickyAlphaLinks = displayLetters.map((l) =>
    renderAlphaItem(l, presentLetters, 'letter-link text-sm', '                        ', ' style="color:rgba(196,181,253,0.75);"')
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

  const priorityLinks = Array.isArray(dc.priority_links) ? dc.priority_links : [];
  const priorityLinksHtml = priorityLinks.length ? `
            <section id="priorityLinksSection" class="quick-browse-panel dictionary-discovery-only glass-panel rounded-3xl mt-4" aria-label="${escapeHtml(dc.priority_links_heading || 'Priority symbols')}">
                <div class="quick-browse-copy">
                    <div>
                        <h2 class="font-serif text-xl md:text-2xl text-dream-cream flex items-center gap-3">
                            <i data-lucide="sparkles" class="w-5 h-5 text-dream-salmon"></i>
                            ${escapeHtml(dc.priority_links_heading || 'Priority symbols')}
                        </h2>
                    </div>
                    <p>${escapeHtml(dc.priority_links_intro || '')}</p>
                </div>
                <div class="grid md:grid-cols-3 gap-4">
${priorityLinks.map((item) => `                    <a href="${escapeHtml(item.href)}" class="glass-panel rounded-xl p-5 block hover:border-dream-salmon/30 border border-transparent transition-colors">
                        <span class="text-dream-cream font-serif text-lg block mb-2">${escapeHtml(item.label)}</span>
                        <span class="text-sm text-purple-200/70 leading-relaxed">${escapeHtml(item.desc || '')}</span>
                    </a>`).join('\n')}
                </div>
            </section>` : '';

  const productDetailsPath = getManagedPagePath('page.ai-dream-interpretation-app', lang);
  const methodologyPath = getManagedPagePath('page.dream-content-methodology', lang);
  const privacyPath = getManagedPagePath('legal.privacy', lang);
  const conversionProofsHtml = (uiCopy.proofItems || []).map((item) => `
                    <li class="dictionary-proof-item">
                        <span class="dictionary-proof-icon" aria-hidden="true"><i data-lucide="${escapeHtml(item.icon)}" class="w-5 h-5"></i></span>
                        <span><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></span>
                    </li>`).join('');
  const conversionPanelHtml = `
            <section id="dictionaryConversion" class="dictionary-conversion dictionary-discovery-only" aria-labelledby="dictionaryConversionTitle">
                <div class="dictionary-conversion-copy">
                    <span class="dictionary-conversion-kicker">Noctalia · Android</span>
                    <h2 id="dictionaryConversionTitle">${escapeHtml(dc.cta_title || dc.analyze_heading)}</h2>
                    <p>${escapeHtml(dc.cta_subtitle || dc.analyze_text)}</p>
                    <div class="dictionary-conversion-actions">
                        <a href="${getAndroidStoreUrl(lang)}" class="dictionary-store-cta" rel="nofollow noopener noreferrer" target="_blank">
                            ${escapeHtml(uiCopy.storeCta)} <i data-lucide="external-link" class="w-4 h-4"></i>
                        </a>
                        <a href="${escapeHtml(productDetailsPath)}" class="dictionary-details-cta">
                            ${escapeHtml(uiCopy.detailsCta)} <i data-lucide="arrow-right" class="w-4 h-4"></i>
                        </a>
                    </div>
                    <p class="dictionary-platform-note">${escapeHtml(uiCopy.platformNote)}</p>
                </div>
                <ul class="dictionary-proof-list">
${conversionProofsHtml}
                </ul>
                <div class="dictionary-conversion-links">
                    <a href="${escapeHtml(methodologyPath)}">${escapeHtml(uiCopy.methodologyLink)}</a>
                    <a href="${escapeHtml(privacyPath)}">${escapeHtml(uiCopy.privacyLink)}</a>
                </div>
            </section>`;

  // ── Build JSON-LD ────────────────────────────────────────────────────
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    headline: pageTitle,
    description: dc.meta_description,
    url: canonical,
    image: {
      '@type': 'ImageObject',
      url: ogImage,
      width: ogImageWidth,
      height: ogImageHeight,
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: ogImage,
      width: ogImageWidth,
      height: ogImageHeight,
    },
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
      { '@type': 'ListItem', position: 1, name: t.home, item: homeUrl(lang) },
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
${renderAhrefsAnalyticsScript()}
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(dc.og_title)}">
    <meta property="og:description" content="${escapeHtml(dc.og_description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:site_name" content="Noctalia">
    <meta property="og:image:width" content="${ogImageWidth}">
    <meta property="og:image:height" content="${ogImageHeight}">
    <meta property="og:image:alt" content="${escapeHtml(dictionaryCopy.alt)}">
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
    <meta name="twitter:image:alt" content="${escapeHtml(dictionaryCopy.alt)}">
    <!-- Preload critical fonts -->
    <link rel="preload" href="/fonts/Outfit-Regular.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Outfit-Bold.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Fraunces-Variable.woff2" as="font" type="font/woff2" crossorigin>
    <!-- Compiled Tailwind CSS -->
    <link rel="stylesheet" href="/css/styles.min.css?v=${version}">
    <link rel="stylesheet" href="/css/language-dropdown.css?v=${version}">
${renderViewTransitionHeadStyles()}

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
        .mobile-menu-surface {
            background: #120720 !important;
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
        }
        .noctalia-premium-nav { background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; }
        .noctalia-premium-nav.py-2 { background: rgba(10, 5, 20, 0.78); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24); }
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
        .letter-link.is-empty,
        .sidebar-alpha-link.is-empty,
        .mobile-alpha-link.is-empty {
          opacity: 0.32;
          pointer-events: none;
          cursor: default;
        }
        #stickyBar {
            position: fixed;
            top: var(--sticky-bar-top, 5.5rem);
            left: 50%;
            transform: translate(-50%, -0.35rem);
            z-index: 45;
            width: min(calc(100vw - 2rem), 72rem);
            display: none;
            opacity: 0;
            pointer-events: none;
            padding: 0.62rem 0.72rem !important;
            border-radius: 1.2rem !important;
            border-color: rgba(255,255,255,0.12) !important;
            background: rgba(16, 9, 31, 0.94) !important;
            box-shadow: 0 1.2rem 3rem rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08);
            -webkit-backdrop-filter: blur(18px);
            backdrop-filter: blur(18px);
            transition: opacity 0.2s ease, transform 0.2s ease;
        }
        #stickyBar.sb-visible { display: block; opacity: 1; pointer-events: none; transform: translate(-50%, 0); }
        #stickyBar .sb-inner {
            display: flex; flex-wrap: nowrap; gap: 8px; align-items: center;
        }
        #stickyBar input,
        #stickyBar button,
        #stickyBar a {
            pointer-events: auto;
            touch-action: manipulation;
        }
        #stickyBar .sb-search { position: relative; flex-shrink: 0; width: min(17rem, 34vw); }
        #stickyBar .sb-alpha { display: flex; flex-wrap: nowrap; gap: 3px; justify-content: flex-start; align-items: center; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
        #stickyBar .sb-alpha::-webkit-scrollbar { display: none; }
        #stickyBar .letter-link {
          min-width: 1.7rem;
          min-height: 1.7rem;
          border-radius: 0.55rem;
          font-size: 0.78rem;
        }
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
        #backToTop {
          min-width: 2.75rem;
          min-height: 2.75rem;
          align-items: center;
          justify-content: center;
        }
        body.mobile-menu-lock { overflow: hidden; touch-action: none; }
        /* Hero search */
        .hero-search:focus { outline: none; border-color: #FDA481; }
        .hero-search:focus-visible,
        .search-input:focus-visible,
        .mobile-alpha-link:focus-visible,
        .letter-link:focus-visible,
        .category-browse-card:focus-visible,
        .dictionary-store-cta:focus-visible,
        .dictionary-details-cta:focus-visible,
        #backToTop:focus-visible {
            outline: 2px solid #FDA481;
            outline-offset: 2px;
        }
        @media (max-width: 767px) {
            #stickyBar {
                width: calc(100vw - 1rem);
                top: var(--sticky-bar-top, 4.8rem);
                padding: 0.5rem !important;
                border-radius: 1rem !important;
            }
            #stickyBar .sb-inner {
                flex-wrap: wrap;
                gap: 0.45rem;
            }
            #stickyBar .sb-search {
                width: auto;
                min-width: 0;
                flex: 1 1 12rem;
            }
            #stickyBar .search-input {
                min-height: 2.75rem;
            }
            #stickyBar .search-clear {
                right: 0;
                width: 2.75rem;
                height: 2.75rem;
            }
            #stickyBar .sb-alpha {
                display: flex;
                order: 4;
                flex: 1 0 100%;
                flex-wrap: nowrap;
                justify-content: flex-start;
                overflow-x: auto;
                padding: 0.25rem 0 0.15rem;
                scrollbar-width: none;
            }
            #stickyBar .letter-link {
                min-width: 2.75rem;
                min-height: 2.75rem;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 2.75rem;
            }
            #stickyBar .sb-alpha::-webkit-scrollbar {
                display: none;
            }
            .sticky-status {
                display: none !important;
            }
            #mobileMenuButton,
            #navMobileGuideLink {
                min-width: 2.75rem;
                min-height: 2.75rem;
                align-items: center;
                justify-content: center;
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
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="${homePath(lang)}" itemprop="item" class="hover:text-dream-salmon transition-colors"><span itemprop="name">${escapeHtml(t.home)}</span></a><meta itemprop="position" content="1"></li>
                    <li class="text-purple-400">/</li>
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/${lang}/guides/" itemprop="item" class="hover:text-dream-salmon transition-colors"><span itemprop="name">${escapeHtml(copy.label)}</span></a><meta itemprop="position" content="2"></li>
                    <li class="text-purple-400">/</li>
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a href="/${lang}/guides/${t.dictionary_slug}" itemprop="item" class="text-dream-cream"><span itemprop="name">${escapeHtml(pageTitle)}</span></a><meta itemprop="position" content="3"></li>
                </ol>
            </nav>

            <!-- Header -->
            <header class="dictionary-header" data-image-seo-hero="true">
                <div class="dictionary-hero-copy">
                    <span class="dictionary-hero-kicker">${escapeHtml(heroCopy.atlas)}</span>
                    <h1 class="font-serif text-3xl md:text-5xl lg:text-[3.4rem] mb-0 text-transparent bg-clip-text bg-gradient-to-b from-white via-dream-lavender to-purple-400/55 leading-tight max-w-4xl">
                        ${escapeHtml(dc.h1_text)}
                    </h1>
                    <p class="dictionary-hero-intro">${escapeHtml(dc.intro_paragraph || heroCopy.guide)}</p>

                    <!-- Hero search -->
                    <div id="heroSearchShell" class="relative w-full">
                        <div class="dictionary-hero-search-input">
                            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/50 pointer-events-none"></i>
                            <input type="text" id="heroSearch" placeholder="${escapeHtml(dc.hero_search_placeholder)}"
                                aria-label="${escapeHtml(dc.hero_search_placeholder)}"
                                class="hero-search w-full bg-white/8 border border-white/15 rounded-full py-4 pl-12 pr-14 text-base text-dream-cream placeholder:text-purple-200/55 transition-colors">
                        </div>
                        <button type="button" id="heroSearchClear" class="search-clear" aria-label="${escapeHtml(uiCopy.clearSearch)}" title="${escapeHtml(uiCopy.clearSearch)}" onclick="document.getElementById('heroSearch').value='';document.getElementById('heroSearch').dispatchEvent(new Event('input',{bubbles:true}));" hidden>
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
${dictionaryHeroFigure}
            </header>

            <!-- dict-no-results -->
            <div id="noResults" style="display:none" class="text-center py-16 text-purple-200/60">
                <i data-lucide="search-x" class="w-12 h-12 mx-auto mb-4 opacity-40"></i>
                <p class="text-lg">${escapeHtml(dc.no_results_text)} &laquo;<span id="noResultsQuery"></span>&raquo;</p>
            </div>
            <!-- /dict-no-results -->

${renderMobilePillsHtml(lang, t, counts)}

${renderMobileAlphaHtml(letters, lang)}

<!-- Sticky Search + Alphabet bar (above categories) -->
            <div id="stickyBar" class="glass-panel rounded-2xl p-4 mb-8">
                <div class="sb-inner">
                    <!-- Compact search -->
                    <div class="sb-search">
                        <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/50 pointer-events-none"></i>
                        <input type="text" id="stickySearch" placeholder="${escapeHtml(dc.sticky_search_placeholder)}"
                            aria-label="${escapeHtml(dc.sticky_search_placeholder)}"
                            class="search-input w-full rounded-full py-2 pl-12 pr-14 text-sm text-dream-cream transition-colors"
                            style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);outline:none;">
                        <button type="button" id="stickySearchClear" class="search-clear" aria-label="${escapeHtml(uiCopy.clearSearch)}" title="${escapeHtml(uiCopy.clearSearch)}" onclick="document.getElementById('stickySearch').value='';document.getElementById('stickySearch').dispatchEvent(new Event('input',{bubbles:true}));" hidden>
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div id="stickySearchStatus" class="sticky-status" hidden>
                        <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                        <span id="stickySearchStatusText" role="status" aria-live="polite" aria-atomic="true"></span>
                    </div>
                    <!-- Alphabet -->
                    <div id="stickyAlphabet" class="sb-alpha letter-nav">
${stickyAlphaLinks}
                    </div>
                    <!-- Back to top -->
                    <button id="backToTop" class="glass-button rounded-full text-purple-300/70 hover:text-white transition-colors" aria-label="${escapeHtml(uiCopy.backToTop)}" title="${escapeHtml(uiCopy.backToTop)}" style="display:none;flex-shrink:0;padding:6px;">
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
${priorityLinksHtml}
${conversionPanelHtml}

            <div id="searchFeedback" class="search-feedback" hidden>
                <div class="search-feedback-copy">
                    <span class="search-feedback-label">${escapeHtml(uiCopy.activeSearchLabel)}</span>
                    <span id="searchFeedbackText" class="search-feedback-text" role="status" aria-live="polite" aria-atomic="true"></span>
                </div>
                <button type="button" id="searchFeedbackClear" class="search-feedback-clear" onclick="document.getElementById('heroSearch').value='';document.getElementById('heroSearch').dispatchEvent(new Event('input',{bubbles:true}));">${escapeHtml(uiCopy.clearSearch)}</button>
            </div>

            <!-- Symbols Dictionary -->
            <div id="dictionary-grid" class="dictionary-discovery-only">
${reflectionSection}
${educationalFigure}
            </div>
            <div id="symbolsList">
${symbolSectionsHtml}

            </div>
<!-- dict-layout-close -->
                </div><!-- /mainContentArea -->
            </div><!-- /dictionaryLayout -->
            <!-- /dict-layout-close -->

            <!-- FAQ Section (before CTA to address objections first) -->
            <section class="dictionary-faq-section mt-16 mx-auto">
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
                <div class="dictionary-conversion-actions justify-center">
                    <a href="${getAndroidStoreUrl(lang)}" class="dictionary-store-cta" rel="nofollow noopener noreferrer" target="_blank">
                        ${escapeHtml(uiCopy.storeCta)} <i data-lucide="external-link" class="w-4 h-4"></i>
                    </a>
                    <a href="${escapeHtml(productDetailsPath)}" class="dictionary-details-cta">
                        ${escapeHtml(uiCopy.detailsCta)} <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </a>
                </div>
                <p class="dictionary-platform-note">${escapeHtml(uiCopy.platformNote)}</p>
            </aside>

            <!-- Related Articles -->
            <section class="dictionary-related-section mt-16 mx-auto">
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
            const navbar = document.getElementById('navbar');
            const stickyBar = document.getElementById('stickyBar');
            const symbolCards = document.querySelectorAll('.symbol-card');
            const listSections = document.querySelectorAll('#symbolsList > section');
            let navbarTransitionFrame = 0;

            function updateSectionScrollOffset() {
                if (!stickyBar) return;
                const navbarBottom = navbar && getComputedStyle(navbar).display !== 'none'
                    ? navbar.getBoundingClientRect().bottom
                    : 0;
                const stickyTop = Math.ceil(Math.max(0, navbarBottom) + 12);
                stickyBar.style.setProperty('--sticky-bar-top', \`\${stickyTop}px\`);
                const stickyHeight = stickyBar.classList.contains('sb-visible') ? stickyBar.getBoundingClientRect().height : 0;
                const offset = Math.ceil(stickyTop + stickyHeight + 16);
                document.documentElement.style.setProperty('--dictionary-scroll-offset', \`\${offset}px\`);
            }

            updateSectionScrollOffset();
            window.addEventListener('resize', updateSectionScrollOffset);
            if (navbar) {
                const trackNavbarTransition = () => {
                    updateSectionScrollOffset();
                    navbarTransitionFrame = window.requestAnimationFrame(trackNavbarTransition);
                };
                const stopNavbarTransitionTracking = (event) => {
                    if (event.propertyName !== 'transform') return;
                    if (navbarTransitionFrame) window.cancelAnimationFrame(navbarTransitionFrame);
                    navbarTransitionFrame = 0;
                    updateSectionScrollOffset();
                };
                navbar.addEventListener('transitionrun', (event) => {
                    if (event.propertyName !== 'transform' || navbarTransitionFrame) return;
                    trackNavbarTransition();
                });
                navbar.addEventListener('transitionend', stopNavbarTransitionTracking);
                navbar.addEventListener('transitioncancel', stopNavbarTransitionTracking);
            }

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
            ${normalizeDictionarySearchText.toString()}
            ${scoreDictionarySearchMatch.toString()}

            function filterSymbols(query) {
                const noResults = document.getElementById('noResults');
                const noResultsQuery = document.getElementById('noResultsQuery');
                const q = normalizeDictionarySearchText(query);
                let visibleCount = 0;
                if (q === '') {
                    symbolCards.forEach(card => {
                        card.style.display = '';
                        card.style.order = '';
                        delete card.dataset.searchScore;
                    });
                    listSections.forEach(section => {
                        section.style.display = '';
                        section.style.order = '';
                    });
                    if (noResults) noResults.style.display = 'none';
                    visibleCount = symbolCards.length;
                } else {
                    listSections.forEach((section, sectionIndex) => {
                        const cards = section.querySelectorAll('.symbol-card');
                        let hasVisible = false;
                        let bestSectionScore = Number.POSITIVE_INFINITY;
                        cards.forEach((card, cardIndex) => {
                            const symbolData = card.dataset.symbol || '';
                            const title = card.querySelector('h3')?.textContent || '';
                            const content = (card.querySelector('p')?.textContent || '') + ' ' + (card.dataset.search || '');
                            const score = scoreDictionarySearchMatch({
                                query: q,
                                title,
                                slug: symbolData,
                                content,
                            });
                            const visible = Number.isFinite(score);
                            card.style.display = visible ? '' : 'none';
                            card.style.order = visible ? String((score * 1000) + cardIndex) : '';
                            if (visible) {
                                card.dataset.searchScore = String(score);
                                hasVisible = true;
                                visibleCount += 1;
                                bestSectionScore = Math.min(bestSectionScore, score);
                            } else {
                                delete card.dataset.searchScore;
                            }
                        });
                        section.style.display = hasVisible ? '' : 'none';
                        section.style.order = hasVisible
                            ? String((bestSectionScore * 1000) + sectionIndex)
                            : '';
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
            const discoveryOnlySections = document.querySelectorAll('.dictionary-discovery-only');
            const symbolsListEl = document.getElementById('symbolsList');
            let revealSearchAreaTimer = null;
            let letterNavigationTimer = null;
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
                const feedbackVisible = searchFeedback && !searchFeedback.hidden;
                const target = feedbackVisible ? searchFeedback : (visibleCount > 0 ? firstVisibleCard || symbolsListEl : document.getElementById('noResults'));
                if (!target) return;
                const rect = target.getBoundingClientRect();
                const visibleHeight = window.visualViewport?.height || window.innerHeight;
                const threshold = Math.min(window.innerHeight, visibleHeight) * 0.44;
                if (rect.top > threshold || rect.top < 0) {
                    const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dictionary-scroll-offset')) || 0;
                    const keyboardLift = window.visualViewport ? Math.max(0, window.innerHeight - window.visualViewport.height) : 0;
                    const nextTop = target.getBoundingClientRect().top + window.scrollY - offset - Math.min(keyboardLift, 220);
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
                discoveryOnlySections.forEach((section) => {
                    section.hidden = hasQuery;
                });
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
                const moveFocusToSticky = hasValue
                    && isMobile
                    && source === 'hero'
                    && document.activeElement === heroSearch;
                if (heroSearchClear) heroSearchClear.hidden = !hasValue;
                if (stickySearchClear) stickySearchClear.hidden = !hasValue;
                const visibleCount = filterSymbols(nextValue);
                updateSearchUi(nextValue, visibleCount);
                if (hasValue && isMobile) {
                    stickyBar?.classList.add('sb-visible');
                    updateSectionScrollOffset();
                    if (moveFocusToSticky) {
                        stickySearch.focus({ preventScroll: true });
                        stickySearch.setSelectionRange(nextValue.length, nextValue.length);
                    }
                } else if (!hasValue && isMobile) {
                    syncStickyBarVisibility();
                }
                scheduleRevealSearchArea(nextValue, visibleCount);
                if (source === 'sticky' && hasValue) {
                    stickySearch.focus({ preventScroll: true });
                }
            }

            function syncStickyBarVisibility() {
                if (!heroHeader || !stickyBar) return;
                if (document.body.classList.contains('dictionary-search-active')
                    || document.body.classList.contains('dictionary-letter-navigation')) {
                    stickyBar.classList.add('sb-visible');
                    updateSectionScrollOffset();
                    return;
                }
                const heroBottom = heroHeader.getBoundingClientRect().bottom;
                const navbarHeight = navbar?.getBoundingClientRect().height || 0;
                const symbolsTop = symbolsListEl?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
                const symbolsBottom = symbolsListEl?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY;
                const revealBoundary = window.matchMedia('(max-width: 767px)').matches ? symbolsTop : heroBottom;
                const shouldShow = revealBoundary <= navbarHeight + 24 && symbolsBottom > navbarHeight + 80;
                stickyBar.classList.toggle('sb-visible', shouldShow);
                updateSectionScrollOffset();
            }

            syncStickyBarVisibility();
            window.addEventListener('scroll', syncStickyBarVisibility, { passive: true });
            window.addEventListener('resize', syncStickyBarVisibility);

            heroSearch.addEventListener('input', (e) => {
                setSearchValue(e.target.value, 'hero');
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
                if (stickyBar?.classList.contains('sb-visible')) {
                    stickySearch.focus({ preventScroll: true });
                } else {
                    heroSearch.focus({ preventScroll: true });
                }
            });
            searchFeedbackClear?.addEventListener('click', () => {
                setSearchValue('', 'hero');
                heroSearch.focus({ preventScroll: true });
            });
            setSearchValue(heroSearch.value || '');

            // ── Smooth scroll for letter navigation ───────────────────────
            document.querySelectorAll('.letter-link[href], .sidebar-alpha-link[href], .mobile-alpha-link[href]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const wasSearchActive = document.body.classList.contains('dictionary-search-active');
                    if (wasSearchActive) {
                        setSearchValue('', 'sticky');
                    }
                    const target = document.querySelector(link.getAttribute('href'));
                    const scrollToTarget = () => {
                        if (!target) return;
                        document.body.classList.add('dictionary-letter-navigation');
                        stickyBar?.classList.add('sb-visible');
                        updateSectionScrollOffset();
                        setActiveAlpha(link.dataset.letter);
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        if (letterNavigationTimer) window.clearTimeout(letterNavigationTimer);
                        letterNavigationTimer = window.setTimeout(() => {
                            document.body.classList.remove('dictionary-letter-navigation');
                            syncStickyBarVisibility();
                            letterNavigationTimer = null;
                        }, 1200);
                    };
                    if (wasSearchActive) {
                        window.requestAnimationFrame(() => window.requestAnimationFrame(scrollToTarget));
                    } else {
                        scrollToTarget();
                    }
                });
            });

            // ── Active letter tracking (IntersectionObserver) ─────────────
            function setActiveAlpha(letter) {
                document.querySelectorAll('.letter-link, .sidebar-alpha-link, .mobile-alpha-link').forEach(l => {
                    const isActive = l.dataset.letter === letter;
                    l.classList.toggle('alpha-active', isActive);
                    if (isActive) {
                        l.setAttribute('aria-current', 'true');
                    } else {
                        l.removeAttribute('aria-current');
                    }
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
    <script src="/js/site-shell.js?v=${version}" defer></script>
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
    const hubResult = materializeGeneratedPage({
      filePath: hubPath,
      renderedHtml: generateHubPage(lang, i18n[lang], pages, version),
      finalizeHtml: finalizeGeneratedHtml,
      dryRun: DRY_RUN,
    });
    if (hubResult.changed) {
      hubs += 1;
      console.log(`${DRY_RUN ? 'Would generate' : 'Generated'} docs/${lang}/guides/index.html`);
    }
    const dictPath = path.join(DOCS_DIR, lang, 'guides', `${i18n[lang].dictionary_slug}.html`);
    const dictionaryResult = materializeGeneratedPage({
      filePath: dictPath,
      renderedHtml: generateDictionaryPage(lang, i18n[lang]),
      finalizeHtml: finalizeGeneratedHtml,
      dryRun: DRY_RUN,
    });
    if (dictionaryResult.changed) {
      dictionaries += 1;
      console.log(`${DRY_RUN ? 'Would generate' : 'Generated'} docs/${lang}/guides/${i18n[lang].dictionary_slug}.html`);
    }
  }
  console.log(`[build-guides-pages] mode=${DRY_RUN ? 'dry-run' : 'write'} hubPages=${hubs} dictionaryPages=${dictionaries}`);
}

if (require.main === module) main();
