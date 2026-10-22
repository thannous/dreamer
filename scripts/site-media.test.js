const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inventory, readMedia, hydrate, sha256, localPath, cdnRedirect, publishedMediaPaths } = require('./lib/site-media');
const { detach, verifyRemote } = require('./site-media');
const { createDeployStaging } = require('./lib/docs-deploy-staging');

// Browser journeys prove decoded paintings and effects. They cannot prove a failed
// restore preserves an artist's local edit, reject path traversal, or protect Git's index.
describe('media preservation and recovery', () => {
  let root;
  const original = Buffer.from('original image bytes');
  const relative = 'img/symbols/gift.webp';
  function setup({ delivery = 'local', publicOrigin = 'https://media.example.com' } = {}) {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-media-'));
    fs.mkdirSync(path.join(root, 'docs-src/config'), { recursive: true });
    fs.mkdirSync(path.join(root, 'docs-src/static/img/symbols'), { recursive: true });
    fs.writeFileSync(localPath(root, relative), original);
    fs.writeFileSync(path.join(root, 'docs-src/config/site-media.json'), JSON.stringify(inventory(root)));
    fs.writeFileSync(path.join(root, 'docs-src/config/site-media-storage.json'), JSON.stringify({ schema: 1, delivery, publicOrigin }));
    fs.writeFileSync(path.join(root, '.gitignore'), '.cache/\n');
  }
  const response = data => ({ ok: true, status: 200,
    headers: new Map([['content-type', 'image/webp'], ['content-length', String(data.length)]]),
    body: (async function* () { yield data; })() });
  afterEach(() => { if (root) fs.rmSync(root, { recursive: true, force: true }); });

  it('restores a missing image byte-for-byte, then reuses it offline', async () => {
    setup();
    fs.unlinkSync(localPath(root, relative));
    const fetcher = jest.fn(async () => response(original));
    await hydrate(root, { fetcher, log: () => {} });
    expect(fs.readFileSync(localPath(root, relative))).toEqual(original);
    const offline = jest.fn(() => { throw new Error('offline'); });
    await hydrate(root, { fetcher: offline, log: () => {} });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(offline).not.toHaveBeenCalled();
  });

  it('rejects corrupt downloads without leaving a bogus image or success receipt', async () => {
    setup();
    fs.unlinkSync(localPath(root, relative));
    const corrupt = Buffer.from('corrupted same size!');
    await expect(hydrate(root, { fetcher: async () => response(corrupt), log: () => {} })).rejects.toThrow(/mismatch/);
    expect(fs.existsSync(localPath(root, relative))).toBe(false);
    await expect(verifyRemote(root, { fetcher: async () => response(corrupt) })).rejects.toThrow(/mismatch/);
    expect(fs.existsSync(path.join(root, 'docs-src/config/site-media-verification.json'))).toBe(false);
  });

  it('recovers a transient network interruption but fails immediately for a missing image', async () => {
    setup();
    fs.unlinkSync(localPath(root, relative));
    const fetcher = jest.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValue(response(original));
    await hydrate(root, { fetcher, log: () => {} });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(localPath(root, relative))).toEqual(original);
    fs.unlinkSync(localPath(root, relative));
    const missing = jest.fn(async () => ({ ok: false, status: 404, headers: new Map() }));
    await expect(hydrate(root, { fetcher: missing, log: () => {} })).rejects.toThrow(`Media response invalid (404): ${relative}`);
    expect(missing).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(localPath(root, relative))).toBe(false);
  });

  it('preserves a changed local painting instead of silently replacing it', async () => {
    setup();
    const edit = Buffer.from('new painting by the artist');
    fs.writeFileSync(localPath(root, relative), edit);
    const fetcher = jest.fn();
    await expect(hydrate(root, { fetcher, log: () => {} })).rejects.toThrow('Local media changed');
    expect(fetcher).not.toHaveBeenCalled();
    expect(fs.readFileSync(localPath(root, relative))).toEqual(edit);
  });

  it('rejects paths outside media and production r2.dev origins', () => {
    setup();
    expect(() => localPath(root, 'img/../../.env')).toThrow('Invalid media path');
    expect(() => localPath(root, 'img/%2e%2e/secret.webp')).toThrow('Invalid media path');
    fs.writeFileSync(path.join(root, 'docs-src/config/site-media-storage.json'), JSON.stringify({ schema: 1, delivery: 'cdn', publicOrigin: 'https://test.r2.dev' }));
    expect(() => readMedia(root)).toThrow('not r2.dev');
  });

  it('requires full remote verification before index removal, preserving all local bytes and Git history', async () => {
    setup({ delivery: 'cdn' });
    const git = args => {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr);
      return result.stdout.trim();
    };
    git(['init', '-q']);
    git(['add', '.']);
    git(['-c', 'user.name=Media Test', '-c', 'user.email=media@example.com', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture']);
    const head = git(['rev-parse', 'HEAD']);
    expect(() => detach(root)).toThrow('Full CDN verification');
    expect(git(['ls-files', 'docs-src/static/img/symbols/gift.webp'])).not.toBe('');
    await verifyRemote(root, { fetcher: async () => response(original) });
    expect(detach(root)).toEqual({ detached: 1, localFilesPreserved: true });
    expect(git(['ls-files', 'docs-src/static/img/symbols/gift.webp'])).toBe('');
    expect(fs.readFileSync(localPath(root, relative))).toEqual(original);
    expect(git(['rev-parse', 'HEAD'])).toBe(head);
  });

  it('stages a CDN redirect without image binaries only after full verification, preserving the built files', async () => {
    setup({ delivery: 'cdn' });
    const docsDir = path.join(root, 'docs');
    for (const dir of ['css', 'js', 'en', 'fr', 'es', 'de', 'it', 'img/symbols']) fs.mkdirSync(path.join(docsDir, dir), { recursive: true });
    for (const dir of ['css', 'js', 'en', 'fr', 'es', 'de', 'it']) fs.writeFileSync(path.join(docsDir, dir, 'index.html'), 'fixture');
    for (const name of ['index.html', 'sitemap.xml', 'robots.txt', '_headers', '_redirects', 'llms.txt']) fs.writeFileSync(path.join(docsDir, name), name === '_redirects' ? '/old /new 301\n' : 'fixture');
    fs.writeFileSync(path.join(docsDir, relative), original);
    expect(() => createDeployStaging({ docsDir, rootDir: root, tempRoot: path.join(root, 'refused') })).toThrow('Full CDN verification');
    await verifyRemote(root, { fetcher: async () => response(original) });
    const stage = createDeployStaging({ docsDir, rootDir: root, tempRoot: path.join(root, 'stage') });
    expect(fs.existsSync(path.join(stage.deployDir, relative))).toBe(false);
    expect(sha256(fs.readFileSync(path.join(docsDir, relative)))).toBe(sha256(original));
    expect(fs.readFileSync(path.join(stage.deployDir, '_redirects'), 'utf8')).toBe(`${cdnRedirect(readMedia(root))}\n/old /new 301\n`);
    expect(publishedMediaPaths(root, stage.deployDir).has(relative)).toBe(true);
    expect(publishedMediaPaths(root, stage.deployDir).has('img/nonexistent.webp')).toBe(false);
  });
});
