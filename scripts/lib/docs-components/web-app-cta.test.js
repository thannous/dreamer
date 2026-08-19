/* global describe, it, expect */

const { getAndroidStoreUrl, getWebAppUrl, loadLocales, siteConfig } = require('../docs-site-config');
const {
  blogArticleContentId,
  insertBlogWebAppCta,
  renderBlogWebAppCta,
  renderBlogWebAppCtaModule,
} = require('./web-app-cta');

const locales = loadLocales();

describe('blog web app CTA module', () => {
  it('renders one web app link per article attributed to the article id, next to the Play link', () => {
    const html = renderBlogWebAppCta({
      lang: 'fr',
      locale: locales.fr,
      pageId: 'blog.snake-dreams-meaning',
    });

    const webAppHref = getWebAppUrl('fr', { medium: 'blog', content: 'snake-dreams-meaning' });
    expect(webAppHref).toBe(
      'https://dream.noctalia.app/?utm_source=noctalia.app&utm_medium=blog&utm_campaign=web_app&utm_content=snake-dreams-meaning'
    );
    expect(html).toContain('data-web-app-cta="blog"');
    expect(html).toContain(`href="${webAppHref}"`);
    expect(html).toContain('>Commencez votre journal de rêves dans le navigateur</h3>');
    expect(html).toContain('>Essayer dans le navigateur <');
    expect(html).toContain(locales.fr.webAppNote.replace(/'/g, '&#39;'));

    // Play stays available in the same module with its usual attributes.
    expect(html).toContain(`href="${getAndroidStoreUrl('fr')}" rel="nofollow noopener noreferrer" target="_blank"`);

    // The web app is our own property: new tab, no nofollow.
    const webAppAnchor = html.match(/<a [^>]*dream\.noctalia\.app[^>]*>/g);
    expect(webAppAnchor).toHaveLength(1);
    expect(webAppAnchor[0]).toContain('rel="noopener"');
    expect(webAppAnchor[0]).toContain('target="_blank"');
    expect(webAppAnchor[0]).not.toContain('nofollow');
  });

  it('strips the blog. prefix from the page id for utm_content', () => {
    expect(blogArticleContentId('blog.dream-journal-guide')).toBe('dream-journal-guide');
    expect(blogArticleContentId('dream-journal-guide')).toBe('dream-journal-guide');
  });

  it('inserts the module before the prev/next navigation when the article declares one', () => {
    const body = [
      '<article>',
      '<p>Body</p>',
      '<!-- Blog Nav Start -->',
      '<nav>prev/next</nav>',
      '<!-- Blog Nav End -->',
      '</article>',
    ].join('\n');

    const html = insertBlogWebAppCta(body, '<aside data-web-app-cta="blog">cta</aside>');
    expect(html.indexOf('data-web-app-cta')).toBeGreaterThan(html.indexOf('<p>Body</p>'));
    expect(html.indexOf('data-web-app-cta')).toBeLessThan(html.indexOf('<!-- Blog Nav Start -->'));
    expect(html.match(/data-web-app-cta/g)).toHaveLength(1);
  });

  it('falls back to the end of the article, then to appending, and stays idempotent', () => {
    const module = '<aside data-web-app-cta="blog">cta</aside>';

    const withArticle = insertBlogWebAppCta('<article><p>Body</p></article>\n<aside>disclaimer</aside>', module);
    expect(withArticle).toBe(`<article><p>Body</p>${module}\n</article>\n<aside>disclaimer</aside>`);

    const withoutArticle = insertBlogWebAppCta('<p>Body</p>', module);
    expect(withoutArticle).toBe(`<p>Body</p>\n${module}`);

    expect(insertBlogWebAppCta(withArticle, module)).toBe(withArticle);
    expect(insertBlogWebAppCta(withArticle, '')).toBe(withArticle);
  });

  it('renders for every blog language with localized labels', () => {
    for (const lang of ['en', 'fr', 'es', 'de', 'it']) {
      const html = renderBlogWebAppCtaModule({
        bodyHtml: '<article><p>Body</p></article>',
        lang,
        locale: locales[lang],
        pageId: 'blog.dream-journal-guide',
      });
      expect(html).toContain(`>${locales[lang].webAppCta.replace(/'/g, '&#39;')} <`);
      expect(html).toContain(getWebAppUrl(lang, { medium: 'blog', content: 'dream-journal-guide' }));
      expect(html).toContain(siteConfig.storeLinks.androidBase);
    }
  });

  it('fails loudly when a locale misses the shared CTA labels', () => {
    expect(() =>
      renderBlogWebAppCta({ lang: 'xx', locale: { googlePlay: 'Google Play' }, pageId: 'blog.x' })
    ).toThrow(/webAppHeading/);
  });
});
