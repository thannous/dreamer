const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildWranglerDeployArgs,
  loadCloudflarePagesConfig,
} = require('./docs-deploy');

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

  it('rejects incomplete Cloudflare Pages config', () => {
    fs.writeFileSync(
      path.join(tmpRoot, 'docs-src', 'config', 'cloudflare-pages.json'),
      JSON.stringify({ projectName: 'noctalia' }),
      'utf8'
    );

    expect(() => loadCloudflarePagesConfig(tmpRoot)).toThrow(/previewBranch/i);
  });
});
