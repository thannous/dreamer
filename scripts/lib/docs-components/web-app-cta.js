const { getAndroidStoreUrl, getWebAppUrl } = require('../docs-site-config');
const { escapeHtml } = require('../docs-source-utils');

// Shared "try it in your browser" module for blog articles. Article bodies
// are hand-authored, so the renderer appends one module per article instead
// of editing every localized source file.
const WEB_APP_CTA_PATTERN = /\bdata-web-app-cta(?:\s*=|\s|>)/i;
const BLOG_NAV_MARKER_PATTERN = /<!--\s*Blog Nav Start\s*-->/i;

function assertLocaleLabels(locale, lang) {
  for (const key of ['webAppHeading', 'webAppCta', 'webAppNote', 'googlePlay']) {
    if (!locale?.[key]) {
      throw new Error(`Missing locale key ${key} for the web app CTA (${lang})`);
    }
  }
}

function blogArticleContentId(pageId) {
  return String(pageId || '').replace(/^blog\./, '');
}

function renderBlogWebAppCta({ lang, locale, pageId }) {
  assertLocaleLabels(locale, lang);
  const webAppHref = getWebAppUrl(lang, { medium: 'blog', content: blogArticleContentId(pageId) });
  const storeHref = getAndroidStoreUrl(lang);

  return [
    '<!-- Web App CTA -->',
    '<aside class="glass-panel rounded-3xl p-8 md:p-10 mt-16 mb-12 text-center border border-dream-salmon/20" data-web-app-cta="blog">',
    `<h3 class="font-serif text-2xl md:text-3xl mb-4 text-dream-cream">${escapeHtml(locale.webAppHeading)}</h3>`,
    `<p class="text-purple-200/70 mb-6 max-w-lg mx-auto">${escapeHtml(locale.webAppNote)}</p>`,
    '<div class="flex flex-col sm:flex-row flex-wrap justify-center gap-3">',
    `<a class="inline-flex items-center justify-center gap-2 px-8 py-4 bg-dream-salmon text-dream-dark rounded-full font-bold hover:bg-dream-salmon/90 transition-colors" href="${webAppHref}" rel="noopener" target="_blank">${escapeHtml(locale.webAppCta)} <i class="w-5 h-5" data-lucide="arrow-right"></i></a>`,
    `<a class="inline-flex items-center justify-center gap-2 px-8 py-4 glass-button text-dream-cream rounded-full font-bold transition-colors" href="${storeHref}" rel="nofollow noopener noreferrer" target="_blank"><i class="w-5 h-5" data-lucide="play"></i> ${escapeHtml(locale.googlePlay)}</a>`,
    '</div>',
    '</aside>',
  ].join('\n');
}

// Inserts the module once per article: before the prev/next navigation when
// the article declares one, otherwise right before the article closes.
function insertBlogWebAppCta(bodyHtml, moduleHtml) {
  const source = String(bodyHtml || '');
  if (!moduleHtml || WEB_APP_CTA_PATTERN.test(source)) return source;

  const navMarker = source.match(BLOG_NAV_MARKER_PATTERN);
  if (navMarker) {
    return `${source.slice(0, navMarker.index)}${moduleHtml}\n${source.slice(navMarker.index)}`;
  }

  const closingTags = [...source.matchAll(/<\/article\s*>/gi)];
  const lastClosingTag = closingTags.at(-1);
  if (!lastClosingTag) return `${source}${source ? '\n' : ''}${moduleHtml}`;

  return `${source.slice(0, lastClosingTag.index)}${moduleHtml}\n${source.slice(lastClosingTag.index)}`;
}

function renderBlogWebAppCtaModule({ bodyHtml, lang, locale, pageId }) {
  return insertBlogWebAppCta(bodyHtml, renderBlogWebAppCta({ lang, locale, pageId }));
}

module.exports = {
  WEB_APP_CTA_PATTERN,
  blogArticleContentId,
  insertBlogWebAppCta,
  renderBlogWebAppCta,
  renderBlogWebAppCtaModule,
};
