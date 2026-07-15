const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');
const {
  DOCS_SRC_DIR,
  readAssetVersion,
  siteConfig,
} = require('./docs-site-config');
const { escapeHtml } = require('./docs-source-utils');
const { renderAhrefsAnalyticsScript } = require('./ahrefs-analytics');
const { renderViewTransitionHeadStyles } = require('./docs-view-transitions');
const { createRenderContext } = require('./docs-components/context');
const { renderFooter: renderSharedFooter } = require('./docs-components/footer');
const { renderPageHero } = require('./docs-components/hero');
const { renderNavigation } = require('./docs-components/navigation');
const { renderSharedComponentStyles } = require('./docs-components/styles');
const { inlineLucideIcons } = require('./lucide-inline');
const {
  synchronizeJsonLdDates,
  synchronizeVisibleArticleDate,
} = require('./article-date-contract');
const { normalizeCanonicalOrganization } = require('./canonical-organization');
const {
  getPageImageSet,
  getPageResponsiveImages,
  getResponsiveImageData,
  readImageAssetRegistry,
  renderResponsivePicture,
} = require('./image-seo-assets');

const shellTemplate = fs.readFileSync(path.join(DOCS_SRC_DIR, 'templates', 'base.html'), 'utf8');
const DEFAULT_SOCIAL_IMAGE = `${siteConfig.domain}/img/og/noctalia-dreamscape-v2-1200x630.jpg`;
const LEGACY_SOCIAL_IMAGE_PATTERN = /\/img\/og\/noctalia-(?:en|fr|es|de|it)-1200x630\.jpg(?:[?#].*)?$/i;
let imageSeoRegistryCache;

function loadImageSeoRegistry() {
  if (imageSeoRegistryCache !== undefined) return imageSeoRegistryCache;
  try {
    imageSeoRegistryCache = readImageAssetRegistry();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    imageSeoRegistryCache = null;
  }
  return imageSeoRegistryCache;
}

function resolvePageImageContext(entry, meta) {
  const registry = loadImageSeoRegistry();
  if (!registry) return null;
  const canonicalPath = entry?.locales?.[meta.lang]?.path || meta.currentPath || '';
  const page = getPageImageSet(registry, canonicalPath);
  if (!page) return null;
  return {
    registry,
    page,
    images: getPageResponsiveImages(registry, canonicalPath),
  };
}

function renderTemplate(tokens) {
  return Object.entries(tokens).reduce(
    (html, [key, value]) => html.replaceAll(`%%${key}%%`, value == null ? '' : String(value)),
    shellTemplate
  );
}

function absoluteUrl(pagePath) {
  return `${siteConfig.domain}${pagePath}`;
}

function normalizePreferredImageUrl(value) {
  const url = String(value || '').trim();
  if (!url || LEGACY_SOCIAL_IMAGE_PATTERN.test(url)) return DEFAULT_SOCIAL_IMAGE;
  return url.startsWith('/') ? absoluteUrl(url) : url;
}

function localImagePathFromUrl(value) {
  try {
    const url = new URL(normalizePreferredImageUrl(value), siteConfig.domain);
    if (url.origin !== siteConfig.domain) return null;
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    return path.join(DOCS_SRC_DIR, 'static', pathname);
  } catch {
    return null;
  }
}

function resolveImageDimensions(value, fallback = { width: 1200, height: 630 }) {
  const filePath = localImagePathFromUrl(value);
  if (!filePath || !fs.existsSync(filePath)) return fallback;

  try {
    const dimensions = imageSize(fs.readFileSync(filePath));
    if (!dimensions.width || !dimensions.height) return fallback;
    return { width: dimensions.width, height: dimensions.height };
  } catch {
    return fallback;
  }
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

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSiteSuffix(title) {
  return String(title || '').replace(/\s*\|\s*Noctalia\s*$/i, '').trim();
}

function estimateWordCount(bodyHtml) {
  return stripHtml(bodyHtml).split(/\s+/).filter(Boolean).length;
}

function estimateReadingTimeMinutes(wordCount) {
  return Math.max(1, Math.ceil(wordCount / 220));
}

function extractFaqEntities(bodyHtml) {
  const entities = [];
  const detailsBlocks = String(bodyHtml || '').match(/<details\b[\s\S]*?<\/details>/gi) || [];

  for (const block of detailsBlocks) {
    const question = stripHtml(block.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || '');
    const answer = stripHtml(block.replace(/<summary\b[\s\S]*?<\/summary>/i, ''));
    if (!question || !answer) continue;
    entities.push({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    });
  }

  return entities;
}

function blogSectionLabel(lang) {
  if (lang === 'fr') return 'Ressources';
  if (lang === 'es') return 'Recursos';
  if (lang === 'de') return 'Ressourcen';
  if (lang === 'it') return 'Risorse';
  return 'Resources';
}

function homeLabel(lang) {
  if (lang === 'fr') return 'Accueil';
  if (lang === 'es') return 'Inicio';
  if (lang === 'de') return 'Startseite';
  if (lang === 'it') return 'Home';
  return 'Home';
}

function buildFallbackBlogJsonLd(meta, entry, bodyHtml) {
  if (meta.layout !== 'blogArticle' || !entry) return [];

  const lang = meta.lang || siteConfig.defaultLanguage;
  const pagePath = entry.locales?.[lang]?.path || meta.currentPath || '/';
  const canonicalUrl = absoluteUrl(pagePath);
  const title = stripSiteSuffix(meta.title);
  const description = meta.description || meta.ogDescription || title;
  const wordCount = estimateWordCount(bodyHtml);
  const imageUrl = normalizePreferredImageUrl(meta.ogImage || meta.twitterImage);
  const imageDimensions = resolveImageDimensions(imageUrl);
  const faqEntities = extractFaqEntities(bodyHtml);

  const blocks = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description,
      image: {
        '@type': 'ImageObject',
        url: imageUrl,
        width: imageDimensions.width,
        height: imageDimensions.height,
      },
      author: {
        '@type': 'Person',
        '@id': `${siteConfig.domain}/en/about#person`,
        name: meta.author || 'Thanh Chau',
        url: `${siteConfig.domain}/en/about`,
      },
      publisher: {
        '@type': 'Organization',
        '@id': `${siteConfig.domain}/#organization`,
        name: siteConfig.organization.name,
        url: siteConfig.organization.url,
        logo: {
          '@type': 'ImageObject',
          url: siteConfig.organization.logoUrl,
        },
      },
      datePublished: meta.publishedTime,
      dateModified: meta.modifiedTime || meta.publishedTime,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
      inLanguage: lang,
      isAccessibleForFree: true,
      wordCount,
      timeRequired: `PT${estimateReadingTimeMinutes(wordCount)}M`,
      url: canonicalUrl,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': canonicalUrl,
      url: canonicalUrl,
      name: meta.title,
      description,
      inLanguage: lang,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: homeLabel(lang),
          item: lang === 'en' ? `${siteConfig.domain}/` : `${siteConfig.domain}/${lang}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: blogSectionLabel(lang),
          item: `${siteConfig.domain}/${lang}/blog/`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: title,
          item: canonicalUrl,
        },
      ],
    },
  ];

  if (faqEntities.length > 0) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqEntities,
    });
  }

  return blocks;
}

function synchronizePreferredImage(blocks, preferredImage) {
  const imageObject = {
    '@type': 'ImageObject',
    url: preferredImage.url,
    width: preferredImage.width,
    height: preferredImage.height,
  };
  const articleImages = Array.isArray(preferredImage.articleImages) && preferredImage.articleImages.length
    ? preferredImage.articleImages.map((image) => ({
        '@type': 'ImageObject',
        url: image.url,
        width: image.width,
        height: image.height,
      }))
    : [{ ...imageObject }];

  function visit(node) {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;

    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.some((type) => ['Article', 'BlogPosting', 'NewsArticle'].includes(type))) {
      node.image = articleImages.length === 1 ? { ...articleImages[0] } : articleImages.map((image) => ({ ...image }));
    }
    if (
      !preferredImage.generic &&
      types.some((type) => ['WebPage', 'CollectionPage'].includes(type))
    ) {
      node.primaryImageOfPage = { ...imageObject };
    }

    for (const value of Object.values(node)) visit(value);
  }

  for (const block of blocks) visit(block);
  return blocks;
}

function renderJsonLd(meta, entry, bodyHtml, preferredImage = null) {
  const blocks = Array.isArray(meta.jsonLd) ? meta.jsonLd : [];
  const sourceBlocks = blocks.length > 0 ? blocks : buildFallbackBlogJsonLd(meta, entry, bodyHtml);
  const normalizedBlocks = normalizeCanonicalOrganization(sourceBlocks);
  const datedBlocks = synchronizeJsonLdDates(normalizedBlocks, meta);
  const synchronizedBlocks = preferredImage
    ? synchronizePreferredImage(datedBlocks, preferredImage)
    : datedBlocks;

  return synchronizedBlocks
    .map((block) => {
      const payload = typeof block === 'string' ? block.trim() : JSON.stringify(block, null, 2);
      return `    <script type="application/ld+json">\n${payload.replace(/</g, '\\u003c')}\n    </script>`;
    })
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

function renderCommonHead(meta, entry, assetVersion, bodyHtml) {
  const lang = meta.lang;
  const pagePath = entry?.locales?.[lang]?.path || meta.currentPath || '/';
  const canonicalUrl = absoluteUrl(pagePath);
  const ogTitle = meta.ogTitle || meta.title;
  const ogDescription = meta.ogDescription || meta.description;
  const ogImage = normalizePreferredImageUrl(meta.ogImage);
  const ogImageDimensions = resolveImageDimensions(ogImage);
  const ogImageAlt = meta.ogImageAlt || ogTitle;
  const twitterTitle = meta.twitterTitle || ogTitle;
  const twitterDescription = meta.twitterDescription || meta.description;
  const twitterImage = normalizePreferredImageUrl(meta.twitterImage || ogImage);
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
  if (meta.preloadImage && meta.layout !== 'blogArticle') {
    const ext = path.extname(meta.preloadImage).toLowerCase();
    const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg';
    preloadLines.push('    <!-- Preload featured image -->');
    preloadLines.push(
      `    <link rel="preload" href="${meta.preloadImage}" as="image" type="${mime}">`
    );
  }
  if (meta.layout === 'landing') {
    preloadLines.push('    <!-- Preload the homepage LCP background -->');
    preloadLines.push(
      '    <link rel="preload" href="/img/hero/noctalia-observatory-bg.webp" as="image" type="image/webp" fetchpriority="high">'
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
    `    <meta property="og:image:width" content="${ogImageDimensions.width}">`,
    `    <meta property="og:image:height" content="${ogImageDimensions.height}">`,
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
    renderAhrefsAnalyticsScript(),
    renderStyles(meta, assetVersion),
    renderViewTransitionHeadStyles(),
    renderHeadScripts(meta, assetVersion),
    renderJsonLd(meta, entry, bodyHtml, {
      url: ogImage,
      width: ogImageDimensions.width,
      height: ogImageDimensions.height,
      generic: ogImage === DEFAULT_SOCIAL_IMAGE,
      articleImages: meta.structuredArticleImages,
    }),
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
  const sections = [heroHtml, bodyHtml].filter(Boolean).join('\n');
  return `    <main${classAttr}>\n${sections}\n    </main>`;
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

function upsertHtmlAttribute(tag, name, value) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`\\b${name}=(['"])[\\s\\S]*?\\1`, 'i');
  if (pattern.test(tag)) return tag.replace(pattern, `${name}="${escaped}"`);
  return tag.replace(/>$/, ` ${name}="${escaped}">`);
}

function appendStyleProperty(tag, name, value) {
  const current = tag.match(/\bstyle=(['"])([\s\S]*?)\1/i)?.[2]?.trim() || '';
  const prefix = current ? `${current.replace(/;?$/, ';')} ` : '';
  return upsertHtmlAttribute(tag, 'style', `${prefix}${name}: ${value};`);
}

function removeHtmlAttribute(tag, name) {
  return tag.replace(new RegExp(`\\s+${name}=(['"])[\\s\\S]*?\\1`, 'i'), '');
}

function responsiveBlogImageSrcset(src) {
  if (!/\/img\/blog\/[^"']+\.webp$/i.test(src)) return null;
  const fileName = path.basename(src).replace(/-(?:480|600|800|1200)w(?=\.webp$)/i, '');
  const stem = fileName.replace(/\.webp$/i, '');
  const variants = [480, 800, 1200].map((width) => ({
    width,
    sourcePath: path.join(DOCS_SRC_DIR, 'static', 'img', 'blog', `${stem}-${width}w.webp`),
    url: src.replace(/[^/]+$/, `${stem}-${width}w.webp`),
  }));
  if (!variants.every((variant) => fs.existsSync(variant.sourcePath))) return null;
  return variants.map((variant) => `${variant.url} ${variant.width}w`).join(', ');
}

function imageStem(value) {
  const pathname = String(value || '').split(/[?#]/, 1)[0];
  return path
    .basename(pathname)
    .replace(/-(?:480|600|800|1200)w(?=\.(?:avif|webp|png|jpe?g)$)/i, '')
    .replace(/\.(?:avif|webp|png|jpe?g)$/i, '');
}

function imageAltFromTag(tag, fallback) {
  return tag.match(/\balt=(['"])([\s\S]*?)\1/i)?.[2] || fallback || '';
}

function addFigureRole(figureTag, role) {
  return upsertHtmlAttribute(figureTag, 'data-image-seo-role', role);
}

function renderArticlePicture({ src, srcset, alt, width, height, role = 'editorial' }) {
  const sizes = role === 'editorial'
    ? '100vw'
    : '(max-width: 768px) 100vw, 920px';
  const loading = role === 'editorial' ? '' : ' loading="lazy"';
  const priority = role === 'editorial' ? ' fetchpriority="high"' : '';
  const source = srcset
    ? `\n                        <source type="image/webp" srcset="${escapeHtml(srcset)}" sizes="${sizes}">`
    : '';
  const imgSrcset = srcset ? ` srcset="${escapeHtml(srcset)}"` : '';

  return `<picture>${source}
                        <img src="${escapeHtml(src)}"${imgSrcset} sizes="${sizes}" width="${width}" height="${height}" alt="${escapeHtml(alt)}"${loading}${priority} decoding="async">
                    </picture>`;
}

function educationalFigureMarkup(imageContext) {
  const imageRef = imageContext.page.images.educational;
  const image = imageContext.images.educational;
  const captionId = `image-caption-${String(image.assetId).replace(/[^a-z0-9]+/gi, '-')}`;
  const picture = renderResponsivePicture(imageContext.registry, imageRef, {
    figure: false,
    priority: false,
    sizes: '(max-width: 640px) calc(100vw - 2.5rem), 760px',
    mobileSizes: '(max-width: 640px) calc(100vw - 2.5rem), 640px',
    describedBy: captionId,
  });
  return `<figure class="seo-image seo-image--educational" data-image-seo-role="educational" data-image-asset-id="${escapeHtml(image.assetId)}">
                    ${picture}
                    <figcaption id="${escapeHtml(captionId)}">${escapeHtml(image.caption)}</figcaption>
                </figure>`;
}

function insertEducationalImage(bodyHtml, imageContext) {
  if (!imageContext?.images?.educational) return bodyHtml;
  const figure = educationalFigureMarkup(imageContext);
  const targetId = imageContext.page.insertBefore;
  const headingPattern = new RegExp(`(<h2\\b[^>]*\\bid=(['"])${targetId}\\2[^>]*>)`, 'i');
  if (headingPattern.test(bodyHtml)) {
    return bodyHtml.replace(headingPattern, `${figure}\n$1`);
  }

  const articleEnd = bodyHtml.lastIndexOf('</article>');
  if (articleEnd >= 0) {
    return `${bodyHtml.slice(0, articleEnd)}${figure}\n${bodyHtml.slice(articleEnd)}`;
  }
  return `${bodyHtml}\n${figure}`;
}

function visibleArticleImageUrl(bodyHtml) {
  const source = String(bodyHtml || '')
    .match(/<figure\b[^>]*>[\s\S]*?<img\b[^>]*\bsrc=(['"])([^"']+)\1/i)?.[2] || '';
  if (!source) return '';
  try {
    const url = new URL(source, siteConfig.domain);
    return url.origin === siteConfig.domain ? `${siteConfig.domain}${url.pathname}` : url.href;
  } catch {
    return '';
  }
}

function appendHtmlClass(openTag, className) {
  return String(openTag || '').replace(
    /\bclass=(['"])([^"']*)\1/i,
    (_match, quote, classes) => `class=${quote}${classes} ${className}${quote}`
  );
}

function renderArticleHeroCopy(inner) {
  const structured = String(inner || '').replace(
    /(<div\b[^>]*\bclass=(['"])[^"']*\bflex\b[^"']*\2[^>]*>)([\s\S]*?)(<span\b[^>]*\baria-hidden=(['"])true\5[^>]*>[\s\S]*?<\/span>\s*)([\s\S]*?)(<\/div>\s*)(<h1\b[^>]*>[\s\S]*?<\/h1>)/i,
    (_block, metaOpen, _metaQuote, taxonomy, _break, _breakQuote, details, _metaClose, heading) => {
      const taxonomyOpen = appendHtmlClass(metaOpen, 'article-hero-taxonomy');
      const conciseTaxonomy = taxonomy.replace(
        /(<a\b[^>]*>\s*)(?:Topic|Tema):\s*/i,
        '$1'
      );
      return [
        '<div class="article-hero-copy">',
        `${taxonomyOpen}${conciseTaxonomy}</div>`,
        heading,
        `<div class="article-hero-details">${details.trim()}</div>`,
        '</div>',
      ].join('\n');
    }
  );

  if (structured !== inner) return structured;
  return String(inner || '').replace(
    /(<div\b[^>]*\bclass=(['"])[^"']*\bflex\b[^"']*\2[^>]*>[\s\S]*?<\/div>\s*)(<h1\b[^>]*>[\s\S]*?<\/h1>)/i,
    '<div class="article-hero-copy">\n$1$3\n</div>'
  );
}

function moveEditorialFigureIntoArticleHeader(bodyHtml) {
  const source = String(bodyHtml || '');
  const figurePattern = /<figure\b[^>]*\bdata-image-seo-role=(['"])editorial\1[^>]*>[\s\S]*?<\/figure>/i;
  const figure = source.match(figurePattern)?.[0];
  if (!figure) return source;

  const headerOpen = source.match(/<header\b[^>]*>/i)?.[0];
  if (!headerOpen) return source;

  const withoutFigure = source.replace(figurePattern, '');
  const promotedHeader = upsertHtmlAttribute(headerOpen, 'data-image-seo-hero', 'true');
  const moved = withoutFigure.replace(headerOpen, `${promotedHeader}\n${figure}`);
  return moved.replace(
    /(<header\b[^>]*\bdata-image-seo-hero=(['"])true\2[^>]*>)([\s\S]*?)(<\/header>)/i,
    (block, open, _quote, inner, close) => {
      if (/\bclass=(['"])[^"']*\barticle-hero-copy\b/i.test(inner)) return block;
      const wrapped = renderArticleHeroCopy(inner);
      return `${open}${wrapped}${close}`;
    }
  );
}

function optimizeBlogArticleImages(bodyHtml, meta, imageContext = null) {
  const visibleFigureImage = visibleArticleImageUrl(bodyHtml);
  const sourceImage = meta.preloadImage || meta.ogImage || visibleFigureImage;
  const normalizedSource = (() => {
    try {
      return new URL(sourceImage, siteConfig.domain).pathname;
    } catch {
      return sourceImage;
    }
  })();
  const sourceStem = imageStem(normalizedSource);
  if (!sourceStem) return bodyHtml;

  const dimensions = resolveImageDimensions(normalizedSource, { width: 1200, height: 675 });
  const srcset = responsiveBlogImageSrcset(normalizedSource);
  let transformed = false;

  const optimizedBody = String(bodyHtml || '').replace(/(<figure\b[^>]*>)([\s\S]*?)(<\/figure>)/gi, (block, open, inner, close) => {
    if (transformed) return block;
    const imgTag = inner.match(/<img\b[^>]*>/i)?.[0];
    const imageSrc = imgTag?.match(/\bsrc=(['"])([^"']+)\1/i)?.[2];
    if (!imgTag || imageStem(imageSrc) !== sourceStem) return block;

    transformed = true;
    const caption = inner.match(/<figcaption\b[\s\S]*?<\/figcaption>/i)?.[0] || '';
    const editorial = imageContext?.images?.editorial;
    const editorialRef = imageContext?.page?.images?.editorial;
    const picture = editorial
      ? renderResponsivePicture(imageContext.registry, editorialRef, {
          figure: false,
          priority: true,
          sizes: '100vw',
        })
      : renderArticlePicture({
          src: normalizedSource,
          srcset,
          alt: imageAltFromTag(imgTag, meta.ogImageAlt || meta.title),
          width: dimensions.width,
          height: dimensions.height,
          role: 'editorial',
        });
    const editorialCaption = editorial?.caption
      ? `<figcaption>${escapeHtml(editorial.caption)}</figcaption>`
      : caption;
    const assetId = editorial?.assetId
      ? ` data-image-asset-id="${escapeHtml(editorial.assetId)}"`
      : '';
    let figureOpen = addFigureRole(open, 'editorial').replace(/>$/, `${assetId}>`);
    const mobilePosition = editorialRef?.mobileAspect
      ? imageContext.registry.assets[editorialRef.assetId]?.aspects?.[editorialRef.mobileAspect]?.position
      : null;
    if (mobilePosition) {
      figureOpen = appendStyleProperty(
        figureOpen,
        '--article-hero-mobile-position',
        `${mobilePosition.x}% ${mobilePosition.y}%`
      );
    }
    return `${figureOpen}\n                    ${picture}${editorialCaption ? `\n                    ${editorialCaption}` : ''}\n                ${close}`;
  });

  return imageContext?.page?.kind === 'article' && imageContext?.images?.editorial
    ? moveEditorialFigureIntoArticleHeader(optimizedBody)
    : optimizedBody;
}

function protectMailtoLinksFromCloudflareObfuscation(bodyHtml) {
  const source = String(bodyHtml || '');
  return source.replace(
    /<a\b[^>]*\bhref=(['"])mailto:[^"']+\1[^>]*>[\s\S]*?<\/a>/gi,
    (anchor, _quote, offset) => {
      const before = source.slice(0, offset).trimEnd();
      const after = source.slice(offset + anchor.length).trimStart();
      if (before.endsWith('<!--email_off-->') && after.startsWith('<!--/email_off-->')) {
        return anchor;
      }
      return `<!--email_off-->${anchor}<!--/email_off-->`;
    }
  );
}

function optimizeBlogIndexImages(bodyHtml) {
  let localBlogImageIndex = 0;
  return String(bodyHtml || '').replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc=(['"])([^"']+)\1/i)?.[2];
    if (!src || !/\/img\/blog\//i.test(src) || /^https?:/i.test(src)) return tag;

    const isPriorityImage = localBlogImageIndex === 0;
    localBlogImageIndex += 1;

    let next = tag;
    next = upsertHtmlAttribute(next, 'loading', isPriorityImage ? 'eager' : 'lazy');
    next = upsertHtmlAttribute(next, 'decoding', 'async');
    next = upsertHtmlAttribute(next, 'width', '800');
    next = upsertHtmlAttribute(next, 'height', '450');
    next = upsertHtmlAttribute(
      next,
      'sizes',
      '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
    );

    const srcset = responsiveBlogImageSrcset(src);
    if (srcset) next = upsertHtmlAttribute(next, 'srcset', srcset);

    if (isPriorityImage) {
      next = upsertHtmlAttribute(next, 'fetchpriority', 'high');
    } else {
      next = removeHtmlAttribute(next, 'fetchpriority');
    }
    return next;
  });
}

function renderManagedPage({ manifest, entryId, meta, bodyHtml, entryOverride = null }) {
  const assetVersion = readAssetVersion();
  const context = createRenderContext({ manifest, entryId, meta, entryOverride });
  const entry = context.entry;
  const imageContext = resolvePageImageContext(entry, meta);
  const editorial = imageContext?.images?.editorial;
  const structuredArticleImages = editorial && imageContext.page.kind === 'article'
    ? ['1x1', '4x3', '16x9'].map((aspect) => {
        const image = getResponsiveImageData(
          imageContext.registry,
          imageContext.page.images.editorial.assetId,
          aspect
        );
        return { url: absoluteUrl(image.src), width: image.width, height: image.height };
      })
    : null;
  const visibleEditorialUrl = meta.layout === 'blogArticle' && meta.ogType === 'article'
    ? visibleArticleImageUrl(bodyHtml)
    : '';
  const renderMeta = editorial
    ? {
        ...meta,
        ogImage: absoluteUrl(editorial.src),
        ogImageAlt: editorial.alt,
        twitterImage: absoluteUrl(editorial.src),
        twitterImageAlt: editorial.alt,
        structuredArticleImages,
      }
    : visibleEditorialUrl
      ? {
          ...meta,
          ogImage: visibleEditorialUrl,
          twitterImage: visibleEditorialUrl,
        }
      : meta;
  const navHtml = renderNavigation(context);
  let renderedBodyHtml = synchronizeVisibleArticleDate(bodyHtml, renderMeta);
  renderedBodyHtml = protectMailtoLinksFromCloudflareObfuscation(renderedBodyHtml);
  if (renderMeta.layout === 'blogIndex') {
    renderedBodyHtml = optimizeBlogIndexImages(renderedBodyHtml);
  }
  if (renderMeta.layout === 'blogArticle') {
    renderedBodyHtml = optimizeBlogArticleImages(renderedBodyHtml, renderMeta, imageContext);
    renderedBodyHtml = insertEducationalImage(renderedBodyHtml, imageContext);
  }

  const html = renderTemplate({
    HTML_ATTRS: htmlAttributes(renderMeta),
    BODY_ATTRS: bodyAttributes(renderMeta),
    HEAD_HTML: renderCommonHead(renderMeta, entry, assetVersion, renderedBodyHtml),
    BEFORE_BODY_HTML: renderBeforeBody(renderMeta),
    NAV_HTML: navHtml,
    CONTENT_HTML: renderContent(renderMeta, renderedBodyHtml, renderPageHero(context)),
    FOOTER_HTML: renderSharedFooter(context),
    SCRIPTS_HTML: renderScripts(renderMeta, assetVersion),
  });

  return inlineLucideIcons(html);
}

module.exports = {
  insertEducationalImage,
  moveEditorialFigureIntoArticleHeader,
  normalizeCanonicalOrganization,
  optimizeBlogIndexImages,
  optimizeBlogArticleImages,
  protectMailtoLinksFromCloudflareObfuscation,
  renderManagedPage,
  renderJsonLd,
  resolvePageImageContext,
  responsiveBlogImageSrcset,
  synchronizePreferredImage,
};
