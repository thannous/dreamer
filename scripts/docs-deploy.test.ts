const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildWranglerDeployArgs,
  loadCloudflarePagesConfig,
} = require('./docs-deploy');
const {
  createDeployStaging,
} = require('./lib/docs-deploy-staging');

describe('docs-deploy helpers', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-deploy-'));
    fs.mkdirSync(path.join(tmpRoot, 'docs-src', 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'docs-src', 'config', 'cloudflare-pages.json'),
      JSON.stringify({
        projectName: 'noctalia',
        previewBranch: 'preview',
        productionBranch: 'main',
      }),
      'utf8'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('loads the Cloudflare Pages direct upload config', () => {
    expect(loadCloudflarePagesConfig(tmpRoot)).toEqual({
      projectName: 'noctalia',
      previewBranch: 'preview',
      productionBranch: 'main',
    });
  });

  it('builds a preview Wrangler deployment command from config', () => {
    const config = loadCloudflarePagesConfig(tmpRoot);

    expect(buildWranglerDeployArgs(config, 'preview')).toEqual([
      'wrangler',
      'pages',
      'deploy',
      'docs',
      '--project-name',
      'noctalia',
      '--branch',
      'preview',
    ]);
  });

  it('builds a production Wrangler deployment command from config', () => {
    const config = loadCloudflarePagesConfig(tmpRoot);

    expect(buildWranglerDeployArgs(config, 'prod')).toEqual([
      'wrangler',
      'pages',
      'deploy',
      'docs',
      '--project-name',
      'noctalia',
      '--branch',
      'main',
    ]);
  });

  it('deploys an explicitly supplied clean staging directory', () => {
    const config = loadCloudflarePagesConfig(tmpRoot);

    expect(buildWranglerDeployArgs(config, 'prod', '/tmp/noctalia-pages/public')).toEqual([
      'wrangler',
      'pages',
      'deploy',
      '/tmp/noctalia-pages/public',
      '--project-name',
      'noctalia',
      '--branch',
      'main',
    ]);
  });

  it('stages runtime files while excluding source and audit artifacts', () => {
    const docsDir = path.join(tmpRoot, 'docs');
    for (const directory of ['css', 'js', 'en', 'fr', 'es', 'de', 'it', 'scripts', 'data']) {
      fs.mkdirSync(path.join(docsDir, directory), { recursive: true });
    }
    for (const fileName of [
      'index.html',
      'sitemap.xml',
      'robots.txt',
      '_headers',
      '_redirects',
      'llms.txt',
    ]) {
      fs.writeFileSync(path.join(docsDir, fileName), fileName, 'utf8');
    }
    fs.writeFileSync(path.join(docsDir, 'css', 'site.css'), 'body{}', 'utf8');
    fs.writeFileSync(path.join(docsDir, 'js', 'site.js'), 'void 0;', 'utf8');
    for (const lang of ['en', 'fr', 'es', 'de', 'it']) {
      fs.writeFileSync(path.join(docsDir, lang, 'index.html'), `<h1>${lang}</h1>`, 'utf8');
    }
    fs.writeFileSync(path.join(docsDir, 'en', 'about.html'), '<h1>About</h1>', 'utf8');
    fs.writeFileSync(path.join(docsDir, 'AGENTS.md'), 'internal', 'utf8');
    fs.writeFileSync(path.join(docsDir, 'scripts', 'build.js'), 'internal', 'utf8');
    fs.writeFileSync(path.join(docsDir, 'data', 'symbols.json'), '{}', 'utf8');

    const stageRoot = path.join(tmpRoot, 'stage');
    const staging = createDeployStaging({ docsDir, tempRoot: stageRoot });

    expect(fs.existsSync(path.join(staging.deployDir, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(staging.deployDir, 'css', 'site.css'))).toBe(true);
    expect(fs.existsSync(path.join(staging.deployDir, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(staging.deployDir, 'scripts'))).toBe(false);
    expect(fs.existsSync(path.join(staging.deployDir, 'data'))).toBe(false);
  });

  it('rejects incomplete Cloudflare Pages config', () => {
    fs.writeFileSync(
      path.join(tmpRoot, 'docs-src', 'config', 'cloudflare-pages.json'),
      JSON.stringify({ projectName: 'noctalia' }),
      'utf8'
    );

    expect(() => loadCloudflarePagesConfig(tmpRoot)).toThrow(/previewBranch/i);
  });
});
