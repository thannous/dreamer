const {
  collectLinkedPathnames,
  renderContentHubModule,
} = require('./content-hubs');

const locale = {
  contentHubHubHeading: 'More guides on this topic',
  contentHubSpokeHeading: 'Explore this topic',
  contentHubRelatedHeading: 'Related guides',
};

function makeRegistry({ hub = null, primaryHub = null, related = [], paths = {}, titles = {} }) {
  return {
    getHubByPageId: jest.fn(() => hub),
    getPrimaryHubForSpoke: jest.fn(() => primaryHub),
    getRelatedSpokes: jest.fn(() => related),
    resolvePath: jest.fn((pageId) => paths[pageId]),
    resolveTitle: jest.fn((pageId) => titles[pageId]),
  };
}

describe('content hub component', () => {
  it('resolves same-origin relative hrefs while ignoring query, fragment, and external links', () => {
    const paths = collectLinkedPathnames(
      [
        '<a href="../blog/topic?source=body#overview">Topic</a>',
        '<a href="related-guide#details">Guide</a>',
        '<a href="https://example.com/en/blog/external">External</a>',
      ].join(''),
      '/en/blog/current-guide'
    );

    expect([...paths]).toEqual(['/en/blog/topic', '/en/blog/related-guide']);
  });

  it('adds only the missing primary and related spoke links before the article closes', () => {
    const primaryHub = {
      kind: 'hubAndSpoke',
      hubPageId: 'blog.topic',
      render: { spokeMissingLinks: true },
    };
    const registry = makeRegistry({
      primaryHub,
      related: ['blog.related-one', 'blog.related-two', 'blog.related-two'],
      paths: {
        'blog.current': '/en/blog/current-guide',
        'blog.topic': '/en/blog/topic',
        'blog.related-one': '/en/blog/related-one',
        'blog.related-two': '/en/blog/related-two',
      },
      titles: {
        'blog.topic': 'Topic hub',
        'blog.related-one': 'Related one',
        'blog.related-two': 'Related two',
      },
    });
    const body = [
      '<article>',
      '<a href="../blog/topic?source=body#overview">Existing hub link</a>',
      '<a href="related-one#details">Existing related link</a>',
      '</article>',
    ].join('\n');

    const html = renderContentHubModule({
      bodyHtml: body,
      pageId: 'blog.current',
      lang: 'en',
      locale,
      registry,
      currentPath: '/en/blog/current-guide',
    });

    expect(html.match(/data-content-hub-module/g)).toHaveLength(1);
    expect(html).not.toContain('Explore this topic');
    expect(html).toContain('Related guides');
    expect(html).toContain('href="/en/blog/related-two"');
    expect(html.match(/href="\/en\/blog\/related-two"/g)).toHaveLength(1);
    expect(html.indexOf('data-content-hub-module')).toBeLessThan(html.indexOf('</article>'));
  });

  it('completes a hub with only spokes absent from its editorial body', () => {
    const hub = {
      kind: 'hubAndSpoke',
      spokePageIds: ['blog.spoke-a', 'blog.spoke-b', 'blog.spoke-b'],
      render: { hubMissingSpokes: true },
    };
    const registry = makeRegistry({
      hub,
      paths: {
        'blog.spoke-a': '/fr/blog/article-a',
        'blog.spoke-b': '/fr/blog/article-b',
      },
      titles: {
        'blog.spoke-a': 'Article A',
        'blog.spoke-b': 'Article B',
      },
    });
    const body = '<article><a href="/fr/blog/article-a?from=hub">Article A</a></article>';

    const html = renderContentHubModule({
      bodyHtml: body,
      pageId: 'blog.topic',
      lang: 'fr',
      locale: {
        ...locale,
        contentHubHubHeading: 'Plus de guides sur ce thème',
      },
      registry,
      currentPath: '/fr/blog/theme',
    });

    expect(html).toContain('Plus de guides sur ce thème');
    expect(html).not.toContain('href="/fr/blog/article-a"');
    expect(html.match(/href="\/fr\/blog\/article-b"/g)).toHaveLength(1);
  });

  it('renders nothing for undeclared or validate-only pages and is idempotent', () => {
    const source = '<article><p>Unchanged</p></article>';
    const unrelatedRegistry = makeRegistry({});
    expect(
      renderContentHubModule({
        bodyHtml: source,
        pageId: 'blog.unrelated',
        lang: 'en',
        locale,
        registry: unrelatedRegistry,
      })
    ).toBe(source);

    const validateOnlyRegistry = makeRegistry({
      hub: {
        kind: 'contentDatabase',
        renderMode: 'validateOnly',
        spokePageIds: ['symbol.one'],
        render: { hubMissingSpokes: true },
      },
    });
    expect(
      renderContentHubModule({
        bodyHtml: source,
        pageId: 'guide.dictionary',
        lang: 'en',
        locale,
        registry: validateOnlyRegistry,
      })
    ).toBe(source);

    const alreadyRendered = '<article><section data-content-hub-module="spoke"></section></article>';
    expect(
      renderContentHubModule({
        bodyHtml: alreadyRendered,
        pageId: 'blog.current',
        lang: 'en',
        locale,
        registry: unrelatedRegistry,
      })
    ).toBe(alreadyRendered);
  });

  it('escapes localized labels and resolved titles', () => {
    const primaryHub = {
      kind: 'hubAndSpoke',
      hubPageId: 'blog.topic',
      render: { spokeMissingLinks: true },
    };
    const registry = makeRegistry({
      primaryHub,
      paths: { 'blog.topic': '/en/blog/topic' },
      titles: { 'blog.topic': 'Dreams & <meaning>' },
    });
    const html = renderContentHubModule({
      bodyHtml: '<article></article>',
      pageId: 'blog.current',
      lang: 'en',
      locale: { ...locale, contentHubSpokeHeading: 'Explore & understand' },
      registry,
      currentPath: '/en/blog/current',
    });

    expect(html).toContain('Explore &amp; understand');
    expect(html).toContain('Dreams &amp; &lt;meaning&gt;');
  });
});
