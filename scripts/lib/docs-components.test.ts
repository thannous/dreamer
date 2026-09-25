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
  });


  it.each([
    ['en', 'Choose language', 'Navigation menu'],
    ['fr', 'Choisir la langue', 'Menu de navigation'],
    ['es', 'Elegir idioma', 'Menú de navegación'],
    ['de', 'Sprache auswählen', 'Navigationsmenü'],
    ['it', 'Scegli la lingua', 'Menu di navigazione'],
    ['pt-br', 'Escolher idioma', 'Menu de navegação'],
  ])('localizes the %s navigation control labels', (lang, languageLabel, menuLabel) => {
    const { createRenderContext } = require('./docs-components/context');
    const { renderNavigation } = require('./docs-components/navigation');
    const context = createRenderContext({
      manifest,
      entryId: 'page.home',
      meta: { lang, layout: 'landing' },
    });

    const html = renderNavigation(context);

    expect(html).toContain(`aria-label="${languageLabel}"`);
    expect(html).toContain(`aria-label="${menuLabel}"`);
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
    expect(html).toContain('>Blog</a>');
    expect(html).toContain('>Guides</h5>');
    expect(html).toContain('Dictionnaire des rêves');
    expect(html).toContain('Symboles populaires');
    expect(html).toContain('Suppression de compte');
  });

  it.each([
    ['en', 'Resources', 'Blog', 'Guides', 'Dream Dictionary'],
    ['fr', 'Ressources', 'Blog', 'Guides', 'Dictionnaire des rêves'],
    ['es', 'Recursos', 'Blog', 'Guías', 'Diccionario de sueños'],
    ['de', 'Ressourcen', 'Blog', 'Ratgeber', 'Traumlexikon'],
    ['it', 'Risorse', 'Blog', 'Guide', 'Dizionario dei sogni'],
  ])(
    'keeps the %s footer column titles distinct from their first links',
    (lang, resourcesTitle, blogLabel, guidesTitle, dictionaryLabel) => {
      const { createRenderContext } = require('./docs-components/context');
      const { renderFooter } = require('./docs-components/footer');

      const context = createRenderContext({
        manifest,
        entryId: 'page.home',
        meta: {
          lang,
          layout: 'landing',
        },
      });

      const html = renderFooter(context);
      const columns = Array.from(
        html.matchAll(
          /<h5 class="font-bold mb-4 text-white">([^<]+)<\/h5>\s*<ul class="space-y-2 text-sm text-gray-500">\s*<li><a [^>]*>([^<]+)<\/a>/g
        )
      );

      expect(columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 1: resourcesTitle, 2: blogLabel }),
          expect.objectContaining({ 1: guidesTitle, 2: dictionaryLabel }),
        ])
      );
      expect(resourcesTitle).not.toBe(blogLabel);
      expect(guidesTitle).not.toBe(dictionaryLabel);
      }
  );

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

});
