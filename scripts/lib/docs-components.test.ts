const manifest = require('../../data/site-manifest.json');

describe('docs shared components', () => {
  it('renders the shared navigation from a render context', () => {
    const { createRenderContext } = require('./docs-components/context');
    const { renderNavigation } = require('./docs-components/navigation');

    const context = createRenderContext({
      manifest,
      entryId: 'page.home',
      meta: {
        lang: 'fr',
        layout: 'landing',
        activeNav: 'resources',
      },
    });

    const html = renderNavigation(context);

    expect(html).toContain('<nav');
    expect(html).toContain('id="navbar"');
    expect(html).toContain('Noctalia');
    expect(html).toContain('Ressources');
    expect(html).toContain('Guides des rêves');
    expect(html).toContain('Dictionnaire des rêves');
    expect(html).toContain('À propos');
    expect(html).toContain('Télécharger l&#39;app');
    expect(html).toContain('transition-all duration-300 py-4 noctalia-premium-nav');
    expect(html).toContain('noctalia-premium-nav-inner px-4 sm:px-8');
    expect(html).toContain('text-dream-salmon');
  });

  it('keeps the internal header aligned with the landing header and removes the search icon', () => {
    const { createRenderContext } = require('./docs-components/context');
    const { renderNavigation } = require('./docs-components/navigation');

    const context = createRenderContext({
      manifest,
      entryId: 'blog.index',
      meta: {
        lang: 'en',
        layout: 'blogIndex',
        activeNav: 'resources',
      },
    });

    const html = renderNavigation(context);

    expect(html).toContain('transition-all duration-300 py-4 noctalia-premium-nav');
    expect(html).toContain('data-expanded-class="py-4"');
    expect(html).toContain('data-compact-class="py-2"');
    expect(html).toContain('noctalia-premium-nav-inner px-4 sm:px-8');
    expect(html).not.toContain('noctalia-premium-search');
    expect(html).not.toContain('data-lucide="search"');
    expect(html).toContain('noctalia-premium-download rounded-full px-4 py-2 text-sm font-semibold transition-colors');
  });

  it('renders the shared footer from a render context', () => {
    const { createRenderContext } = require('./docs-components/context');
    const { renderFooter } = require('./docs-components/footer');

    const context = createRenderContext({
      manifest,
      entryId: 'page.home',
      meta: {
        lang: 'fr',
        layout: 'landing',
      },
    });

    const html = renderFooter(context);

    expect(html).toContain('<footer class="site-footer landing-footer');
    expect(html).toContain('Noctalia');
    expect(html).toContain('Ressources');
    expect(html).toContain('Dictionnaire des rêves');
    expect(html).toContain('Symboles populaires');
    expect(html).toContain('Suppression de compte');
  });

  it('keeps the landing hero special while supporting managed page heroes', () => {
    const { createRenderContext } = require('./docs-components/context');
    const { renderPageHero } = require('./docs-components/hero');

    const landingContext = createRenderContext({
      manifest,
      entryId: 'page.home',
      meta: {
        lang: 'fr',
        layout: 'landing',
        hero: {
          title: 'Hero handled by source HTML',
        },
      },
    });

    expect(renderPageHero(landingContext)).toBe('');

    const pageContext = createRenderContext({
      manifest,
      entryId: 'guide.index',
      meta: {
        lang: 'fr',
        layout: 'standard',
        hero: {
          eyebrow: 'Guide',
          title: 'Titre commun',
          subtitle: 'Texte introductif commun.',
          ctas: [
            {
              href: '/fr/guides/',
              label: 'Lire le guide',
              icon: 'book-open',
            },
          ],
        },
      },
    });

    const html = renderPageHero(pageContext);

    expect(html).toContain('<section class="page-hero');
    expect(html).toContain('Guide');
    expect(html).toContain('Titre commun');
    expect(html).toContain('Texte introductif commun.');
    expect(html).toContain('href="/fr/guides/"');
    expect(html).toContain('data-lucide="book-open"');
  });

  it('exposes shared component styles required by generated pages', () => {
    const { renderSharedComponentStyles } = require('./docs-components/styles');

    const html = renderSharedComponentStyles();

    expect(html).toContain('<style>');
    expect(html).toContain('.noctalia-premium-nav');
    expect(html).toContain('.noctalia-premium-nav { background: transparent');
    expect(html).toContain('.noctalia-premium-nav.py-2 { background: transparent');
    expect(html).toContain('.noctalia-premium-nav-inner');
    expect(html).toContain('.noctalia-premium-nav-actions');
    expect(html).toContain('.mobile-menu-surface { background: #120720');
    expect(html).toContain('justify-content: space-between');
    expect(html).toContain('margin-left: auto');
    expect(html).toContain('#mobileMenuButton');
  });
});
