const fs = require('fs');
const path = require('path');
const {
  DOCS_SRC_DIR,
  readAssetVersion,
  siteConfig,
} = require('./docs-site-config');
const { escapeHtml } = require('./docs-source-utils');
const { renderViewTransitionHeadStyles } = require('./docs-view-transitions');
const { createRenderContext } = require('./docs-components/context');
const { renderFooter: renderSharedFooter } = require('./docs-components/footer');
const { renderPageHero } = require('./docs-components/hero');
const { renderNavigation } = require('./docs-components/navigation');
const { renderSharedComponentStyles } = require('./docs-components/styles');
const { inlineLucideIcons } = require('./lucide-inline');

const shellTemplate = fs.readFileSync(path.join(DOCS_SRC_DIR, 'templates', 'base.html'), 'utf8');
const AHREFS_ANALYTICS_KEY = 'qDwc7i0RM0aLBY/cZLkOxA';

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

  if (meta.layout === 'blogArticle' && assets.blogArticleCss) {
    lines.push(`    <link rel="stylesheet" href="${assets.blogArticleCss}?v=${assetVersion}">`);
  }

  if (meta.layout === 'blogIndex' && String(meta.mainClass || '').includes('blog-premium')) {
    lines.push(`    <link rel="stylesheet" href="/css/blog-premium.css?v=${assetVersion}">`);
  }

  if (meta.layout === 'landing') {
    lines.push(`    <link rel="stylesheet" href="/css/observatory.css?v=${assetVersion}">`);
  }

  lines.push(renderSharedComponentStyles());

  return lines.join('\n');
}

function renderHeadScripts() {
  return '';
}

function renderAnalyticsHeadScript() {
  return [
    '    <script',
    '      src="https://analytics.ahrefs.com/analytics.js"',
    `      data-key="${AHREFS_ANALYTICS_KEY}"`,
    '      async',
    '    ></script>',
  ].join('\n');
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
    renderAnalyticsHeadScript(),
    renderStyles(meta, assetVersion),
    renderViewTransitionHeadStyles(),
    renderHeadScripts(meta, assetVersion),
    renderJsonLd(meta),
  ]
    .filter(Boolean)
    .join('\n');
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

function renderContent(meta, bodyHtml, heroHtml = '') {
  if (meta.layout === 'landing') {
    return bodyHtml;
  }

  const classAttr = meta.mainClass ? ` class="${escapeHtml(meta.mainClass)}"` : '';
  const styleAttr =
    meta.layout === 'blogArticle' && meta.preloadImage
      ? ` style="--article-bg-image: url('${escapeHtml(meta.preloadImage)}');"`
      : '';
  const sections = [heroHtml, bodyHtml].filter(Boolean).join('\n');
  return `    <main${classAttr}${styleAttr}>\n${sections}\n    </main>`;
}

function renderScripts(meta, assetVersion) {
  const assets = siteConfig.assetPaths;
  const lines = [
    `    <script src="${assets.siteShellJs}?v=${assetVersion}" defer></script>`,
    `    <script src="${assets.languageDropdownJs}?v=${assetVersion}" defer></script>`,
    `    <script src="${assets.mobileMenuJs}?v=${assetVersion}" defer></script>`,
  ];

  if (meta.layout === 'landing') {
    lines.push(`    <script src="${assets.landingPageJs}?v=${assetVersion}" defer></script>`);
    lines.push(
      [
        '    <script',
        '      type="module"',
        `      src="/js/landing-animations.js?v=${assetVersion}"`,
        '      data-animation-module="landing"',
        `      data-gsap-src="${assets.gsapJs}?v=${assetVersion}"`,
        `      data-scroll-trigger-src="${assets.scrollTriggerJs}?v=${assetVersion}"`,
        '    ></script>',
      ].join('\n')
    );
  }

  if (meta.layout === 'blogIndex' && String(meta.mainClass || '').includes('blog-premium')) {
    lines.push(
      [
        '    <script',
        '      type="module"',
        `      src="/js/blog-premium.js?v=${assetVersion}"`,
        '      data-animation-module="blog-premium"',
        `      data-gsap-src="${assets.gsapJs}?v=${assetVersion}"`,
        `      data-scroll-trigger-src="${assets.scrollTriggerJs}?v=${assetVersion}"`,
        '    ></script>',
      ].join('\n')
    );
  }

  if (meta.layout === 'blogArticle') {
    lines.push(`    <script src="${assets.blogArticleJs}?v=${assetVersion}" defer></script>`);
  }

  return lines.join('\n');
}

function renderManagedPage({ manifest, entryId, meta, bodyHtml, entryOverride = null }) {
  const assetVersion = readAssetVersion();
  const context = createRenderContext({ manifest, entryId, meta, entryOverride });
  const entry = context.entry;
  const navHtml = renderNavigation(context);

  const html = renderTemplate({
    HTML_ATTRS: htmlAttributes(meta),
    BODY_ATTRS: bodyAttributes(meta),
    HEAD_HTML: renderCommonHead(meta, entry, assetVersion),
    BEFORE_BODY_HTML: renderBeforeBody(meta),
    NAV_HTML: navHtml,
    CONTENT_HTML: renderContent(meta, bodyHtml, renderPageHero(context)),
    FOOTER_HTML: renderSharedFooter(context),
    SCRIPTS_HTML: renderScripts(meta, assetVersion),
  });

  return inlineLucideIcons(html);
}

module.exports = {
  renderManagedPage,
};
