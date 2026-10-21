import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = process.env.DEPENDENCY_SECURITY_PROJECT || 'root';
const directories = { root: '.', meditation: 'apps/meditation', documentation: 'doc_web_interne/docs', site: 'apps/site' };
assert.ok(Object.hasOwn(directories, project), `Unknown dependency-security project: ${project}`);
const projectRoot = join(root, directories[project]);
const require = createRequire(join(projectRoot, 'package.json'));

// Node's upward fallback can otherwise hide a missing standalone installation.
// Resolve each package against its own node_modules entry. Package symlinks are
// intentional in verify-local's isolated copy, so compare real paths per entry.
function installed(name) {
  const resolved = realpathSync(require.resolve(name));
  let packageRoot;
  try { packageRoot = realpathSync(join(projectRoot, 'node_modules', name)); }
  catch { assert.fail(`${name} resolved outside the ${project} installation`); }
  const path = relative(packageRoot, resolved);
  assert.ok(path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path), `${name} resolved outside the ${project} installation`);
  return require(name);
}

const hasBraces = project !== 'site';
const hasMetro = project === 'root' || project === 'meditation';
const braces = hasBraces ? installed('braces') : null;

// CLI/glob attacks cannot be exercised by a browser journey. Check rejection
// alongside normal behavior through the installed dependency graph.
if (hasBraces) test('installed braces rejects deep patterns and ASTs without stack exhaustion', () => {
  const nested = '{'.repeat(4990) + 'x' + '}'.repeat(4990);
  for (const method of ['parse', 'compile', 'expand', 'stringify']) {
    assert.throws(() => braces[method](nested, { maxDepth: Infinity, maxLength: Infinity }), { code: 'ERR_BRACES_DEPTH' });
  }
  for (const method of ['compile', 'expand', 'stringify']) {
    const cycle = { type: 'root', nodes: [] };
    cycle.nodes.push(cycle);
    assert.throws(() => braces[method](cycle), { code: 'ERR_BRACES_DEPTH' });
  }
  assert.deepEqual(braces.expand('apps/{alpha,beta}/{1..2}'), ['apps/alpha/1', 'apps/alpha/2', 'apps/beta/1', 'apps/beta/2']);
  assert.equal(braces.compile('{alpha,beta}'), '(alpha|beta)');
  const matcher = installed('micromatch');
  assert.deepEqual(matcher(['src/a.ts', 'src/b.js', 'src/c.css'], 'src/*.{ts,js}'), ['src/a.ts', 'src/b.js']);
  assert.throws(() => matcher.braces(nested), { code: 'ERR_BRACES_DEPTH' });
});

if (hasMetro) test('Metro keeps its callable Buffer image-size API with the patched parser', () => {
  installed('metro');
  const metroRequire = createRequire(require.resolve('metro/package.json'));
  const imageSize = metroRequire('image-size');
  assert.equal(imageSize, installed('image-size'));
  assert.equal(typeof imageSize, 'function');
  assert.equal(imageSize.imageSize, imageSize);
  assert.equal(imageSize.default, imageSize);
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000030806000000', 'hex');
  assert.deepEqual(imageSize(png), { width: 2, height: 3, type: 'png' });
});

if (hasMetro) test('Metro reads ordinary file-path assets with the patched parser', async () => {
  const metroRequire = createRequire(require.resolve('metro/package.json'));
  const { getAssetData } = metroRequire('./src/Assets.js');
  const assetPath = fileURLToPath(new URL('../assets/images/favicon.png', import.meta.url));
  const metadata = await getAssetData(assetPath, 'assets/images/favicon.png', [], 'ios', '/assets');
  assert.equal(metadata.width, 192);
  assert.equal(metadata.height, 192);
  assert.equal(metadata.type, 'png');
  assert.deepEqual(metadata.files, [assetPath]);
});

if (project !== 'documentation') test('an ICNS zero-length chunk cannot hang the metadata process', () => {
  installed('image-size');
  const script = `const parser = require('image-size');
    const imageSize = typeof parser === 'function' ? parser : parser.imageSize;
    const malformed = Buffer.alloc(16); malformed.write('icns');
    malformed.writeUInt32BE(16, 4); malformed.write('ic10', 8);
    try { imageSize(malformed); process.exitCode = 2; } catch { process.exitCode = 0; }`;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: projectRoot, timeout: 2000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

if (hasMetro) test('the legacy Xcode consumer still generates project UUIDs', () => {
  installed('xcode');
  const xcodeRequire = createRequire(require.resolve('xcode/package.json'));
  assert.match(xcodeRequire('uuid').v4(), /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
});

if (hasBraces) test('the installed braces security patch matches the tracked source', () => {
  const source = fileURLToPath(new URL('../tools/braces/', import.meta.url));
  const installed = dirname(require.resolve('braces'));
  const files = ['index.js', 'package.json', 'LICENSE', ...readdirSync(join(source, 'lib')).map(name => `lib/${name}`)];
  for (const file of files) assert.deepEqual(readFileSync(join(installed, file)), readFileSync(join(source, file)), file);
});

if (hasMetro) test('the installed image-size adapter matches the tracked source', () => {
  const source = fileURLToPath(new URL('../tools/image-size-compat/', import.meta.url));
  const installed = dirname(require.resolve('image-size'));
  for (const file of ['index.js', 'package.json']) {
    assert.deepEqual(readFileSync(join(installed, file)), readFileSync(join(source, file)), file);
  }
});

if (project === 'site') test('the standalone site parses and transforms ordinary images', async () => {
  const { imageSize } = installed('image-size');
  const sharp = installed('sharp');
  const png = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="red"/></svg>')).png().toBuffer();
  assert.deepEqual(imageSize(png), { width: 2, height: 3, type: 'png' });
});
