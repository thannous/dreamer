const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

let root;
let seo;
let symbols;
let registry;
let illustrations;
beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'image-generators-'));
  await sharp({ create: { width: 32, height: 24, channels: 3, background: '#123456' } })
    .png().toFile(path.join(root, 'source.png'));
  jest.resetModules();
  jest.doMock('./lib/image-seo-assets', () => ({
    ...jest.requireActual('./lib/image-seo-assets'),
    resolveRepoPath: (file) => path.resolve(root, file),
  }));
  jest.doMock('./lib/docs-site-config', () => ({
    ...jest.requireActual('./lib/docs-site-config'), ROOT_DIR: root,
  }));
  seo = require('./generate-image-seo-assets');
  symbols = require('./generate-symbol-responsive-images');
  registry = { variants: { formats: ['webp'] }, assets: { sample: {
    source: 'source.png', role: 'fallback', outputStem: '/img/seo/test',
    version: 'v1', slug: 'sample', aspects: { landscape: { width: 32, height: 24, widths: [16], mode: 'contain' } },
  } } };
  illustrations = [{ stem: 'sample', sourcePath: path.join(root, 'source.png') }];
});
afterEach(() => {
  jest.dontMock('./lib/image-seo-assets');
  jest.dontMock('./lib/docs-site-config');
  fs.rmSync(root, { recursive: true, force: true });
});

test.each(['seo', 'symbols'])('%s generator skips encodes across checkout dates, regenerates corruption and force', async (kind) => {
  const manifestPath = path.join(root, 'cache.json');
  const generate = (force = false) => kind === 'seo'
    ? seo.generateAssets(registry, { manifestPath, force })
    : symbols.generateIllustrations(illustrations, { manifestPath, force });
  const target = () => kind === 'seo' ? seo.expectedVariants(registry)[0].outputPath
    : symbols.outputPath(illustrations[0], symbols.WIDTHS[0]);
  await generate();
  const firstManifest = fs.readFileSync(manifestPath, 'utf8');
  const stamp = new Date('2001-01-01');
  fs.utimesSync(target(), stamp, stamp);
  fs.utimesSync(path.join(root, 'source.png'), new Date(), new Date());
  await generate();
  expect(fs.statSync(target()).mtime.toISOString()).toBe(stamp.toISOString());
  expect(fs.readFileSync(manifestPath, 'utf8')).toBe(firstManifest);
  fs.writeFileSync(target(), 'broken image');
  fs.utimesSync(target(), stamp, stamp);
  await generate();
  expect((await sharp(target()).metadata()).format).toBe('webp');
  fs.utimesSync(target(), stamp, stamp);
  await generate(true);
  expect(fs.statSync(target()).mtime.toISOString()).not.toBe(stamp.toISOString());
});

test.each(['seo', 'symbols'])('%s encoding failure does not create a successful manifest', async (kind) => {
  const manifestPath = path.join(root, 'cache.json');
  fs.writeFileSync(path.join(root, 'source.png'), 'invalid source');
  await expect(kind === 'seo' ? seo.generateAssets(registry, { manifestPath })
    : symbols.generateIllustrations(illustrations, { manifestPath })).rejects.toThrow();
  expect(fs.existsSync(manifestPath)).toBe(false);
});

test.each(['seo', 'symbols'])('%s source bytes change is detected with unchanged mtime', async (kind) => {
  const manifestPath = path.join(root, 'cache.json');
  const generate = () => kind === 'seo' ? seo.generateAssets(registry, { manifestPath })
    : symbols.generateIllustrations(illustrations, { manifestPath });
  await generate();
  const before = fs.readFileSync(manifestPath, 'utf8');
  const source = path.join(root, 'source.png');
  const stamp = fs.statSync(source).mtime;
  await sharp({ create: { width: 32, height: 24, channels: 3, background: '#abcdef' } })
    .png().toFile(source);
  fs.utimesSync(source, stamp, stamp);
  await generate();
  expect(fs.readFileSync(manifestPath, 'utf8')).not.toBe(before);
});

test('SEO dimensions changed in registry invalidate with unchanged source', async () => {
  const manifestPath = path.join(root, 'cache.json');
  await seo.generateAssets(registry, { manifestPath });
  registry.assets.sample.aspects.landscape.height = 16;
  await seo.generateAssets(registry, { manifestPath });
  const metadata = await sharp(seo.expectedVariants(registry)[0].outputPath).metadata();
  expect(metadata.height).toBe(8);
});
