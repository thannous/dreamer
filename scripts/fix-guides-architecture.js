#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { SUPPORTED_LANGS, extractTitleTag, matchLineEndings } = require('./lib/docs-seo-utils');

const ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const DATA_DIR = path.join(DOCS_DIR, 'data');
const DOMAIN = 'https://noctalia.app';
const DRY_RUN = process.argv.includes('--dry-run');

const COPY = {
  en: { label: 'Dream Guides', title: 'Dream Guides & Symbol Meanings | Noctalia', desc: "Browse Noctalia's dream guides: the dictionary plus themed pages for common, scary, positive, water, people, places, and transformation dreams.", intro: 'Start with the full dream symbols dictionary, then explore themed guides that group related dream patterns and meanings.', dictionary: 'Dream Symbols Dictionary', openDictionary: 'Open dictionary', openGuide: 'Open guide', browseAll: 'Browse all dream guides' },
  fr: { label: 'Guides des reves', title: 'Guides des reves et symboles oniriques | Noctalia', desc: 'Parcourez les guides des reves de Noctalia : le dictionnaire des symboles et des pages thematiques sur les reves courants, effrayants, positifs, lies a l eau, aux personnes, aux lieux et a la transformation.', intro: 'Commencez par le dictionnaire complet des symboles, puis explorez des guides thematiques qui regroupent des motifs oniriques proches.', dictionary: 'Dictionnaire des symboles de reves', openDictionary: 'Ouvrir le dictionnaire', openGuide: 'Ouvrir le guide', browseAll: 'Parcourir tous les guides des reves' },
  es: { label: 'Guias de suenos', title: 'Guias de suenos y significados de simbolos | Noctalia', desc: 'Explora las guias de suenos de Noctalia: el diccionario de simbolos y paginas tematicas sobre suenos comunes, aterradores, positivos, de agua, de personas, de lugares y de transformacion.', intro: 'Empieza por el diccionario completo de simbolos y luego entra en guias tematicas que agrupan patrones y significados relacionados.', dictionary: 'Diccionario de simbolos de suenos', openDictionary: 'Abrir diccionario', openGuide: 'Abrir guia', browseAll: 'Ver todas las guias de suenos' },
  de: { label: 'Traumratgeber', title: 'Traumratgeber & Traumsymbole | Noctalia', desc: 'Entdecken Sie Noctalias Traumratgeber: das Lexikon der Traumsymbole plus thematische Seiten zu haufigen, beangstigenden, positiven, wasserbezogenen, personenzentrierten, ortsbezogenen und transformierenden Traumen.', intro: 'Starten Sie mit dem vollstandigen Traumsymbole-Lexikon und vertiefen Sie sich dann in thematische Ratgeber zu verwandten Traumthemen.', dictionary: 'Traumsymbole-Lexikon', openDictionary: 'Lexikon offnen', openGuide: 'Ratgeber offnen', browseAll: 'Alle Traumratgeber ansehen' },
  it: { label: 'Guide ai sogni', title: 'Guide ai sogni e significati dei simboli | Noctalia', desc: 'Esplora le guide ai sogni di Noctalia: il dizionario dei simboli e pagine tematiche su sogni comuni, spaventosi, positivi, d acqua, di persone, di luoghi e di trasformazione.', intro: 'Inizia dal dizionario completo dei simboli e poi approfondisci con guide tematiche che raggruppano schemi e significati collegati.', dictionary: 'Dizionario dei simboli dei sogni', openDictionary: 'Apri il dizionario', openGuide: 'Apri la guida', browseAll: 'Sfoglia tutte le guide ai sogni' },
};

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

function renderJsonLd(data) {
  return `    <script type="application/ld+json">\n${JSON.stringify(data, null, 4)
    .replace(/</g, '\\u003c')
    .split('\n')
    .map((line) => `        ${line}`)
    .join('\n')}\n    </script>`;
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
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0a0514">
    <title>${escapeHtml(copy.title)}</title>
    <meta name="description" content="${escapeHtml(copy.desc)}">
    <link rel="canonical" href="${DOMAIN}/${lang}/guides/">
${SUPPORTED_LANGS.map((targetLang) => `    <link rel="alternate" hreflang="${targetLang}" href="${DOMAIN}/${targetLang}/guides/">`).join('\n')}
    <link rel="alternate" hreflang="x-default" href="${DOMAIN}/en/guides/">
    <link rel="stylesheet" href="/css/styles.min.css?v=${version}">
    <style>
        body { margin: 0; background: #0a0514; color: #f8f5ff; font-family: system-ui, sans-serif; }
        a { color: inherit; text-decoration: none; }
        .shell { max-width: 1120px; margin: 0 auto; padding: 32px 16px 72px; }
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
<body>
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

function patchDictionaryPage(lang, t) {
  const copy = COPY[lang];
  const absPath = path.join(DOCS_DIR, lang, 'guides', `${t.dictionary_slug}.html`);
  const originalRaw = fs.readFileSync(absPath, 'utf8');
  let next = originalRaw.replace(/\r\n/g, '\n');
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
  next = replaceFirst(next, /[ \t]*<nav class="text-sm text-purple-200\/60 mb-8" aria-label="[^"]+">[\s\S]*?<\/nav>/, `            <nav class="text-sm text-purple-200/60 mb-8" aria-label="Breadcrumb">
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
    new RegExp(`<a href="/${lang}/blog/" class="hidden sm:inline-flex [^"]*">[^<]+</a>`),
    `<a href="/${lang}/guides/" class="hidden sm:inline-flex text-dream-salmon">${escapeHtml(copy.label)}</a>`,
    new RegExp(`<a href="/${lang}/guides/" class="hidden sm:inline-flex text-dream-salmon">${escapeHtml(copy.label)}</a>`),
    'navbar link',
  );
  next = replaceFirstOrKeep(
    next,
    new RegExp(`<li><a href="/${lang}/blog/" class="[^"]*">[^<]+</a></li>`),
    `<li><a href="/${lang}/guides/" class="hover:text-dream-salmon transition-colors">${escapeHtml(copy.label)}</a></li>`,
    new RegExp(`<li><a href="/${lang}/guides/" class="hover:text-dream-salmon transition-colors">${escapeHtml(copy.label)}</a></li>`),
    'footer link',
  );
  next = replaceFirstOrKeep(
    next,
    /<a\b(?=[^>]*href="\.\.\/blog\/[^"]+")(?=[^>]*class="[^"]*text-xs font-mono[^"]*")[^>]*>[\s\S]*?<\/a>/,
    `<a href="/${lang}/guides/" class="inline-flex items-center gap-2 text-xs font-mono text-purple-200/70 border border-white/10 rounded-full px-4 py-2 hover:text-white hover:border-dream-salmon/30 transition-colors">${escapeHtml(copy.browseAll)}</a>`,
    new RegExp(`<a\\b(?=[^>]*href="/${lang}/guides/")(?=[^>]*class="[^"]*text-xs font-mono[^"]*")[^>]*>\\s*${escapeRegExp(copy.browseAll)}\\s*<\\/a>`),
    'hero link',
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
