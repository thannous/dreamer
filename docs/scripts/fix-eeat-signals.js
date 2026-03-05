#!/usr/bin/env node
/**
 * fix-eeat-signals.js — Improve E-E-A-T signals across the Noctalia docs site
 *
 * Fixes:
 * 1. Add author byline to all blog articles (130 files)
 * 2. Add a short "Quick answer" block to all blog articles
 * 3. Add editorial review callouts to health-adjacent articles
 * 4. Update JSON-LD author from Organization to Person + Organization (130 files)
 * 5. Update article:author meta tag from "Noctalia" to "Thanh Chau" (130 files)
 * 6. Expand editorial process section on about pages (5 files)
 * 7. Add founder bio section to about pages (5 files)
 * 8. Update AboutPage JSON-LD schema with founder Person (5 files)
 *
 * Run: node scripts/fix-eeat-signals.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const DOCS_ROOT = path.resolve(__dirname, '..');

const LANGS = ['en', 'fr', 'es', 'de', 'it'];

// ─── About page paths per language ───
const ABOUT_PAGES = {
  en: 'en/about.html',
  fr: 'fr/a-propos.html',
  es: 'es/sobre.html',
  de: 'de/ueber-uns.html',
  it: 'it/chi-siamo.html',
};

const ABOUT_URLS = {
  en: '/en/about',
  fr: '/fr/a-propos',
  es: '/es/sobre',
  de: '/de/ueber-uns',
  it: '/it/chi-siamo',
};

// ─── Translations ───
const T = {
  en: {
    bylineName: 'Thanh Chau',
    bylineRole: 'Founder & Publication Director',
    bylineLink: 'About our editorial process',
    quickAnswerTitle: 'Quick answer',
    reviewTitle: 'Editorial review',
    reviewBody: 'This health-related page was reviewed for clarity and source accuracy against the references cited on the page. It is informational and does not replace medical advice.',
    reviewLink: 'Learn how we review sensitive topics',
    founderTitle: 'Our founder',
    founderName: 'Thanh Chau',
    founderRole: 'Founder & Publication Director',
    founderBio: 'Software engineer and dream journaling enthusiast who created Noctalia to help people capture and understand their dreams. Thanh oversees editorial direction and ensures all content meets quality standards grounded in sleep research.',
    editorialTitle: 'How we create our resources',
    editorialIntro: 'Our blog articles and guides are written to be clear, practical, and grounded in well-established concepts from sleep research and psychology.',
    editorialResearchTitle: 'Research-based writing',
    editorialResearchDesc: 'We consult peer-reviewed studies, clinical guidelines, and established works in dream psychology. When referencing research, we link to the original source (PubMed, APA, university publications).',
    editorialExpertTitle: 'Expert citations',
    editorialExpertDesc: 'Our articles cite named researchers and their institutional affiliations — including sleep scientists, psychologists, and dream researchers from Harvard, APA, and other institutions.',
    editorialUpdateTitle: 'Regular updates',
    editorialUpdateDesc: 'Articles are reviewed and updated to reflect new findings. Each article displays its publication and last-modified dates.',
    editorialBoundaryTitle: 'Clear boundaries',
    editorialBoundaryDesc: 'We distinguish informational content from medical advice. Every article includes a disclaimer, and health-related topics always recommend consulting a qualified professional.',
    editorialDisclaimer: '<strong>Important:</strong> Our content is for informational purposes only and does not replace medical advice.',
  },
  fr: {
    bylineName: 'Thanh Chau',
    bylineRole: 'Fondateur & Directeur de la publication',
    bylineLink: 'Notre processus \u00e9ditorial',
    quickAnswerTitle: 'R\u00e9ponse rapide',
    reviewTitle: 'Relecture \u00e9ditoriale',
    reviewBody: 'Cette page li\u00e9e \u00e0 la sant\u00e9 a \u00e9t\u00e9 relue pour la clart\u00e9 et la fiabilit\u00e9 des sources \u00e0 partir des r\u00e9f\u00e9rences cit\u00e9es sur la page. Elle est informative et ne remplace pas un avis m\u00e9dical.',
    reviewLink: 'Voir notre m\u00e9thode de relecture',
    founderTitle: 'Notre fondateur',
    founderName: 'Thanh Chau',
    founderRole: 'Fondateur & Directeur de la publication',
    founderBio: "Ing\u00e9nieur logiciel et passionn\u00e9 de journal de r\u00eaves, Thanh a cr\u00e9\u00e9 Noctalia pour aider chacun \u00e0 capturer et comprendre ses r\u00eaves. Il supervise la direction \u00e9ditoriale et veille \u00e0 la qualit\u00e9 des contenus, fond\u00e9s sur la recherche sur le sommeil.",
    editorialTitle: 'Notre approche \u00e9ditoriale',
    editorialIntro: 'Nos articles et guides visent \u00e0 \u00eatre clairs, pratiques et bas\u00e9s sur des notions \u00e9tablies en recherche sur le sommeil et en psychologie.',
    editorialResearchTitle: 'R\u00e9daction bas\u00e9e sur la recherche',
    editorialResearchDesc: 'Nous consultons des \u00e9tudes \u00e9valu\u00e9es par des pairs, des directives cliniques et des ouvrages reconnus en psychologie du r\u00eave. Lorsque nous citons des recherches, nous renvoyons vers la source originale (PubMed, APA, publications universitaires).',
    editorialExpertTitle: 'Citations d\u2019experts',
    editorialExpertDesc: 'Nos articles citent des chercheurs nomm\u00e9s et leurs affiliations institutionnelles \u2014 sp\u00e9cialistes du sommeil, psychologues et chercheurs sur les r\u00eaves de Harvard, de l\u2019APA et d\u2019autres institutions.',
    editorialUpdateTitle: 'Mises \u00e0 jour r\u00e9guli\u00e8res',
    editorialUpdateDesc: 'Les articles sont r\u00e9vis\u00e9s et mis \u00e0 jour pour refl\u00e9ter les nouvelles d\u00e9couvertes. Chaque article affiche ses dates de publication et de derni\u00e8re modification.',
    editorialBoundaryTitle: 'Limites claires',
    editorialBoundaryDesc: 'Nous distinguons le contenu informatif du conseil m\u00e9dical. Chaque article inclut un avertissement, et les sujets li\u00e9s \u00e0 la sant\u00e9 recommandent toujours de consulter un professionnel qualifi\u00e9.',
    editorialDisclaimer: '<strong>Important\u00a0:</strong> nos contenus sont fournis \u00e0 titre informatif et ne remplacent pas un avis m\u00e9dical.',
  },
  es: {
    bylineName: 'Thanh Chau',
    bylineRole: 'Fundador y Director de publicaci\u00f3n',
    bylineLink: 'Nuestro proceso editorial',
    quickAnswerTitle: 'Respuesta r\u00e1pida',
    reviewTitle: 'Revisi\u00f3n editorial',
    reviewBody: 'Esta p\u00e1gina relacionada con la salud fue revisada para verificar claridad y fiabilidad de las fuentes a partir de las referencias citadas en la propia p\u00e1gina. Tiene fines informativos y no sustituye el asesoramiento m\u00e9dico.',
    reviewLink: 'C\u00f3mo revisamos los temas sensibles',
    founderTitle: 'Nuestro fundador',
    founderName: 'Thanh Chau',
    founderRole: 'Fundador y Director de publicaci\u00f3n',
    founderBio: 'Ingeniero de software y entusiasta del diario de sue\u00f1os que cre\u00f3 Noctalia para ayudar a las personas a capturar y comprender sus sue\u00f1os. Thanh supervisa la direcci\u00f3n editorial y garantiza que todo el contenido cumpla est\u00e1ndares de calidad basados en la investigaci\u00f3n del sue\u00f1o.',
    editorialTitle: 'C\u00f3mo creamos nuestros recursos',
    editorialIntro: 'Nuestros art\u00edculos y gu\u00edas buscan ser claros, pr\u00e1cticos y basados en conceptos consolidados de investigaci\u00f3n del sue\u00f1o y psicolog\u00eda.',
    editorialResearchTitle: 'Redacci\u00f3n basada en investigaci\u00f3n',
    editorialResearchDesc: 'Consultamos estudios revisados por pares, gu\u00edas cl\u00ednicas y obras reconocidas en psicolog\u00eda del sue\u00f1o. Al citar investigaciones, enlazamos a la fuente original (PubMed, APA, publicaciones universitarias).',
    editorialExpertTitle: 'Citas de expertos',
    editorialExpertDesc: 'Nuestros art\u00edculos citan investigadores con nombre y afiliaci\u00f3n institucional \u2014 cient\u00edficos del sue\u00f1o, psic\u00f3logos e investigadores de Harvard, APA y otras instituciones.',
    editorialUpdateTitle: 'Actualizaciones regulares',
    editorialUpdateDesc: 'Los art\u00edculos se revisan y actualizan para reflejar nuevos hallazgos. Cada art\u00edculo muestra sus fechas de publicaci\u00f3n y \u00faltima modificaci\u00f3n.',
    editorialBoundaryTitle: 'L\u00edmites claros',
    editorialBoundaryDesc: 'Distinguimos el contenido informativo del consejo m\u00e9dico. Cada art\u00edculo incluye un aviso, y los temas relacionados con la salud siempre recomiendan consultar a un profesional cualificado.',
    editorialDisclaimer: '<strong>Importante:</strong> el contenido es informativo y no sustituye asesoramiento m\u00e9dico.',
  },
  de: {
    bylineName: 'Thanh Chau',
    bylineRole: 'Gr\u00fcnder & Verantwortlicher',
    bylineLink: 'Unser redaktioneller Prozess',
    quickAnswerTitle: 'Kurzantwort',
    reviewTitle: 'Redaktionelle Pr\u00fcfung',
    reviewBody: 'Diese gesundheitsbezogene Seite wurde anhand der auf der Seite zitierten Quellen auf Klarheit und Quellenzuverl\u00e4ssigkeit gepr\u00fcft. Sie dient nur der Information und ersetzt keine medizinische Beratung.',
    reviewLink: 'Wie wir sensible Themen pr\u00fcfen',
    founderTitle: 'Unser Gr\u00fcnder',
    founderName: 'Thanh Chau',
    founderRole: 'Gr\u00fcnder & Verantwortlicher',
    founderBio: 'Softwareentwickler und begeisterter Traumtagebuch-Nutzer, der Noctalia ins Leben gerufen hat, um Menschen zu helfen, ihre Tr\u00e4ume festzuhalten und zu verstehen. Thanh leitet die redaktionelle Ausrichtung und stellt sicher, dass alle Inhalte Qualit\u00e4tsstandards aus der Schlafforschung erf\u00fcllen.',
    editorialTitle: 'Wie wir unsere Inhalte erstellen',
    editorialIntro: 'Unsere Artikel und Guides sollen klar, praktisch und an etablierten Konzepten aus Schlafforschung und Psychologie orientiert sein.',
    editorialResearchTitle: 'Forschungsbasiertes Schreiben',
    editorialResearchDesc: 'Wir konsultieren begutachtete Studien, klinische Leitlinien und anerkannte Werke der Traumpsychologie. Bei Verweisen auf Forschung verlinken wir zur Originalquelle (PubMed, APA, universit\u00e4re Publikationen).',
    editorialExpertTitle: 'Expertenzitate',
    editorialExpertDesc: 'Unsere Artikel zitieren namentlich genannte Forscher und deren institutionelle Zugeh\u00f6rigkeit \u2014 darunter Schlafwissenschaftler, Psychologen und Traumforscher von Harvard, APA und anderen Institutionen.',
    editorialUpdateTitle: 'Regelm\u00e4\u00dfige Aktualisierungen',
    editorialUpdateDesc: 'Artikel werden \u00fcberpr\u00fcft und aktualisiert, um neue Erkenntnisse widerzuspiegeln. Jeder Artikel zeigt sein Ver\u00f6ffentlichungs- und \u00c4nderungsdatum.',
    editorialBoundaryTitle: 'Klare Grenzen',
    editorialBoundaryDesc: 'Wir unterscheiden informativen Inhalt von medizinischer Beratung. Jeder Artikel enth\u00e4lt einen Hinweis, und gesundheitsbezogene Themen empfehlen stets die Konsultation eines qualifizierten Fachmanns.',
    editorialDisclaimer: '<strong>Wichtig:</strong> Unsere Inhalte dienen nur der Information und ersetzen keine medizinische Beratung.',
  },
  it: {
    bylineName: 'Thanh Chau',
    bylineRole: 'Fondatore e Direttore della pubblicazione',
    bylineLink: 'Il nostro processo editoriale',
    quickAnswerTitle: 'Risposta rapida',
    reviewTitle: 'Revisione editoriale',
    reviewBody: 'Questa pagina legata alla salute \u00e8 stata rivista per chiarezza e affidabilit\u00e0 delle fonti sulla base dei riferimenti citati nella pagina. Ha finalit\u00e0 informative e non sostituisce il parere medico.',
    reviewLink: 'Come revisioniamo i temi sensibili',
    founderTitle: 'Il nostro fondatore',
    founderName: 'Thanh Chau',
    founderRole: 'Fondatore e Direttore della pubblicazione',
    founderBio: 'Ingegnere del software e appassionato di diario dei sogni, Thanh ha creato Noctalia per aiutare le persone a catturare e comprendere i propri sogni. Supervisiona la direzione editoriale e garantisce che tutti i contenuti rispettino standard di qualit\u00e0 basati sulla ricerca del sonno.',
    editorialTitle: 'Come creiamo le nostre risorse',
    editorialIntro: 'I nostri articoli e guide sono pensati per essere chiari, pratici e basati su concetti consolidati di ricerca sul sonno e psicologia.',
    editorialResearchTitle: 'Scrittura basata sulla ricerca',
    editorialResearchDesc: 'Consultiamo studi sottoposti a revisione paritaria, linee guida cliniche e opere riconosciute in psicologia del sogno. Quando citiamo ricerche, rimandiamo alla fonte originale (PubMed, APA, pubblicazioni universitarie).',
    editorialExpertTitle: 'Citazioni di esperti',
    editorialExpertDesc: 'I nostri articoli citano ricercatori con nome e affiliazione istituzionale \u2014 scienziati del sonno, psicologi e ricercatori di Harvard, APA e altre istituzioni.',
    editorialUpdateTitle: 'Aggiornamenti regolari',
    editorialUpdateDesc: 'Gli articoli vengono rivisti e aggiornati per riflettere nuove scoperte. Ogni articolo mostra le date di pubblicazione e ultima modifica.',
    editorialBoundaryTitle: 'Confini chiari',
    editorialBoundaryDesc: 'Distinguiamo il contenuto informativo dalla consulenza medica. Ogni articolo include un avviso, e gli argomenti legati alla salute raccomandano sempre di consultare un professionista qualificato.',
    editorialDisclaimer: '<strong>Importante:</strong> i contenuti sono informativi e non sostituiscono un parere medico.',
  },
};

const SENSITIVE_SLUG_PATTERNS = {
  en: /(dreams-mental-health|sleep-paralysis-guide|stop-nightmares-guide|rem-sleep-dreams)$/i,
  fr: /(reves-sante-mentale|guide-paralysie-sommeil|guide-cauchemars|sommeil-paradoxal-reves)$/i,
  es: /(suenos-salud-mental|guia-paralisis-sueno|guia-pesadillas|sueno-rem-suenos)$/i,
  de: /(psychische-gesundheit|schlaflaehmung|albtraeume|rem-schlaf)$/i,
  it: /(salute-mentale|paralisi-del-sonno|incubi|sonno-rem)$/i,
};

// ─── Stats ───
const stats = {
  blogBylineAdded: 0,
  blogQuickAnswerAdded: 0,
  blogEditorialReviewAdded: 0,
  blogAuthorSchemaUpdated: 0,
  blogArticleAuthorUpdated: 0,
  blogReviewSchemaAdded: 0,
  aboutEditorialExpanded: 0,
  aboutFounderAdded: 0,
  aboutSchemaUpdated: 0,
};

// ─── Helpers ───

function collectBlogFiles() {
  const files = [];
  for (const lang of LANGS) {
    const blogDir = path.join(DOCS_ROOT, lang, 'blog');
    if (!fs.existsSync(blogDir)) continue;
    for (const entry of fs.readdirSync(blogDir, { withFileTypes: true })) {
      if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
        files.push({ filePath: path.join(blogDir, entry.name), lang });
      }
    }
  }
  return files;
}

function detectLang(filePath) {
  const rel = path.relative(DOCS_ROOT, filePath);
  return rel.split(path.sep)[0];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractMetaDescription(html) {
  const nameFirst = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (nameFirst) return nameFirst[1];
  const contentFirst = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
  return contentFirst ? contentFirst[1] : null;
}

function extractCanonicalUrl(html) {
  const relFirst = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (relFirst) return relFirst[1];
  const hrefFirst = html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return hrefFirst ? hrefFirst[1] : null;
}

function extractPageTitle(html) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

function isSensitiveArticle(filePath, lang) {
  const slug = path.basename(filePath, '.html');
  const pattern = SENSITIVE_SLUG_PATTERNS[lang] || SENSITIVE_SLUG_PATTERNS.en;
  return pattern.test(slug);
}

function insertBeforeFirstMarker(html, block, markers) {
  for (const marker of markers) {
    if (html.includes(marker)) {
      return {
        html: html.replace(marker, `${block}\n${marker}`),
        inserted: true,
      };
    }
  }

  return { html, inserted: false };
}

// ─── Blog: Author Byline ───

function buildBylineHtml(lang) {
  const t = T[lang];
  const aboutUrl = ABOUT_URLS[lang];
  return `\n<!-- Author Byline (E-E-A-T) -->\n<div class="flex items-center gap-3 mb-8 text-sm text-purple-200/70">\n    <div class="w-10 h-10 rounded-full bg-dream-salmon/10 flex items-center justify-center flex-shrink-0">\n        <i data-lucide="pen-tool" class="w-5 h-5 text-dream-salmon"></i>\n    </div>\n    <div>\n        <span class="text-dream-cream font-medium">${t.bylineName}</span>\n        <span class="block text-xs text-purple-300/60">${t.bylineRole} &middot; <a href="${aboutUrl}" class="text-dream-salmon hover:underline">${t.bylineLink}</a></span>\n    </div>\n</div>`;
}

function buildQuickAnswerHtml(lang, description) {
  const t = T[lang];
  return `\n<!-- Quick Answer (AI SEO) -->\n<section class="glass-panel rounded-2xl p-6 mb-8 border border-dream-salmon/20 bg-white/5" aria-labelledby="quick-answer-title">\n    <h2 id="quick-answer-title" class="font-serif text-xl text-dream-cream mb-3">${t.quickAnswerTitle}</h2>\n    <p class="text-purple-100/80 leading-relaxed">${escapeHtml(description)}</p>\n</section>`;
}

function buildEditorialReviewHtml(lang) {
  const t = T[lang];
  const aboutUrl = ABOUT_URLS[lang];
  return `\n<!-- Editorial Review (E-E-A-T) -->\n<aside class="glass-panel rounded-2xl p-5 mb-8 border border-white/10 bg-white/5" role="note" aria-label="${t.reviewTitle}">\n    <p class="text-sm text-purple-100/80 leading-relaxed">\n        <strong class="text-dream-cream">${t.reviewTitle}:</strong>\n        ${t.reviewBody}\n        <a href="${aboutUrl}" class="text-dream-salmon hover:underline">${t.reviewLink}</a>.\n    </p>\n</aside>`;
}

// ─── Blog: JSON-LD Author ───

function buildAuthorJsonLd(lang) {
  const t = T[lang];
  const aboutUrl = `https://noctalia.app${ABOUT_URLS[lang]}`;
  return `"author": [\n    {\n        "@type": "Person",\n        "@id": "${aboutUrl}#person",\n        "name": "Thanh Chau",\n        "jobTitle": "${t.bylineRole}",\n        "url": "${aboutUrl}",\n        "worksFor": {\n            "@type": "Organization",\n            "@id": "https://noctalia.app/#organization",\n            "name": "Noctalia",\n            "url": "https://noctalia.app"\n        }\n    },\n    {\n        "@type": "Organization",\n        "@id": "https://noctalia.app/#organization",\n        "name": "Noctalia",\n        "url": "https://noctalia.app",\n        "logo": {\n            "@type": "ImageObject",\n            "url": "https://noctalia.app/logo/logo_noctalia.png"\n        }\n    }\n]`;
}

function buildReviewSchemaScript(lang, canonicalUrl, title) {
  const reviewedPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonicalUrl,
    url: canonicalUrl,
    name: title,
    inLanguage: lang,
    reviewedBy: {
      '@type': 'Organization',
      '@id': 'https://noctalia.app/#organization',
      name: 'Noctalia',
      url: 'https://noctalia.app',
    },
  };

  return `<script type="application/ld+json">\n${JSON.stringify(reviewedPage, null, 4)}\n</script>`;
}

// ─── Blog: Fix a single blog article ───

function fixBlogArticle(filePath, lang) {
  let html = fs.readFileSync(filePath, 'utf-8');
  if (!html.includes('"@type": "BlogPosting"')) {
    return false;
  }

  let modified = false;
  const description = extractMetaDescription(html);
  const canonicalUrl = extractCanonicalUrl(html);
  const pageTitle = extractPageTitle(html);
  const sensitiveArticle = isSensitiveArticle(filePath, lang);
  const articleContentMarkers = ['<!-- Featured Image -->', '<!-- Table of Contents -->', '<!-- Article Content -->'];

  // 1. Add author byline after the article header.
  if (!html.includes('Author Byline (E-E-A-T)')) {
    const byline = buildBylineHtml(lang);
    if (html.includes('</header>')) {
      html = html.replace('</header>', `</header>${byline}`);
      modified = true;
      stats.blogBylineAdded++;
    }
  }

  // 2. Add a short answer-first block using the page description.
  if (description && !html.includes('Quick Answer (AI SEO)')) {
    const quickAnswer = buildQuickAnswerHtml(lang, description);
    const result = insertBeforeFirstMarker(html, quickAnswer, articleContentMarkers);
    html = result.html;
    if (result.inserted) {
      modified = true;
      stats.blogQuickAnswerAdded++;
    }
  }

  // 3. Add an editorial review callout on health-adjacent pages.
  if (sensitiveArticle && !html.includes('Editorial Review (E-E-A-T)')) {
    const editorialReview = buildEditorialReviewHtml(lang);
    const result = insertBeforeFirstMarker(html, editorialReview, articleContentMarkers);
    html = result.html;
    if (result.inserted) {
      modified = true;
      stats.blogEditorialReviewAdded++;
    }
  }

  // 4. Update JSON-LD author from Organization to Person + Organization.
  // Match the existing author block in BlogPosting schema
  const authorOrgPattern = /"author":\s*\{\s*\n\s*"@type":\s*"Organization",\s*\n\s*"name":\s*"Noctalia",\s*\n\s*"url":\s*"https:\/\/noctalia\.app",\s*\n\s*"logo":\s*\{\s*\n\s*"@type":\s*"ImageObject",\s*\n\s*"url":\s*"https:\/\/noctalia\.app\/logo\/logo_noctalia\.png"\s*\n\s*\}\s*\n\s*\}/;

  if (authorOrgPattern.test(html) && !html.includes('"@type": "Person"')) {
    const newAuthor = buildAuthorJsonLd(lang);
    html = html.replace(authorOrgPattern, newAuthor);
    modified = true;
      stats.blogAuthorSchemaUpdated++;
  }

  // 5. Update article:author meta tag.
  if (html.includes('<meta content="Noctalia" property="article:author"/>')) {
    html = html.replace(
      '<meta content="Noctalia" property="article:author"/>',
      '<meta content="Thanh Chau" property="article:author"/>'
    );
    modified = true;
    stats.blogArticleAuthorUpdated++;
  }

  // 6. Add WebPage.reviewedBy markup for health-adjacent pages.
  if (sensitiveArticle && html.includes('Editorial Review (E-E-A-T)') && canonicalUrl && pageTitle && !html.includes('"reviewedBy"')) {
    const blogSchemaPattern = /(<script type="application\/ld\+json">\s*\{[\s\S]*?"@type": "BlogPosting"[\s\S]*?<\/script>)/;
    if (blogSchemaPattern.test(html)) {
      const reviewSchema = buildReviewSchemaScript(lang, canonicalUrl, pageTitle);
      html = html.replace(blogSchemaPattern, `$1\n${reviewSchema}`);
      modified = true;
      stats.blogReviewSchemaAdded++;
    }
  }

  if (modified && !DRY_RUN) {
    fs.writeFileSync(filePath, html, 'utf-8');
  }

  return modified;
}

// ─── About Page: Editorial section ───

function buildEditorialSection(lang) {
  const t = T[lang];
  return `<section class="glass-panel p-8 rounded-2xl border border-white/10 bg-white/5">
                <h2 class="text-2xl font-serif text-white mb-4">${t.editorialTitle}</h2>
                <p>${t.editorialIntro}</p>
                <div class="mt-6 space-y-4">
                    <div class="flex items-start gap-3">
                        <i data-lucide="search" class="w-5 h-5 text-dream-salmon mt-0.5 flex-shrink-0"></i>
                        <div>
                            <h3 class="text-white font-medium mb-1">${t.editorialResearchTitle}</h3>
                            <p class="text-sm">${t.editorialResearchDesc}</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <i data-lucide="user-check" class="w-5 h-5 text-dream-salmon mt-0.5 flex-shrink-0"></i>
                        <div>
                            <h3 class="text-white font-medium mb-1">${t.editorialExpertTitle}</h3>
                            <p class="text-sm">${t.editorialExpertDesc}</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <i data-lucide="refresh-cw" class="w-5 h-5 text-dream-salmon mt-0.5 flex-shrink-0"></i>
                        <div>
                            <h3 class="text-white font-medium mb-1">${t.editorialUpdateTitle}</h3>
                            <p class="text-sm">${t.editorialUpdateDesc}</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <i data-lucide="shield-check" class="w-5 h-5 text-dream-salmon mt-0.5 flex-shrink-0"></i>
                        <div>
                            <h3 class="text-white font-medium mb-1">${t.editorialBoundaryTitle}</h3>
                            <p class="text-sm">${t.editorialBoundaryDesc}</p>
                        </div>
                    </div>
                </div>
                <p class="mt-6 text-sm text-purple-200/70">${t.editorialDisclaimer}</p>
            </section>`;
}

// ─── About Page: Founder bio ───

function buildFounderSection(lang) {
  const t = T[lang];
  return `<section class="glass-panel p-8 rounded-2xl border border-white/10 bg-white/5">
                <h2 class="text-2xl font-serif text-white mb-4">${t.founderTitle}</h2>
                <div class="flex items-start gap-4">
                    <div class="w-14 h-14 rounded-full bg-dream-salmon/10 flex items-center justify-center flex-shrink-0">
                        <i data-lucide="user" class="w-7 h-7 text-dream-salmon"></i>
                    </div>
                    <div>
                        <h3 class="text-white font-medium">${t.founderName}</h3>
                        <p class="text-sm text-dream-salmon mb-2">${t.founderRole}</p>
                        <p class="text-sm">${t.founderBio}</p>
                    </div>
                </div>
            </section>`;
}

// ─── About Page: JSON-LD schema update ───

function buildAboutSchema(lang) {
  const t = T[lang];
  const aboutUrl = `https://noctalia.app${ABOUT_URLS[lang]}`;
  const personId = `${aboutUrl}#person`;
  const organizationId = 'https://noctalia.app/#organization';

  const titles = {
    en: 'About Noctalia',
    fr: '\u00c0 propos de Noctalia',
    es: 'Sobre Noctalia',
    de: '\u00dcber Noctalia',
    it: 'Chi siamo',
  };

  const aboutSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AboutPage',
        name: titles[lang],
        url: aboutUrl,
        inLanguage: lang,
        about: { '@id': organizationId },
        mainEntity: { '@id': personId },
      },
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'Noctalia',
        url: 'https://noctalia.app',
        founder: { '@id': personId },
      },
      {
        '@type': 'Person',
        '@id': personId,
        name: 'Thanh Chau',
        jobTitle: t.founderRole,
        url: aboutUrl,
        worksFor: { '@id': organizationId },
        description: t.founderBio,
      },
    ],
  };

  return JSON.stringify(aboutSchema, null, 12);
}

// ─── About Page: Fix a single about page ───

function fixAboutPage(filePath, lang) {
  let html = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  const t = T[lang];

  // 1. Replace the editorial section with expanded version
  // Find the existing editorial section by its heading
  const editorialHeadingPattern = new RegExp(
    `<section class="glass-panel p-8 rounded-2xl border border-white/10 bg-white/5">\\s*` +
    `<h2 class="text-2xl font-serif text-white mb-4">${escapeRegex(t.editorialTitle)}</h2>[\\s\\S]*?</section>`
  );

  if (editorialHeadingPattern.test(html) && !html.includes('data-lucide="search"')) {
    const newEditorial = buildEditorialSection(lang);
    html = html.replace(editorialHeadingPattern, newEditorial);
    modified = true;
    stats.aboutEditorialExpanded++;
  }

  // 2. Add founder bio section after "Who we are" section, before editorial section
  if (!html.includes(t.founderTitle)) {
    // Find the end of the "Who we are" section (first </section> in the content area)
    // The structure is: Who we are section, then editorial section
    // We want to insert the founder bio between them
    const whoWeAreEndPattern = /<\/section>\s*\n\s*<section class="glass-panel p-8 rounded-2xl border border-white\/10 bg-white\/5">\s*\n\s*<h2 class="text-2xl font-serif text-white mb-4">/;

    // Find the editorial heading to locate insertion point
    const editorialSectionStart = html.indexOf(`<h2 class="text-2xl font-serif text-white mb-4">${t.editorialTitle}</h2>`);
    if (editorialSectionStart !== -1) {
      // Walk back to find the <section> tag before the editorial heading
      const beforeEditorial = html.lastIndexOf('<section class="glass-panel', editorialSectionStart);
      if (beforeEditorial !== -1) {
        // Find the </section> just before this <section>
        const closingSectionBefore = html.lastIndexOf('</section>', beforeEditorial);
        if (closingSectionBefore !== -1) {
          const insertPoint = closingSectionBefore + '</section>'.length;
          const founderHtml = '\n\n            ' + buildFounderSection(lang);
          html = html.slice(0, insertPoint) + founderHtml + html.slice(insertPoint);
          modified = true;
          stats.aboutFounderAdded++;
        }
      }
    }
  }

  // 3. Update AboutPage JSON-LD schema to include founder
  if (html.includes('"@type": "AboutPage"') && !html.includes('"founder"')) {
    const aboutSchemaPattern = /\{\s*\n\s*"@context":\s*"https:\/\/schema\.org",\s*\n\s*"@type":\s*"AboutPage",\s*\n\s*"name":\s*"[^"]+",\s*\n\s*"url":\s*"[^"]+",\s*\n\s*"inLanguage":\s*"[^"]+",\s*\n\s*"about":\s*\{\s*\n\s*"@type":\s*"Organization",\s*\n\s*"name":\s*"Noctalia",\s*\n\s*"url":\s*"https:\/\/noctalia\.app"\s*\n\s*\}\s*\n\s*\}/;

    if (aboutSchemaPattern.test(html)) {
      const newSchema = buildAboutSchema(lang);
      html = html.replace(aboutSchemaPattern, newSchema);
      modified = true;
      stats.aboutSchemaUpdated++;
    }
  }

  if (modified && !DRY_RUN) {
    fs.writeFileSync(filePath, html, 'utf-8');
  }

  return modified;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Main ───

console.log(`\nE-E-A-T Signals Fix Script${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log(`Root: ${DOCS_ROOT}\n`);

// Process blog articles
const blogFiles = collectBlogFiles();
console.log(`Found ${blogFiles.length} blog articles across ${LANGS.length} languages`);

let blogModified = 0;
for (const { filePath, lang } of blogFiles) {
  const wasModified = fixBlogArticle(filePath, lang);
  if (wasModified) {
    blogModified++;
    const rel = path.relative(DOCS_ROOT, filePath);
    if (DRY_RUN) console.log(`  [would fix] ${rel}`);
  }
}

// Process about pages
console.log(`\nProcessing ${Object.keys(ABOUT_PAGES).length} about pages`);

let aboutModified = 0;
for (const lang of LANGS) {
  const filePath = path.join(DOCS_ROOT, ABOUT_PAGES[lang]);
  if (!fs.existsSync(filePath)) {
    console.log(`  [skip] ${ABOUT_PAGES[lang]} — file not found`);
    continue;
  }
  const wasModified = fixAboutPage(filePath, lang);
  if (wasModified) {
    aboutModified++;
    if (DRY_RUN) console.log(`  [would fix] ${ABOUT_PAGES[lang]}`);
  }
}

// Report
console.log(`\n--- Results ---`);
console.log(`Blog articles modified:       ${blogModified}`);
console.log(`  Bylines added:              ${stats.blogBylineAdded}`);
console.log(`  Quick answers added:        ${stats.blogQuickAnswerAdded}`);
console.log(`  Editorial reviews added:    ${stats.blogEditorialReviewAdded}`);
console.log(`  JSON-LD author updated:     ${stats.blogAuthorSchemaUpdated}`);
console.log(`  article:author updated:     ${stats.blogArticleAuthorUpdated}`);
console.log(`  review schema added:        ${stats.blogReviewSchemaAdded}`);
console.log(`About pages modified:          ${aboutModified}`);
console.log(`  Editorial section expanded:  ${stats.aboutEditorialExpanded}`);
console.log(`  Founder bio added:           ${stats.aboutFounderAdded}`);
console.log(`  AboutPage schema updated:    ${stats.aboutSchemaUpdated}`);
console.log(DRY_RUN ? '\n(Dry run — no files were modified)' : '\nDone!');
