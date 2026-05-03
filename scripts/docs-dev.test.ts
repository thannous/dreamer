const path = require('path');

const {
  DEV_EVENT_PATH,
  injectLiveReloadClient,
  isWatchableDocsPath,
} = require('./docs-dev');

describe('docs-dev helpers', () => {
  const rootDir = path.join('C:', 'repo', 'noctalia');

  it('injects the live reload client before the closing body tag', () => {
    const html = '<!doctype html><html><body><main>Noctalia</main></body></html>';

    const result = injectLiveReloadClient(html);

    expect(result).toContain(`new EventSource('${DEV_EVENT_PATH}')`);
    expect(result).toContain('</script></body>');
    expect(result.indexOf('EventSource')).toBeLessThan(result.indexOf('</body>'));
  });

  it('appends the live reload client when the page has no body close tag', () => {
    const result = injectLiveReloadClient('<main>Noctalia</main>');

    expect(result).toMatch(/<\/script>$/);
    expect(result).toContain(`new EventSource('${DEV_EVENT_PATH}')`);
  });

  it('watches editable docs sources and ignores generated output', () => {
    expect(isWatchableDocsPath(path.join(rootDir, 'docs-src', 'content', 'pages', 'page.home', 'fr.md'), rootDir)).toBe(true);
    expect(isWatchableDocsPath(path.join(rootDir, 'data', 'dream-symbols.json'), rootDir)).toBe(true);
    expect(isWatchableDocsPath(path.join(rootDir, 'scripts', 'lib', 'docs-renderer.js'), rootDir)).toBe(true);
    expect(isWatchableDocsPath(path.join(rootDir, 'scripts', 'docs-build.js'), rootDir)).toBe(true);

    expect(isWatchableDocsPath(path.join(rootDir, 'docs', 'fr', 'index.html'), rootDir)).toBe(false);
    expect(isWatchableDocsPath(path.join(rootDir, 'node_modules', 'wrangler', 'index.js'), rootDir)).toBe(false);
    expect(isWatchableDocsPath(path.join(rootDir, 'tmp', 'docs-dev.log'), rootDir)).toBe(false);
  });
});
