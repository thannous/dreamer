const { getAndroidStoreUrl, siteConfig } = require('../docs-site-config');
const { escapeHtml } = require('../docs-source-utils');

function downloadAppLabel(lang) {
  if (lang === 'fr') return "Télécharger l'app";
  if (lang === 'es') return 'Descargar la app';
  if (lang === 'de') return 'App herunterladen';
  if (lang === 'it') return "Scarica l'app";
  return 'Download app';
}

function renderLanguageDropdown({ entry, lang, locales }) {
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

function navLinkClass(isActive) {
  return `${isActive ? 'text-dream-salmon' : 'hover:text-white'} transition-colors`;
}

function renderMobileMenuPanel(context) {
  const { entry, lang, locale, locales, routePath } = context;
  const resourcesHref = routePath('blog.index');
  const guidesHref = routePath('guide.index');
  const dictionaryHref = routePath('guide.dictionary');
  const aboutHref = routePath('page.about');
  const downloadLabel = downloadAppLabel(lang);
  const linkClass = 'block px-4 py-3 text-sm text-purple-100/80 hover:text-white hover:bg-white/5 transition-colors';

  const langLinks = siteConfig.languages
    .map((candidate) => {
      const candidateLocale = locales[candidate];
      const pagePath = entry?.locales?.[candidate]?.path || `/${candidate}/`;
      const activeClass = candidate === lang ? ' text-dream-salmon' : '';
      return `                    <a href="${pagePath}" hreflang="${candidate}" class="${linkClass}${activeClass}">${escapeHtml(candidateLocale.language)}</a>`;
    })
    .join('\n');

  return [
    '        <div id="mobileMenuPanel" class="hidden px-4 pb-4 pt-2">',
    '            <div class="mobile-menu-surface rounded-2xl py-2">',
    `                <a href="${resourcesHref}" class="${linkClass}">${escapeHtml(locale.resources)}</a>`,
    `                <a href="${guidesHref}" class="${linkClass}">${escapeHtml(locale.dreamGuides)}</a>`,
    `                <a href="${dictionaryHref}" class="${linkClass}">${escapeHtml(locale.dreamDictionary)}</a>`,
    `                <a href="${aboutHref}" class="${linkClass}">${escapeHtml(locale.about)}</a>`,
    `                <a href="${getAndroidStoreUrl(lang)}" class="${linkClass} text-dream-salmon" rel="nofollow noopener noreferrer" target="_blank">${escapeHtml(downloadLabel)}</a>`,
    '                <div class="border-t border-white/10 mt-2 pt-2">',
    langLinks,
    '                </div>',
    '            </div>',
    '        </div>',
  ].join('\n');
}

function renderNavigation(context) {
  const { entry, lang, locale, locales, meta, routePath } = context;
  const activeNav = meta.activeNav || null;
  const dropdown = renderLanguageDropdown({ entry, lang, locales });
  const resourcesHref = routePath('blog.index');
  const guidesHref = routePath('guide.index');
  const dictionaryHref = routePath('guide.dictionary');
  const aboutHref = routePath('page.about');
  const isBlogPremium = meta.layout === 'blogIndex' && String(meta.mainClass || '').includes('blog-premium');
  const downloadLabel = downloadAppLabel(lang);
  const storeHref = getAndroidStoreUrl(lang);

  const navClasses = [
    'fixed w-full z-50 top-0 left-0 transition-all duration-300 py-4 noctalia-premium-nav',
    isBlogPremium ? 'blog-premium-nav' : '',
  ].filter(Boolean).join(' ');
  return [
    `    <nav class="${navClasses}" id="navbar" data-shrink-on-scroll="true" data-expanded-class="py-4" data-compact-class="py-2">`,
    '        <div class="noctalia-premium-nav-inner px-4 sm:px-8">',
    `            <a href="/${lang}/" class="flex items-center gap-2 min-w-max">`,
    '                <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>',
    '                <span class="noctalia-premium-brand-text font-serif text-2xl font-semibold tracking-wide text-dream-cream">Noctalia</span>',
    '            </a>',
    '            <div id="navDesktopLinks" class="noctalia-premium-links flex items-center text-sm font-sans text-purple-100/80">',
    `                <a href="${resourcesHref}" class="${navLinkClass(activeNav === 'resources')}">${escapeHtml(locale.resources)}</a>`,
    `                <a href="${guidesHref}" class="${navLinkClass(activeNav === 'guides')}">${escapeHtml(locale.dreamGuides)}</a>`,
    `                <a href="${dictionaryHref}" class="${navLinkClass(activeNav === 'dictionary')}">${escapeHtml(locale.dreamDictionary)}</a>`,
    `                <a href="${aboutHref}" class="noctalia-premium-action noctalia-premium-about hover:text-white transition-colors">${escapeHtml(locale.about)}</a>`,
    '            </div>',
    '            <div class="noctalia-premium-nav-actions flex items-center gap-3">',
    '                <div id="navDesktopLangDropdown" class="language-dropdown-wrapper relative">',
    '                    <button type="button" class="px-3 py-2 rounded-full text-sm text-purple-100/80 hover:text-white transition-colors flex items-center gap-2" aria-haspopup="true" aria-expanded="false" aria-label="Choose language" id="languageDropdownButton">',
    '                        <i data-lucide="languages" class="w-4 h-4"></i>',
    `                        <span>${lang.toUpperCase()}</span>`,
    '                        <i data-lucide="chevron-down" class="w-3 h-3 transition-transform" id="dropdownChevron"></i>',
    '                    </button>',
    '                    <div class="language-dropdown-menu absolute right-0 top-full mt-2 glass-panel rounded-2xl py-2 min-w-[160px] hidden z-50" role="menu" aria-labelledby="languageDropdownButton" id="languageDropdownMenu">',
    dropdown,
    '                    </div>',
    '                </div>',
    `                <a href="${storeHref}" class="noctalia-premium-download rounded-full px-4 py-2 text-sm font-semibold transition-colors" rel="nofollow noopener noreferrer" target="_blank">${escapeHtml(downloadLabel)}</a>`,
    '                <button id="mobileMenuButton" class="hidden p-2 text-purple-100/80 hover:text-white transition-colors" aria-label="Menu" aria-expanded="false">',
    '                    <i data-lucide="menu" id="mobileMenuIcon" class="w-5 h-5"></i>',
    '                </button>',
    '            </div>',
    '        </div>',
    renderMobileMenuPanel(context),
    '    </nav>',
  ].join('\n');
}

module.exports = {
  renderNavigation,
};
