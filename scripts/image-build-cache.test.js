const fs = require('fs');
const os = require('os');
const path = require('path');
const { createImageBuildCache } = require('./lib/image-build-cache');

let root;
let options;
let source;
let output;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'image-cache-'));
  source = path.join(root, 'source');
  output = path.join(root, 'output');
  fs.writeFileSync(source, 'source bytes');
  fs.writeFileSync(output, 'encoded bytes');
  fs.writeFileSync(path.join(root, 'code'), 'encoder');
  options = { manifestPath: path.join(root, 'cache.json'), codePaths: [path.join(root, 'code')],
    versions: { sharp: '1', vips: '2' } };
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function seed() {
  const cache = createImageBuildCache(options);
  cache.record('image.webp', cache.fingerprint(source, { width: 1200, quality: 82 }), output);
  cache.commit();
}
function fresh(recipe = { quality: 82, width: 1200 }) {
  const cache = createImageBuildCache(options);
  return cache.isFresh('image.webp', cache.fingerprint(source, recipe), output);
}

test('checkout mtimes and JSON key order do not invalidate bytes', () => {
  seed();
  fs.utimesSync(source, new Date(0), new Date());
  fs.utimesSync(output, new Date(0), new Date(0));
  expect(fresh()).toBe(true);
});
test('changed source bytes invalidate even with preserved mtime', () => {
  seed();
  const stamp = fs.statSync(source).mtime;
  fs.writeFileSync(source, 'new source bytes');
  fs.utimesSync(source, stamp, stamp);
  expect(fresh()).toBe(false);
});
test.each(['width', 'quality'])('changed %s invalidates', (key) => {
  seed();
  expect(fresh({ width: 1200, quality: 82, [key]: 90 })).toBe(false);
});
test('code and encoder versions invalidate', () => {
  seed();
  options.versions.vips = '3';
  expect(fresh()).toBe(false);
  options.versions.vips = '2';
  fs.writeFileSync(options.codePaths[0], 'new encoder');
  expect(fresh()).toBe(false);
});
test('missing and corrupted outputs invalidate', () => {
  seed();
  const stamp = fs.statSync(output).mtime;
  fs.writeFileSync(output, 'corrupt bytes');
  fs.utimesSync(output, stamp, stamp);
  expect(fresh()).toBe(false);
  fs.unlinkSync(output);
  expect(fresh()).toBe(false);
});
test('missing, malformed and incompatible manifests never trust existing outputs', () => {
  expect(fresh()).toBe(false);
  for (const contents of ['{', 'null', '{"schema":2,"entries":{}}']) {
    fs.writeFileSync(options.manifestPath, contents);
    expect(fresh()).toBe(false);
  }
});
test('uncommitted run cannot publish partial success', () => {
  seed();
  const before = fs.readFileSync(options.manifestPath, 'utf8');
  const cache = createImageBuildCache(options);
  cache.record('other.webp', cache.fingerprint(source, {}), output);
  expect(() => cache.record('failed.webp', 'input', path.join(root, 'missing'))).toThrow();
  expect(fs.readFileSync(options.manifestPath, 'utf8')).toBe(before);
});
test('manifest is deterministic across checkout roots and excludes timestamps and paths', () => {
  seed();
  const before = fs.readFileSync(options.manifestPath, 'utf8');
  const other = path.join(root, 'other-checkout');
  fs.mkdirSync(other);
  for (const name of ['source', 'output', 'code']) fs.copyFileSync(path.join(root, name), path.join(other, name));
  const cache = createImageBuildCache({ ...options, manifestPath: path.join(other, 'cache.json'),
    codePaths: [path.join(other, 'code')] });
  cache.record('image.webp', cache.fingerprint(path.join(other, 'source'), { width: 1200, quality: 82 }), path.join(other, 'output'));
  cache.commit();
  expect(fs.readFileSync(path.join(other, 'cache.json'), 'utf8')).toBe(before);
  expect(before).not.toContain(root);
});
