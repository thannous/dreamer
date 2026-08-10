const { getAndroidStoreUrl, getLanguageTag, siteConfig } = require('../docs-site-config');
const { escapeHtml } = require('../docs-source-utils');

function downloadAppLabel(lang) {
  if (lang === 'fr') return "Télécharger l'app";
  if (lang === 'es') return 'Descargar la app';
  if (lang === 'de') return 'App herunterladen';
  if (lang === 'it') return "Scarica l'app";
  if (lang === 'pt-br') return 'Baixar o app';
  return 'Download app';
}

function normalizeHomePath(lang, pagePath) {
  if (lang !== 'en') return pagePath;
  return pagePath === '/en/' ? '/' : pagePath;
}

// Languages where the current page actually exists. Partial-coverage pages
// never offer a language switch that would land on a non-existent URL.
function availableLanguages(entry) {
  if (!entry) return siteConfig.languages;
  return siteConfig.languages.filter((candidate) => Boolean(entry.locales?.[candidate]?.path));
}

function renderLanguageDropdown({ entry, lang, locales }) {
  return availableLanguages(entry)
    .map((candidate) => {
      const locale = locales[candidate];
      const pagePath = normalizeHomePath(candidate, entry?.locales?.[candidate]?.path || `/${candidate}/`);
      const currentClass = candidate === lang ? '' : ' hidden';
      return [
        `                    <a href="${pagePath}" hreflang="${getLanguageTag(candidate)}" class="dropdown-item flex items-center justify-between px-4 py-2 text-sm text-purple-100/80 hover:bg-white/10 hover:text-white transition-colors" role="menuitem">`,
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

// Primary nav destinations, rendered only when the destination exists in the
// current language (collections unavailable in a language are hidden).
function primaryNavLinks(context) {
  const { lang, locale, hasRoute, routePath } = context;
  return [
    { pageId: 'blog.index', label: locale.resources, nav: 'resources' },
    { pageId: 'guide.index', label: locale.dreamGuides, nav: 'guides' },
    { pageId: 'guide.dictionary', label: locale.dreamDictionary, nav: 'dictionary' },
    { pageId: 'page.about', label: locale.about, nav: 'about' },
  ]
    .filter((link) => hasRoute(link.pageId, lang))
    .map((link) => ({ ...link, href: routePath(link.pageId) }));
}

function renderMobileMenuPanel(context) {
  const { entry, lang, locales } = context;
  const links = primaryNavLinks(context);
  const downloadLabel = downloadAppLabel(lang);
  const linkClass = 'block px-4 py-3 text-sm text-purple-100/80 hover:text-white hover:bg-white/5 transition-colors';

  const navLinks = links
    .map(
      (link) =>
        `                <a href="${link.href}" class="${linkClass}">${escapeHtml(link.label)}</a>`
    )
    .join('\n');

  const langLinks = availableLanguages(entry)
    .map((candidate) => {
      const candidateLocale = locales[candidate];
      const pagePath = normalizeHomePath(candidate, entry?.locales?.[candidate]?.path || `/${candidate}/`);
      const activeClass = candidate === lang ? ' text-dream-salmon' : '';
      return `                    <a href="${pagePath}" hreflang="${getLanguageTag(candidate)}" class="${linkClass}${activeClass}">${escapeHtml(candidateLocale.language)}</a>`;
    })
    .join('\n');

  return [
    '        <div id="mobileMenuPanel" class="hidden px-4 pb-4 pt-2">',
    '            <div class="mobile-menu-surface rounded-2xl py-2">',
    navLinks,
    `                <a href="${getAndroidStoreUrl(lang)}" class="${linkClass} text-dream-salmon" rel="nofollow noopener noreferrer" target="_blank">${escapeHtml(downloadLabel)}</a>`,
    '                <div class="border-t border-white/10 mt-2 pt-2">',
    langLinks,
    '                </div>',
    '            </div>',
    '        </div>',
  ].join('\n');
}

function renderNavigation(context) {
  const { entry, lang, locales, meta } = context;
  const dropdown = renderLanguageDropdown({ entry, lang, locales });
  const links = primaryNavLinks(context);
  const homeHref = lang === 'en' ? '/' : `/${lang}/`;
  const isBlogPremium = meta.layout === 'blogIndex' && String(meta.mainClass || '').includes('blog-premium');
  const downloadLabel = downloadAppLabel(lang);
  const storeHref = getAndroidStoreUrl(lang);

  const desktopLinks = links
    .map((link) => {
      const linkClass =
        link.nav === 'about'
          ? 'noctalia-premium-action noctalia-premium-about hover:text-white transition-colors'
          : navLinkClass(meta.activeNav === link.nav);
      return `                <a href="${link.href}" class="${linkClass}">${escapeHtml(link.label)}</a>`;
    })
    .join('\n');

  const navClasses = [
    'fixed w-full z-50 top-0 left-0 transition-colors duration-300 py-4 noctalia-premium-nav',
    isBlogPremium ? 'blog-premium-nav' : '',
  ].filter(Boolean).join(' ');
  return [
    `    <nav class="${navClasses}" id="navbar" data-shrink-on-scroll="true" data-expanded-class="py-4" data-compact-class="py-2">`,
    '        <div class="noctalia-premium-nav-inner px-4 sm:px-8">',
    `            <a href="${homeHref}" class="flex items-center gap-2 min-w-max">`,
    '                <i data-lucide="moon" class="w-6 h-6 text-dream-salmon"></i>',
    '                <span class="noctalia-premium-brand-text font-serif text-2xl font-semibold tracking-wide text-dream-cream">Noctalia</span>',
    '            </a>',
    '            <div id="navDesktopLinks" class="noctalia-premium-links flex items-center text-sm font-sans text-purple-100/80">',
    desktopLinks,
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
    '        <div id="mobileMenuBackdrop" class="hidden mobile-menu-backdrop" aria-hidden="true"></div>',
    renderMobileMenuPanel(context),
    '    </nav>',
  ].join('\n');
}

module.exports = {
  availableLanguages,
  renderNavigation,
};
