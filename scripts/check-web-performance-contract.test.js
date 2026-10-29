const fs = require('fs');
const os = require('os');
const path = require('path');

const { release } = require('../docs-src/config/site-media.json');
const { publicOrigin } = require('../docs-src/config/site-media-storage.json');

const { checkBlogPremiumHeroCss } = require('./check-web-performance-contract');

describe('web performance contract', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-performance-contract-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('accepts the optimized WebP background on blog indexes', () => {
    const cssPath = path.join(tmpRoot, 'blog-premium.css');
    fs.writeFileSync(
      cssPath,
      `.blog-premium::before { background-image: url('${publicOrigin}/releases/${release}/img/hero/noctalia-observatory-bg.webp'); }`,
      'utf8'
    );

    expect(checkBlogPremiumHeroCss(cssPath)).toEqual([]);
  });

  it('rejects a legacy WebP alias in generated CSS', () => {
    const cssPath = path.join(tmpRoot, 'blog-premium.css');
    fs.writeFileSync(cssPath, ".blog-premium::before { background-image: url('/img/hero/noctalia-observatory-bg.webp'); }", 'utf8');

    expect(checkBlogPremiumHeroCss(cssPath)).toEqual([
      '[blog index LCP] blog-premium.css must use the optimized WebP hero',
    ]);
  });

  it('rejects the 1.8 MB PNG background on blog indexes', () => {
    const cssPath = path.join(tmpRoot, 'blog-premium.css');
    fs.writeFileSync(
      cssPath,
      ".blog-premium::before { background-image: url('/img/hero/noctalia-observatory-bg.png'); }",
      'utf8'
    );

    expect(checkBlogPremiumHeroCss(cssPath)).toEqual([
      '[blog index LCP] blog-premium.css must use the optimized WebP hero',
      '[blog index LCP] blog-premium.css still requests the 1.8 MB PNG hero',
    ]);
  });
});
