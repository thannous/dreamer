// CLI journeys of the atlas tools on temporary fixtures: the defects they exist to catch.
//   node --test scripts/test-atlas-tools.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { directoryFiles, hashFiles } from '../tools/e2e/qualification.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(import.meta.url)('../apps/site/dependencies')('sharp');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const node = (script, args, cwd = ROOT) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], { cwd, encoding: 'utf8', env: { ...process.env, INIT_CWD: cwd } });
// Real paths: the tools compare resolved paths, and a system temp folder may sit behind a link (macOS).
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-tools-')));
const listFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);
// A directory link that needs no special right: a junction on Windows, a symbolic link elsewhere.
const junction = (target, at) => fs.symlinkSync(target, at, 'junction');

// A painting: a gradient, with a soft round cut-out when `alpha` is 'cutout', fully opaque or fully
// transparent alpha when it is 'opaque' or 'empty'. `seed` makes another image of the same size.
async function painting(file, width, height, alpha, seed = 0) {
  const channels = alpha ? 4 : 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels;
      pixels[index] = (x + seed) % 256;
      pixels[index + 1] = (y * 2 + seed) % 256;
      pixels[index + 2] = (x + y) % 256;
      if (alpha === 'cutout') {
        const distance = Math.hypot(x - width / 2, y - height / 2) / (Math.min(width, height) / 2);
        pixels[index + 3] = distance < 0.6 ? 255 : distance < 0.8 ? Math.round(255 * (0.8 - distance) / 0.2) : 0;
      } else if (alpha) pixels[index + 3] = alpha === 'opaque' ? 255 : 0;
    }
  }
  const bytes = await sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
  fs.writeFileSync(file, bytes);
  return sha256(bytes);
}

// Smallest sizes the contract accepts, one scene at the canonical 1400×768 (ratio 1.823).
const SIZES = {
  hero: [1200, 675, false], portrait: [800, 1333, false], plate: [700, 560, 'cutout'],
  'scene-pleine': [1400, 768, false], 'scene-croissant': [640, 360, false], 'scene-double': [640, 360, false],
  layer: [960, 540, 'cutout'], accent: [960, 540, 'cutout'],
};

// `allowlisted`: the fixture's pilots config lists the moon as the site's does; by default it does not.
async function fixture({ allowlisted = false } = {}) {
  const dir = temporary();
  const repo = path.join(dir, 'repo');
  const packDir = path.join(dir, 'pack');
  fs.mkdirSync(path.join(repo, 'data'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs-src', 'config'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs-src', 'static'), { recursive: true });
  fs.mkdirSync(packDir);
  fs.copyFileSync(path.join(ROOT, 'data', 'dream-symbols.json'), path.join(repo, 'data', 'dream-symbols.json'));
  const pilots = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs-src', 'config', 'symbol-atlas-pilots.json'), 'utf8'));
  if (!allowlisted) delete pilots.moon;
  fs.writeFileSync(path.join(repo, 'docs-src', 'config', 'symbol-atlas-pilots.json'), JSON.stringify(pilots));
  const pack = { schema: 'noctalia.atlas-pack/1', symbolId: 'moon', sceneIds: ['pleine', 'croissant', 'double'], provenance: { author: 'test', tool: 'fixture', createdAt: '2026-10-19T00:00:00Z' }, roles: {} };
  for (const [role, [width, height, alpha]] of Object.entries(SIZES)) {
    pack.roles[role] = { file: `${role}.png`, sha256: await painting(path.join(packDir, `${role}.png`), width, height, alpha), prompt: `fixture ${role}` };
  }
  const packFile = path.join(packDir, 'pack.json');
  const save = (value) => fs.writeFileSync(packFile, JSON.stringify(value, null, 2));
  save(pack);
  const out = path.join(repo, 'docs-src', 'static', 'img', 'symbols', 'atlas-six-v2', 'moon');
  const run = (...extra) => node('atlas-pack.mjs', ['--pack', packFile, '--repo-root', repo, ...extra], dir);
  return { dir, repo, packDir, packFile, pack, save, out, run };
}

const latestReceipt = (repo) => {
  const receipts = path.join(repo, '.cache', 'atlas-pack', 'receipts');
  return JSON.parse(fs.readFileSync(path.join(receipts, listFiles(receipts).at(-1)), 'utf8'));
};
const statuses = (receipt) => Object.fromEntries(Object.entries(receipt.roles).map(([role, entry]) => [role, [...new Set(entry.outputs.map((output) => output.status))].join()]));

test('a complete pack is encoded once, at the served sizes, with native sizes in its manifest delta; a second pass changes nothing; one changed role is the only one re-encoded', async () => {
  const f = await fixture();
  const dry = f.run('--dry-run');
  assert.equal(dry.status, 0, dry.stderr);
  assert.deepEqual(listFiles(f.out), [], 'a dry run writes nothing');
  assert.equal(fs.existsSync(path.join(f.repo, '.cache')), false);

  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  const receipt = latestReceipt(f.repo);
  const delta = receipt.manifestDelta.moon;
  assert.deepEqual(Object.keys(delta), ['hero', 'portrait', 'plate', 'scene-pleine', 'scene-croissant', 'scene-double', 'layer', 'accent']);
  assert.deepEqual(Object.keys(delta.hero.webp), ['400', '800', '1200']);
  assert.deepEqual(Object.keys(delta.portrait.avif), ['480', '800']);
  assert.deepEqual(Object.keys(delta['scene-pleine'].webp), ['320', '640']);
  assert.deepEqual([delta['scene-pleine'].width, delta['scene-pleine'].height], [1400, 768], 'the native size of the source, not the largest served one');
  assert.deepEqual([delta.layer.width, delta.layer.height], [960, 540]);
  for (const [role, asset] of Object.entries(delta)) {
    for (const format of ['avif', 'webp']) {
      for (const [width, url] of Object.entries(asset[format])) {
        const match = new RegExp(`^/img/symbols/atlas-six-v2/moon/${role}-${width}-([0-9a-f]{12})\\.${format}$`).exec(url);
        assert.ok(match, url);
        const file = path.join(f.repo, 'docs-src', 'static', ...url.split('/').filter(Boolean));
        assert.equal(sha256(fs.readFileSync(file)).slice(0, 12), match[1], `${url} is named after its content`);
        const meta = await sharp(file).metadata();
        assert.equal(meta.width, Number(width));
        if (['plate', 'layer', 'accent'].includes(role)) assert.equal(meta.hasAlpha, true, `${url} keeps its alpha`);
      }
    }
  }
  assert.ok(receipt.roles.layer.source.alpha.translucent > 0.001);
  assert.equal(fs.existsSync(path.join(f.repo, 'docs-src', 'config', 'symbol-atlas-six-assets.json')), false, 'the shared manifest is untouched without --merge-manifest');

  const written = listFiles(f.out);
  const times = written.map((name) => fs.statSync(path.join(f.out, name)).mtimeMs);
  const second = f.run();
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(Object.values(statuses(latestReceipt(f.repo))), Array(8).fill('unchanged'));
  assert.deepEqual(listFiles(f.out).map((name) => fs.statSync(path.join(f.out, name)).mtimeMs), times, 'nothing is rewritten');

  f.pack.roles.accent.sha256 = await painting(path.join(f.packDir, 'accent.png'), 960, 540, 'cutout', 40);
  f.save(f.pack);
  const third = f.run();
  assert.equal(third.status, 0, third.stderr);
  const after = latestReceipt(f.repo);
  assert.deepEqual(statuses(after), { hero: 'unchanged', portrait: 'unchanged', plate: 'unchanged', 'scene-pleine': 'unchanged', 'scene-croissant': 'unchanged', 'scene-double': 'unchanged', layer: 'unchanged', accent: 'written' });
  assert.equal(after.superseded.length, 4, 'the former accent files are listed');
  for (const url of after.superseded) assert.ok(fs.existsSync(path.join(f.repo, 'docs-src', 'static', ...url.split('/').filter(Boolean))), 'and kept');
});

test('an incomplete pack, a wrong sha256 or a texture without real alpha is refused before anything is written', async () => {
  const f = await fixture();
  const refused = (pattern) => {
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, pattern);
    assert.deepEqual(listFiles(f.out), []);
    assert.equal(fs.existsSync(path.join(f.repo, '.cache')), false);
  };
  const { accent } = f.pack.roles;
  delete f.pack.roles.accent;
  f.save(f.pack);
  refused(/role accent is missing/);
  f.pack.roles.accent = { ...accent, sha256: '0'.repeat(64) };
  f.save(f.pack);
  refused(/accent: accent\.png has sha256 [0-9a-f]{64}, the pack says 0{64}/);
  f.pack.roles.accent = { ...accent, sha256: await painting(path.join(f.packDir, 'accent.png'), 960, 540, 'opaque') };
  f.save(f.pack);
  refused(/accent: 0\.00% transparent, at least 2% expected/);
  f.pack.roles.accent = { ...accent, sha256: await painting(path.join(f.packDir, 'accent.png'), 960, 540, 'empty') };
  f.save(f.pack);
  refused(/accent: 100\.00% transparent, at most 99\.9% \(an empty texture\)/);
  f.pack.roles.accent = { ...accent, sha256: await painting(path.join(f.packDir, 'accent.png'), 960, 540, 'cutout') };
  f.pack.roles.hero.sha256 = await painting(path.join(f.packDir, 'hero.png'), 1000, 1000, false);
  f.save(f.pack);
  refused(/hero: ratio 1\.0000 \(1000×1000\) is outside its orientation range 1\.5–2/);
});

test('the pack cannot write outside its prefix nor read outside its input root', async () => {
  const f = await fixture();
  const refused = (pattern) => {
    const result = f.run();
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, pattern);
    assert.deepEqual(listFiles(path.join(f.repo, 'docs-src', 'static')), []);
  };
  const original = structuredClone(f.pack);
  f.save({ ...original, symbolId: '../moon' });
  refused(/symbolId must match/);
  f.save({ ...original, symbolId: 'dragonfly' });
  refused(/symbolId "dragonfly" is not in data\/dream-symbols\.json/);
  f.save({ ...original, sceneIds: ['pleine', 'pleine', 'double'] });
  refused(/sceneIds must be distinct/);
  f.save({ ...original, symbolId: 'snake' });
  refused(/differ from the allowlisted morsure, calme, mue/);
  f.save({ ...original, roles: { ...original.roles, hero: { ...original.roles.hero, file: '../hero.png' } } });
  refused(/hero: \.\.\/hero\.png must be a relative POSIX path inside the input root/);
  fs.mkdirSync(path.join(f.packDir, 'real'));
  fs.copyFileSync(path.join(f.packDir, 'hero.png'), path.join(f.packDir, 'real', 'hero.png'));
  junction(path.join(f.packDir, 'real'), path.join(f.packDir, 'linked'));
  f.save({ ...original, roles: { ...original.roles, hero: { ...original.roles.hero, file: 'linked/hero.png' } } });
  refused(/hero: linked\/hero\.png is not a plain file \(links are refused\)/);
  f.save(original);
  const merge = f.run('--merge-manifest');
  assert.equal(merge.status, 1);
  assert.match(merge.stderr, /moon is not allowlisted/);
  const outside = f.run('--output-root', f.dir);
  assert.equal(outside.status, 1);
  assert.match(outside.stderr, /must lie inside the repository/);
});

test('the pack writes only through real folders of the repository, and merges the manifest only from the site\'s own output root', async () => {
  const f = await fixture({ allowlisted: true });
  const elsewhere = temporary();
  const refused = (pattern, ...extra) => {
    const result = f.run(...extra);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, pattern);
    assert.deepEqual(listFiles(elsewhere), [], 'nothing lands outside the repository');
    assert.deepEqual(listFiles(path.join(f.repo, 'docs-src', 'static')).filter((name) => name !== 'img'), []);
  };
  refused(/--merge-manifest needs the site's own output root docs-src\/static, not a staging one/, '--merge-manifest', '--output-root', path.join(f.repo, 'staging'));
  assert.equal(fs.existsSync(path.join(f.repo, 'staging')), false);

  // A link (or junction) on the way to each destination: the images, the cache, the receipt, the manifest.
  const img = path.join(f.repo, 'docs-src', 'static', 'img');
  junction(elsewhere, img);
  refused(/the output folder: .+img is a link or an alias/);
  fs.unlinkSync(img);
  junction(elsewhere, path.join(f.repo, '.cache'));
  refused(/the cache: .+\.cache is a link or an alias/);
  fs.unlinkSync(path.join(f.repo, '.cache'));
  junction(elsewhere, path.join(f.repo, 'receipts'));
  refused(/the receipt: .+receipts is a link or an alias/, '--receipt', path.join(f.repo, 'receipts', 'moon.json'));
  fs.unlinkSync(path.join(f.repo, 'receipts'));
  const config = path.join(f.repo, 'docs-src', 'config');
  const movedConfig = path.join(temporary(), 'config');
  fs.renameSync(config, movedConfig);
  junction(movedConfig, config);
  refused(/the shared manifest: .+config is a link or an alias/, '--merge-manifest');
  assert.equal(fs.existsSync(path.join(movedConfig, 'symbol-atlas-six-assets.json')), false);
  fs.unlinkSync(config);
  fs.renameSync(movedConfig, config);

  const merged = f.run('--merge-manifest');
  assert.equal(merged.status, 0, merged.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(config, 'symbol-atlas-six-assets.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest), ['moon']);
  assert.equal(Object.keys(manifest.moon).length, 8);
});

function gitRepo() {
  const dir = temporary();
  const run = (cwd, ...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const cloud = path.join(dir, 'cloud');
  fs.mkdirSync(cloud);
  run(cloud, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(cloud, 'a.txt'), 'zero\n');
  fs.writeFileSync(path.join(cloud, 'b.txt'), 'b\n');
  run(cloud, 'add', '.');
  run(cloud, 'commit', '-qm', 'root');
  const root = run(cloud, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(cloud, 'a.txt'), 'one\ntwo\nthree\nfour\nfive\nsix\nseven\n');
  run(cloud, 'commit', '-qam', 'base');
  const base = run(cloud, 'rev-parse', 'HEAD');
  const local = path.join(dir, 'local');
  run(dir, 'clone', '-q', cloud, local);
  fs.writeFileSync(path.join(cloud, 'a.txt'), 'one\ntwo\nthree\nfour\nfive\nsix\nSEVEN\n');
  fs.writeFileSync(path.join(cloud, 'c.txt'), 'new\n');
  run(cloud, 'add', '.');
  run(cloud, 'commit', '-qm', 'change');
  return { dir, cloud, local, root, base, run };
}

test('a handoff is refused when its patch or paths differ from its envelope, or when the base content diverged without an explicit three-way check', () => {
  const g = gitRepo();
  const out = path.join(g.dir, 'handoff');
  const created = node('atlas-handoff.mjs', ['create', '--repo-root', g.cloud, '--base', g.base, '--out', out, '--run', 'node -e "process.exit(0)"', '--run', 'node -e "process.exit(3)"'], g.dir);
  assert.equal(created.status, 1, 'a failed check fails the command');
  const envelopeFile = path.join(out, listFiles(out).find((name) => name.endsWith('.json')));
  const envelope = JSON.parse(fs.readFileSync(envelopeFile, 'utf8'));
  assert.deepEqual(envelope.checks.map((check) => check.exitCode), [0, 3], 'and it is recorded as failed');
  assert.deepEqual(envelope.paths.map((entry) => [entry.path, entry.status]), [['a.txt', 'M'], ['c.txt', 'A']]);
  const verify = (...extra) => node('atlas-handoff.mjs', ['verify', '--repo-root', g.local, '--envelope', envelopeFile, ...extra], g.dir);

  const exact = verify();
  assert.equal(exact.status, 0, exact.stderr);
  assert.match(exact.stdout, /apply: {2}git am /);
  assert.match(exact.stdout, /git reset --keep [0-9a-f]{40}/);
  assert.match(exact.stdout, /the base is in this clone \(its blobs checked\), the head is not: the commits are not proven/);

  // The announced base: one this clone does not have is reported, never taken as proven; one it has
  // must hold every "before" blob, and with the head here too, lead to it through the listed commits.
  const announcing = (fields) => fs.writeFileSync(envelopeFile, JSON.stringify({ ...envelope, ...fields }));
  announcing({ base: 'f'.repeat(40) });
  const unknown = verify();
  assert.equal(unknown.status, 0, unknown.stderr);
  assert.match(unknown.stdout, /base and head are not in this clone: content checked per path, ancestry not proven/);
  announcing({ base: g.root });
  const wrongBase = verify();
  assert.equal(wrongBase.status, 1);
  assert.match(wrongBase.stderr, new RegExp(`the base ${g.root.slice(0, 12)} holds a\\.txt as [0-9a-f]{40}, the envelope's before is ${envelope.paths[0].before}`));
  announcing({ commits: [{ sha: 'e'.repeat(40), subject: 'change' }] });
  assert.match(verify().stderr, /the patch carries commits [0-9a-f]{40}, the envelope lists e{40}/);
  g.run(g.local, 'fetch', '-q', 'origin');
  fs.writeFileSync(envelopeFile, JSON.stringify(envelope));
  const known = verify();
  assert.equal(known.status, 0, known.stderr);
  assert.match(known.stdout, /base and head are in this clone: ancestry, commits, paths and blobs checked against them/);
  announcing({ base: g.root });
  assert.match(verify().stderr, new RegExp(`${g.root.slice(0, 12)}\\.\\.${envelope.head.slice(0, 12)} holds commits ${g.base}, ${envelope.head}, the envelope lists ${envelope.head}`));
  announcing({ paths: envelope.paths.map((entry) => (entry.path === 'c.txt' ? { ...entry, after: 'd'.repeat(40) } : entry)) });
  assert.match(verify().stderr, /the head [0-9a-f]{12} holds c\.txt as [0-9a-f]{40}, the envelope's after is d{40}/);

  const patchFile = path.join(out, envelope.patch.file);
  const bytes = fs.readFileSync(patchFile);
  fs.writeFileSync(patchFile, Buffer.concat([bytes, Buffer.from('\n')]));
  assert.match(verify().stderr, /has sha256 [0-9a-f]{64}, the envelope says/);
  fs.writeFileSync(patchFile, bytes);
  fs.writeFileSync(envelopeFile, JSON.stringify({ ...envelope, paths: envelope.paths.slice(0, 1) }));
  assert.match(verify().stderr, /disagree on paths \(patch only: c\.txt/);
  fs.writeFileSync(envelopeFile, JSON.stringify({ ...envelope, paths: [...envelope.paths, { path: '../x', status: 'A', before: null, after: null }] }));
  assert.match(verify().stderr, /unsafe path in the envelope/);
  fs.writeFileSync(envelopeFile, JSON.stringify(envelope));

  fs.writeFileSync(path.join(g.local, 'a.txt'), 'ONE\ntwo\nthree\nfour\nfive\nsix\nseven\n');
  assert.match(verify().stderr, /working tree is not clean/);
  g.run(g.local, 'commit', '-qam', 'local change far from the patch');
  const diverged = verify();
  assert.equal(diverged.status, 1);
  assert.match(diverged.stdout, /DIVERGED M a\.txt/);
  assert.match(diverged.stderr, /do not hold the base content/);
  const merged = verify('--allow-diverged');
  assert.equal(merged.status, 0, merged.stderr);
  assert.match(merged.stdout, /git am --3way/);
  g.run(g.local, 'am', '-q', '--3way', patchFile);
  assert.equal(verify('--applied').status, 1, 'a merged path differs from the cloud head');
  assert.equal(verify('--applied', '--allow-diverged').status, 0);
});

// A run directory as tools/e2e/run.mjs leaves it, reduced to what the receipt reads.
let runs = 0;
function runDirectory({ qualified = true, revision = 'a'.repeat(40), excluded = 1, sdkLaunched = true, sourceEnd = {} } = {}) {
  const parent = temporary();
  runs += 1;
  const dir = path.join(parent, `1792000000000-${runs}-run`);
  fs.mkdirSync(path.join(dir, 'results', 'test-one'), { recursive: true });
  const write = (name, value) => fs.writeFileSync(path.join(dir, name), typeof value === 'string' ? value : JSON.stringify(value));
  const row = (title) => ({ targetId: 'site-web', testId: `tests/site.web.e2e.ts::${encodeURIComponent(title)}`, repeat: 0, agent: 'default' });
  write('evidence.json', { product: 'site', platform: 'web', revision, workingTree: '', command: ['node', 'tools/e2e/run.mjs', 'site', 'web', 'run'] });
  write('source-start.json', { revision, workingTree: '', files: {}, outputs: {} });
  write('source-end.json', { revision, workingTree: '', files: {}, outputs: {}, ...sourceEnd });
  write('collection.json', { pairs: [] });
  write('report.json', { run: { id: 'run-1', status: 'passed', startedAt: 's', finishedAt: 'f', summary: { discovered: 1 + excluded, selected: 1, executed: 1, passed: 1, failed: 0, interrupted: 0, flaky: 0, skipped: 0 } } });
  write('qualification.json', { schemaVersion: 1, runId: 'run-1', target: 'site-web', revision, runner: '0.21.2', engine: '0.15.2', passed: [row('a moon journey')], skipped: [], excluded: Array.from({ length: excluded }, (_, index) => row(`another journey ${index}`)) });
  write('results/test-one/trace.md', '# trace\n');
  write('files.json', hashFiles(dir, directoryFiles(dir, '.').filter((file) => !['files.json', 'end.json'].includes(file))));
  write('end.json', { exitCode: 0, primaryExitCode: 0, applicationQualified: qualified, sdkLaunched, stability: { sourceStable: true, outputsStable: true, startRevision: revision, endRevision: revision, sourceClean: true } });
  return dir;
}

test('a qualification receipt copies a qualified run once and refuses a run the wrapper did not qualify or whose files changed', () => {
  const out = temporary();
  const receipt = (dir, ...extra) => node('atlas-qualification-receipt.mjs', ['--run', dir, '--out', out, ...extra]);
  const good = runDirectory({ excluded: 2 });
  const first = receipt(good);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /1 passed, 0 skipped, 2 excluded by the selection/);
  const written = JSON.parse(fs.readFileSync(path.join(out, `${path.basename(good)}.receipt.json`), 'utf8'));
  assert.deepEqual(written.passed, ['a moon journey']);
  assert.equal(written.files['results/test-one/trace.md'], sha256('# trace\n'));
  const again = receipt(good);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /0 file\(s\) copied/);
  assert.equal(receipt(good, '--revision', 'b'.repeat(40)).status, 1);

  const unqualified = runDirectory({ qualified: false });
  const refused = receipt(unqualified);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /did not qualify the run/);
  assert.equal(fs.existsSync(path.join(out, `${path.basename(unqualified)}.receipt.json`)), false);

  const tampered = runDirectory();
  fs.appendFileSync(path.join(tampered, 'results', 'test-one', 'trace.md'), 'edited\n');
  const changed = receipt(tampered);
  assert.equal(changed.status, 1);
  assert.match(changed.stderr, /EVIDENCE_CHANGED/);

  const incomplete = runDirectory();
  fs.unlinkSync(path.join(incomplete, 'qualification.json'));
  assert.match(receipt(incomplete).stderr, /qualification\.json is missing/);

  // The candidate's identity: the SDK ran, and the source snapshots before and after the run name the
  // same revision and working tree as its evidence.
  assert.match(receipt(runDirectory({ sdkLaunched: false })).stderr, /the SDK was not launched/);
  assert.match(receipt(runDirectory({ sourceEnd: { revision: 'c'.repeat(40) } })).stderr, /the run's revisions disagree: a{40}, c{40}/);
  assert.match(receipt(runDirectory({ sourceEnd: { workingTree: ' M app.json' } })).stderr, /describe different working trees/);
  assert.deepEqual(listFiles(out).filter((name) => name.endsWith('.receipt.json')), [`${path.basename(good)}.receipt.json`]);
});

test('a qualification receipt copies only into real folders that do not overlap the run', () => {
  const run = runDirectory();
  const files = () => directoryFiles(run, '.').sort();
  const before = files();
  // An output folder reached through a link that lands inside the run.
  const parent = temporary();
  junction(run, path.join(parent, 'into-run'));
  const overlap = node('atlas-qualification-receipt.mjs', ['--run', run, '--out', path.join(parent, 'into-run', 'copies')]);
  assert.equal(overlap.status, 1);
  assert.match(overlap.stderr, /overlaps the run/);
  assert.deepEqual(files(), before, 'the run is untouched');
  // A link planted below the output folder: refused before the first copy.
  const out = temporary();
  const elsewhere = temporary();
  fs.mkdirSync(path.join(out, path.basename(run)));
  junction(elsewhere, path.join(out, path.basename(run), 'results'));
  const planted = node('atlas-qualification-receipt.mjs', ['--run', run, '--out', out]);
  assert.equal(planted.status, 1);
  assert.match(planted.stderr, /unsafe destination: .+results is a link or an alias/);
  assert.deepEqual(listFiles(elsewhere), []);
  assert.deepEqual(listFiles(path.join(out, path.basename(run))), ['results'], 'nothing copied');
  assert.deepEqual(listFiles(out).filter((name) => name.endsWith('.receipt.json')), []);
});

test('the review gallery refuses a page that is not the catalogue\'s, and never writes into the site, even through an alias', () => {
  const dir = temporary();
  const repo = path.join(dir, 'repo');
  for (const folder of ['data', 'docs', path.join('docs-src', 'config')]) fs.mkdirSync(path.join(repo, folder), { recursive: true });
  for (const file of [path.join('data', 'dream-symbols.json'), path.join('docs-src', 'config', 'symbol-atlas-pilots.json'), path.join('docs-src', 'config', 'site.config.json')]) fs.copyFileSync(path.join(ROOT, file), path.join(repo, file));
  fs.writeFileSync(path.join(repo, 'docs', 'index.html'), 'site\n');
  const pages = path.join(dir, 'pages.json');
  const gallery = (out) => node('atlas-review-gallery.mjs', ['--pages', pages, '--out', out, '--repo-root', repo], dir);
  const refused = (out, pattern) => {
    const result = gallery(out);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, pattern);
  };
  fs.writeFileSync(pages, JSON.stringify([{ id: 'moon', slug: 'moon', name: 'Lune', mood: 'brume' }]));
  refused(path.join(dir, 'review.html'), /the French slug of moon is lune, not moon/);
  fs.writeFileSync(pages, JSON.stringify([{ id: 'moon', slug: 'lune', name: 'Lune', mood: 'brume' }]));
  refused(path.join(repo, 'docs', 'review.html'), /must stay outside docs\//);
  // A folder alias that leads into the site: to docs/ itself, or to the repository, then docs-src/.
  junction(path.join(repo, 'docs'), path.join(dir, 'to-docs'));
  refused(path.join(dir, 'to-docs', 'review.html'), /must stay outside docs\/ .+ lands in .+review\.html/);
  junction(repo, path.join(dir, 'to-repo'));
  refused(path.join(dir, 'to-repo', 'docs-src', 'review.html'), /must stay outside docs-src\//);
  // Another name of a site file.
  fs.linkSync(path.join(repo, 'docs', 'index.html'), path.join(dir, 'index-alias.html'));
  refused(path.join(dir, 'index-alias.html'), /not a link, a hard link or a folder/);
  assert.deepEqual(listFiles(path.join(repo, 'docs')), ['index.html']);
  assert.equal(fs.readFileSync(path.join(repo, 'docs', 'index.html'), 'utf8'), 'site\n');
  assert.deepEqual(listFiles(path.join(repo, 'docs-src')), ['config']);

  const made = gallery(path.join(dir, 'review.html'));
  assert.equal(made.status, 0, made.stderr);
  const review = fs.readFileSync(path.join(dir, 'review.html'), 'utf8');
  // One page per published language, at the catalogue's slug under that language's symbols path.
  for (const url of ['/fr/symboles/lune.html', '/en/symbols/moon.html', '/es/simbolos/luna.html', '/de/traumsymbole/mond.html', '/it/simboli/luna.html', '/pt-br/simbolos/lua.html']) {
    assert.ok(review.includes(`"url":"http://localhost:8000${url}"`), url);
  }
  assert.deepEqual([...review.matchAll(/data-lang="([^"]+)"/g)].map((match) => match[1]), ['en', 'fr', 'es', 'de', 'it', 'pt-br']);
});

// The rollout report of the 240 symbols, run on copies of the site's real inputs.
function rolloutFixture() {
  const dir = temporary();
  const repo = path.join(dir, 'repo');
  for (const file of [
    'data/dream-symbols.json', 'data/dream-symbols-extended.json', 'data/dream-symbols-extended-tier3.json',
    'docs-src/config/site.config.json', 'docs-src/config/symbol-rollout.json',
    'docs-src/config/symbol-atlas-pilots.json', 'docs-src/config/symbol-atlas-locales.json',
  ]) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), path.join(repo, file));
  }
  const image = (name) => ({ webp: { 640: `/img/${name}.webp` } });
  const roles = (id, scenes, sceneImage) => ({
    hero: image(`${id}-hero`), portrait: image(`${id}-portrait`), plate: image(`${id}-plate`),
    layer: image(`${id}-layer`), accent: image(`${id}-accent`),
    ...Object.fromEntries(scenes.map((scene) => [`scene-${scene}`, image(sceneImage(scene))])),
  });
  // The moon has its eight paintings; the door shows one image for its three scenes; the rest have none.
  const manifest = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({
    moon: roles('moon', ['pleine', 'croissant', 'double'], (scene) => `moon-${scene}`),
    door: roles('door', ['ouverte', 'verrouillee', 'choix'], () => 'door-scene'),
  }));
  // A stand-in for the page generator: the engine part of every source identity.
  const generator = path.join(repo, 'docs-src', 'static', 'scripts', 'generate-symbol-pages.js');
  fs.mkdirSync(path.dirname(generator), { recursive: true });
  fs.writeFileSync(generator, '// engine v1\n');
  const registryFile = path.join(repo, 'docs-src', 'config', 'symbol-rollout.json');
  // The site's lots, without its records: their evidence files are not in the fixture, and each
  // stage below starts from what the journey records itself.
  const registry = { ...JSON.parse(fs.readFileSync(registryFile, 'utf8')), records: [] };
  fs.writeFileSync(registryFile, JSON.stringify(registry));
  const writeRegistry = (change) => fs.writeFileSync(registryFile, JSON.stringify(change(structuredClone(registry))));
  const run = (out) => {
    const result = node('symbol-rollout-report.mjs', ['--repo-root', repo, '--manifest', manifest, '--out', out], dir);
    const json = path.join(dir, out, 'symbol-rollout.json');
    return { ...result, report: result.status === 0 ? JSON.parse(fs.readFileSync(json, 'utf8')) : null };
  };
  return { dir, repo, run, writeRegistry, manifest, generator };
}

test('the rollout report reads states from the repository and stages only from registry records with their evidence', () => {
  const { dir, repo, run, writeRegistry, manifest, generator } = rolloutFixture();
  const first = run('out-1');
  assert.equal(first.status, 0, first.stderr);
  const bySymbol = (report, id) => report.symbols.find((symbol) => symbol.id === id);
  assert.deepEqual(first.report.languages, ['en', 'fr', 'es', 'de', 'it', 'pt-br']);
  // Every file the report reads is named by its sha256.
  assert.deepEqual(Object.keys(first.report.inputs), ['siteConfig', 'catalog', 'extended', 'tier3', 'registry', 'pilots', 'locales', 'manifest', 'engines']);
  assert.deepEqual(first.report.totals, { symbols: 240, done: 0, inProgress: 37, remaining: 203 });
  assert.deepEqual(first.report.lots['lot-02'].symbols, ['fire', 'door', 'bird', 'moon', 'train', 'clock']);
  assert.deepEqual(first.report.lots['lot-03'].symbols, ['water', 'teeth', 'flying', 'dog', 'car', 'bridge']);
  assert.deepEqual(first.report.lots['lot-04'].symbols, ['cat', 'stairs', 'rain', 'mountain', 'mirror', 'key']);
  assert.deepEqual(first.report.lots['lot-05'].symbols, ['baby', 'horse', 'storm', 'flowers', 'castle', 'stars']);
  assert.deepEqual(first.report.lots['lot-06'].symbols, ['elevator', 'wolf', 'book', 'snow', 'desert', 'candle']);
  assert.equal(bySymbol(first.report, 'tiger').assets.state, 'tiger-engine');
  assert.equal(bySymbol(first.report, 'moon').assets.state, 'complete');
  assert.equal(bySymbol(first.report, 'door').assets.state, 'same-image-scenes');
  assert.deepEqual(bySymbol(first.report, 'fire').assets, {
    state: 'incomplete',
    missing: ['hero', 'portrait', 'plate', 'scene-reconfort', 'scene-incendie', 'scene-fumee', 'layer', 'accent'],
  });
  assert.equal(bySymbol(first.report, 'deer').state, 'remaining');
  // Each pt-br scene names a card of the pt catalog, like the five other languages.
  assert.deepEqual(bySymbol(first.report, 'moon').languages['pt-br'].scenes, { pleine: 'card', croissant: 'card', double: 'card' });
  assert.deepEqual(bySymbol(first.report, 'moon').languages.fr.stages, {
    qa: { desktop: 'not-recorded', mobile: 'not-recorded' },
    approval: { desktop: 'not-recorded', mobile: 'not-recorded' },
    publication: { all: 'not-recorded' },
  });

  // The same inputs give the same bytes.
  assert.equal(run('out-2').status, 0);
  for (const file of ['symbol-rollout.json', 'symbol-rollout.csv']) {
    assert.equal(fs.readFileSync(path.join(dir, 'out-1', file), 'utf8'), fs.readFileSync(path.join(dir, 'out-2', file), 'utf8'));
  }

  // A screenshot lying in the repository validates nothing without a record.
  const evidence = path.join(repo, 'evidence', 'moon-fr-desktop.png');
  fs.mkdirSync(path.dirname(evidence), { recursive: true });
  fs.writeFileSync(evidence, 'qa capture');
  assert.equal(bySymbol(run('out-3').report, 'moon').languages.fr.stages.qa.desktop, 'not-recorded');

  // A record names the source the report gave for that symbol and language when it was qualified.
  const source = bySymbol(first.report, 'moon').languages.fr.source;
  assert.deepEqual(Object.keys(source), ['content', 'atlas', 'assets', 'engine']);
  const record = { id: 'moon', lang: 'fr', stage: 'qa', surface: 'desktop', verdict: 'accepted', date: '2026-10-18', source, evidence: { path: 'evidence/moon-fr-desktop.png', sha256: sha256('qa capture') } };
  writeRegistry((value) => ({ ...value, records: [record] }));
  const accepted = bySymbol(run('out-4').report, 'moon');
  assert.equal(accepted.languages.fr.stages.qa.desktop, 'accepted');
  assert.equal(accepted.languages.fr.stages.qa.mobile, 'not-recorded');
  assert.equal(accepted.languages['pt-br'].stages.qa.desktop, 'not-recorded');
  assert.equal(accepted.state, 'in-progress');

  // Once the reading, the paintings or the engine change, the record stays as history: stale, with
  // what changed, until a new QA records the new source.
  const extendedFile = path.join(repo, 'data', 'dream-symbols-extended.json');
  const extended = fs.readFileSync(extendedFile, 'utf8');
  const edited = JSON.parse(extended);
  edited.symbols.moon.fr.variations[0].meaning += ' Une phrase de plus.';
  fs.writeFileSync(extendedFile, JSON.stringify(edited));
  const changedReading = bySymbol(run('out-4b').report, 'moon');
  assert.equal(changedReading.languages.fr.stages.qa.desktop, 'stale');
  assert.ok(changedReading.reasons.includes('fr qa desktop: stale (content changed since 2026-10-18)'));
  assert.equal(bySymbol(run('out-4b').report, 'snake').languages.fr.stages.qa.desktop, 'not-recorded');
  fs.writeFileSync(extendedFile, extended);
  const paintings = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  paintings.moon.hero.webp[640] = '/img/moon-hero-retouched.webp';
  fs.writeFileSync(manifest, JSON.stringify(paintings));
  fs.writeFileSync(generator, '// engine v2\n');
  assert.deepEqual(bySymbol(run('out-4c').report, 'moon').languages.fr.stale, [{ stage: 'qa', surface: 'desktop', date: '2026-10-18', changed: ['assets', 'engine'] }]);
  const requalified = { ...record, date: '2026-10-19', source: bySymbol(run('out-4d').report, 'moon').languages.fr.source };
  writeRegistry((value) => ({ ...value, records: [record, requalified] }));
  assert.equal(bySymbol(run('out-4e').report, 'moon').languages.fr.stages.qa.desktop, 'accepted');

  fs.writeFileSync(evidence, 'another capture');
  assert.equal(bySymbol(run('out-5').report, 'moon').languages.fr.stages.qa.desktop, 'evidence-mismatch');
  fs.rmSync(evidence);
  assert.equal(bySymbol(run('out-6').report, 'moon').languages.fr.stages.qa.desktop, 'evidence-missing');
  writeRegistry((value) => ({ ...value, records: [requalified, { ...requalified, verdict: 'changes', date: '2026-10-20' }] }));
  assert.equal(bySymbol(run('out-7').report, 'moon').languages.fr.stages.qa.desktop, 'changes-requested');

  // A registry that drops an id, or records a publication per surface, is refused.
  writeRegistry((value) => { delete value.symbols.cat; return value; });
  const missing = run('out-8');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /cat is missing from the registry/);
  writeRegistry((value) => ({ ...value, records: [{ ...record, stage: 'publication' }] }));
  const perSurface = run('out-9');
  assert.equal(perSurface.status, 1);
  assert.match(perSurface.stderr, /a publication record covers all/);
  const unsourced = { ...record };
  delete unsourced.source;
  writeRegistry((value) => ({ ...value, records: [unsourced] }));
  const withoutSource = run('out-10');
  assert.equal(withoutSource.status, 1);
  assert.match(withoutSource.stderr, /source needs the content, atlas, assets, engine identities/);
});
