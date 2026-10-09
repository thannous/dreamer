const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildWranglerDeployArgs,
  loadCloudflarePagesConfig,
  main,
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
        rootDirectory: '',
        buildCommand: 'npm run docs:build && npm run docs:check',
        buildOutputDirectory: 'docs',
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
      rootDirectory: '',
      buildCommand: 'npm run docs:build && npm run docs:check',
      buildOutputDirectory: 'docs',
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

  it('records the publish SHA with the documented Wrangler flags', () => {
    const config = loadCloudflarePagesConfig(tmpRoot);
    const sha = '0123456789abcdef0123456789abcdef01234567';

    expect(buildWranglerDeployArgs(config, 'prod', '/tmp/noctalia-pages/public', sha)).toEqual([
      'wrangler',
      'pages',
      'deploy',
      '/tmp/noctalia-pages/public',
      '--project-name',
      'noctalia',
      '--branch',
      'main',
      '--commit-hash',
      sha,
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
    for (const directory of ['css', 'js', 'en', 'fr', 'es', 'de', 'it', 'pt-br', 'scripts', 'data']) {
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
    for (const lang of ['en', 'fr', 'es', 'de', 'it', 'pt-br']) {
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
    expect(fs.existsSync(path.join(staging.deployDir, 'pt-br', 'index.html'))).toBe(true);
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

describe('docs-deploy production guard', () => {
  const HEAD = 'a'.repeat(40);
  const config = {
    projectName: 'noctalia',
    previewBranch: 'preview',
    productionBranch: 'master',
    rootDirectory: '',
    buildCommand: 'npm run docs:build && npm run docs:check',
    buildOutputDirectory: 'docs',
  };
  const accepted = (head = HEAD) => ({ head, tree: 'b'.repeat(40), message: `[site-publish-proof] OK: HEAD ${head}` });

  function deps(guardProduction: () => Promise<{ head: string; tree: string; message: string }>, overrides: Record<string, unknown> = {}) {
    const calls: string[][] = [];
    const cleanup = jest.fn();
    return {
      calls,
      cleanup,
      deps: {
        guardProduction: jest.fn(guardProduction),
        runCommand: (command: string, args: string[]) => {
          calls.push([command, ...args]);
        },
        loadConfig: () => config,
        createStaging: jest.fn(() => ({ deployDir: '/tmp/staging', cleanup })),
        summarizeStaging: () => ({ files: 1, bytes: 1 }),
        readHead: () => HEAD,
        log: () => {},
        ...overrides,
      },
    };
  }
  const wranglerCalls = (calls: string[][]) => calls.filter((call) => call[0] === 'npx');

  it('refuses a production publish before any build or upload when the guard refuses', async () => {
    const setup = deps(async () => {
      throw new Error('[site-publish-proof] production publish of noctalia.app refused: no proof for tree abc. There is no override.');
    });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('production publish of noctalia.app refused');
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(1);
    expect(setup.calls).toEqual([]);
    expect(setup.deps.createStaging).not.toHaveBeenCalled();
  });

  it('publishes the guarded HEAD to the production branch after the guard accepts twice', async () => {
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(2);
    expect(setup.calls[0]).toEqual(['npm', 'run', 'docs:release-check']);
    expect(setup.calls[1]).toEqual(expect.arrayContaining(['npx', 'wrangler', 'pages', 'deploy', '--branch', 'master', '--commit-hash', HEAD]));
    expect(setup.cleanup).toHaveBeenCalled();
  });

  it('refuses the upload when origin/master moved or the tree changed during the build (recheck refuses)', async () => {
    const guard = jest
      .fn()
      .mockResolvedValueOnce(accepted())
      .mockRejectedValueOnce(new Error('[site-publish-proof] production publish of noctalia.app refused: HEAD a is not origin/master c. There is no override.'));
    const setup = deps(guard);
    await expect(main(['prod'], setup.deps)).rejects.toThrow('is not origin/master');
    expect(setup.calls).toEqual([['npm', 'run', 'docs:release-check']]);
    expect(wranglerCalls(setup.calls)).toEqual([]);
    expect(setup.cleanup).toHaveBeenCalled();
  });

  it('refuses the upload when HEAD changed between the guard and the upload', async () => {
    const guard = jest.fn().mockResolvedValueOnce(accepted()).mockResolvedValueOnce(accepted('c'.repeat(40)));
    const setup = deps(guard);
    await expect(main(['prod'], setup.deps)).rejects.toThrow(`HEAD moved from ${HEAD} to ${'c'.repeat(40)}`);
    expect(wranglerCalls(setup.calls)).toEqual([]);
  });

  it('refuses the upload when the checkout HEAD differs from the guarded HEAD', async () => {
    const setup = deps(async () => accepted(), { readHead: () => 'd'.repeat(40) });
    await expect(main(['prod'], setup.deps)).rejects.toThrow(`not the guarded ${HEAD}`);
    expect(wranglerCalls(setup.calls)).toEqual([]);
  });

  it('does not guard a preview upload', async () => {
    const setup = deps(async () => {
      throw new Error('must not be called');
    });
    await main(['preview'], setup.deps);
    expect(setup.deps.guardProduction).not.toHaveBeenCalled();
    expect(setup.calls[setup.calls.length - 1]).toEqual(expect.arrayContaining(['npx', 'wrangler', 'pages', 'deploy', '--branch', 'preview']));
  });

  it.each(['master', 'main', 'production', ' Master ', 'MAIN', 'Production', 'release-prod'])(
    'refuses a preview whose previewBranch is a production branch (%s) before any build or upload',
    async (previewBranch) => {
      const productionBranch = previewBranch === 'release-prod' ? 'release-prod' : 'master';
      const setup = deps(async () => accepted(), { loadConfig: () => ({ ...config, previewBranch, productionBranch }) });
      await expect(main(['preview'], setup.deps)).rejects.toThrow('Preview refused');
      expect(setup.calls).toEqual([]);
      expect(setup.deps.createStaging).not.toHaveBeenCalled();
      expect(setup.deps.guardProduction).not.toHaveBeenCalled();
    }
  );

  it('never builds preview Wrangler arguments for a production branch', () => {
    expect(() => buildWranglerDeployArgs({ ...config, previewBranch: 'master' }, 'preview', '/tmp/x', HEAD)).toThrow('Preview refused');
    expect(() => buildWranglerDeployArgs({ ...config, previewBranch: '' }, 'preview', '/tmp/x', HEAD)).toThrow('Preview refused');
  });

  it('wires the real guard by default for prod', () => {
    const source = fs.readFileSync(path.join(__dirname, 'docs-deploy.js'), 'utf8');
    expect(source).toContain("await import('./check-site-publish-proof.mjs')");
    expect(source).toContain('guardProduction = guardProductionPublish');
    expect(source).not.toMatch(/OVERRIDE|--force|--override/);
  });
});
