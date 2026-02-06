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

function isoDateFromDocsVersion(version) {
  const match = version.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().slice(0, 10);
}

const DOCS_ASSET_VERSION = readDocsAssetVersionOrExit();

// Configuration
const CONFIG = {
  dataDir: path.join(__dirname, '..', 'data'),
  outputDir: path.join(__dirname, '..'),
  symbolsFile: 'dream-symbols.json',
  i18nFile: 'symbol-i18n.json',
  extendedFile: 'dream-symbols-extended.json',
  languages: ['en', 'fr', 'es', 'de', 'it'],
  symbolsPath: {
    en: 'symbols',
    fr: 'symboles',
    es: 'simbolos',
    de: 'traumsymbole',
    it: 'simboli'
  },
  datePublished: '2025-01-21',
  // Keep the historical publish date but refresh `dateModified` on each docs build.
  dateModified: isoDateFromDocsVersion(DOCS_ASSET_VERSION),
  cssVersion: DOCS_ASSET_VERSION
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
    nature: { en: 'Nature', fr: 'Nature', es: 'Naturaleza', de: 'Natur', it: 'Natura' },
    animals: { en: 'Animals', fr: 'Animaux', es: 'Animales', de: 'Tiere', it: 'Animali' },
    body: { en: 'Body', fr: 'Corps', es: 'Cuerpo', de: 'Körper', it: 'Corpo' },
    places: { en: 'Places', fr: 'Lieux', es: 'Lugares', de: 'Orte', it: 'Luoghi' },
    objects: { en: 'Objects', fr: 'Objets', es: 'Objetos', de: 'Objekte', it: 'Oggetti' },
    actions: { en: 'Actions', fr: 'Actions', es: 'Acciones', de: 'Handlungen', it: 'Azioni' },
    people: { en: 'People', fr: 'Personnes', es: 'Personas', de: 'Menschen', it: 'Persone' },
    celestial: { en: 'Celestial', fr: 'Céleste', es: 'Celestial', de: 'Himmlisch', it: 'Celeste' }
  };
  return categories[symbol.category]?.[lang] || symbol.category;
}

// Generate meta title
function generateMetaTitle(symbol, i18n, lang) {
  const template = i18n[lang].meta_title_template;
  const name = symbol[lang].name;
  return template.replace(/{symbol}/g, name);
}

// Truncate a meta description to a maximum length, cutting at the last sentence or word boundary
function truncateMetaDescription(text, maxLength = 160) {
  if (text.length <= maxLength) return text;
  // Try to cut at the last sentence boundary (period followed by space) within the limit
  const truncated = text.slice(0, maxLength);
  const lastSentenceEnd = truncated.lastIndexOf('. ');
  if (lastSentenceEnd > maxLength * 0.5) {
    return truncated.slice(0, lastSentenceEnd + 1);
  }
  // Fall back to last word boundary, reserving space for ellipsis
  const ellipsis = '\u2026'; // single-char ellipsis (…)
  const truncatedForEllipsis = text.slice(0, maxLength - 1);
  const lastSpace = truncatedForEllipsis.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.5) {
    return truncatedForEllipsis.slice(0, lastSpace) + ellipsis;
  }
  return truncatedForEllipsis + ellipsis;
}

// Generate meta description
function generateMetaDescription(symbol, i18n, lang) {
  const template = i18n[lang].meta_description_template;
  const name = symbol[lang].name;
  const shortDesc = symbol[lang].shortDescription;
  const description = template
    .replace(/{symbol}/g, name)
    .replace(/{short_description}/g, shortDesc);
  return truncateMetaDescription(description);
}

// Generate hreflang URLs
function generateHreflangUrls(symbol) {
  const urls = {};
  for (const l of CONFIG.languages) {
    if (symbol[l]) {
      urls[l] = `https://noctalia.app/${l}/${CONFIG.symbolsPath[l]}/${symbol[l].slug}`;
    }
  }
  return urls;
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

function firstSentence(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.+?[.!?])(\s|$)/);
  return (match ? match[1] : trimmed).trim();
}

// Generate default interpretation from short description
function generateDefaultInterpretation({ shortDescription, symbolName, lang, categoryIntro, askYourself }) {
  const lower = symbolName.toLowerCase();
  const categorySentence = firstSentence(categoryIntro);
  const firstQuestion = Array.isArray(askYourself) ? askYourself[0] : null;

  const questionLead = {
    en: 'A helpful question to reflect on:',
    fr: 'Une question utile à se poser :',
    es: 'Una pregunta útil para reflexionar:',
    de: 'Eine hilfreiche Frage zur Reflexion:',
    it: 'Una domanda utile su cui riflettere:'
  };

  const templates = {
    en: `<p>${shortDescription}</p>
${categorySentence ? `<p>${categorySentence}</p>` : ''}
<p>When ${lower} appears in your dreams, it often reflects important aspects of your inner life and current circumstances. The specific context and emotions you experience in the dream provide valuable clues to its personal meaning for you.</p>
${firstQuestion ? `<p>${questionLead.en} ${firstQuestion}</p>` : ''}
<p>Consider what ${lower} means to you personally. Your individual associations and life experiences shape the symbol's significance in your dreams.</p>`,
    fr: `<p>${shortDescription}</p>
${categorySentence ? `<p>${categorySentence}</p>` : ''}
<p>Lorsque ${lower} apparaît dans vos rêves, cela reflète souvent des aspects importants de votre vie intérieure et de vos circonstances actuelles. Le contexte spécifique et les émotions que vous ressentez dans le rêve fournissent des indices précieux sur sa signification personnelle.</p>
${firstQuestion ? `<p>${questionLead.fr} ${firstQuestion}</p>` : ''}
<p>Réfléchissez à ce que ${lower} signifie pour vous personnellement. Vos associations individuelles et vos expériences de vie façonnent la signification du symbole dans vos rêves.</p>`,
    es: `<p>${shortDescription}</p>
${categorySentence ? `<p>${categorySentence}</p>` : ''}
<p>Cuando ${lower} aparece en tus sueños, a menudo refleja aspectos importantes de tu vida interior y circunstancias actuales. El contexto específico y las emociones que experimentas en el sueño proporcionan pistas valiosas sobre su significado personal para ti.</p>
${firstQuestion ? `<p>${questionLead.es} ${firstQuestion}</p>` : ''}
<p>Considera qué significa ${lower} para ti personalmente. Tus asociaciones individuales y experiencias de vida dan forma al significado del símbolo en tus sueños.</p>`,
    de: `<p>${shortDescription}</p>
${categorySentence ? `<p>${categorySentence}</p>` : ''}
<p>Wenn ${lower} in deinen Träumen erscheint, spiegelt es oft wichtige Aspekte deines Innenlebens und deiner aktuellen Lebensumstände wider. Der spezifische Kontext und die Emotionen, die du im Traum erlebst, liefern wertvolle Hinweise auf seine persönliche Bedeutung für dich.</p>
${firstQuestion ? `<p>${questionLead.de} ${firstQuestion}</p>` : ''}
<p>Überlege, was ${lower} für dich persönlich bedeutet. Deine individuellen Assoziationen und Lebenserfahrungen prägen die Bedeutung des Symbols in deinen Träumen.</p>`,
    it: `<p>${shortDescription}</p>
${categorySentence ? `<p>${categorySentence}</p>` : ''}
<p>Quando ${lower} appare nei tuoi sogni, riflette spesso aspetti importanti della tua vita interiore e delle circostanze attuali. Il contesto specifico e le emozioni che provi nel sogno forniscono indizi preziosi sul suo significato personale per te.</p>
${firstQuestion ? `<p>${questionLead.it} ${firstQuestion}</p>` : ''}
<p>Considera cosa significa ${lower} per te personalmente. Le tue associazioni individuali e le esperienze di vita plasmano il significato del simbolo nei tuoi sogni.</p>`
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
    ],
    de: [
      { context: `Positives ${symbolName}`, meaning: `Steht oft für günstige Ergebnisse, Wachstum oder positive Aspekte deiner aktuellen Situation.` },
      { context: `Negatives oder bedrohliches ${symbolName}`, meaning: `Kann auf Ängste, Herausforderungen oder ungelöste Probleme hinweisen, die deine Aufmerksamkeit brauchen.` },
      { context: `Wiederkehrendes ${symbolName}`, meaning: `Deutet auf ein beständiges Thema oder eine Botschaft deines Unterbewusstseins hin, die eine tiefere Erforschung verdient.` }
    ],
    it: [
      { context: `${symbolName} positivo`, meaning: `Rappresenta spesso risultati favorevoli, crescita o aspetti positivi della tua situazione attuale.` },
      { context: `${symbolName} negativo o minaccioso`, meaning: `Può indicare paure, sfide o problemi irrisolti che richiedono la tua attenzione.` },
      { context: `${symbolName} ricorrente`, meaning: `Suggerisce un tema persistente o un messaggio dal tuo subconscio che merita un'esplorazione più profonda.` }
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

function sanitizeEmDashes(text) {
  if (!text) return text;
  return String(text)
    .replace(/\s*—\s*/g, ', ')
    .replace(/,\s*,/g, ', ')
    .replace(/\s{2,}/g, ' ');
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
  const categoryIntroForDefaults = i18n[lang].category_intros?.[symbol.category] || null;
  const relatedSymbols = getRelatedSymbols(symbol, allSymbols, lang);
  const extendedContent = getExtendedContent(symbol.id, extended, lang);

  // Use extended content or generate defaults
  const fullInterpretation = sanitizeEmDashes(extendedContent.fullInterpretation) ||
    generateDefaultInterpretation({
      shortDescription: symbolData.shortDescription,
      symbolName: symbolData.name,
      lang,
      categoryIntro: categoryIntroForDefaults,
      askYourself: symbolData.askYourself
    });
  const variations = extendedContent.variations.length > 0 ?
    extendedContent.variations :
    generateDefaultVariations(symbolData.name, lang);

  // Generate variations HTML
  const variationsHtml = variations.map(v => `
                    <div class="variation-card glass-panel rounded-xl p-5 border border-transparent">
                        <h3 class="font-medium text-dream-cream mb-2">${escapeHtml(sanitizeEmDashes(v.context))}</h3>
                        <p class="text-sm text-gray-300">${escapeHtml(sanitizeEmDashes(v.meaning))}</p>
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
  const faqVariationsAnswer = sanitizeEmDashes(variations.slice(0, 3).map(v => `${v.context}: ${v.meaning}`).join(' '));

  const reflectionTitles = {
    en: 'Make it personal',
    fr: 'Pour vous',
    es: 'Para ti',
    de: 'Für dich',
    it: 'Per te'
  };

  const reflectionLead1 = {
    en: `Dream symbols are personal. Two people can dream about ${symbolData.name} and wake up with different feelings. Use this page as a guide, then compare it with your current life.`,
    fr: `Les symboles de rêve sont personnels. Deux personnes peuvent rêver de ${symbolData.name} et se réveiller avec des sensations différentes. Utilisez cette page comme repère, puis reliez-la à votre vie actuelle.`,
    es: `Los símbolos de los sueños son personales. Dos personas pueden soñar con ${symbolData.name} y despertar con sensaciones distintas. Usa esta página como guía y compárala con tu vida actual.`,
    de: `Traumsymbole sind persönlich. Zwei Menschen können von ${symbolData.name} träumen und mit unterschiedlichen Gefühlen aufwachen. Nutze diese Seite als Orientierung und verknüpfe sie mit deinem aktuellen Leben.`,
    it: `I simboli nei sogni sono personali. Due persone possono sognare ${symbolData.name} e svegliarsi con sensazioni diverse. Usa questa pagina come guida e collegala alla tua vita di adesso.`
  };

  const reflectionLead2 = {
    en: `A practical way to interpret this dream is to pick one recent moment that felt similar. It could be pressure, curiosity, conflict, or relief. Details from the dream usually point to the right theme.`,
    fr: `Une manière simple d'interpréter ce rêve est de choisir un moment récent qui vous a fait ressentir quelque chose de similaire. Cela peut être de la pression, de la curiosité, un conflit ou un soulagement. Les détails du rêve indiquent souvent le bon thème.`,
    es: `Una forma práctica de interpretar este sueño es pensar en un momento reciente que se sintiera parecido. Puede ser presión, curiosidad, conflicto o alivio. Los detalles del sueño suelen señalar el tema correcto.`,
    de: `Eine praktische Methode ist, an einen aktuellen Moment zu denken, der sich ähnlich angefühlt hat. Das kann Druck, Neugier, Konflikt oder Erleichterung sein. Die Details aus dem Traum weisen oft auf das passende Thema hin.`,
    it: `Un modo pratico per interpretare questo sogno è pensare a un momento recente che ti ha dato sensazioni simili. Può essere pressione, curiosità, conflitto o sollievo. I dettagli del sogno di solito indicano il tema giusto.`
  };

  const promptLead = {
    en: 'Try writing down answers to:',
    fr: 'Essayez d’écrire vos réponses à :',
    es: 'Prueba a escribir tus respuestas a:',
    de: 'Notiere dir Antworten auf:',
    it: 'Prova a scrivere le risposte a:'
  };

  const extraPrompts = {
    en: [
      'What was happening right before the symbol appeared?',
      'What emotion stayed with you after waking?'
    ],
    fr: [
      'Que se passait-il juste avant que le symbole apparaisse ?',
      "Quelle émotion est restée après le réveil ?"
    ],
    es: [
      '¿Qué pasó justo antes de que apareciera el símbolo?',
      '¿Qué emoción quedó al despertar?'
    ],
    de: [
      'Was geschah kurz bevor das Symbol auftauchte?',
      'Welche Emotion blieb nach dem Aufwachen?'
    ],
    it: [
      'Cosa è successo subito prima che apparisse il simbolo?',
      "Quale emozione è rimasta al risveglio?"
    ]
  };

  const reflectionPrompts = [
    ...(Array.isArray(symbolData.askYourself) ? symbolData.askYourself.slice(0, 2) : []),
    ...(extraPrompts[lang] || extraPrompts.en)
  ].slice(0, 4);

  const reflectionPromptsHtml = reflectionPrompts.map(p => `<li>${escapeHtml(p)}</li>`).join('');
  const reflectionSectionHtml = `
            <!-- Reflection -->
            <section class="glass-panel rounded-2xl p-6 md:p-8 mb-10 border border-dream-salmon/10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-4 flex items-center gap-3">
                    <i data-lucide="pen-line" class="w-6 h-6 text-dream-salmon"></i>
                    ${escapeHtml(reflectionTitles[lang] || reflectionTitles.en)}
                </h2>
                <div class="prose prose-invert prose-purple max-w-none text-gray-300 leading-relaxed space-y-4">
                    <p>${escapeHtml(reflectionLead1[lang] || reflectionLead1.en)}</p>
                    <p>${escapeHtml(reflectionLead2[lang] || reflectionLead2.en)}</p>
                    <p><strong>${escapeHtml(promptLead[lang] || promptLead.en)}</strong></p>
                    <ul>${reflectionPromptsHtml}</ul>
                </div>
            </section>`;

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
    es: { flag: '🇪🇸', name: 'Español' },
    de: { flag: '🇩🇪', name: 'Deutsch' },
    it: { flag: '🇮🇹', name: 'Italiano' }
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

  // Generate hreflang links
  const hreflangLinks = CONFIG.languages
    .filter(l => hreflang[l])
    .map(l => `    <link rel="alternate" hreflang="${l}" href="${hreflang[l]}">`)
    .join('\n');

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
${hreflangLinks}
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
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(metaTitle)}">
    <meta property="og:locale" content="${t.locale}">
${CONFIG.languages.filter(l => l !== lang).map(l => `    <meta property="og:locale:alternate" content="${{ en: 'en_US', fr: 'fr_FR', es: 'es_ES', de: 'de_DE', it: 'it_IT' }[l]}">`).join('\n')}
    <meta property="article:published_time" content="${CONFIG.datePublished}">
    <meta property="article:modified_time" content="${CONFIG.dateModified}">
    <meta property="article:author" content="Noctalia">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
    <meta name="twitter:description" content="${escapeHtml(symbolData.shortDescription)}">
    <meta name="twitter:image" content="https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg">
    <meta name="twitter:site" content="@NoctaliaDreams">
    <meta name="twitter:image:alt" content="${escapeHtml(metaTitle)}">

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
                <ol class="flex items-center gap-2 flex-wrap">
                    <li>
                        <a href="/${lang}/" class="hover:text-dream-salmon transition-colors">${t.home}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <a href="/${lang}/guides/${t.dictionary_slug}" class="hover:text-dream-salmon transition-colors">${t.symbols}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <span class="text-dream-cream">${escapeHtml(symbolData.name)}</span>
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
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${t.category_slugs[symbol.category]}"
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

${reflectionSectionHtml}
            <!-- FAQ -->
            <section class="mb-10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="help-circle" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.section_faq}
                </h2>
                <div class="grid gap-4">
                    <div class="glass-panel rounded-2xl p-6 border border-transparent">
                        <h3 class="font-medium text-dream-cream mb-2">${t.faq_what_means} ${escapeHtml(symbolData.name)}?</h3>
                        <p class="text-sm text-gray-300 leading-relaxed">${escapeHtml(symbolData.shortDescription)}</p>
                    </div>
                    <div class="glass-panel rounded-2xl p-6 border border-transparent">
                        <h3 class="font-medium text-dream-cream mb-2">${t.faq_common_interpretations}</h3>
                        <p class="text-sm text-gray-300 leading-relaxed">${escapeHtml(faqVariationsAnswer)}</p>
                    </div>
                </div>
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

  // Filter by symbol id(s) if specified (comma-separated)
  if (args.id) {
    const ids = String(args.id).split(',').map(s => s.trim()).filter(Boolean);
    symbolsToGenerate = symbolsToGenerate.filter(s => ids.includes(s.id));
    console.log(`🔎 Filtered to ids: ${ids.join(', ')} (${symbolsToGenerate.length} symbols)`);
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

// =====================================================
// CATEGORY PAGES GENERATION
// =====================================================

// Category icons mapping (Lucide icon names)
const CATEGORY_ICONS = {
  nature: 'leaf',
  animals: 'paw-print',
  body: 'user',
  places: 'home',
  objects: 'package',
  actions: 'zap',
  people: 'users',
  celestial: 'sun'
};

// Get category name for a given category ID
function getCategoryNameById(categoryId, lang) {
  const categories = {
    nature: { en: 'Nature', fr: 'Nature', es: 'Naturaleza', de: 'Natur', it: 'Natura' },
    animals: { en: 'Animals', fr: 'Animaux', es: 'Animales', de: 'Tiere', it: 'Animali' },
    body: { en: 'Body', fr: 'Corps', es: 'Cuerpo', de: 'Körper', it: 'Corpo' },
    places: { en: 'Places', fr: 'Lieux', es: 'Lugares', de: 'Orte', it: 'Luoghi' },
    objects: { en: 'Objects', fr: 'Objets', es: 'Objetos', de: 'Objekte', it: 'Oggetti' },
    actions: { en: 'Actions', fr: 'Actions', es: 'Acciones', de: 'Handlungen', it: 'Azioni' },
    people: { en: 'People', fr: 'Personnes', es: 'Personas', de: 'Menschen', it: 'Persone' },
    celestial: { en: 'Celestial', fr: 'Céleste', es: 'Celestial', de: 'Himmlisch', it: 'Celeste' }
  };
  return categories[categoryId]?.[lang] || categoryId;
}

// Generate category hreflang URLs
function generateCategoryHreflangUrls(categoryId, i18n) {
  const urls = {};
  for (const l of CONFIG.languages) {
    if (i18n[l]?.category_slugs?.[categoryId]) {
      urls[l] = `https://noctalia.app/${l}/${CONFIG.symbolsPath[l]}/${i18n[l].category_slugs[categoryId]}`;
    }
  }
  return urls;
}

// Generate category meta title
function generateCategoryMetaTitle(categoryId, i18n, lang) {
  const template = i18n[lang].category_meta_title_template;
  const categoryName = getCategoryNameById(categoryId, lang);
  return template.replace(/{category}/g, categoryName);
}

// Generate category meta description
function generateCategoryMetaDescription(categoryId, i18n, lang) {
  const template = i18n[lang].category_meta_description_template;
  const categoryName = getCategoryNameById(categoryId, lang);
  const description = template
    .replace(/{category}/g, categoryName)
    .replace(/{category_lower}/g, categoryName.toLowerCase());
  return truncateMetaDescription(description);
}

// Generate category page HTML
function generateCategoryPage(categoryId, symbolsInCategory, allCategories, i18n, lang, curationPages) {
  const t = i18n[lang];
  const categoryName = getCategoryNameById(categoryId, lang);
  const categorySchemaName = t.category_h1_template.replace(/{category}/g, categoryName);
  const categorySlug = t.category_slugs[categoryId];
  const hreflang = generateCategoryHreflangUrls(categoryId, i18n);
  const metaTitle = generateCategoryMetaTitle(categoryId, i18n, lang);
  const metaDescription = generateCategoryMetaDescription(categoryId, i18n, lang);
  const categoryIntro = t.category_intros?.[categoryId] || t.category_intro_template.replace(/{category_lower}/g, categoryName.toLowerCase());
  const categoryIcon = CATEGORY_ICONS[categoryId] || 'sparkles';
  const symbolsCount = symbolsInCategory.length;

  const howToTitles = {
    en: 'How to use this category',
    fr: 'Comment utiliser cette catégorie',
    es: 'Cómo usar esta categoría',
    de: 'So nutzt du diese Kategorie',
    it: 'Come usare questa categoria'
  };

  const howToParagraphs = {
    en: [
      `This category groups symbols that often share related themes. Start with how the dream felt, then look at the symbol details.`,
      `If you notice several ${categoryName.toLowerCase()} symbols in a short period, it can help to look for one common situation in your waking life.`
    ],
    fr: [
      `Cette catégorie regroupe des symboles qui partagent souvent des thèmes proches. Commencez par l'émotion du rêve, puis regardez les détails du symbole.`,
      `Si vous remarquez plusieurs symboles de type ${categoryName.toLowerCase()} sur une courte période, cherchez un point commun dans votre vie éveillée.`
    ],
    es: [
      `Esta categoría agrupa símbolos que suelen compartir temas relacionados. Empieza por cómo se sintió el sueño y luego mira los detalles del símbolo.`,
      `Si ves varios símbolos de ${categoryName.toLowerCase()} en poco tiempo, puede ayudar buscar una situación común en tu vida despierta.`
    ],
    de: [
      `Diese Kategorie bündelt Symbole, die oft ähnliche Themen teilen. Starte mit dem Gefühl im Traum und achte dann auf die Details des Symbols.`,
      `Wenn dir mehrere ${categoryName.toLowerCase()}-Symbole in kurzer Zeit auffallen, kann es helfen, nach einer gemeinsamen Situation im Wachleben zu suchen.`
    ],
    it: [
      `Questa categoria raccoglie simboli che spesso condividono temi collegati. Parti da come ti sei sentito nel sogno e poi guarda i dettagli del simbolo.`,
      `Se noti più simboli di tipo ${categoryName.toLowerCase()} in poco tempo, può aiutare cercare una situazione comune nella tua vita da sveglio.`
    ]
  };

  const howToBullets = {
    en: ['Write down the main emotion.', 'Note what changed during the dream.', 'Pick one symbol and connect it to a recent moment.'],
    fr: ["Notez l'émotion principale.", 'Repérez ce qui change dans le rêve.', 'Choisissez un symbole et reliez-le à un moment récent.'],
    es: ['Anota la emoción principal.', 'Fíjate en qué cambia durante el sueño.', 'Elige un símbolo y conéctalo con un momento reciente.'],
    de: ['Notiere die wichtigste Emotion.', 'Achte darauf, was sich im Traum verändert.', 'Wähle ein Symbol und verbinde es mit einem aktuellen Moment.'],
    it: ["Scrivi l'emozione principale.", 'Nota cosa cambia durante il sogno.', 'Scegli un simbolo e collegalo a un momento recente.']
  };

  const categoryHowToHtml = `
            <!-- How to use -->
            <section class="glass-panel rounded-2xl p-6 md:p-8 mb-12 border border-dream-salmon/10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-4 flex items-center gap-3">
                    <i data-lucide="sparkles" class="w-6 h-6 text-dream-salmon"></i>
                    ${escapeHtml(howToTitles[lang] || howToTitles.en)}
                </h2>
                <div class="prose prose-invert prose-purple max-w-none text-gray-300 leading-relaxed space-y-4">
                    <p>${escapeHtml(howToParagraphs[lang]?.[0] || howToParagraphs.en[0])}</p>
                    <p>${escapeHtml(howToParagraphs[lang]?.[1] || howToParagraphs.en[1])}</p>
                    <ul>${(howToBullets[lang] || howToBullets.en).map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
                </div>
            </section>`;

  // Language dropdown items
  const langItems = {
    en: { flag: '🇺🇸', name: 'English' },
    fr: { flag: '🇫🇷', name: 'Français' },
    es: { flag: '🇪🇸', name: 'Español' },
    de: { flag: '🇩🇪', name: 'Deutsch' },
    it: { flag: '🇮🇹', name: 'Italiano' }
  };

  const langDropdownHtml = Object.keys(langItems).map(l => {
    const isActive = l === lang;
    const targetSlug = i18n[l].category_slugs[categoryId];
    const activeClass = isActive ? 'text-dream-salmon bg-dream-salmon/10' : 'text-purple-100/80 hover:text-white hover:bg-white/5';
    return `
                        <a href="/${l}/${CONFIG.symbolsPath[l]}/${targetSlug}" hreflang="${l}" class="flex items-center gap-3 px-4 py-2 text-sm ${activeClass} transition-colors" role="menuitem">
                            <span class="w-5 text-center">${langItems[l].flag}</span> ${langItems[l].name}
                        </a>`;
  }).join('\n');

  // Generate symbols grid HTML
  const symbolsHtml = symbolsInCategory.map(s => `
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${s[lang].slug}" class="symbol-card glass-panel rounded-2xl p-6 border border-transparent group">
                        <h2 class="font-serif text-xl text-dream-cream mb-3 group-hover:text-dream-salmon transition-colors">${escapeHtml(s[lang].name)}</h2>
                        <p class="text-sm text-gray-400 leading-relaxed line-clamp-3">${escapeHtml(s[lang].shortDescription)}</p>
                        <span class="inline-flex items-center gap-2 text-xs text-dream-salmon mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            ${t.read_article} <i data-lucide="arrow-right" class="w-3 h-3"></i>
                        </span>
                    </a>`).join('\n');

  // Generate other categories HTML
  const otherCategoriesHtml = allCategories
    .filter(c => c.id !== categoryId)
    .map(c => `
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${i18n[lang].category_slugs[c.id]}" class="category-chip glass-panel rounded-full px-5 py-3 text-sm text-purple-200/80 border border-transparent hover:text-dream-cream">
                        ${getCategoryNameById(c.id, lang)} <span class="text-purple-400/60 ml-1">(${c.count})</span>
                    </a>`).join('\n');

  // Generate related guides HTML (from curation pages)
  let relatedGuidesHtml = '';
  if (curationPages && curationPages.length > 0) {
    const relatedCurationIds = CATEGORY_TO_CURATION[categoryId] || [];
    const relatedPages = relatedCurationIds
      .map(id => curationPages.find(p => p.id === id))
      .filter(Boolean);

    if (relatedPages.length > 0) {
      const guidesLinksHtml = relatedPages.map(p => `
                    <a href="/${lang}/guides/${p.slugs[lang]}" class="category-chip glass-panel rounded-xl px-5 py-4 text-sm text-purple-200/80 border border-transparent hover:text-dream-cream hover:border-dream-salmon/30 transition-all flex items-center gap-2">
                        <i data-lucide="book-open" class="w-4 h-4 text-dream-salmon"></i>
                        ${escapeHtml(p[lang].title)}
                    </a>`).join('\n');

      relatedGuidesHtml = `
            <!-- Related Guides -->
            <section class="mb-16">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="book-marked" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.curation_related_guides}
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${guidesLinksHtml}
                </div>
            </section>`;
    }
  }

  // Schema.org CollectionPage
  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: metaTitle,
    description: metaDescription,
    url: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${categorySlug}`,
    inLanguage: lang,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Noctalia',
      url: 'https://noctalia.app'
    },
    about: {
      '@type': 'Thing',
      name: categorySchemaName
    },
    publisher: {
      '@type': 'Organization',
      name: 'Noctalia',
      logo: { '@type': 'ImageObject', url: 'https://noctalia.app/logo/logo_noctalia.png' }
    },
    datePublished: CONFIG.datePublished,
    dateModified: CONFIG.dateModified
  };

  // Schema.org ItemList
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: categorySchemaName,
    description: categoryIntro,
    numberOfItems: symbolsCount,
    itemListElement: symbolsInCategory.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s[lang].name,
      url: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${s[lang].slug}`
    }))
  };

  // Schema.org BreadcrumbList
  const breadcrumbListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `https://noctalia.app/${lang}/` },
      { '@type': 'ListItem', position: 2, name: t.symbols, item: `https://noctalia.app/${lang}/guides/${t.dictionary_slug}` },
      { '@type': 'ListItem', position: 3, name: categoryName, item: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${categorySlug}` }
    ]
  };

  // Generate the full HTML
  return `<!DOCTYPE html>
<html lang="${lang}" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(metaTitle)} | Noctalia</title>
    <meta name="description" content="${escapeHtml(metaDescription)}">
    <link rel="canonical" href="https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${categorySlug}">
${CONFIG.languages.filter(l => hreflang[l]).map(l => `    <link rel="alternate" hreflang="${l}" href="${hreflang[l]}">`).join('\n')}
    <link rel="alternate" hreflang="x-default" href="${hreflang.en}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="64x64 48x48 32x32 16x16">
    <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">
    <link rel="apple-touch-icon" href="/logo192.png" sizes="192x192">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(metaTitle)}">
    <meta property="og:description" content="${escapeHtml(metaDescription)}">
    <meta property="og:url" content="https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${categorySlug}">
    <meta property="og:image" content="https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(metaTitle)}">
    <meta property="og:locale" content="${t.locale}">
${CONFIG.languages.filter(l => l !== lang).map(l => `    <meta property="og:locale:alternate" content="${{ en: 'en_US', fr: 'fr_FR', es: 'es_ES', de: 'de_DE', it: 'it_IT' }[l]}">`).join('\n')}
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
    <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
    <meta name="twitter:image" content="https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg">
    <meta name="twitter:site" content="@NoctaliaDreams">
    <meta name="twitter:image:alt" content="${escapeHtml(metaTitle)}">

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
        .symbol-card { transition: all 0.3s ease; }
        .symbol-card:hover { transform: translateY(-4px); border-color: rgba(253, 164, 129, 0.3); }
        .category-chip { transition: all 0.3s ease; }
        .category-chip:hover { background: rgba(255, 255, 255, 0.15); border-color: rgba(253, 164, 129, 0.3); }
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    </style>

    <!-- Schema.org CollectionPage -->
${renderJsonLd(collectionPageJsonLd)}

    <!-- Schema.org ItemList -->
${renderJsonLd(itemListJsonLd)}

    <!-- Schema.org BreadcrumbList -->
${renderJsonLd(breadcrumbListJsonLd)}
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
        <div class="max-w-5xl mx-auto">

            <!-- Breadcrumb -->
            <nav class="text-sm text-purple-200/60 mb-8" aria-label="Breadcrumb">
                <ol class="flex items-center gap-2 flex-wrap">
                    <li>
                        <a href="/${lang}/" class="hover:text-dream-salmon transition-colors">${t.home}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <a href="/${lang}/guides/${t.dictionary_slug}" class="hover:text-dream-salmon transition-colors">${t.symbols}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <span class="text-dream-cream">${escapeHtml(categoryName)}</span>
                    </li>
                </ol>
            </nav>

            <!-- Header -->
            <header class="mb-12 text-center">
                <div class="flex justify-center gap-3 mb-6">
                    <span class="inline-flex items-center gap-2 text-xs font-mono text-dream-salmon border border-dream-salmon/30 rounded-full px-4 py-2">
                        <i data-lucide="${categoryIcon}" class="w-4 h-4"></i>
                        ${symbolsCount} ${t.symbols_in_category}
                    </span>
                </div>

                <h1 class="font-serif text-3xl md:text-5xl mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white via-dream-lavender to-purple-400/50 leading-tight">
                    ${t.category_h1_template.replace(/{category}/g, categoryName)}
                </h1>

                <p class="text-lg text-purple-200/80 leading-relaxed max-w-2xl mx-auto">
                    ${escapeHtml(sanitizeEmDashes(categoryIntro))}
                </p>
            </header>

${categoryHowToHtml}
            <!-- Symbol Grid -->
            <section class="mb-16">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${symbolsHtml}
                </div>
            </section>

            <!-- Other Categories -->
            <section class="mb-16">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-6 flex items-center gap-3">
                    <i data-lucide="grid-3x3" class="w-6 h-6 text-dream-salmon"></i>
                    ${t.other_categories}
                </h2>
                <div class="flex flex-wrap gap-3">${otherCategoriesHtml}
                </div>
            </section>
${relatedGuidesHtml}
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

        </div>
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

// Generate all category pages
function generateCategoryPages(symbols, i18n, languages) {
  console.log('\n📁 Generating category pages...\n');

  // Load curation pages for cross-linking (graceful if missing)
  let curationPages = [];
  try {
    const curationData = loadCurationData();
    curationPages = curationData.pages || [];
  } catch (e) {
    console.log('ℹ️  No curation-pages.json found, skipping related guides in category pages.');
  }

  // Group symbols by category
  const categoriesMap = {};
  for (const symbol of symbols.symbols) {
    const cat = symbol.category;
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = [];
    }
    categoriesMap[cat].push(symbol);
  }

  // Build allCategories array for cross-linking
  const allCategories = Object.keys(categoriesMap).map(id => ({
    id,
    count: categoriesMap[id].length
  }));

  let generated = 0;
  let errors = 0;

  // Generate pages
  for (const lang of languages) {
    const langDir = path.join(CONFIG.outputDir, lang, CONFIG.symbolsPath[lang]);

    // Create directory if not dry run
    if (!args['dry-run']) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    for (const categoryId of Object.keys(categoriesMap)) {
      const symbolsInCategory = categoriesMap[categoryId];
      const categorySlug = i18n[lang].category_slugs?.[categoryId];

      if (!categorySlug) {
        console.log(`⚠️  Skipping category ${categoryId} for ${lang} (no slug)`);
        errors++;
        continue;
      }

      const filename = `${categorySlug}.html`;
      const filepath = path.join(langDir, filename);

      try {
        const html = generateCategoryPage(categoryId, symbolsInCategory, allCategories, i18n, lang, curationPages);

        if (args['dry-run']) {
          console.log(`  [DRY RUN] Would create: ${filepath}`);
        } else {
          fs.writeFileSync(filepath, html, 'utf8');
          console.log(`  ✅ ${lang}/${CONFIG.symbolsPath[lang]}/${filename} (${symbolsInCategory.length} symbols)`);
        }
        generated++;
      } catch (err) {
        console.error(`  ❌ Error generating category ${categoryId} (${lang}): ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n✨ Category pages done! Generated ${generated} pages, ${errors} errors.`);
  return { generated, errors };
}

// =====================================================
// CURATION PAGES GENERATION
// =====================================================

function loadCurationData() {
  const curationPath = path.join(CONFIG.dataDir, 'curation-pages.json');
  if (!fs.existsSync(curationPath)) {
    console.error('Missing data/curation-pages.json');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(curationPath, 'utf8'));
}

function validateCurationDataOrExit(curationData, allSymbols) {
  const pages = Array.isArray(curationData?.pages) ? curationData.pages : [];
  const symbolIds = new Set((allSymbols || []).map(s => s.id));

  const problems = [];
  for (const page of pages) {
    const pageId = page?.id || '(unknown-page-id)';
    const ids = Array.isArray(page?.symbols) ? page.symbols : [];
    const missing = ids.filter(id => !symbolIds.has(id));
    if (missing.length > 0) {
      problems.push({ pageId, missing });
    }
  }

  if (problems.length === 0) return;

  // Fail fast: otherwise we silently drop missing symbols and render inconsistent counts.
  console.error('\n❌ Invalid data/curation-pages.json: unknown symbol ids referenced:\n');
  for (const p of problems) {
    console.error(`- ${p.pageId}: ${p.missing.join(', ')}`);
  }
  console.error('\nFix by adding the missing symbols to data/dream-symbols.json (and ideally data/dream-symbols-extended.json), or removing them from curation-pages.json.\n');
  process.exit(1);
}

// Generate hreflang URLs for a curation page
function generateCurationHreflangUrls(page) {
  const urls = {};
  for (const l of CONFIG.languages) {
    if (page.slugs[l]) {
      urls[l] = `https://noctalia.app/${l}/guides/${page.slugs[l]}`;
    }
  }
  return urls;
}

// Generate a single curation page HTML
function generateCurationPage(page, allSymbols, i18n, extended, lang) {
  const t = i18n[lang];
  const pageData = { ...page[lang], metaDescription: truncateMetaDescription(page[lang].metaDescription) };
  const slug = page.slugs[lang];
  const hreflang = generateCurationHreflangUrls(page);
  const symbolsCount = page.symbols.length;

  // Resolve symbols
  const resolvedSymbols = page.symbols
    .map(id => allSymbols.find(s => s.id === id))
    .filter(Boolean);

  // Safety net: keep counts and rendered content consistent.
  if (resolvedSymbols.length !== symbolsCount) {
    const resolvedIds = new Set(resolvedSymbols.map(s => s.id));
    const missing = page.symbols.filter(id => !resolvedIds.has(id));
    throw new Error(`Curation "${page.id}" references unknown symbols: ${missing.join(', ')}`);
  }

  // Language dropdown
  const langItems = {
    en: { flag: '🇺🇸', name: 'English' },
    fr: { flag: '🇫🇷', name: 'Français' },
    es: { flag: '🇪🇸', name: 'Español' },
    de: { flag: '🇩🇪', name: 'Deutsch' },
    it: { flag: '🇮🇹', name: 'Italiano' }
  };

  const langDropdownHtml = Object.keys(langItems).map(l => {
    const isActive = l === lang;
    const targetSlug = page.slugs[l];
    const activeClass = isActive ? 'text-dream-salmon bg-dream-salmon/10' : 'text-purple-100/80 hover:text-white hover:bg-white/5';
    return `
                        <a href="/${l}/guides/${targetSlug}" hreflang="${l}" class="flex items-center gap-3 px-4 py-2 text-sm ${activeClass} transition-colors" role="menuitem">
                            <span class="w-5 text-center">${langItems[l].flag}</span> ${langItems[l].name}
                        </a>`;
  }).join('\n');

  // Generate symbol cards
  const symbolCardsHtml = resolvedSymbols.map((s, i) => {
    const symbolData = s[lang];
    if (!symbolData) return '';
    const extContent = getExtendedContent(s.id, extended, lang);
    const firstVariation = extContent.variations.length > 0 ? extContent.variations[0] : null;
    return `
                    <a href="/${lang}/${CONFIG.symbolsPath[lang]}/${symbolData.slug}" class="symbol-card glass-panel rounded-2xl p-6 border border-transparent group">
                        <div class="flex items-start justify-between mb-3">
                            <h2 class="font-serif text-xl text-dream-cream group-hover:text-dream-salmon transition-colors">${i + 1}. ${escapeHtml(symbolData.name)}</h2>
                        </div>
                        <p class="text-sm text-gray-400 leading-relaxed mb-3 line-clamp-3">${escapeHtml(symbolData.shortDescription)}</p>
                        ${firstVariation ? `<p class="text-xs text-purple-300/60 italic mb-3"><strong>${escapeHtml(firstVariation.context)}:</strong> ${escapeHtml(firstVariation.meaning.substring(0, 120))}${firstVariation.meaning.length > 120 ? '...' : ''}</p>` : ''}
                        <span class="inline-flex items-center gap-2 text-xs text-dream-salmon opacity-0 group-hover:opacity-100 transition-opacity">
                            ${t.curation_read_full} <i data-lucide="arrow-right" class="w-3 h-3"></i>
                        </span>
                    </a>`;
  }).join('\n');

  // Schema.org ItemList
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: pageData.title,
    description: pageData.metaDescription,
    numberOfItems: symbolsCount,
    itemListElement: resolvedSymbols.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s[lang]?.name || s.id,
      url: `https://noctalia.app/${lang}/${CONFIG.symbolsPath[lang]}/${s[lang]?.slug || s.id}`
    }))
  };

  const guideHowToTitles = {
    en: 'How to use this guide',
    fr: 'Comment utiliser ce guide',
    es: 'Cómo usar esta guía',
    de: 'So nutzt du diese Anleitung',
    it: 'Come usare questa guida'
  };

  const guideHowToParagraphs = {
    en: [
      'Use this list as a starting point. The symbol meaning depends on your context, your emotions, and what is happening in your life right now.',
      'A simple approach is to pick one symbol that stood out, then compare it to a recent situation. Write one or two sentences about what feels similar.'
    ],
    fr: [
      "Utilisez cette liste comme point de départ. La signification d'un symbole dépend de votre contexte, de vos émotions et de ce qui se passe dans votre vie en ce moment.",
      "Une approche simple consiste à choisir un symbole marquant, puis à le relier à une situation récente. Écrivez une ou deux phrases sur ce qui vous semble similaire."
    ],
    es: [
      'Usa esta lista como punto de partida. El significado de un símbolo depende de tu contexto, tus emociones y lo que ocurre en tu vida ahora.',
      'Una forma sencilla es elegir un símbolo que destaque y compararlo con una situación reciente. Escribe una o dos frases sobre lo que se siente parecido.'
    ],
    de: [
      'Nutze diese Liste als Ausgangspunkt. Die Bedeutung eines Symbols hängt von deinem Kontext, deinen Emotionen und dem ab, was gerade in deinem Leben passiert.',
      'Eine einfache Methode ist, ein Symbol auszuwählen, das heraussticht, und es mit einer aktuellen Situation zu verbinden. Schreibe ein oder zwei Sätze dazu.'
    ],
    it: [
      'Usa questa lista come punto di partenza. Il significato di un simbolo dipende dal tuo contesto, dalle tue emozioni e da ciò che sta succedendo nella tua vita in questo periodo.',
      'Un modo semplice è scegliere un simbolo che ti è rimasto impresso e confrontarlo con una situazione recente. Scrivi una o due frasi su cosa ti sembra simile.'
    ]
  };

  const guideHowToBullets = {
    en: ['Note the strongest emotion in the dream.', 'Look for one real-life trigger from the last few days.', 'Use the questions on each symbol page to go deeper.'],
    fr: ["Notez l'émotion la plus forte du rêve.", 'Cherchez un déclencheur récent dans les derniers jours.', 'Utilisez les questions sur chaque page de symbole pour aller plus loin.'],
    es: ['Anota la emoción más fuerte del sueño.', 'Busca un desencadenante reciente de los últimos días.', 'Usa las preguntas de cada símbolo para profundizar.'],
    de: ['Notiere die stärkste Emotion im Traum.', 'Suche nach einem Auslöser aus den letzten Tagen.', 'Nutze die Fragen auf jeder Symbolseite, um tiefer zu gehen.'],
    it: ["Annota l'emozione più forte del sogno.", 'Cerca un possibile trigger degli ultimi giorni.', 'Usa le domande nelle pagine dei simboli per andare più a fondo.']
  };

  const guideHowToHtml = `
            <!-- How to use -->
            <section class="glass-panel rounded-2xl p-6 md:p-8 mb-12 border border-dream-salmon/10">
                <h2 class="font-serif text-xl md:text-2xl text-dream-cream mb-4 flex items-center gap-3">
                    <i data-lucide="map" class="w-6 h-6 text-dream-salmon"></i>
                    ${escapeHtml(guideHowToTitles[lang] || guideHowToTitles.en)}
                </h2>
                <div class="prose prose-invert prose-purple max-w-none text-gray-300 leading-relaxed space-y-4">
                    <p>${escapeHtml(guideHowToParagraphs[lang]?.[0] || guideHowToParagraphs.en[0])}</p>
                    <p>${escapeHtml(guideHowToParagraphs[lang]?.[1] || guideHowToParagraphs.en[1])}</p>
                    <ul>${(guideHowToBullets[lang] || guideHowToBullets.en).map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
                </div>
            </section>`;

  // Schema.org BreadcrumbList
  const breadcrumbListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `https://noctalia.app/${lang}/` },
      { '@type': 'ListItem', position: 2, name: t.symbols, item: `https://noctalia.app/${lang}/guides/${t.dictionary_slug}` },
      { '@type': 'ListItem', position: 3, name: pageData.title, item: `https://noctalia.app/${lang}/guides/${slug}` }
    ]
  };

  // Schema.org Article
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: pageData.title,
    description: pageData.metaDescription,
    image: `https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg`,
    author: { '@type': 'Organization', name: 'Noctalia' },
    publisher: {
      '@type': 'Organization',
      name: 'Noctalia',
      logo: { '@type': 'ImageObject', url: 'https://noctalia.app/logo/logo_noctalia.png' }
    },
    datePublished: CONFIG.datePublished,
    dateModified: CONFIG.dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://noctalia.app/${lang}/guides/${slug}` },
    inLanguage: lang
  };

  return `<!DOCTYPE html>
<html lang="${lang}" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(pageData.title)} | Noctalia</title>
    <meta name="description" content="${escapeHtml(pageData.metaDescription)}">
    <link rel="canonical" href="https://noctalia.app/${lang}/guides/${slug}">
${CONFIG.languages.filter(l => hreflang[l]).map(l => `    <link rel="alternate" hreflang="${l}" href="${hreflang[l]}">`).join('\n')}
    <link rel="alternate" hreflang="x-default" href="${hreflang.en}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="64x64 48x48 32x32 16x16">
    <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">
    <link rel="apple-touch-icon" href="/logo192.png" sizes="192x192">

    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(pageData.title)}">
    <meta property="og:description" content="${escapeHtml(pageData.metaDescription)}">
    <meta property="og:url" content="https://noctalia.app/${lang}/guides/${slug}">
    <meta property="og:image" content="https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(pageData.title)}">
    <meta property="og:locale" content="${t.locale}">
${CONFIG.languages.filter(l => l !== lang).map(l => `    <meta property="og:locale:alternate" content="${{ en: 'en_US', fr: 'fr_FR', es: 'es_ES', de: 'de_DE', it: 'it_IT' }[l]}">`).join('\n')}
    <meta property="article:published_time" content="${CONFIG.datePublished}">
    <meta property="article:modified_time" content="${CONFIG.dateModified}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(pageData.title)}">
    <meta name="twitter:description" content="${escapeHtml(pageData.metaDescription)}">
    <meta name="twitter:image" content="https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg">
    <meta name="twitter:site" content="@NoctaliaDreams">
    <meta name="twitter:image:alt" content="${escapeHtml(pageData.title)}">

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
        .symbol-card { transition: all 0.3s ease; }
        .symbol-card:hover { transform: translateY(-4px); border-color: rgba(253, 164, 129, 0.3); }
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    </style>

    <!-- Schema.org ItemList -->
${renderJsonLd(itemListJsonLd)}

    <!-- Schema.org Article -->
${renderJsonLd(articleJsonLd)}

    <!-- Schema.org BreadcrumbList -->
${renderJsonLd(breadcrumbListJsonLd)}
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
        <div class="max-w-5xl mx-auto">

            <!-- Breadcrumb -->
            <nav class="text-sm text-purple-200/60 mb-8" aria-label="Breadcrumb">
                <ol class="flex items-center gap-2 flex-wrap">
                    <li>
                        <a href="/${lang}/" class="hover:text-dream-salmon transition-colors">${t.home}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <a href="/${lang}/guides/${t.dictionary_slug}" class="hover:text-dream-salmon transition-colors">${t.symbols}</a>
                    </li>
                    <li class="text-purple-400">/</li>
                    <li>
                        <span class="text-dream-cream">${escapeHtml(pageData.title)}</span>
                    </li>
                </ol>
            </nav>

            <!-- Header -->
            <header class="mb-12 text-center">
                <div class="flex justify-center gap-3 mb-6">
                    <span class="inline-flex items-center gap-2 text-xs font-mono text-dream-salmon border border-dream-salmon/30 rounded-full px-4 py-2">
                        <i data-lucide="list" class="w-4 h-4"></i>
                        ${t.curation_label}
                    </span>
                    <span class="inline-flex items-center gap-2 text-xs font-mono text-purple-200/70 border border-white/10 rounded-full px-4 py-2">
                        ${t.curation_symbols_count.replace('{count}', symbolsCount)}
                    </span>
                </div>

                <h1 class="font-serif text-3xl md:text-5xl mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white via-dream-lavender to-purple-400/50 leading-tight">
                    ${escapeHtml(pageData.title)}
                </h1>

                <p class="text-lg text-purple-200/80 leading-relaxed max-w-3xl mx-auto">
                    ${escapeHtml(sanitizeEmDashes(pageData.intro))}
                </p>
            </header>

${guideHowToHtml}
            <!-- Symbol Grid -->
            <section class="mb-16">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${symbolCardsHtml}
                </div>
            </section>

            <!-- Outro -->
            <section class="glass-panel rounded-2xl p-6 md:p-8 mb-10">
                <div class="prose prose-invert prose-purple max-w-none text-gray-300 leading-relaxed">
                    <p>${escapeHtml(sanitizeEmDashes(pageData.outro))}</p>
                </div>
            </section>

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

        </div>
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

// Generate all curation pages
function generateCurationPages(symbols, i18n, extended, languages) {
  console.log('\n📋 Generating curation pages...\n');

  const curationData = loadCurationData();
  validateCurationDataOrExit(curationData, symbols.symbols);
  let generated = 0;
  let errors = 0;

  for (const lang of languages) {
    const langDir = path.join(CONFIG.outputDir, lang, 'guides');

    if (!args['dry-run']) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    for (const page of curationData.pages) {
      const slug = page.slugs[lang];
      if (!slug) {
        console.log(`⚠️  Skipping curation ${page.id} for ${lang} (no slug)`);
        errors++;
        continue;
      }

      const filename = `${slug}.html`;
      const filepath = path.join(langDir, filename);

      try {
        const html = generateCurationPage(page, symbols.symbols, i18n, extended, lang);

        if (args['dry-run']) {
          console.log(`  [DRY RUN] Would create: ${filepath}`);
        } else {
          fs.writeFileSync(filepath, html, 'utf8');
          console.log(`  ✅ ${lang}/guides/${filename} (${page.symbols.length} symbols)`);
        }
        generated++;
      } catch (err) {
        console.error(`  ❌ Error generating curation ${page.id} (${lang}): ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n✨ Curation pages done! Generated ${generated} pages, ${errors} errors.`);
  return { generated, errors };
}

// =====================================================
// CATEGORY PAGES: RELATED GUIDES CROSS-LINKS (Phase 3)
// =====================================================

// Map categories to relevant curation page IDs
const CATEGORY_TO_CURATION = {
  animals: ['animal-dream-symbols', 'scary-dream-symbols', 'most-common-dream-symbols'],
  nature: ['water-dream-symbols', 'most-common-dream-symbols'],
  body: ['scary-dream-symbols', 'most-common-dream-symbols', 'death-transformation-dreams'],
  places: ['dream-locations', 'most-common-dream-symbols'],
  objects: ['most-common-dream-symbols', 'dream-locations'],
  actions: ['scary-dream-symbols', 'most-common-dream-symbols', 'positive-dream-symbols'],
  people: ['people-in-dreams', 'death-transformation-dreams', 'positive-dream-symbols'],
  celestial: ['positive-dream-symbols', 'death-transformation-dreams']
};

// Run
if (args.curation) {
  // Generate only curation pages
  const { symbols, i18n, extended } = loadData();
  let languages = CONFIG.languages;
  if (args.lang) {
    languages = [args.lang];
  }
  generateCurationPages(symbols, i18n, extended, languages);
} else if (args.categories) {
  // Generate only category pages
  const { symbols, i18n } = loadData();
  let languages = CONFIG.languages;
  if (args.lang) {
    languages = [args.lang];
  }
  generateCategoryPages(symbols, i18n, languages);
} else {
  main();
}
