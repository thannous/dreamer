const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  checkContentHubContract,
  inspectRenderedPage,
  outputFileForPath,
  resolveInternalPath,
} = require('./check-content-hub-contract');

function writePage(docsDir, pagePath, body) {
  const filePath = outputFileForPath(docsDir, pagePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `<!doctype html><html><body>${body}</body></html>`, 'utf8');
}

function fixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-hub-contract-'));
  const docsDir = path.join(rootDir, 'docs');
  const paths = {
    directory: '/en/blog/',
    hub: '/en/blog/topic',
    spoke: '/en/blog/spoke',
    related: '/en/blog/related',
  };
  const entries = Object.fromEntries(
    [
      ['blog.index', 'blogIndex', paths.directory],
      ['blog.topic', 'blogArticle', paths.hub],
      ['blog.spoke', 'blogArticle', paths.spoke],
      ['blog.related', 'blogArticle', paths.related],
    ].map(([id, type, pagePath]) => [
      id,
      { id, type, locales: { en: { path: pagePath, slug: path.basename(pagePath) } } },
    ])
  );
  const hub = {
    id: 'topic',
    kind: 'hubAndSpoke',
    directoryPageId: 'blog.index',
    hubPageId: 'blog.topic',
    spokePageIds: ['blog.spoke', 'blog.related'],
    relatedByPageId: { 'blog.spoke': ['blog.related'] },
  };
  const registry = {
    hubs: [hub],
    resolvePath(pageId) {
      return entries[pageId].locales.en.path;
    },
    getRelatedSpokes(pageId) {
      return hub.relatedByPageId[pageId] || [];
    },
  };
  const manifest = {
    languages: ['en'],
    collections: { blog: { entries } },
  };
  return { rootDir, docsDir, paths, registry, manifest };
}

describe('content hub contract', () => {
  it('resolves relative hrefs without retaining query or fragment', () => {
    expect(resolveInternalPath('topic?src=card#intro', '/en/blog/spoke')).toBe('/en/blog/topic');
    expect(resolveInternalPath('https://example.com/topic', '/en/blog/spoke')).toBeNull();
  });

  it('separates generated module targets from editorial targets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-hub-page-'));
    const file = path.join(root, 'page.html');
    fs.writeFileSync(
      file,
      '<main><a href="topic">Topic</a><section data-content-hub-module><a href="related">Related</a></section></main><footer><a href="related">Footer link</a></footer>',
      'utf8'
    );
    const page = inspectRenderedPage(file, '/en/blog/spoke');
    expect(page.moduleCount).toBe(1);
    expect(page.outsideTargets.has('/en/blog/topic')).toBe(true);
    expect(page.outsideTargets.has('/en/blog/related')).toBe(false);
    expect(page.moduleTargets).toEqual(['/en/blog/related']);
  });

  it('accepts a complete localized hub graph and reports a removed backlink', () => {
    const state = fixture();
    state.manifest.collections.blog.entries['blog.related'].locales.fr = {
      path: '/fr/blog/related',
      slug: 'related',
    };
    writePage(state.docsDir, state.paths.directory, '<a href="topic">Topic</a>');
    writePage(
      state.docsDir,
      state.paths.hub,
      '<a href="spoke">Spoke</a><a href="related">Related</a>'
    );
    writePage(
      state.docsDir,
      state.paths.spoke,
      '<a href="topic">Topic</a><section data-content-hub-module><a href="related">Related</a></section>'
    );
    writePage(state.docsDir, state.paths.related, '<a href="topic">Topic</a>');

    const passing = checkContentHubContract({
      ...state,
      languages: ['en'],
      redirectSources: new Set(),
    });
    expect(passing.errors).toEqual([]);

    writePage(
      state.docsDir,
      state.paths.spoke,
      '<a href="topic">Topic</a><a href="/fr/blog/related">Mauvaise langue</a><section data-content-hub-module><a href="related">Related</a></section>'
    );
    const crossLanguage = checkContentHubContract({
      ...state,
      languages: ['en'],
      redirectSources: new Set(),
    });
    expect(crossLanguage.errors).toContain(
      '[content hub cross-language] blog.spoke.en: /en/blog/spoke links to blog.related.fr at /fr/blog/related'
    );

    writePage(state.docsDir, state.paths.related, '<p>No backlink</p>');
    const failing = checkContentHubContract({
      ...state,
      languages: ['en'],
      redirectSources: new Set(),
    });
    expect(failing.errors).toContain(
      '[content hub relation] blog.related.en: /en/blog/related must link to /en/blog/topic'
    );
  });
});
