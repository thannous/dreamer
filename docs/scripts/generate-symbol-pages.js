#!/usr/bin/env node
/**
 * Dream Symbol Pages Generator
 *
 * Generates individual HTML pages for each dream symbol in each language
 * using the data from dream-symbols.json and symbol-i18n.json
 *
 * Usage:
 *   node scripts/generate-symbol-pages.js
 *   node scripts/generate-symbol-pages.js --priority=1  # Only priority 1 symbols
 *   node scripts/generate-symbol-pages.js --lang=en     # Only English
 *   node scripts/generate-symbol-pages.js --dry-run     # Preview without writing
 */

const fs = require('fs');
const path = require('path');

function readDocsAssetVersionOrExit() {
  const versionPath = path.join(__dirname, '..', 'version.txt');
  if (!fs.existsSync(versionPath)) {
    console.error('Missing `docs/version.txt` (needed for cache-busting).');
    process.exit(1);
  }

  const version = fs.readFileSync(versionPath, 'utf8').trim();
  if (!version) {
    console.error('Empty `docs/version.txt` (needed for cache-busting).');
    process.exit(1);
  }

  return version;
}

// Configuration
const CONFIG = {
  dataDir: path.join(__dirname, '..', 'data'),
  outputDir: path.join(__dirname, '..'),
  symbolsFile: 'dream-symbols.json',
  i18nFile: 'symbol-i18n.json',
  extendedFile: 'dream-symbols-extended.json',
  languages: ['en', 'fr', 'es'],
  symbolsPath: {
    en: 'symbols',
    fr: 'symboles',
    es: 'simbolos'
  },
  datePublished: '2025-01-21',
  dateModified: '2025-01-21',
  cssVersion: readDocsAssetVersionOrExit()
};

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

// Load data files
function loadData() {
  const symbolsPath = path.join(CONFIG.dataDir, CONFIG.symbolsFile);
  const i18nPath = path.join(CONFIG.dataDir, CONFIG.i18nFile);
  const extendedPath = path.join(CONFIG.dataDir, CONFIG.extendedFile);

  const symbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
  const i18n = JSON.parse(fs.readFileSync(i18nPath, 'utf8'));

  // Load extended data if available
  let extended = { symbols: {} };
  if (fs.existsSync(extendedPath)) {
    extended = JSON.parse(fs.readFileSync(extendedPath, 'utf8'));
  }

  return { symbols, i18n, extended };
}

// Get category name for a symbol
function getCategoryName(symbol, i18n, lang) {
  const categories = {
    nature: { en: 'Nature', fr: 'Nature', es: 'Naturaleza' },
    animals: { en: 'Animals', fr: 'Animaux', es: 'Animales' },
    body: { en: 'Body', fr: 'Corps', es: 'Cuerpo' },
    places: { en: 'Places', fr: 'Lieux', es: 'Lugares' },
    objects: { en: 'Objects', fr: 'Objets', es: 'Objetos' },
    actions: { en: 'Actions', fr: 'Actions', es: 'Acciones' },
    people: { en: 'People', fr: 'Personnes', es: 'Personas' },
    celestial: { en: 'Celestial', fr: 'Céleste', es: 'Celestial' }
  };
  return categories[symbol.category]?.[lang] || symbol.category;
}

// Generate meta title
function generateMetaTitle(symbol, i18n, lang) {
  const template = i18n[lang].meta_title_template;
  const name = symbol[lang].name;
  return template.replace(/{symbol}/g, name);
}

// Generate meta description
function generateMetaDescription(symbol, i18n, lang) {
  const template = i18n[lang].meta_description_template;
  const name = symbol[lang].name;
  const shortDesc = symbol[lang].shortDescription;
  return template
    .replace(/{symbol}/g, name)
    .replace(/{short_description}/g, shortDesc);
}

// Generate hreflang URLs
function generateHreflangUrls(symbol) {
  return {
    en: `https://noctalia.app/en/${CONFIG.symbolsPath.en}/${symbol.en.slug}`,
    fr: `https://noctalia.app/fr/${CONFIG.symbolsPath.fr}/${symbol.fr.slug}`,
    es: `https://noctalia.app/es/${CONFIG.symbolsPath.es}/${symbol.es.slug}`
  };
}

// Get related symbols data
function getRelatedSymbols(symbol, allSymbols, lang) {
  if (!symbol.relatedSymbols || symbol.relatedSymbols.length === 0) {
    return [];
  }

  return symbol.relatedSymbols
    .map(relId => {
      const relSymbol = allSymbols.find(s => s.id === relId);
      if (!relSymbol || !relSymbol[lang]) return null;
      return {
        slug: relSymbol[lang].slug,
        name: relSymbol[lang].name
      };
    })
    .filter(Boolean)
    .slice(0, 6); // Max 6 related symbols
}

// Get extended content for a symbol
function getExtendedContent(symbolId, extended, lang) {
  const extSymbol = extended.symbols?.[symbolId]?.[lang];
  if (!extSymbol) {
    return {
      fullInterpretation: null,
      variations: []
    };
  }
  return {
    fullInterpretation: extSymbol.fullInterpretation || null,
    variations: extSymbol.variations || []
  };
}

// Generate default interpretation from short description
function generateDefaultInterpretation(shortDescription, symbolName, lang) {
  const templates = {
    en: `<p>${shortDescription}</p>
<p>When ${symbolName.toLowerCase()} appears in your dreams, it often reflects important aspects of your inner life and current circumstances. The specific context and emotions you experience in the dream provide valuable clues to its personal meaning for you.</p>
<p>Consider what ${symbolName.toLowerCase()} means to you personally. Your individual associations and life experiences shape the symbol's significance in your dreams. Cultural background, personal memories, and current life situations all influence how this symbol manifests in your unconscious mind.</p>
<p>Pay attention to the feelings that accompany this dream symbol. Are you feeling peaceful, anxious, curious, or fearful? These emotional responses often point to areas of your waking life that need attention or reflection.</p>`,
    fr: `<p>${shortDescription}</p>
<p>Lorsque ${symbolName.toLowerCase()} apparaît dans vos rêves, cela reflète souvent des aspects importants de votre vie intérieure et de vos circonstances actuelles. Le contexte spécifique et les émotions que vous ressentez dans le rêve fournissent des indices précieux sur sa signification personnelle.</p>
<p>Réfléchissez à ce que ${symbolName.toLowerCase()} signifie pour vous personnellement. Vos associations individuelles et vos expériences de vie façonnent la signification du symbole dans vos rêves. L'origine culturelle, les souvenirs personnels et les situations de vie actuelles influencent tous la façon dont ce symbole se manifeste dans votre inconscient.</p>
<p>Faites attention aux sentiments qui accompagnent ce symbole de rêve. Vous sentez-vous paisible, anxieux, curieux ou craintif ? Ces réponses émotionnelles pointent souvent vers des domaines de votre vie éveillée qui nécessitent attention ou réflexion.</p>`,
    es: `<p>${shortDescription}</p>
<p>Cuando ${symbolName.toLowerCase()} aparece en tus sueños, a menudo refleja aspectos importantes de tu vida interior y circunstancias actuales. El contexto específico y las emociones que experimentas en el sueño proporcionan pistas valiosas sobre su significado personal para ti.</p>
<p>Considera qué significa ${symbolName.toLowerCase()} para ti personalmente. Tus asociaciones individuales y experiencias de vida dan forma al significado del símbolo en tus sueños. El trasfondo cultural, los recuerdos personales y las situaciones de vida actuales influyen en cómo este símbolo se manifiesta en tu mente inconsciente.</p>
<p>Presta atención a los sentimientos que acompañan este símbolo onírico. ¿Te sientes tranquilo, ansioso, curioso o temeroso? Estas respuestas emocionales a menudo señalan áreas de tu vida despierta que necesitan atención o reflexión.</p>`
  };
  return templates[lang];
}

// Generate default variations
function generateDefaultVariations(symbolName, lang) {
  const templates = {
    en: [
      { context: `Positive ${symbolName}`, meaning: `Often represents favorable outcomes, growth, or positive aspects of your current situation.` },
      { context: `Negative or threatening ${symbolName}`, meaning: `May indicate fears, challenges, or unresolved issues that need your attention.` },
      { context: `Recurring ${symbolName}`, meaning: `Suggests a persistent theme or message from your subconscious that deserves deeper exploration.` }
    ],
    fr: [
      { context: `${symbolName} positif`, meaning: `Représente souvent des résultats favorables, la croissance ou des aspects positifs de votre situation actuelle.` },
      { context: `${symbolName} négatif ou menaçant`, meaning: `Peut indiquer des peurs, des défis ou des problèmes non résolus qui nécessitent votre attention.` },
      { context: `${symbolName} récurrent`, meaning: `Suggère un thème persistant ou un message de votre subconscient qui mérite une exploration plus profonde.` }
    ],
    es: [
      { context: `${symbolName} positivo`, meaning: `A menudo representa resultados favorables, crecimiento o aspectos positivos de tu situación actual.` },
      { context: `${symbolName} negativo o amenazante`, meaning: `Puede indicar miedos, desafíos o problemas no resueltos que necesitan tu atención.` },
      { context: `${symbolName} recurrente`, meaning: `Sugiere un tema persistente o mensaje de tu subconsciente que merece una exploración más profunda.` }
    ]
  };
  return templates[lang];
}

// Escape HTML entities
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeJsonStringifyForHtml(data, space = 4) {
  return JSON.stringify(data, null, space).replace(/</g, '\\u003c');
}

function indentLines(text, indent) {
  const prefix = ' '.repeat(indent);
  return text.split('\n').map(line => prefix + line).join('\n');
}

function renderJsonLd(data, indent = 4) {
  return indentLines(
    `<script type="application/ld+json">\n${safeJsonStringifyForHtml(data)}\n</script>`,
    indent
  );
}

// Generate HTML page for a symbol
function generatePage(symbol, allSymbols, i18n, extended, lang) {
  const t = i18n[lang];
  const symbolData = symbol[lang];
  const hreflang = generateHreflangUrls(symbol);
  const metaTitle = generateMetaTitle(symbol, i18n, lang);
  const metaDescription = generateMetaDescription(symbol, i18n, lang);
  const categoryName = getCategoryName(symbol, i18n, lang);
  const relatedSymbols = getRelatedSymbols(symbol, allSymbols, lang);
  const extendedContent = getExtendedContent(symbol.id, extended, lang);

  // Use extended content or generate defaults
  const fullInterpretation = extendedContent.fullInterpretation ||
    generateDefaultInterpretation(symbolData.shortDescription, symbolData.name, lang);
  const variations = extendedContent.variations.length > 0 ?
    extendedContent.variations :
    generateDefaultVariations(symbolData.name, lang);

  // Generate variations HTML
  const variationsHtml = variations.map(v => `
                    <div class="variation-card glass-panel rounded-xl p-5 border border-transparent">
                        <h3 class="font-medium text-dream-cream mb-2">${escapeHtml(v.context)}</h3>
                        <p class="text-sm text-gray-300">${escapeHtml(v.meaning)}</p>
                    </div>`).join('\n');

  // Generate ask yourself HTML
  const askYourselfHtml = symbolData.askYourself.map(q => `
                    <li class="flex items-start gap-3 text-purple-200/80">
                        <i data-lucide="chevron-right" class="w-5 h-5 text-dream-salmon flex-shrink-0 mt-0.5"></i>
                        <span>${escapeHtml(q)}</span>
                    </li>`).join('\n');

  // Generate related symbols HTML
  const relatedSymbolsHtml = relatedSymbols.map(rs => `
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${rs.slug}" class="symbol-link glass-panel rounded-xl p-4 text-center border border-transparent hover:border-dream-salmon/30 transition-all">
                        <span class="font-serif text-dream-cream">${escapeHtml(rs.name)}</span>
                    </a>`).join('\n');

  // Check for related article
  const relatedArticle = symbol.relatedArticles?.[lang];
  const hasRelatedArticle = !!relatedArticle;

  // Generate related article section
  const relatedArticleHtml = hasRelatedArticle ? `
            <!-- Related Article -->
            <section class="mb-10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="book-open" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_learn_more}
                </h2>
                <a href="/${lang}/blog/${relatedArticle}" class="glass-panel rounded-xl p-6 block hover:border-dream-salmon/30 transition-colors border border-transparent">
                    <span class="text-xs text-dream-salmon uppercase mb-2 block">${t.in_depth_guide}</span>
                    <h3 class="font-serif text-lg text-dream-cream mb-2">${escapeHtml(symbolData.name)} - ${t.in_depth_guide}</h3>
                    <span class="text-sm text-purple-200/60 flex items-center gap-2">
                        ${t.read_article} <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </span>
                </a>
            </section>` : '';

  // Generate FAQ answer for variations
  const faqVariationsAnswer = variations.slice(0, 3).map(v => `${v.context}: ${v.meaning}`).join(' ');

  const definedTermJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: symbolData.name,
    description: symbolData.shortDescription,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: t.symbols,
      url: `https://noctalia.app/${lang}/guides/${t.dictionary_slug}`
    },
    url: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}`
  };

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: metaTitle,
    description: metaDescription,
    image: `https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg`,
    author: { '@type': 'Organization', name: 'Noctalia' },
    publisher: {
      '@type': 'Organization',
      name: 'Noctalia',
      logo: { '@type': 'ImageObject', url: 'https://noctalia.app/logo/logo_noctalia.png' }
    },
    datePublished: CONFIG.datePublished,
    dateModified: CONFIG.dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}` },
    inLanguage: lang
  };

  const breadcrumbListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `https://noctalia.app/${lang}/` },
      { '@type': 'ListItem', position: 2, name: t.symbols, item: `https://noctalia.app/${lang}/guides/${t.dictionary_slug}` },
      { '@type': 'ListItem', position: 3, name: symbolData.name, item: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}` }
    ]
  };

  const faqPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `${t.faq_what_means} ${symbolData.name}?`,
        acceptedAnswer: { '@type': 'Answer', text: symbolData.shortDescription }
      },
      {
        '@type': 'Question',
        name: t.faq_common_interpretations,
        acceptedAnswer: { '@type': 'Answer', text: faqVariationsAnswer }
      }
    ]
  };

  // Language dropdown items
  const langItems = {
    en: { flag: '🇺🇸', name: 'English' },
    fr: { flag: '🇫🇷', name: 'Français' },
    es: { flag: '🇪🇸', name: 'Español' }
  };

  const langDropdownHtml = Object.keys(langItems).map(l => {
    const isActive = l === lang;
    const targetSlug = symbol[l]?.slug || symbolData.slug;
    const activeClass = isActive ? 'text-dream-salmon bg-dream-salmon/10' : 'text-purple-100/80 hover:text-white hover:bg-white/5';
    return `
                        <a href="/${l}/${CONFIG.symbolsPath[l]}/${targetSlug}" hreflang="${l}" class="flex items-center gap-3 px-4 py-2 text-sm ${activeClass} transition-colors" role="menuitem">
                            <span class="w-5 text-center">${langItems[l].flag}</span> ${langItems[l].name}
                        </a>`;
  }).join('\n');

  // Generate the full HTML
  return `<!DOCTYPE html>
<html lang="${lang}" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(metaTitle)} | Noctalia</title>
    <meta name="description" content="${escapeHtml(metaDescription)}">
    <link rel="canonical" href="https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}">
    <link rel="alternate" hreflang="en" href="${hreflang.en}">
    <link rel="alternate" hreflang="fr" href="${hreflang.fr}">
    <link rel="alternate" hreflang="es" href="${hreflang.es}">
    <link rel="alternate" hreflang="x-default" href="${hreflang.en}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="64x64 48x48 32x32 16x16">
    <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">
    <link rel="apple-touch-icon" href="/logo192.png" sizes="192x192">

    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(metaTitle)}">
    <meta property="og:description" content="${escapeHtml(symbolData.shortDescription)}">
    <meta property="og:url" content="https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}">
    <meta property="og:image" content="https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg">
    <meta property="og:locale" content="${t.locale}">
    <meta property="article:published_time" content="${CONFIG.datePublished}">
    <meta property="article:modified_time" content="${CONFIG.dateModified}">
    <meta property="article:author" content="Noctalia">
    <meta name="robots" content="index, follow">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
    <meta name="twitter:description" content="${escapeHtml(symbolData.shortDescription)}">
    <meta name="twitter:image" content="https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg">

    <!-- Fonts -->
    <link rel="preload" href="/fonts/Outfit-Regular.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Outfit-Bold.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/Fraunces-Variable.woff2" as="font" type="font/woff2" crossorigin>

    <!-- Styles -->
    <link rel="stylesheet" href="/css/styles.min.css?v=${CONFIG.cssVersion}">
    <link rel="stylesheet" href="/css/language-dropdown.css?v=${CONFIG.cssVersion}">
    <script src="/js/lucide.min.js?v=${CONFIG.cssVersion}" defer></script>

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
        .variation-card { transition: all 0.3s ease; }
        .variation-card:hover { transform: translateY(-2px); border-color: rgba(253, 164, 129, 0.3); }
        .symbol-link { transition: all 0.3s ease; }
        .symbol-link:hover { transform: translateY(-2px); border-color: rgba(253, 164, 129, 0.3); }
    </style>

    <!-- Schema.org DefinedTerm -->
${renderJsonLd(definedTermJsonLd)}

    <!-- Schema.org Article -->
${renderJsonLd(articleJsonLd)}

    <!-- Schema.org BreadcrumbList -->
${renderJsonLd(breadcrumbListJsonLd)}

    <!-- Schema.org FAQPage -->
${renderJsonLd(faqPageJsonLd)}
</head>

<body class="bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden" style="background-color: #0a0514;">
    <div class="aurora-bg"></div>
    <div class="orb w-[70vw] h-[70vw] md:w-[40rem] md:h-[40rem] bg-purple-900/30 top-0 left-0"></div>
    <div class="orb w-[90vw] h-[90vw] md:w-[50rem] md:h-[50rem] bg-blue-900/20 bottom-0 right-0"></div>

    <!-- Navbar -->
    <nav class="fixed w-full z-50 top-0 left-0 px-4 md:px-6 py-4 md:py-6 transition-all duration-300" id="navbar">
        <div class="max-w-7xl mx-auto glass-panel rounded-full px-4 py-2 flex items-center justify-between gap-2 sm:px-6 sm:py-3 sm:gap-4">
            <a href="/${lang}/" class="flex items-center gap-2">
                <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>
                <span class="font-serif text-xl font-semibold tracking-wide text-dream-cream">Noctalia</span>
            </a>
            <div class="flex flex-wrap items-center gap-4 md:gap-8 text-sm font-sans text-purple-100/80">
                <a href="/${lang}/#${t.nav_how_it_works_anchor}" class="hidden sm:inline-flex hover:text-white transition-colors">${t.nav_how_it_works}</a>
                <a href="/${lang}/#${t.nav_features_anchor}" class="hidden sm:inline-flex hover:text-white transition-colors">${t.nav_features}</a>
                <a href="/${lang}/blog/" class="hidden sm:inline-flex text-dream-salmon">${t.nav_resources}</a>
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
                         role="menu" aria-labelledby="languageDropdownButton" id="languageDropdownMenu">${langDropdownHtml}
                    </div>
                </div>
            </div>
        </div>
    </nav>

    <main class="pt-32 pb-20 px-4">
        <article class="max-w-3xl mx-auto">

            <!-- Breadcrumb -->
            <nav class="text-sm text-purple-200/60 mb-8" aria-label="Breadcrumb">
                <ol class="flex items-center gap-2 flex-wrap" itemscope itemtype="https://schema.org/BreadcrumbList">
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                        <a href="/${lang}/" itemprop="item" class="hover:text-dream-salmon transition-colors"><span itemprop="name">${t.home}</span></a>
                        <meta itemprop="position" content="1">
                    </li>
                    <li class="text-purple-400">/</li>
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                        <a href="/${lang}/guides/${t.dictionary_slug}" itemprop="item" class="hover:text-dream-salmon transition-colors"><span itemprop="name">${t.symbols}</span></a>
                        <meta itemprop="position" content="2">
                    </li>
                    <li class="text-purple-400">/</li>
                    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                        <span itemprop="name" class="text-dream-cream">${escapeHtml(symbolData.name)}</span>
                        <meta itemprop="position" content="3">
                    </li>
                </ol>
            </nav>

            <!-- Header -->
            <header class="mb-12">
                <div class="flex flex-wrap gap-3 mb-6">
                    <span class="inline-flex items-center gap-2 text-xs font-mono text-dream-salmon border border-dream-salmon/30 rounded-full px-4 py-2">
                        <i data-lucide="sparkles" class="w-4 h-4"></i>
                        ${t.dream_symbol}
                    </span>
                    <a href="/${lang}/guides/${t.dictionary_slug}#${symbol.category}"
                       class="inline-flex items-center gap-2 text-xs font-mono text-purple-200/70 border border-white/10 rounded-full px-4 py-2 hover:text-white hover:border-dream-salmon/30 transition-colors">
                        ${categoryName}
                    </a>
                </div>

                <h1 class="font-serif text-3xl md:text-5xl mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white via-dream-lavender to-purple-400/50 leading-tight">
                    ${t.h1_prefix} ${escapeHtml(symbolData.name)}
                </h1>

                <p class="text-lg text-purple-200/80 leading-relaxed">
                    ${escapeHtml(symbolData.shortDescription)}
                </p>
            </header>

            <!-- Main Interpretation -->
            <section class="glass-panel rounded-2xl p-6 md:p-8 mb-10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-4 flex items-center gap-3">
                    <i data-lucide="eye" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_interpretation}
                </h2>
                <div class="prose prose-invert prose-purple max-w-none text-gray-300 leading-relaxed space-y-4">
                    ${fullInterpretation}
                </div>
            </section>

            <!-- Variations -->
            <section class="mb-10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="layers" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_variations}
                </h2>
                <div class="grid gap-4">${variationsHtml}
                </div>
            </section>

            <!-- Ask Yourself -->
            <section class="glass-panel rounded-2xl p-6 md:p-8 mb-10 border border-dream-salmon/20">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-4 flex items-center gap-3">
                    <i data-lucide="help-circle" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_ask_yourself}
                </h2>
                <ul class="space-y-3">${askYourselfHtml}
                </ul>
            </section>

            <!-- Related Symbols -->
            ${relatedSymbols.length > 0 ? `<section class="mb-10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="link" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_related_symbols}
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">${relatedSymbolsHtml}
                </div>
            </section>` : ''}
${relatedArticleHtml}
            <!-- CTA Section -->
            <aside class="glass-panel rounded-3xl p-8 md:p-10 text-center border border-dream-salmon/20">
                <div class="w-16 h-16 bg-dream-salmon/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i data-lucide="sparkles" class="w-8 h-8 text-dream-salmon"></i>
                </div>
                <h3 class="font-serif text-2xl md:text-3xl mb-4 text-dream-cream">${t.cta_title}</h3>
                <p class="text-purple-200/70 mb-6 max-w-lg mx-auto">
                    ${t.cta_description}
                </p>
                <a href="/${lang}/" class="inline-flex items-center gap-2 px-8 py-4 bg-dream-salmon text-dream-dark rounded-full font-bold hover:bg-dream-salmon/90 transition-colors">
                    ${t.cta_button} <i data-lucide="arrow-right" class="w-5 h-5"></i>
                </a>
            </aside>

            <!-- Back to Dictionary -->
            <div class="mt-10 text-center">
                <a href="/${lang}/guides/${t.dictionary_slug}" class="inline-flex items-center gap-2 text-purple-200/60 hover:text-dream-salmon transition-colors">
                    <i data-lucide="arrow-left" class="w-4 h-4"></i>
                    ${t.back_to_dictionary}
                </a>
            </div>

        </article>
    </main>

    <!-- Footer -->
    <footer class="pb-10 pt-20 border-t border-white/5 px-6 bg-[#05020a]">
        <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">
            <div class="col-span-1 md:col-span-2">
                <a href="/${lang}/" class="flex items-center gap-2 mb-4">
                    <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>
                    <h4 class="font-serif text-2xl text-dream-cream">Noctalia</h4>
                </a>
                <p class="text-sm text-gray-500 max-w-xs mb-6">${t.footer_tagline}</p>
            </div>
            <div>
                <h5 class="font-bold mb-4 text-white">${t.nav_resources}</h5>
                <ul class="space-y-2 text-sm text-gray-500">
                    <li><a href="/${lang}/blog/" class="hover:text-dream-salmon transition-colors">${t.nav_resources}</a></li>
                    <li><a href="/${lang}/guides/${t.dictionary_slug}" class="text-dream-salmon">${t.symbols}</a></li>
                </ul>
            </div>
            <div>
                <h5 class="font-bold mb-4 text-white">${t.footer_legal}</h5>
                <ul class="space-y-2 text-sm text-gray-500">
                    <li><a href="/${lang}/${t.about_slug}" class="hover:text-dream-salmon transition-colors">${t.about}</a></li>
                    <li><a href="/${lang}/${t.legal_slug}" class="hover:text-dream-salmon transition-colors">${t.legal_notice}</a></li>
                    <li><a href="/${lang}/${t.privacy_slug}" class="hover:text-dream-salmon transition-colors">${t.privacy}</a></li>
                    <li><a href="/${lang}/${t.terms_slug}" class="hover:text-dream-salmon transition-colors">${t.terms}</a></li>
                </ul>
            </div>
        </div>
        <div class="text-center pt-8 border-t border-white/5 text-[10px] text-gray-600 flex flex-col md:flex-row justify-between items-center">
            <span>&copy; 2025 Noctalia Inc.</span>
            <span class="mt-2 md:mt-0 flex gap-2 items-center">${t.footer_made_with} <i data-lucide="heart" class="w-3 h-3 text-dream-salmon fill-current"></i> ${t.footer_for_dreamers}</span>
        </div>
    </footer>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

            // Navbar scroll effect
            window.addEventListener('scroll', () => {
                const navbar = document.getElementById('navbar');
                if (navbar) {
                    navbar.classList.toggle('py-2', window.scrollY > 50);
                    navbar.classList.toggle('py-6', window.scrollY <= 50);
                }
            });
        });
    </script>
    <script src="/js/language-dropdown.js?v=${CONFIG.cssVersion}" defer></script>
</body>
</html>`;
}

// Main function
function main() {
  console.log('🌙 Dream Symbol Pages Generator\n');

  // Load data
  const { symbols, i18n, extended } = loadData();
  console.log(`📚 Loaded ${symbols.symbols.length} symbols`);
  console.log(`🌍 Languages: ${CONFIG.languages.join(', ')}`);

  // Filter by priority if specified
  let symbolsToGenerate = symbols.symbols;
  if (args.priority) {
    const priority = parseInt(args.priority);
    symbolsToGenerate = symbolsToGenerate.filter(s => s.priority === priority);
    console.log(`🎯 Filtered to priority ${priority}: ${symbolsToGenerate.length} symbols`);
  }

  // Filter by language if specified
  let languages = CONFIG.languages;
  if (args.lang) {
    languages = [args.lang];
    console.log(`🌍 Filtered to language: ${args.lang}`);
  }

  // Calculate total pages
  const totalPages = symbolsToGenerate.length * languages.length;
  console.log(`\n📄 Generating ${totalPages} pages...\n`);

  let generated = 0;
  let errors = 0;

  // Generate pages
  for (const lang of languages) {
    const langDir = path.join(CONFIG.outputDir, lang, CONFIG.symbolsPath[lang]);

    // Create directory if not dry run
    if (!args['dry-run']) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    for (const symbol of symbolsToGenerate) {
      const symbolData = symbol[lang];
      if (!symbolData) {
        console.log(`⚠️  Skipping ${symbol.id} for ${lang} (no translation)`);
        errors++;
        continue;
      }

      const filename = `${symbolData.slug}.html`;
      const filepath = path.join(langDir, filename);

      try {
        const html = generatePage(symbol, symbols.symbols, i18n, extended, lang);

        if (args['dry-run']) {
          console.log(`  [DRY RUN] Would create: ${filepath}`);
        } else {
          fs.writeFileSync(filepath, html, 'utf8');
          console.log(`  ✅ ${lang}/${CONFIG.symbolsPath[lang]}/${filename}`);
        }
        generated++;
      } catch (err) {
        console.error(`  ❌ Error generating ${symbol.id} (${lang}): ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n✨ Done! Generated ${generated} pages, ${errors} errors.`);

  if (!args['dry-run']) {
    console.log(`\n📁 Output directories:`);
    for (const lang of languages) {
      console.log(`   /${lang}/${CONFIG.symbolsPath[lang]}/`);
    }
  }
}

// Run
main();
