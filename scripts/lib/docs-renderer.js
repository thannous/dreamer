const fs = require('fs');
const path = require('path');
const {
  DOCS_SRC_DIR,
  getAndroidStoreUrl,
  loadLocales,
  readAssetVersion,
  siteConfig,
} = require('./docs-site-config');
const { escapeHtml } = require('./docs-source-utils');
const { buildEntryIndex } = require('./site-manifest');

const locales = loadLocales();
const shellTemplate = fs.readFileSync(path.join(DOCS_SRC_DIR, 'templates', 'base.html'), 'utf8');

function renderTemplate(tokens) {
  return Object.entries(tokens).reduce(
    (html, [key, value]) => html.replaceAll(`%%${key}%%`, value == null ? '' : String(value)),
    shellTemplate
  );
}

function absoluteUrl(pagePath) {
  return `${siteConfig.domain}${pagePath}`;
}

function htmlAttributes(meta) {
  const attrs = [];
  const lang = meta.lang || siteConfig.defaultLanguage;
  attrs.push(` lang="${escapeHtml(lang)}"`);

  if (meta.htmlClass && meta.htmlClass.trim()) {
    attrs.push(` class="${escapeHtml(meta.htmlClass)}"`);
  }

  return attrs.join('');
}

function bodyAttributes(meta) {
  const attrs = [];
  if (meta.bodyClass && meta.bodyClass.trim()) {
    attrs.push(` class="${escapeHtml(meta.bodyClass)}"`);
  }
  if (meta.bodyStyle && meta.bodyStyle.trim()) {
    attrs.push(` style="${escapeHtml(meta.bodyStyle)}"`);
  }
  return attrs.join('');
}

function renderAlternateLinks(entry) {
  const lines = [];
  if (!entry) return '';

  for (const lang of siteConfig.languages) {
    const locale = entry.locales?.[lang];
    if (!locale) continue;
    lines.push(
      `    <link rel="alternate" hreflang="${lang}" href="${absoluteUrl(locale.path)}">`
    );
  }

  const xDefaultPath =
    entry.id === 'page.home'
      ? '/'
      : entry.locales?.[siteConfig.defaultLanguage]?.path || '/';
  lines.push(
    `    <link rel="alternate" hreflang="x-default" href="${absoluteUrl(xDefaultPath)}">`
  );

  return lines.join('\n');
}

function renderLocaleAlternates(lang) {
  return siteConfig.languages
    .filter((candidate) => candidate !== lang)
    .map(
      (candidate) =>
        `    <meta property="og:locale:alternate" content="${siteConfig.localeCodes[candidate]}">`
    )
    .join('\n');
}

function renderJsonLd(meta) {
  const blocks = Array.isArray(meta.jsonLd) ? meta.jsonLd : [];
  return blocks
    .map(
      (block) =>
        `    <script type="application/ld+json">\n${block.trim()}\n    </script>`
    )
    .join('\n\n');
}

function renderStyles(meta, assetVersion) {
  const assets = siteConfig.assetPaths;
  const lines = [
    `    <link rel="stylesheet" href="${assets.stylesCss}?v=${assetVersion}">`,
    `    <link rel="stylesheet" href="${assets.languageDropdownCss}?v=${assetVersion}">`,
  ];

  if (meta.layout === 'blogIndex' || meta.layout === 'blogArticle') {
    lines.push(`    <link rel="stylesheet" href="${assets.blogCss}?v=${assetVersion}">`);
  }

  return lines.join('\n');
}

function renderHeadScripts(meta, assetVersion) {
  const assets = siteConfig.assetPaths;
  const lines = [`    <script src="${assets.lucideJs}?v=${assetVersion}" defer></script>`];

  if (meta.layout === 'landing') {
    lines.push(`    <script src="${assets.gsapJs}?v=${assetVersion}" defer></script>`);
    lines.push(
      `    <script src="${assets.scrollTriggerJs}?v=${assetVersion}" defer></script>`
    );
  }

  return lines.join('\n');
}

function renderCommonHead(meta, entry, assetVersion) {
  const lang = meta.lang;
  const pagePath = entry?.locales?.[lang]?.path || meta.currentPath || '/';
  const canonicalUrl = absoluteUrl(pagePath);
  const ogTitle = meta.ogTitle || meta.title;
  const ogDescription = meta.ogDescription || meta.description;
  const ogImage = meta.ogImage || `${siteConfig.domain}/img/og/noctalia-${lang}-1200x630.jpg`;
  const ogImageAlt = meta.ogImageAlt || ogTitle;
  const twitterTitle = meta.twitterTitle || ogTitle;
  const twitterDescription = meta.twitterDescription || meta.description;
  const twitterImage = meta.twitterImage || ogImage;
  const twitterImageAlt = meta.twitterImageAlt || ogImageAlt;
  const themeColor = meta.themeColor || '#0a0514';
  const defaultRobots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const robots =
    meta.robots && /(index|noindex)/i.test(meta.robots) ? meta.robots : defaultRobots;

  const prevNextLines = [];
  if (meta.prevPath) {
    prevNextLines.push(`    <link rel="prev" href="${absoluteUrl(meta.prevPath)}">`);
  }
  if (meta.nextPath) {
    prevNextLines.push(`    <link rel="next" href="${absoluteUrl(meta.nextPath)}">`);
  }

  const preloadLines = [];
  if (meta.preloadImage) {
    const ext = path.extname(meta.preloadImage).toLowerCase();
    const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg';
    preloadLines.push('    <!-- Preload featured image -->');
    preloadLines.push(
      `    <link rel="preload" href="${meta.preloadImage}" as="image" type="${mime}">`
    );
  }

  const articleMetaLines = [];
  if (meta.ogType === 'article' && meta.publishedTime) {
    articleMetaLines.push(
      `    <meta property="article:published_time" content="${escapeHtml(meta.publishedTime)}">`
    );
  }
  if (meta.ogType === 'article' && meta.modifiedTime) {
    articleMetaLines.push(
      `    <meta property="article:modified_time" content="${escapeHtml(meta.modifiedTime)}">`
    );
  }
  if (meta.ogType === 'article' && meta.author) {
    articleMetaLines.push(
      `    <meta property="article:author" content="${escapeHtml(meta.author)}">`
    );
  }

  return [
    '    <meta charset="UTF-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `    <meta name="theme-color" content="${themeColor}">`,
    `    <title>${escapeHtml(meta.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(meta.description)}">`,
    `    <meta name="robots" content="${escapeHtml(robots)}">`,
    `    <link rel="canonical" href="${canonicalUrl}">`,
    renderAlternateLinks(entry),
    '    <link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="64x64 48x48 32x32 16x16">',
    '    <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">',
    '    <link rel="apple-touch-icon" href="/logo192.png" sizes="192x192">',
    prevNextLines.join('\n'),
    `    <meta property="og:type" content="${escapeHtml(meta.ogType || 'website')}">`,
    `    <meta property="og:title" content="${escapeHtml(ogTitle)}">`,
    `    <meta property="og:description" content="${escapeHtml(ogDescription)}">`,
    `    <meta property="og:url" content="${canonicalUrl}">`,
    `    <meta property="og:image" content="${escapeHtml(ogImage)}">`,
    '    <meta property="og:image:width" content="1200">',
    '    <meta property="og:image:height" content="630">',
    `    <meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}">`,
    `    <meta property="og:locale" content="${siteConfig.localeCodes[lang]}">`,
    renderLocaleAlternates(lang),
    '    <meta property="og:site_name" content="Noctalia">',
    articleMetaLines.join('\n'),
    `    <meta name="twitter:card" content="${escapeHtml(meta.twitterCard || 'summary_large_image')}">`,
    `    <meta name="twitter:site" content="${escapeHtml(siteConfig.organization.twitterHandle)}">`,
    `    <meta name="twitter:title" content="${escapeHtml(twitterTitle)}">`,
    `    <meta name="twitter:description" content="${escapeHtml(twitterDescription)}">`,
    `    <meta name="twitter:image" content="${escapeHtml(twitterImage)}">`,
    `    <meta name="twitter:image:alt" content="${escapeHtml(twitterImageAlt)}">`,
    '    <link rel="preload" href="/fonts/Outfit-Regular.woff2" as="font" type="font/woff2" crossorigin>',
    '    <link rel="preload" href="/fonts/Outfit-Bold.woff2" as="font" type="font/woff2" crossorigin>',
    '    <link rel="preload" href="/fonts/Fraunces-Variable.woff2" as="font" type="font/woff2" crossorigin>',
    preloadLines.join('\n'),
    renderStyles(meta, assetVersion),
    renderHeadScripts(meta, assetVersion),
    renderJsonLd(meta),
  ]
    .filter(Boolean)
    .join('\n');
}

function renderLanguageDropdown(entry, lang) {
  return siteConfig.languages
    .map((candidate) => {
      const locale = locales[candidate];
      const pagePath = entry?.locales?.[candidate]?.path || `/${candidate}/`;
      const currentClass = candidate === lang ? '' : ' hidden';
      return [
        `                    <a href="${pagePath}" hreflang="${candidate}" class="dropdown-item flex items-center justify-between px-4 py-2 text-sm text-purple-100/80 hover:bg-white/10 hover:text-white transition-colors" role="menuitem">`,
        `                        <span>${escapeHtml(locale.language)}</span>`,
        `                        <i data-lucide="check" class="w-4 h-4 text-dream-salmon${currentClass}"></i>`,
        '                    </a>',
      ].join('\n');
    })
    .join('\n');
}

function renderGlassNav(entry, lang, activeNav) {
  const locale = locales[lang];
  const dropdown = renderLanguageDropdown(entry, lang);
  const resourcesHref = activeNav === 'guides' ? `/${lang}/guides/` : `/${lang}/blog/`;
  const resourcesLabel = activeNav === 'guides' ? locale.dreamGuides : locale.resources;

  return [
    '    <nav class="fixed w-full z-50 top-0 left-0 px-4 md:px-6 py-4 md:py-6 transition-all duration-300" id="navbar" data-shrink-on-scroll="true" data-expanded-class="py-6" data-compact-class="py-2">',
    '        <div class="max-w-7xl mx-auto glass-panel rounded-full px-4 py-2 flex items-center justify-between gap-2 sm:px-6 sm:py-3 sm:gap-4">',
    `            <a href="/${lang}/" class="flex items-center gap-2">`,
    '                <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>',
    '                <span class="font-serif text-xl font-semibold tracking-wide text-dream-cream">Noctalia</span>',
    '            </a>',
    '            <div class="flex flex-wrap items-center gap-4 md:gap-8 text-sm font-sans text-purple-100/80">',
    `                <a href="/${lang}/#${locale.navHowItWorksAnchor}" class="hidden sm:inline-flex hover:text-white transition-colors">${escapeHtml(locale.navHowItWorks)}</a>`,
    `                <a href="/${lang}/#${locale.navFeaturesAnchor}" class="hidden sm:inline-flex hover:text-white transition-colors">${escapeHtml(locale.navFeatures)}</a>`,
    `                <a href="${resourcesHref}" class="hidden sm:inline-flex${activeNav ? ' text-dream-salmon' : ' hover:text-white'} transition-colors">${escapeHtml(resourcesLabel)}</a>`,
    '            </div>',
    '            <div class="flex items-center gap-3">',
    '                <div class="language-dropdown-wrapper relative" id="languageDropdown">',
    '                    <button type="button" class="glass-button px-3 py-2 rounded-full text-sm text-purple-100/80 border border-white/10 hover:border-dream-salmon hover:text-white transition-colors flex items-center gap-2" aria-haspopup="true" aria-expanded="false" aria-label="Choose language" id="languageDropdownButton">',
    '                        <i data-lucide="languages" class="w-4 h-4"></i>',
    `                        <span class="hidden sm:inline">${lang.toUpperCase()}</span>`,
    '                        <i data-lucide="chevron-down" class="w-3 h-3 transition-transform" id="dropdownChevron"></i>',
    '                    </button>',
    '                    <div class="language-dropdown-menu absolute right-0 top-full mt-2 glass-panel rounded-2xl py-2 min-w-[160px] hidden z-50" role="menu" aria-labelledby="languageDropdownButton" id="languageDropdownMenu">',
    dropdown,
    '                    </div>',
    '                </div>',
    '            </div>',
    '        </div>',
    '    </nav>',
  ].join('\n');
}

function renderCompactNav(entry, lang) {
  const locale = locales[lang];
  const dropdown = renderLanguageDropdown(entry, lang);

  return [
    '    <nav class="fixed w-full z-50 top-0 left-0 px-6 py-4 bg-dream-dark/80 backdrop-blur-md border-b border-white/5">',
    '        <div class="max-w-4xl mx-auto flex justify-between items-center">',
    `            <a href="/${lang}/" class="flex items-center gap-2">`,
    '                <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>',
    '                <span class="font-serif text-xl font-semibold text-dream-cream">Noctalia</span>',
    '            </a>',
    '            <div class="flex items-center gap-3">',
    '                <div class="language-dropdown-wrapper relative" id="languageDropdown">',
    '                    <button type="button" class="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2" aria-haspopup="true" aria-expanded="false" aria-label="Choose language" id="languageDropdownButton">',
    '                        <i data-lucide="languages" class="w-4 h-4"></i>',
    `                        <span class="hidden sm:inline">${lang.toUpperCase()}</span>`,
    '                        <i data-lucide="chevron-down" class="w-3 h-3 transition-transform" id="dropdownChevron"></i>',
    '                    </button>',
    '                    <div class="language-dropdown-menu absolute right-0 top-full mt-2 glass-panel rounded-2xl py-2 min-w-[160px] hidden z-50" role="menu" aria-labelledby="languageDropdownButton" id="languageDropdownMenu">',
    dropdown,
    '                    </div>',
    '                </div>',
    `                <a href="/${lang}/" class="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">`,
    '                    <i data-lucide="arrow-left" class="w-4 h-4"></i>',
    `                    ${escapeHtml(locale.back)}`,
    '                </a>',
    '            </div>',
    '        </div>',
    '    </nav>',
  ].join('\n');
}

function routePath(entryIndex, pageId, lang) {
  return entryIndex.get(pageId)?.locales?.[lang]?.path || `/${lang}/`;
}

function renderFooter(entryIndex, lang) {
  const locale = locales[lang];
  const socialLinks = siteConfig.socialLinks
    .map(
      (item) => [
        `                    <a href="${item.url}" class="w-10 h-10 rounded-full glass-button flex items-center justify-center hover:text-dream-salmon" aria-label="${escapeHtml(item.label)}">`,
        `                        <i data-lucide="${item.icon}" class="w-5 h-5"></i>`,
        '                    </a>',
      ].join('\n')
    )
    .join('\n');

  return [
    '    <footer class="pb-10 pt-20 border-t border-white/5 px-6 bg-[#05020a]">',
    '        <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">',
    '            <div class="col-span-1 md:col-span-2">',
    `                <a href="/${lang}/" class="flex items-center gap-2 mb-4">`,
    '                    <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>',
    '                    <h4 class="font-serif text-2xl text-dream-cream">Noctalia</h4>',
    '                </a>',
    `                <p class="text-sm text-gray-500 max-w-xs mb-6">${escapeHtml(locale.footerTagline)}</p>`,
    '                <div class="flex gap-4">',
    socialLinks,
    '                </div>',
    '            </div>',
    '            <div>',
    `                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.footerResources)}</h5>`,
    '                <ul class="space-y-2 text-sm text-gray-500">',
    `                    <li><a href="${routePath(entryIndex, 'blog.index', lang)}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.resources)}</a></li>`,
    `                    <li><a href="${routePath(entryIndex, 'guide.index', lang)}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.dreamGuides)}</a></li>`,
    `                    <li><a href="${routePath(entryIndex, 'guide.dictionary', lang)}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.dreamSymbols)}</a></li>`,
    '                </ul>',
    '            </div>',
    '            <div>',
    `                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.footerLegal)}</h5>`,
    '                <ul class="space-y-2 text-sm text-gray-500">',
    `                    <li><a href="${routePath(entryIndex, 'page.about', lang)}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.about)}</a></li>`,
    `                    <li><a href="${routePath(entryIndex, 'legal.notice', lang)}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.legalNotice)}</a></li>`,
    `                    <li><a href="${routePath(entryIndex, 'legal.privacy', lang)}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.privacy)}</a></li>`,
    `                    <li><a href="${routePath(entryIndex, 'legal.terms', lang)}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.terms)}</a></li>`,
    `                    <li><a href="${routePath(entryIndex, 'legal.account-deletion', lang)}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.accountDeletion)}</a></li>`,
    '                </ul>',
    '            </div>',
    '            <div>',
    `                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.footerDownload)}</h5>`,
    '                <div class="flex flex-col gap-3">',
    `                    <a href="${getAndroidStoreUrl(lang)}" class="glass-button px-4 py-2 rounded-lg flex items-center gap-3 text-left hover:bg-white/10">`,
    '                        <i data-lucide="play" class="w-5 h-5 fill-current"></i>',
    '                        <div class="leading-none">',
    `                            <div class="text-[9px] uppercase">${escapeHtml(locale.availableOn)}</div>`,
    `                            <div class="text-sm font-bold">${escapeHtml(locale.googlePlay)}</div>`,
    '                        </div>',
    '                    </a>',
    '                </div>',
    '            </div>',
    '        </div>',
    '        <div class="text-center pt-8 border-t border-white/5 text-[10px] text-gray-600 flex flex-col md:flex-row justify-between items-center">',
    `            <span>${escapeHtml(locale.copyright)}</span>`,
    `            <span class="mt-2 md:mt-0 flex gap-2 items-center">${escapeHtml(locale.footerMadeWith)} <i data-lucide="heart" class="w-3 h-3 text-dream-salmon fill-current"></i> ${escapeHtml(locale.footerForDreamers)}</span>`,
    '        </div>',
    '    </footer>',
  ].join('\n');
}

function renderBeforeBody(meta) {
  if (meta.layout === 'landing') {
    return [
      '    <div class="aurora-bg"></div>',
      '    <div class="noise-overlay"></div>',
      '    <div class="orb w-[70vw] h-[70vw] md:w-[40rem] md:h-[40rem] bg-purple-900/30 top-0 left-0 animate-float"></div>',
      '    <div class="orb w-[90vw] h-[90vw] md:w-[50rem] md:h-[50rem] bg-blue-900/20 bottom-0 right-0 animate-float-delayed"></div>',
    ].join('\n');
  }

  if (meta.layout === 'blogIndex' || meta.layout === 'blogArticle') {
    return [
      '    <div class="aurora-bg"></div>',
      '    <div class="orb w-[70vw] h-[70vw] md:w-[40rem] md:h-[40rem] bg-purple-900/30 top-0 left-0"></div>',
      '    <div class="orb w-[90vw] h-[90vw] md:w-[50rem] md:h-[50rem] bg-blue-900/20 bottom-0 right-0"></div>',
    ].join('\n');
  }

  return '';
}

function renderContent(meta, bodyHtml) {
  if (meta.layout === 'landing') {
    return bodyHtml;
  }

  const classAttr = meta.mainClass ? ` class="${escapeHtml(meta.mainClass)}"` : '';
  return `    <main${classAttr}>\n${bodyHtml}\n    </main>`;
}

function renderScripts(meta, assetVersion) {
  const assets = siteConfig.assetPaths;
  const lines = [
    `    <script src="${assets.siteShellJs}?v=${assetVersion}" defer></script>`,
    `    <script src="${assets.languageDropdownJs}?v=${assetVersion}" defer></script>`,
  ];

  if (meta.layout === 'landing') {
    lines.push(`    <script src="${assets.landingPageJs}?v=${assetVersion}" defer></script>`);
    lines.push('    <script type="module" src="/js/landing-animations.js"></script>');
  }

  if (meta.layout === 'blogArticle') {
    lines.push(`    <script src="${assets.blogArticleJs}?v=${assetVersion}" defer></script>`);
  }

  return lines.join('\n');
}

function renderManagedPage({ manifest, entryId, meta, bodyHtml }) {
  const assetVersion = readAssetVersion();
  const entryIndex = buildEntryIndex(manifest);
  const entry = entryIndex.get(entryId);
  const navHtml =
    meta.layout === 'content'
      ? renderCompactNav(entry, meta.lang)
      : renderGlassNav(entry, meta.lang, meta.activeNav || null);

  return renderTemplate({
    HTML_ATTRS: htmlAttributes(meta),
    BODY_ATTRS: bodyAttributes(meta),
    HEAD_HTML: renderCommonHead(meta, entry, assetVersion),
    BEFORE_BODY_HTML: renderBeforeBody(meta),
    NAV_HTML: navHtml,
    CONTENT_HTML: renderContent(meta, bodyHtml),
    FOOTER_HTML: meta.layout === 'content' ? '' : renderFooter(entryIndex, meta.lang),
    SCRIPTS_HTML: renderScripts(meta, assetVersion),
  });
}

module.exports = {
  renderManagedPage,
};
