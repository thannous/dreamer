const fs = require('fs');
const os = require('os');
const path = require('path');

describe('docs shell check', () => {
  function writeFile(root, relativePath, html) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, html, 'utf8');
    return filePath;
  }

  it('fails indexable pages that bypass the shared shell', () => {
    const { auditDocsShell } = require('./check-docs-shell');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-shell-'));

    writeFile(root, 'it/simboli/animali.html', `<!doctype html>
<html><head><title>Legacy</title></head>
<body>
  <nav id="navbar" class="fixed w-full z-50 top-0 left-0 px-4 md:px-6 py-4 md:py-6 transition-all duration-300"></nav>
  <main></main>
  <footer class="pb-10 pt-20"></footer>
  <script src="/js/language-dropdown.js" defer></script>
</body></html>`);

    const result = auditDocsShell(root);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('it/simboli/animali.html');
    expect(result.errors.join('\n')).toContain('missing .site-footer');
    expect(result.errors.join('\n')).toContain('missing /js/mobile-menu.js');
    expect(result.errors.join('\n')).toContain('legacy navbar classes');
  });

  it('accepts shared-shell pages and ignores non-indexable utility pages', () => {
    const { auditDocsShell } = require('./check-docs-shell');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-shell-'));

    writeFile(root, 'it/termini.html', `<!doctype html>
<html><head><title>Terms</title></head>
<body>
  <nav id="navbar" class="fixed w-full z-50 top-0 left-0 transition-all duration-300 py-5 noctalia-premium-nav"></nav>
  <main></main>
  <footer class="site-footer pb-10 pt-20"></footer>
  <script src="/js/language-dropdown.js" defer></script>
  <script src="/js/mobile-menu.js" defer></script>
</body></html>`);
    writeFile(root, '404.html', '<!doctype html><html><body>Not found</body></html>');
    writeFile(root, 'auth/callback/index.html', '<!doctype html><html><body>Callback</body></html>');
    writeFile(root, 'templates/symbol-page.html', '<!doctype html><html><body>Template</body></html>');

    const result = auditDocsShell(root);

    expect(result).toEqual({ ok: true, checked: 1, errors: [] });
  });
});
