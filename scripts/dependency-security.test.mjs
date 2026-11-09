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

if (hasMetro) test('deepmerge preserves data keys without poisoning the returned prototype', () => {
  const merge = installed('deepmerge');
  const poison = JSON.parse('{"__proto__":{"admin":true}}');
  for (const [target, source, options] of [
    [Object.create(null), poison], [poison, {}], [{ nested: null }, { nested: poison }],
    [Object.create(null), poison, { clone: false }],
  ]) {
    const result = merge(target, source, options);
    const value = result.nested ?? result;
    assert.equal(Object.getPrototypeOf(value), Object.prototype);
    assert.equal(value.admin, undefined);
    assert.equal(Object.hasOwn(value, '__proto__'), true);
  }
  const symbol = Symbol('metadata');
  assert.deepEqual(merge.all([{ list: [1], [symbol]: 'ok' }, { list: [2] }]), { list: [1, 2], [symbol]: 'ok' });
  assert.deepEqual(merge({ list: [1] }, { list: [2] }, { arrayMerge: (_, source) => source }), { list: [2] });
  assert.deepEqual(merge({ name: { value: 'a' } }, { name: { value: 'b' } }, {
    customMerge: key => key === 'name' ? (a, b) => ({ value: a.value + b.value }) : undefined,
  }), { name: { value: 'ab' } });
});

if (hasMetro) test('all installed Zod v3 entry points reject oversized collections before visiting elements', async () => {
  // The MCP SDK imports zod/v3; older tools import zod. Both CJS and ESM must be fixed.
  const consumers = ['zod', 'zod/v3'];
  for (const name of consumers) {
    const path = require.resolve(name);
    const cjs = require(name);
    const esm = await import(path.replace(/\.cjs$/, '.js'));
    for (const z of [cjs, esm]) {
      for (const asyncMode of [false, true]) {
        for (const kind of ['arrayMax', 'arrayLength', 'setMax']) {
          let visits = 0;
          const element = z.preprocess(value => { visits++; return value; }, z.string());
          const schema = kind === 'setMax' ? z.set(element).max(2)
            : kind === 'arrayLength' ? z.array(element).length(2) : z.array(element).max(2);
          const data = kind === 'setMax' ? new Set([1, 2, 3, 4]) : [1, 2, 3, 4];
          const parsed = asyncMode ? await schema.safeParseAsync(data) : schema.safeParse(data);
          assert.equal(parsed.success, false, name);
          assert.equal(visits, 0, `${name}/${kind}/${asyncMode}`);
          assert.equal(parsed.error.issues.length, 1);
          assert.equal(parsed.error.issues[0].code, 'too_big');
        }
      }
      assert.deepEqual(z.record(z.string()).parse({ ordinary: 'value' }), { ordinary: 'value' });
      assert.deepEqual(z.array(z.string().transform(s => s.toUpperCase())).max(2).parse(['a', 'b']), ['A', 'B']);
      assert.equal(z.array(z.string()).min(2).safeParse(['a']).error.issues[0].code, 'too_small');
    }
  }
  if (project === 'root') {
    const consumer = createRequire(require.resolve('@expo/mcp-tunnel'));
    const z = consumer('zod');
    const converter = consumer('zod-to-json-schema').zodToJsonSchema;
    const schema = converter(z.object({ title: z.string() }));
    assert.equal(schema.properties.title.type, 'string');
    assert.deepEqual(schema.required, ['title']);
    const legacy = createRequire(require.resolve('@vercel/python-analysis'))('zod');
    assert.deepEqual(legacy.record(legacy.string()).parse({ ordinary: 'value' }), { ordinary: 'value' });
    const modern = createRequire(require.resolve('vercel/package.json'))('zod');
    assert.deepEqual(modern.record(modern.string(), modern.string()).parse({ ordinary: 'value' }), { ordinary: 'value' });
    assert.equal(typeof modern.toJSONSchema, 'function');
  }
});

if (project === 'root') test('stream-json preserves JSON prototype keys and bounds recursive filter work', async () => {
  const { Readable } = await import('node:stream');
  const { pipeline } = await import('node:stream/promises');
  const Assembler = require('stream-json/Assembler');
  for (const options of [undefined, { reviver: (_, value) => value }]) {
    const assembler = new Assembler(options);
    assembler.startObject(); assembler.keyValue('__proto__'); assembler.startObject();
    assembler.keyValue('admin'); assembler.trueValue(); assembler.endObject(); assembler.endObject();
    assert.equal(Object.getPrototypeOf(assembler.current), Object.prototype);
    assert.equal(assembler.current.admin, undefined);
    assert.deepEqual(assembler.current, JSON.parse('{"__proto__":{"admin":true}}'));
  }
  for (const name of ['Pick', 'Ignore', 'Filter', 'Replace']) {
    const Filter = require(`stream-json/filters/${name}`);
    for (const filter of ['missing', /^missing$/]) {
      const tokens = Array.from({ length: 1030 }, () => ({ name: 'startArray' }));
      await assert.rejects(pipeline(Readable.from(tokens), new Filter({ filter }), async source => {
        for await (const chunk of source) { void chunk; }
      }), { code: 'ERR_STREAM_JSON_DEPTH' });
      const shallow = JSON.stringify({ ['x'.repeat(20000)]: [0, 1, 2] });
      await assert.rejects(pipeline(Readable.from([shallow]), require('stream-json').parser(), new Filter({ filter }), async source => {
        for await (const chunk of source) { void chunk; }
      }), { code: 'ERR_STREAM_JSON_DEPTH' });
      await assert.rejects(pipeline(Readable.from(['{"a":{"b":1}}']), require('stream-json').parser(),
        new Filter({ filter, pathSeparator: '.'.repeat(20000) }), async source => {
          for await (const chunk of source) { void chunk; }
        }), { code: 'ERR_STREAM_JSON_DEPTH' });
    }
  }
});

if (hasMetro) test('patched glob and minimatch preserve matching and abort promptly', async () => {
  const { glob, globSync } = require('glob');
  const { minimatch } = createRequire(require.resolve('glob/package.json'))('minimatch');
  const options = { cwd: projectRoot, nodir: true };
  assert.deepEqual(globSync('package.{json,missing}', options), ['package.json']);
  assert.deepEqual(await glob('package.{json,missing}', options), ['package.json']);
  assert.equal(minimatch('src/view.tsx', 'src/*.{ts,tsx}'), true);
  assert.equal(minimatch('src/view.css', 'src/*.{ts,tsx}'), false);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(glob('**/*', { ...options, signal: controller.signal }), { name: 'AbortError' });
});

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
