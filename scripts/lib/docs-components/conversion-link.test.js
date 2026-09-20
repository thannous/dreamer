/* global describe, it, expect */
const manifest = require('../../../data/site-manifest.json');
const { createRenderContext } = require('./context');
const { renderNavigation } = require('./navigation');
const { renderFooter } = require('./footer');
const { renderBlogWebAppCta } = require('./web-app-cta');

describe('scoped conversion link attribution', () => {
  it('distinguishes desktop, mobile, footer and article links without adding tracking handlers', () => {
    const context = createRenderContext({
      manifest,
      entryId: 'blog.water-dreams-meaning',
      meta: { lang: 'es', layout: 'blogArticle', activeNav: 'resources' },
    });
    const html = renderNavigation(context) + renderFooter(context) + renderBlogWebAppCta({
      lang: context.lang,
      locale: context.locale,
      pageId: context.entryId,
      pagePath: context.entry.locales.es.path,
    });
    const links = html.match(/<a\b[^>]*(?:play\.google\.com|dream\.noctalia\.app)[^>]*>/g);
    const ids = links.map((link) => link.match(/\bid="([^"]+)"/)?.[1]);
    expect(links).toHaveLength(8);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(links.length);
    expect(ids.some((id) => id.includes('nav-desktop'))).toBe(true);
    expect(ids.some((id) => id.includes('nav-mobile'))).toBe(true);
    expect(html).not.toMatch(/\bonclick=|gtag\(/);
  });

  it('does not alter attribution on a page outside the experiment', () => {
    const context = createRenderContext({
      manifest,
      entryId: 'blog.water-dreams-meaning',
      meta: { lang: 'fr', layout: 'blogArticle', activeNav: 'resources' },
    });
    const html = renderNavigation(context) + renderFooter(context) + renderBlogWebAppCta({
      lang: context.lang,
      locale: context.locale,
      pageId: context.entryId,
      pagePath: context.entry.locales.fr.path,
    });
    expect(html).not.toContain('id="cta-');
  });
});
