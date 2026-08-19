/* global describe, it, expect */

const fs = require('fs');
const path = require('path');

const {
  getAndroidStoreUrl,
  getCollectionLanguages,
  getLanguageTag,
  getStaticPagePath,
  getWebAppUrl,
  siteConfig,
} = require('./lib/docs-site-config');
const { SUPPORTED_LANGS, SUPPORTED_LANGUAGE_TAGS } = require('./lib/docs-seo-utils');
const { buildSiteManifest } = require('./lib/site-manifest');
const { renderAlternateLinks, renderLocaleAlternates } = require('./lib/docs-renderer');

const ROOT_DIR = path.resolve(__dirname, '..');
const DOMAIN = siteConfig.domain;

describe('partial-coverage language configuration (pt-br)', () => {
  it('registers pt-br with its BCP 47 tag, Open Graph locale and Play Store override', () => {
    expect(siteConfig.languages).toContain('pt-br');
    expect(SUPPORTED_LANGS).toEqual(['en', 'fr', 'es', 'de', 'it', 'pt-br']);
    expect(SUPPORTED_LANGUAGE_TAGS).toEqual(['en', 'fr', 'es', 'de', 'it', 'pt-BR']);
    expect(getLanguageTag('pt-br')).toBe('pt-BR');
    expect(getLanguageTag('fr')).toBe('fr');
    expect(siteConfig.localeCodes['pt-br']).toBe('pt_BR');
  });

  it('keeps blog, symbols and guides collections on the five full-coverage languages', () => {
    for (const collectionId of ['blog', 'symbols', 'guides']) {
      expect(getCollectionLanguages(collectionId)).toEqual(['en', 'fr', 'es', 'de', 'it']);
    }
    expect(getCollectionLanguages('unknown-collection')).toEqual(siteConfig.languages);
  });

  it('builds the Google Play CTA with hl=pt-BR for pt-br and the raw code elsewhere', () => {
    expect(getAndroidStoreUrl('pt-br')).toBe(
      `${siteConfig.storeLinks.androidBase}&hl=pt-BR`
    );
    expect(getAndroidStoreUrl('fr')).toBe(`${siteConfig.storeLinks.androidBase}&hl=fr`);
    expect(getAndroidStoreUrl()).toBe(siteConfig.storeLinks.androidBase);
  });

  it('builds the web app CTA on dream.noctalia.app with stable, encoded UTM attribution only', () => {
    expect(siteConfig.storeLinks.webAppBase).toBe('https://dream.noctalia.app/');

    expect(getWebAppUrl('fr', { medium: 'nav' })).toBe(
      'https://dream.noctalia.app/?utm_source=noctalia.app&utm_medium=nav&utm_campaign=web_app'
    );
    expect(getWebAppUrl('pt-br', { medium: 'footer' })).toBe(
      'https://dream.noctalia.app/?utm_source=noctalia.app&utm_medium=footer&utm_campaign=web_app'
    );
    expect(getWebAppUrl('en', { medium: 'symbol_page', content: 'being-chased' })).toBe(
      'https://dream.noctalia.app/?utm_source=noctalia.app&utm_medium=symbol_page&utm_campaign=web_app&utm_content=being-chased'
    );
    // Content ids are URL-encoded and the language never leaks into the query.
    expect(getWebAppUrl('de', { medium: 'blog', content: 'a b&c/é' })).toBe(
      'https://dream.noctalia.app/?utm_source=noctalia.app&utm_medium=blog&utm_campaign=web_app&utm_content=a+b%26c%2F%C3%A9'
    );
    expect(getWebAppUrl('de', { medium: 'blog', content: 'x' })).not.toMatch(/[?&](hl|lang)=/);
    // Every surface must declare its medium so clicks stay attributable.
    expect(() => getWebAppUrl('en')).toThrow(/medium/);
  });

  it('resolves /pt-br/ URLs only for pages that declare a pt-br slug', () => {
    expect(getStaticPagePath('page.home', 'pt-br')).toBe('/pt-br/');
    expect(getStaticPagePath('page.pricing', 'pt-br')).toBe('/pt-br/precos');
    expect(getStaticPagePath('page.features', 'pt-br')).toBe('/pt-br/funcionalidades');
    expect(getStaticPagePath('page.faq', 'pt-br')).toBe('/pt-br/perguntas-frequentes');
    expect(getStaticPagePath('legal.account-deletion', 'pt-br')).toBe('/pt-br/exclusao-de-conta');
  });

  it('returns null for pages without a pt-br version instead of falling back to English', () => {
    expect(getStaticPagePath('page.about', 'pt-br')).toBeNull();
    expect(getStaticPagePath('legal.notice', 'pt-br')).toBeNull();
    expect(getStaticPagePath('page.features', 'en')).toBeNull();
    expect(getStaticPagePath('page.faq', 'fr')).toBeNull();
  });
});

describe('site manifest partial coverage', () => {
  const manifest = buildSiteManifest();

  it('scopes static page locales to the languages declared in static-pages.json', () => {
    const pages = manifest.collections.pages.entries;
    expect(Object.keys(pages['page.home'].locales)).toEqual([
      'en', 'fr', 'es', 'de', 'it', 'pt-br',
    ]);
    expect(Object.keys(pages['page.about'].locales)).toEqual(['en', 'fr', 'es', 'de', 'it']);
    // pt-br-only pages exist without any English fallback locale.
    expect(Object.keys(pages['page.features'].locales)).toEqual(['pt-br']);
    expect(Object.keys(pages['page.faq'].locales)).toEqual(['pt-br']);
    expect(pages['page.features'].locales['pt-br'].path).toBe('/pt-br/funcionalidades');
  });

  it('never exposes pt-br locales in the blog, guides or symbols collections', () => {
    for (const collectionId of ['blog', 'guides', 'symbols']) {
      for (const entry of Object.values(manifest.collections[collectionId].entries)) {
        expect(entry.locales['pt-br']).toBeUndefined();
        for (const locale of Object.values(entry.locales)) {
          expect(locale.path || '').not.toMatch(/^\/pt-br\//);
        }
      }
    }
  });

  it('lists every site language at the manifest level', () => {
    expect(manifest.languages).toEqual(['en', 'fr', 'es', 'de', 'it', 'pt-br']);
  });
});

describe('hreflang and Open Graph rendering for partial coverage', () => {
  it('emits reciprocal hreflang only for languages where the page exists', () => {
    const html = renderAlternateLinks({
      id: 'page.pricing',
      locales: {
        en: { path: '/en/pricing' },
        fr: { path: '/fr/tarifs' },
        'pt-br': { path: '/pt-br/precos' },
      },
    });

    expect(html).toContain(`hreflang="pt-BR" href="${DOMAIN}/pt-br/precos"`);
    expect(html).toContain(`hreflang="en" href="${DOMAIN}/en/pricing"`);
    expect(html).toContain(`hreflang="fr" href="${DOMAIN}/fr/tarifs"`);
    expect(html).not.toContain('hreflang="es"');
    expect(html).not.toContain('hreflang="pt-br"');
    expect(html).toContain(`hreflang="x-default" href="${DOMAIN}/en/pricing"`);
  });

  it('omits x-default for a pt-br-only page without an English version', () => {
    const html = renderAlternateLinks({
      id: 'page.features',
      locales: {
        'pt-br': { path: '/pt-br/funcionalidades' },
      },
    });

    expect(html).toContain(`hreflang="pt-BR" href="${DOMAIN}/pt-br/funcionalidades"`);
    expect(html).not.toContain('x-default');
    expect(html).not.toContain('hreflang="en"');
  });

  it('never emits a pt-BR alternate for five-language collections (blog, symbols, guides)', () => {
    const html = renderAlternateLinks({
      id: 'blog.dream-journal-guide',
      locales: Object.fromEntries(
        ['en', 'fr', 'es', 'de', 'it'].map((lang) => [lang, { path: `/${lang}/blog/guide` }])
      ),
    });

    expect(html).not.toContain('pt-BR');
    expect(html).not.toContain('/pt-br/');
    expect(html).toContain(`hreflang="x-default" href="${DOMAIN}/en/blog/guide"`);
  });

  it('keeps the homepage x-default on the language selector root', () => {
    const html = renderAlternateLinks({
      id: 'page.home',
      locales: {
        en: { path: '/' },
        'pt-br': { path: '/pt-br/' },
      },
    });

    expect(html).toContain(`hreflang="x-default" href="${DOMAIN}/"`);
  });

  it('scopes og:locale:alternate to the languages where the page exists', () => {
    const full = renderLocaleAlternates('en', {
      id: 'page.pricing',
      locales: {
        en: { path: '/en/pricing' },
        'pt-br': { path: '/pt-br/precos' },
      },
    });
    expect(full).toContain('og:locale:alternate" content="pt_BR"');
    expect(full).not.toContain('fr_FR');

    const ptBrOnly = renderLocaleAlternates('pt-br', {
      id: 'page.features',
      locales: { 'pt-br': { path: '/pt-br/funcionalidades' } },
    });
    expect(ptBrOnly).toBe('');
  });
});

describe('navigation and footer visibility for partial coverage', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'data', 'site-manifest.json'), 'utf8')
  );

  function makeContext(entryId, lang, layout = 'content') {
    const { createRenderContext } = require('./lib/docs-components/context');
    return createRenderContext({ manifest, entryId, meta: { lang, layout } });
  }

  it('hides blog, guides and dictionary nav links on pt-br pages', () => {
    const { renderNavigation } = require('./lib/docs-components/navigation');
    const html = renderNavigation(makeContext('page.home', 'pt-br', 'landing'));

    expect(html).toContain('id="navbar"');
    expect(html).not.toContain('/pt-br/blog/');
    expect(html).not.toContain('/pt-br/guides/');
    expect(html).toContain(`${siteConfig.storeLinks.androidBase}&hl=pt-BR`);

    const french = renderNavigation(makeContext('page.home', 'fr', 'landing'));
    expect(french).toContain('/fr/blog/');
    expect(french).toContain('/fr/guides/');
  });

  it('adds the web app CTA next to the Play CTA in the desktop nav and the mobile menu', () => {
    const { renderNavigation } = require('./lib/docs-components/navigation');
    const webAppHref = getWebAppUrl('pt-br', { medium: 'nav' });
    const html = renderNavigation(makeContext('page.home', 'pt-br', 'landing'));

    // Desktop action + mobile menu entry, both keeping the Play link untouched.
    expect(html.match(new RegExp(`href="${webAppHref.replace(/[?&.]/g, '\\$&')}"`, 'g'))).toHaveLength(2);
    expect(html).toContain('noctalia-premium-download noctalia-premium-webapp');
    expect(html).toContain('>Experimentar no navegador</a>');
    expect(html).toContain(`${siteConfig.storeLinks.androidBase}&hl=pt-BR`);

    // Our own property: opens in a new tab without nofollow.
    const webAppAnchors = html.match(/<a [^>]*dream\.noctalia\.app[^>]*>/g) || [];
    expect(webAppAnchors).toHaveLength(2);
    for (const anchor of webAppAnchors) {
      expect(anchor).toContain('target="_blank"');
      expect(anchor).toContain('rel="noopener"');
      expect(anchor).not.toContain('nofollow');
    }

    const french = renderNavigation(makeContext('blog.index', 'fr', 'blogIndex'));
    expect(french).toContain('>Essayer dans le navigateur</a>');
  });

  it('only offers languages where the current page exists in the language switcher', () => {
    const { renderNavigation } = require('./lib/docs-components/navigation');
    const locales = JSON.parse(
      fs.readFileSync(path.join(ROOT_DIR, 'docs-src', 'locales', 'pt-br.json'), 'utf8')
    );

    // page.features is pt-br only: the switcher offers exactly one language.
    const ptBrOnly = renderNavigation(makeContext('page.features', 'pt-br'));
    expect(ptBrOnly).toContain(locales.language);
    expect(ptBrOnly).not.toMatch(/href="\/en\/[^"]*" hreflang="en"/);

    // page.pricing exists everywhere: pt-br is one of the options.
    const pricing = renderNavigation(makeContext('page.pricing', 'en'));
    expect(pricing).toContain('href="/pt-br/precos" hreflang="pt-BR"');

    // blog pages are not available in pt-br: no pt-br option there.
    const blog = renderNavigation(makeContext('blog.index', 'en', 'blogIndex'));
    expect(blog).not.toContain('/pt-br/');
  });

  it('limits the pt-br footer to available destinations and drops empty columns', () => {
    const { renderFooter } = require('./lib/docs-components/footer');
    const html = renderFooter(makeContext('page.home', 'pt-br', 'landing'));

    expect(html).toContain('/pt-br/precos');
    expect(html).toContain('/pt-br/funcionalidades');
    expect(html).toContain('/pt-br/perguntas-frequentes');
    expect(html).toContain('/pt-br/politica-de-privacidade');
    expect(html).toContain('/pt-br/termos-de-uso');
    expect(html).toContain('/pt-br/exclusao-de-conta');
    // No blog, guide, symbol or unavailable legal links.
    expect(html).not.toContain('/pt-br/blog/');
    expect(html).not.toContain('/pt-br/guides/');

    // The legal column lists exactly the three pages available in pt-br
    // (privacy, terms, account-deletion — never legal.notice).
    const legalColumn = html.match(
      /<ul class="space-y-2 text-sm text-gray-500 mb-4">([\s\S]*?)<\/ul>/
    );
    expect(legalColumn).not.toBeNull();
    expect(legalColumn[1].match(/<li>/g)).toHaveLength(3);

    // Guides and popular-symbols columns are hidden: only Resources, Legal
    // and Download headings remain (3 instead of 5).
    expect(html.match(/<h5 class="font-bold mb-4 text-white">/g)).toHaveLength(3);

    const french = renderFooter(makeContext('page.home', 'fr', 'landing'));
    expect(french.match(/<h5 class="font-bold mb-4 text-white">/g)).toHaveLength(5);
    expect(french).toContain('/fr/mentions-legales');
  });

  it('keeps one web app link in the footer download column of every language', () => {
    const { renderFooter } = require('./lib/docs-components/footer');
    for (const lang of siteConfig.languages) {
      const html = renderFooter(makeContext('page.home', lang, 'landing'));
      const webAppHref = getWebAppUrl(lang, { medium: 'footer' });
      const anchors = html.match(/<a [^>]*dream\.noctalia\.app[^>]*>/g) || [];
      expect(anchors).toHaveLength(1);
      expect(anchors[0]).toContain(`href="${webAppHref}"`);
      expect(anchors[0]).toContain('target="_blank"');
      expect(anchors[0]).not.toContain('nofollow');
      // Play stays first in the same column.
      expect(html.indexOf(siteConfig.storeLinks.androidBase)).toBeLessThan(html.indexOf(webAppHref));
    }
  });
});
