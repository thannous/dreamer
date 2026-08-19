const fs = require('fs');
const path = require('path');
const {
  DOCS_SRC_DIR,
  DATA_DIR,
  STATIC_DATA_DIR,
  getAndroidStoreUrl,
  getWebAppUrl,
  siteConfig,
} = require('../docs-site-config');
const { escapeHtml, readJson, readSourceDocument } = require('../docs-source-utils');

const dreamSymbolsData = readJson(path.join(DATA_DIR, 'dream-symbols.json'));
const curationPagesData = readJson(path.join(STATIC_DATA_DIR, 'curation-pages.json'));

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

function pricingLabel(lang) {
  if (lang === 'fr') return 'Tarifs';
  if (lang === 'es') return 'Precios';
  if (lang === 'de') return 'Preise';
  if (lang === 'it') return 'Prezzi';
  if (lang === 'pt-br') return 'Preços';
  return 'Pricing';
}

function featuresLabel(lang) {
  if (lang === 'pt-br') return 'Funcionalidades';
  return 'Features';
}

function faqLabel(lang) {
  if (lang === 'pt-br') return 'Perguntas frequentes';
  return 'FAQ';
}

function dreamAppAlternativeLabel(lang) {
  if (lang === 'fr') return 'Alternative DreamApp';
  if (lang === 'es') return 'Alternativa DreamApp';
  if (lang === 'de') return 'DreamApp Alternative';
  if (lang === 'it') return 'Alternativa DreamApp';
  return 'DreamApp alternative';
}

function oniriAlternativeLabel(lang) {
  if (lang === 'fr') return 'Alternative Oniri';
  if (lang === 'es') return 'Alternativa Oniri';
  if (lang === 'de') return 'Oniri Alternative';
  if (lang === 'it') return 'Alternativa Oniri';
  return 'Oniri alternative';
}

function aiDreamAppLabel(lang) {
  if (lang === 'fr') return 'Application reves IA';
  if (lang === 'es') return 'App suenos IA';
  if (lang === 'de') return 'KI-Traumdeutung-App';
  if (lang === 'it') return 'App sogni IA';
  if (lang === 'pt-br') return 'App de sonhos com IA';
  return 'AI dream app';
}

function dreamDictionaryAppLabel(lang) {
  if (lang === 'fr') return 'Dictionnaire de reves app';
  if (lang === 'es') return 'Diccionario de suenos app';
  if (lang === 'de') return 'Traumlexikon App';
  if (lang === 'it') return 'Dizionario sogni app';
  if (lang === 'pt-br') return 'App dicionário de sonhos';
  return 'Dream dictionary app';
}

function androidDreamAnalysisAppLabel(lang) {
  if (lang === 'fr') return 'Analyse de reve Android';
  if (lang === 'es') return 'Analisis suenos Android';
  if (lang === 'de') return 'Android Traumanalyse';
  if (lang === 'it') return 'Analisi sogni Android';
  if (lang === 'pt-br') return 'Análise de sonhos Android';
  return 'Android dream analysis';
}

function voiceDreamJournalLabel(lang) {
  if (lang === 'fr') return 'Journal de reves vocal';
  if (lang === 'es') return 'Diario suenos por voz';
  if (lang === 'de') return 'Traumtagebuch Sprache';
  if (lang === 'it') return 'Diario sogni vocale';
  if (lang === 'pt-br') return 'Diário de sonhos por voz';
  return 'Voice dream journal';
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
  const { lang, locale, hasRoute, routePath } = context;

  // Every footer link is gated on the destination actually existing in the
  // current language (partial-coverage languages never link to missing pages).
  const featuredResources = [
    {
      pageId: 'blog.index',
      label: locale.blog,
    },
    {
      pageId: 'page.alternatives',
      label: alternativesLabel(lang),
    },
    {
      pageId: 'page.pricing',
      label: pricingLabel(lang),
    },
    {
      pageId: 'page.features',
      label: featuresLabel(lang),
    },
    {
      pageId: 'page.faq',
      label: faqLabel(lang),
    },
    {
      pageId: 'page.dreamapp-alternative',
      label: dreamAppAlternativeLabel(lang),
    },
    {
      pageId: 'page.oniri-alternative',
      label: oniriAlternativeLabel(lang),
    },
    {
      pageId: 'page.ai-dream-interpretation-app',
      label: aiDreamAppLabel(lang),
    },
    {
      pageId: 'page.dream-dictionary-app',
      label: dreamDictionaryAppLabel(lang),
    },
    {
      pageId: 'page.android-dream-analysis-app',
      label: androidDreamAnalysisAppLabel(lang),
    },
    {
      pageId: 'page.voice-dream-journal',
      label: voiceDreamJournalLabel(lang),
    },
  ]
    .filter((link) => hasRoute(link.pageId, lang))
    .map((link) => ({ href: routePath(link.pageId), label: link.label }));

  featuredResources.push(
    ...(siteConfig.seoLinking?.featuredBlogEntries || [])
      .map((entryId) => {
        if (!hasRoute(entryId, lang)) return null;
        const href = routePath(entryId);
        const label = featuredBlogTitles.get(`${entryId}:${lang}`);
        if (!label) return null;
        return { href, label };
      })
      .filter(Boolean)
  );

  const featuredGuides = [
    {
      pageId: 'guide.dictionary',
      label: locale.dreamDictionary,
    },
    {
      pageId: 'guide.index',
      label: locale.dreamGuides,
    },
  ]
    .filter((link) => hasRoute(link.pageId, lang))
    .map((link) => ({ href: routePath(link.pageId), label: link.label }));

  featuredGuides.push(
    ...(siteConfig.seoLinking?.featuredGuideEntries || [])
      .map((entryId) => {
        if (!hasRoute(entryId, lang)) return null;
        const pageId = entryId.replace(/^guide\./, '');
        const page = (curationPagesData.pages || []).find((item) => item.id === pageId);
        if (!page || !page[lang]?.title) return null;
        return {
          href: routePath(entryId),
          label: page[lang].title,
        };
      })
      .filter(Boolean)
  );

  const popularSymbols = (siteConfig.seoLinking?.featuredSymbols || [])
    .map((symbolId) => {
      if (!hasRoute(`symbol.${symbolId}`, lang)) return null;
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

function renderFooterLinks(links) {
  return links
    .map(
      (link) =>
        `                    <li><a href="${link.href}" class="hover:text-dream-salmon transition-colors">${escapeHtml(link.label)}</a></li>`
    )
    .join('\n');
}

function renderFooter(context) {
  const { lang, locale, meta, hasRoute, routePath } = context;
  const { featuredResources, featuredGuides, popularSymbols } = buildSeoFooterLinks(context);
  const isBlogPremium = meta.layout === 'blogIndex' && String(meta.mainClass || '').includes('blog-premium');
  const homeHref = lang === 'en' ? '/' : `/${lang}/`;
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

  // Link columns only render when they have at least one destination
  // available in the current language.
  const resourcesColumn = featuredResources.length > 0
    ? [
        '            <div>',
        `                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.footerResources)}</h5>`,
        '                <ul class="space-y-2 text-sm text-gray-500">',
        renderFooterLinks(featuredResources),
        '                </ul>',
        '            </div>',
      ].join('\n')
    : null;
  const guidesColumn = featuredGuides.length > 0
    ? [
        '            <div>',
        `                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.footerGuides)}</h5>`,
        '                <ul class="space-y-2 text-sm text-gray-500">',
        renderFooterLinks(featuredGuides),
        '                </ul>',
        '            </div>',
      ].join('\n')
    : null;
  const symbolsColumn = popularSymbols.length > 0
    ? [
        '            <div>',
        `                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.popularSymbols)}</h5>`,
        '                <ul class="space-y-2 text-sm text-gray-500">',
        renderFooterLinks(popularSymbols),
        '                </ul>',
        '            </div>',
      ].join('\n')
    : null;

  const legalLinks = [
    { pageId: 'page.about', label: locale.about },
    { pageId: 'page.press', label: pressKitLabel(lang) },
    { pageId: 'legal.notice', label: locale.legalNotice },
    { pageId: 'legal.privacy', label: locale.privacy },
    { pageId: 'legal.terms', label: locale.terms },
    { pageId: 'legal.account-deletion', label: locale.accountDeletion },
  ]
    .filter((link) => hasRoute(link.pageId, lang))
    .map(
      (link) =>
        `                    <li><a href="${routePath(link.pageId)}" class="hover:text-dream-salmon transition-colors">${escapeHtml(link.label)}</a></li>`
    )
    .join('\n');

  return [
    `    <footer class="${footerClass}">`,
    '        <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-10 mb-16">',
    '            <div class="xl:col-span-2">',
    `                <a href="${homeHref}" class="flex items-center gap-2 mb-4">`,
    '                    <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>',
    '                    <h4 class="font-serif text-2xl text-dream-cream">Noctalia</h4>',
    '                </a>',
    `                <p class="text-sm text-gray-500 max-w-xs mb-6">${escapeHtml(locale.footerTagline)}</p>`,
    '                <div class="flex gap-4">',
    socialLinks,
    '                </div>',
    '            </div>',
    resourcesColumn,
    guidesColumn,
    symbolsColumn,
    '            <div>',
    `                <h5 class="font-bold mb-4 text-white">${escapeHtml(locale.footerLegal)}</h5>`,
    '                <ul class="space-y-2 text-sm text-gray-500 mb-4">',
    legalLinks,
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
    `                    <a href="${getWebAppUrl(lang, { medium: 'footer' })}" class="glass-button px-4 py-2 rounded-lg flex items-center gap-3 text-left hover:bg-white/10 footer-webapp-cta" rel="noopener" target="_blank">`,
    '                        <i data-lucide="globe" class="w-5 h-5"></i>',
    '                        <div class="leading-none">',
    `                            <div class="text-[9px] uppercase">${escapeHtml(locale.webAppKicker)}</div>`,
    `                            <div class="text-sm font-bold">${escapeHtml(locale.webAppCta)}</div>`,
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
  ]
    .filter(Boolean)
    .join('\n');
}

module.exports = {
  buildSeoFooterLinks,
  renderFooter,
};
