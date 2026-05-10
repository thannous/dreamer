const fs = require('fs');
const path = require('path');
const {
  DOCS_DIR,
  DOCS_SRC_DIR,
  getAndroidStoreUrl,
  siteConfig,
} = require('../docs-site-config');
const { escapeHtml, readJson, readSourceDocument } = require('../docs-source-utils');

const dreamSymbolsData = readJson(path.join(DOCS_DIR, 'data', 'dream-symbols.json'));
const curationPagesData = readJson(path.join(DOCS_DIR, 'data', 'curation-pages.json'));

function stripSiteSuffix(title) {
  return String(title || '').replace(/\s*\|\s*Noctalia\s*$/i, '').trim();
}

function pressKitLabel(lang) {
  if (lang === 'fr') return 'Presse';
  if (lang === 'es') return 'Prensa';
  if (lang === 'de') return 'Presse';
  if (lang === 'it') return 'Stampa';
  return 'Press kit';
}

function alternativesLabel(lang) {
  if (lang === 'fr') return 'Applications de reves';
  if (lang === 'es') return 'Apps de suenos';
  if (lang === 'de') return 'Traumtagebuch-Apps';
  if (lang === 'it') return 'App diario dei sogni';
  return 'Dream journal apps';
}

function loadFeaturedBlogTitles() {
  const titles = new Map();
  const featuredEntries = siteConfig.seoLinking?.featuredBlogEntries || [];

  for (const entryId of featuredEntries) {
    for (const lang of siteConfig.languages) {
      const sourcePath = path.join(DOCS_SRC_DIR, 'content', 'blog', entryId, `${lang}.md`);
      if (!fs.existsSync(sourcePath)) continue;
      const { meta } = readSourceDocument(sourcePath);
      titles.set(`${entryId}:${lang}`, stripSiteSuffix(meta.title));
    }
  }

  return titles;
}

const featuredBlogTitles = loadFeaturedBlogTitles();

function buildSeoFooterLinks(context) {
  const { lang, locale, routePath } = context;

  const featuredResources = [
    {
      href: routePath('blog.index'),
      label: locale.resources,
    },
    {
      href: routePath('page.alternatives'),
      label: alternativesLabel(lang),
    },
    ...(siteConfig.seoLinking?.featuredBlogEntries || [])
      .map((entryId) => {
        const href = routePath(entryId);
        const label = featuredBlogTitles.get(`${entryId}:${lang}`);
        if (!href || !label) return null;
        return { href, label };
      })
      .filter(Boolean),
  ];

  const featuredGuides = [
    {
      href: routePath('guide.dictionary'),
      label: locale.dreamDictionary,
    },
    {
      href: routePath('guide.index'),
      label: locale.dreamGuides,
    },
    ...(siteConfig.seoLinking?.featuredGuideEntries || [])
      .map((entryId) => {
        const pageId = entryId.replace(/^guide\./, '');
        const page = (curationPagesData.pages || []).find((item) => item.id === pageId);
        if (!page || !page[lang]?.title) return null;
        return {
          href: routePath(entryId),
          label: page[lang].title,
        };
      })
      .filter(Boolean),
  ];

  const popularSymbols = (siteConfig.seoLinking?.featuredSymbols || [])
    .map((symbolId) => {
      const symbol = (dreamSymbolsData.symbols || []).find((item) => item.id === symbolId);
      if (!symbol || !symbol[lang]?.name) return null;
      return {
        href: routePath(`symbol.${symbolId}`),
        label: symbol[lang].name,
      };
    })
    .filter(Boolean);

  return { featuredResources, featuredGuides, popularSymbols };
}

function renderFooterLinks(links, { highlightFirst = false } = {}) {
  return links
    .map(
      (link, index) =>
        `                    <li><a href="${link.href}" class="${highlightFirst && index === 0 ? 'text-dream-salmon' : 'hover:text-dream-salmon'} transition-colors">${escapeHtml(link.label)}</a></li>`
    )
    .join('\n');
}

function renderFooter(context) {
  const { lang, locale, meta, routePath } = context;
  const { featuredResources, featuredGuides, popularSymbols } = buildSeoFooterLinks(context);
  const isBlogPremium = meta.layout === 'blogIndex' && String(meta.mainClass || '').includes('blog-premium');
  const footerClass = meta.layout === 'landing'
    ? 'site-footer landing-footer pb-10 pt-20 border-t border-white/5 px-6 bg-[#05020a]'
    : `site-footer${isBlogPremium ? ' blog-premium-footer' : ''} pb-10 pt-20 border-t border-white/5 px-6 bg-[#05020a]`;
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
    `    <footer class="${footerClass}">`,
    '        <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-10 mb-16">',
    '            <div class="xl:col-span-2">',
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
    renderFooterLinks(featuredResources, { highlightFirst: true }),
    '                </ul>',
    '            </div>',
    '            <div>',
    `                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.dreamDictionary)}</h5>`,
    '                <ul class="space-y-2 text-sm text-gray-500">',
    renderFooterLinks(featuredGuides, { highlightFirst: true }),
    '                </ul>',
    '            </div>',
    '            <div>',
    `                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.popularSymbols)}</h5>`,
    '                <ul class="space-y-2 text-sm text-gray-500">',
    renderFooterLinks(popularSymbols),
    '                </ul>',
    '            </div>',
    '            <div>',
    `                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.footerLegal)}</h5>`,
    '                <ul class="space-y-2 text-sm text-gray-500 mb-4">',
    `                    <li><a href="${routePath('page.about')}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.about)}</a></li>`,
    `                    <li><a href="${routePath('page.press')}" class="hover:text-dream-salmon transition-colors">${escapeHtml(pressKitLabel(lang))}</a></li>`,
    `                    <li><a href="${routePath('legal.notice')}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.legalNotice)}</a></li>`,
    `                    <li><a href="${routePath('legal.privacy')}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.privacy)}</a></li>`,
    `                    <li><a href="${routePath('legal.terms')}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.terms)}</a></li>`,
    `                    <li><a href="${routePath('legal.account-deletion')}" class="hover:text-dream-salmon transition-colors">${escapeHtml(locale.accountDeletion)}</a></li>`,
    '                </ul>',
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

module.exports = {
  buildSeoFooterLinks,
  renderFooter,
};
