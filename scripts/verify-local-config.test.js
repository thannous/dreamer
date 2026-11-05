'use strict';

// verify-local.config.mjs: the checks verify:pr and verify:release announce
// must exist and retain the former CircleCI validation portfolio. The frozen
// fixture prevents removing a remote job from silently dropping local coverage.

const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const ENGINE = pathToFileURL(path.join(ROOT, 'scripts/verify-local.mjs')).href;

// The config is an ES module; Jest runs this project without ESM support.
const config = JSON.parse(execFileSync(process.execPath, [
  '--input-type=module',
  '-e',
  `const { default: config } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'verify-local.config.mjs')).href)});
   process.stdout.write(JSON.stringify(config));`,
], { encoding: 'utf8' }));

const scriptsOf = (file) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8')).scripts;

const tracked = () => execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).trim().split('\n');

/** The files a scope leaves out, by the engine's own matcher (an ES module). */
function outside(globs, files) {
  return JSON.parse(execFileSync(process.execPath, [
    '--input-type=module', '-e',
    `import { readFileSync } from 'node:fs';
     import { matchesAny } from ${JSON.stringify(ENGINE)};
     const [globs, files] = JSON.parse(readFileSync(0, 'utf8'));
     process.stdout.write(JSON.stringify(files.filter((file) => !matchesAny(file, globs))));`,
  ], { input: JSON.stringify([globs, files]), encoding: 'utf8', maxBuffer: 64 << 20 }));
}

const checkNamed = (name) => config.checks.find((check) => check.name === name);

// Records, in each Node process, the repository files that repository code
// reads (a tool reading for itself, such as Jest's haste map, does not count).
const READ_RECORDER = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { syncBuiltinESMExports } = require('node:module');
const root = process.env.SCOPE_READS_ROOT;
const reads = new Set();
function record(target) {
  if (target instanceof URL) target = fileURLToPath(target);
  if (typeof target !== 'string') return;
  const relative = path.relative(root, path.resolve(target));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep)[0] === 'node_modules') return;
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 100;
  const stack = new Error().stack.split('\\n').slice(3);
  Error.stackTraceLimit = limit;
  if (stack.some((line) => line.includes(root + path.sep) && !line.includes(path.sep + 'node_modules' + path.sep))) {
    reads.add(relative.split(path.sep).join('/'));
  }
}
for (const [owner, names] of [[fs, ['readFileSync', 'readFile', 'openSync', 'open', 'readdirSync', 'readdir', 'createReadStream']],
  [fs.promises, ['readFile', 'open', 'readdir']]]) {
  for (const name of names) {
    const original = owner[name];
    owner[name] = function (target, ...rest) { record(target); return original.call(this, target, ...rest); };
  }
}
syncBuiltinESMExports();
process.on('exit', () => fs.writeFileSync(path.join(process.env.SCOPE_READS_DIR, process.pid + '.reads'), [...reads].join('\\n')));
`;

function circleciCommands() {
  const continuation = YAML.parse(readFileSync(path.join(ROOT, '.circleci/tests/fixtures/validation-portfolio.yml'), 'utf8'));
  const commands = [];
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      if (value.run !== undefined) commands.push(typeof value.run === 'string' ? value.run : value.run.command);
      Object.values(value).forEach(walk);
    }
  };
  walk(continuation.jobs);
  walk(continuation.commands);
  return commands.join('\n');
}

describe('verify-local.config.mjs', () => {
  // The pin lives here, in verify-config, which runs on any edit of the
  // config, the engine or .gitattributes: the engine's own tests read only
  // scratch configs, so a config edit does not rerun them.
  it('pins the engine as committed (LF), and .gitattributes keeps both files LF', () => {
    const { createHash } = require('node:crypto');
    const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
    const pinned = execFileSync(process.execPath, ['--input-type=module', '-e',
      `const { ENGINE_SHA256 } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'verify-local.config.mjs')).href)});
       process.stdout.write(String(ENGINE_SHA256));`], { encoding: 'utf8' });
    expect(pinned).toMatch(/^[0-9a-f]{64}$/);
    // Update the pin after a deliberate engine edit.
    expect(sha256(readFileSync(path.join(ROOT, 'scripts/verify-local.mjs')))).toBe(pinned);
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
    // Commit the engine, then pin the hash of its blob.
    const blob = spawnSync('git', ['show', 'HEAD:scripts/verify-local.mjs'], { cwd: ROOT, env, maxBuffer: 64 << 20 });
    expect({ status: blob.status, stderr: String(blob.stderr) }).toEqual({ status: 0, stderr: '' });
    expect(sha256(blob.stdout)).toBe(pinned);
    const attributes = readFileSync(path.join(ROOT, '.gitattributes'), 'utf8').split(/\r?\n/);
    expect(attributes).toEqual(expect.arrayContaining(['scripts/verify-local*.mjs text eol=lf', 'verify-local.config.mjs text eol=lf']));
    const eol = spawnSync('git', ['check-attr', 'eol', '--', 'scripts/verify-local.mjs', 'verify-local.config.mjs'], { cwd: ROOT, env, encoding: 'utf8' });
    expect(eol.stdout.trim().split('\n').filter((line) => line.endsWith(': eol: lf'))).toHaveLength(2);
    // Neither engine-level check reruns for a config edit any more.
    for (const name of ['verify-local-engine', 'site-publish-guard']) {
      expect({ name, inputs: checkNamed(name).inputs.filter((input) => ['verify-local.config.mjs', '.gitattributes'].includes(input)) }).toEqual({ name, inputs: [] });
    }
  });

  it('flags any EAS workflow, eas.json or release guard edit as a delivery check change', () => {
    const files = [
      '.eas/workflows/android-release-qualification.yml',
      '.eas/workflows/android-release-smoke.yml',
      '.eas/workflows/on-demand.yml',
      '.eas/workflows/new/nested.yaml',
      'eas.json',
      'scripts/check-android-release-ref.js',
      'scripts/check-android-release-gates.js',
    ];
    const matched = JSON.parse(execFileSync(process.execPath, [
      '--input-type=module',
      '-e',
      `const { globToRegExp } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'scripts/verify-local.mjs')).href)});
       const globs = ${JSON.stringify(config.deliveryFiles)};
       const files = ${JSON.stringify(files)};
       process.stdout.write(JSON.stringify(files.filter((file) => globs.some((glob) => globToRegExp(glob).test(file)))));`,
    ], { encoding: 'utf8' }));
    expect(matched).toEqual(files);
  });

  it('enforces index hygiene on every PR/release and retains the complete warning scope', () => {
    // UI assertions cannot notice a newly tracked private file or a skipped CLI gate.
    const hygiene = config.checks.find((check) => check.name === 'repository-hygiene');
    expect(hygiene).toBeDefined();
    expect(hygiene.kinds ?? ['pr', 'release']).toEqual(['pr', 'release']);
    for (const key of ['when', 'targets', 'inputs', 'exclude']) expect(hygiene[key]).toBeUndefined();
    expect(hygiene.command).toBe('npm run repository:hygiene && npm run test:repository-hygiene');
    const scripts = scriptsOf('package.json');
    expect(scripts.lint).toBe('npm run brand:check && npm run lint:warnings');
    expect(scripts['lint:warnings']).toBe('node scripts/check-lint-warnings.js');
    expect(scripts['repository:hygiene']).toBe('node scripts/check-repository-hygiene.cjs');
    expect(scripts['test:repository-hygiene']).toBe('node --test scripts/check-repository-hygiene.test.cjs');
    for (const file of ['scripts/lint-warnings-baseline.json', 'data/repository-hygiene-baseline.json',
      'scripts/check-lint-warnings.js', 'scripts/check-repository-hygiene.cjs']) {
      expect(config.deliveryFiles).toContain(file);
    }
  });

  it('checks the grants of new public tables on every PR and release', () => {
    // A migration creating a public table without explicit grants only fails once deployed (42501).
    const check = config.checks.find((entry) => entry.name === 'migration-grants');
    expect(check).toBeDefined();
    expect(check.kinds ?? ['pr', 'release']).toEqual(['pr', 'release']);
    expect(check.when).toBeUndefined();
    expect(check.command).toBe('npm run migrations:grants && npm run test:migration-grants');
    expect(check.inputs).toEqual(expect.arrayContaining(['supabase/migrations/**', 'scripts/check-migration-grants.cjs']));
    const scripts = scriptsOf('package.json');
    expect(scripts['migrations:grants']).toBe('node scripts/check-migration-grants.cjs');
    expect(scripts['test:migration-grants']).toBe('node --test scripts/check-migration-grants.test.cjs');
    expect(config.deliveryFiles).toEqual(expect.arrayContaining(['scripts/check-migration-grants.cjs', 'scripts/check-migration-grants.test.cjs']));
  });

  it('names only npm scripts that exist in the package each command runs in', () => {
    const packages = { root: scriptsOf('package.json'), meditation: scriptsOf('apps/meditation/package.json') };
    const missing = [];
    for (const check of config.checks) {
      // `cd apps/meditation` moves every later command of the chain into that package.
      const [rootPart, meditationPart = ''] = check.command.split('cd apps/meditation');
      for (const [where, part] of [['root', rootPart], ['meditation', meditationPart]]) {
        for (const [, script] of part.matchAll(/npm run ([\w:-]+)/g)) {
          if (!Object.hasOwn(packages[where], script)) missing.push(`${check.name}: ${where} has no "${script}"`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('runs every step of the CircleCI portfolio on a published master commit', () => {
    // A release runs every release check of its target, `when` ones included;
    // verify:release and verify:release:site together run them all.
    const release = config.checks
      .filter((check) => (check.kinds ?? ['pr', 'release']).includes('release'))
      .map((check) => check.command)
      .join('\n');
    const ci = circleciCommands();
    const expected = new Set([
      ...[...ci.matchAll(/npm run ([\w:-]+)/g)].map(([, script]) => `npm run ${script}`),
      ...[...ci.matchAll(/node \.?\/?(scripts\/[\w./-]+\.(?:js|mjs|cjs))/g)].map(([, file]) => file),
      ...[...ci.matchAll(/(?:bash|python3) (\.circleci\/tests\/[\w.-]+)/g)].map(([, file]) => file),
      ...[...ci.matchAll(/scripts\/[\w-]+\.test\.js/g)].map(([file]) => file),
      ...[...ci.matchAll(/deno (?:check|test)/g)].map(([command]) => command),
    ]);
    // Dependency installation, and the CircleCI-only Jest timing baseline history.
    for (const setup of ['npm run test:testerarmy:setup', 'npm run browsers:install', 'scripts/check-jest-duration-regression.js']) {
      expect(expected.delete(setup)).toBe(true);
    }
    expect([...expected].filter((step) => !release.includes(step))).toEqual([]);
    // Each runs once per release: release-contracts no longer repeats the pins and CI contracts.
    for (const step of ['node scripts/mobile-release.js verify --app all', 'bash .circleci/tests/classify-changes.test.sh']) {
      expect({ step, runs: release.split(step).length - 1 }).toEqual({ step, runs: 1 });
    }
  });

  it('never hands VERIFY_LOCAL_KEEP_FAILED to a check', () => {
    // The engine reads it from its own environment to keep a failed copy; the
    // engine tests, which expect their scratch copies removed, must not see it.
    expect(config.stripEnv).toEqual(['VERIFY_LOCAL_KEEP_FAILED']);
  });

  it('verify:release runs the app checks the web app publish requires; verify:release:site runs the site campaign instead', () => {
    // The site publish asks the guard for the site target, so the backend journey and the app
    // campaigns never hold back noctalia.app, and the site campaign never holds back the app.
    // A target dropped on any side would let a publish ship without its checks.
    const { RELEASE_TARGETS } = require('./web-deploy');
    expect(RELEASE_TARGETS).toEqual(['app']);
    const siteTargets = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e',
      `const { SITE_TARGETS } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'scripts/check-site-publish-proof.mjs')).href)});
       process.stdout.write(JSON.stringify(SITE_TARGETS));`], { encoding: 'utf8' }));
    expect(siteTargets).toEqual(['site']);
    const scripts = scriptsOf('package.json');
    expect(scripts['verify:release']).toBe('node scripts/verify-local.mjs release --target app');
    expect(scripts['verify:release:site']).toBe('node scripts/verify-local.mjs release --target site');
    const app = config.checks.filter((check) => check.targets).map((check) => [check.name, check.targets]);
    expect(app).toEqual([
      ['web-build', ['app']],
      ['app-media-published', ['app']],
      ['e2e-backend', ['app']],
      // It drives the docs/ that `site`, earlier in every release, built.
      ['testerarmy-site', ['site']],
      ['testerarmy-dreamer', ['app']],
      ['testerarmy-lucid', ['app']],
      ['testerarmy-meditation', ['app']],
      ['bugbash-repros', ['app']],
    ]);
    const names = config.checks.map((check) => check.name);
    expect(names.indexOf('site')).toBeLessThan(names.indexOf('testerarmy-site'));
    expect(checkNamed('testerarmy-site').command).toBe('npm run test:testerarmy:site');
    // targets apply on release only. A target here would drop the PR gates.
    // A missing browser on a touched zone must be incomplete, not a green pass.
    for (const [name, probe] of [['parcours-touches', 'probe parcours'], ['smoke-journeys', 'probe smoke']]) {
      const check = config.checks.find((entry) => entry.name === name);
      expect(check.targets).toBeUndefined();
      expect(check.kinds ?? ['pr', 'release']).toEqual(['pr', 'release']);
      expect(check.specialised).toBe(true);
      expect(check.requires.command).toBe(`node tools/e2e/pr-gate.mjs ${probe}`);
      expect(check.requires.hint).toContain('proof is incomplete');
    }
  });

  it('e2e-backend needs the native Supabase runtime, never Docker, and really runs the journeys', () => {
    // A failed probe leaves the check unavailable (proof incomplete); it can never pass it.
    const check = config.checks.find((entry) => entry.name === 'e2e-backend');
    expect(check.command).toBe('npm run test:e2e:backend');
    expect(check.specialised).toBe(true);
    expect(check.requires.command).toBe('node scripts/check-native-supabase-runtime.cjs');
    expect(check.requires.hint).toContain('needs Linux glibc>=2.35 (WSL2 on Windows) or macOS 14+ Apple silicon');
    expect(JSON.stringify(config.checks.map((entry) => entry.requires?.command ?? ''))).not.toMatch(/docker|podman/i);
    expect(scriptsOf('package.json')['test:e2e:backend']).toBe('node ./scripts/run-backend-e2e.cjs');
  });

  it('keeps the former pre-push suite in verify:pr', () => {
    const pr = config.checks.filter((check) => (check.kinds ?? ['pr', 'release']).includes('pr'));
    const commands = pr.map((check) => check.command).join('\n');
    for (const script of ['typecheck:app', 'typecheck:tests', 'lint', 'lint:scripts', 'test:changed', 'docs:build', 'docs:check']) {
      expect(commands).toMatch(new RegExp(`npm run ${script}(?![\\w:-])`));
    }
    expect(commands).toContain('npm run test:verify-local');
    expect(scriptsOf('package.json')['test:verify-local']).toBe('node scripts/run-verify-tests.mjs');
    expect(pr.find((check) => check.command.includes('docs:build')).when).toEqual(expect.arrayContaining(['docs-src/', 'data/']));
  });

  it('scopes the site check to every script the site build and check load', () => {
    // A script left out would let a PR skip the site check, or reuse an old pass,
    // after changing what the build runs. strace found the list; this walk of
    // relative requires and spawned scripts keeps it complete.
    const site = config.checks.find((check) => check.name === 'site');
    // This test runs in the site check itself, so a PR on the site path runs it.
    const name = expect.getState().currentTestName.replace(/^verify-local\.config\.mjs /, '');
    expect(site.command).toContain(`npm run test:file -- scripts/verify-local-config.test.js -t '${name}'`);
    // A pass is reused only while the site, this test and what it reads are unchanged.
    expect(site.inputs).toEqual([...site.when, 'scripts/verify-local-config.test.js', 'verify-local.config.mjs', 'scripts/verify-local.mjs', 'jest.config.js']);
    const { existsSync, statSync } = require('node:fs');
    const isFile = (file) => existsSync(file) && statSync(file).isFile();
    const seen = new Set();
    const visit = (file) => {
      const relative = path.relative(ROOT, file).split(path.sep).join('/');
      if (seen.has(relative) || !isFile(file)) return;
      seen.add(relative);
      const source = readFileSync(file, 'utf8');
      for (const [, spec] of source.matchAll(/(?:require\(|from\s+|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const base = path.resolve(path.dirname(file), spec);
        const found = [base, `${base}.js`, `${base}.cjs`, `${base}.mjs`, `${base}.json`, path.join(base, 'index.js')].find(isFile);
        if (found) visit(found);
      }
      // runNodeScript('scripts/x.js') and path.join(ROOT_DIR, 'scripts', 'x.js').
      for (const [, name] of source.matchAll(/['"`](?:\.\/)?scripts\/([\w./-]+\.(?:c|m)?js)['"`]/g)) visit(path.join(ROOT, 'scripts', name));
      for (const [, name] of source.matchAll(/['"]scripts['"]\s*,\s*['"]([\w.-]+\.(?:c|m)?js)['"]/g)) visit(path.join(ROOT, 'scripts', name));
    };
    visit(path.join(ROOT, 'scripts/docs-build.js'));
    visit(path.join(ROOT, 'scripts/docs-check.js'));
    expect(seen.size).toBeGreaterThan(50);
    const uncovered = JSON.parse(execFileSync(process.execPath, [
      '--input-type=module', '-e',
      `import { matchesAny } from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'scripts/verify-local.mjs')).href)};
       const when = ${JSON.stringify(site.when)};
       process.stdout.write(JSON.stringify(${JSON.stringify([...seen])}.filter(file => !matchesAny(file, when))));`,
    ], { encoding: 'utf8' }));
    expect(uncovered).toEqual([]);
  });

  it('scopes both typechecks to every tracked file the two tsc programs read', () => {
    // A file tsc reads but TYPESCRIPT leaves out would let a PR changing only
    // that file skip both typechecks, or reuse an old pass.
    const files = new Set(tracked());
    const tsc = path.join(ROOT, 'node_modules/typescript/bin/tsc');
    const read = ['tsconfig.json', 'tsconfig.test.json'].flatMap((project) => {
      // Before any typecheck, the generated route types may be missing: tsc
      // reports it and still lists the rest.
      const listed = spawnSync(process.execPath, [tsc, '-p', project, '--listFilesOnly'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
      return listed.stdout.split('\n').map((line) => path.relative(ROOT, line.trim()).split(path.sep).join('/')).filter((file) => files.has(file));
    });
    expect(read.length).toBeGreaterThan(500);
    for (const name of ['typecheck-app', 'typecheck-tests']) {
      const check = checkNamed(name);
      expect({ name, inputs: check.inputs }).toEqual({ name, inputs: check.when });
      expect({ name, outside: outside(check.when, [...new Set(read)]) }).toEqual({ name, outside: [] });
    }
  }, 60000);

  it('scopes lint and lint-scripts to every file their import graph reaches', () => {
    // lint --changed lints a changed file and every file importing it, through
    // re-exports: a file outside a lint scope must reach no file it lints.
    const { lintScope } = require('./check-lint-warnings');
    const files = tracked();
    const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
    for (const [name, linted] of [['lint', () => true], ['lint-scripts', (file) => file.startsWith('scripts/')]]) {
      const check = checkNamed(name);
      expect({ name, inputs: check.inputs }).toEqual({ name, inputs: check.when });
      const reached = lintScope({ changed: outside(check.when, files), files, read });
      expect({ name, reached: reached && reached.filter(linted) }).toEqual({ name, reached: [] });
    }
  });

  it('scopes jest-changed to every file Jest can select a test from', () => {
    // jest --changedSince leaves out a changed file its haste map does not hold:
    // one outside the roots of every project, or with another extension.
    const { defaults } = require('jest-config');
    const probes = [];
    for (const project of require('../jest.config').projects) {
      const options = require(project.replace('<rootDir>', ROOT));
      for (const root of options.roots ?? ['<rootDir>']) {
        const dir = path.relative(ROOT, root.replace('<rootDir>', ROOT)).split(path.sep).join('/');
        for (const extension of ['snap', ...(options.moduleFileExtensions ?? defaults.moduleFileExtensions)]) {
          probes.push(`${dir ? `${dir}/` : ''}probe.${extension}`, `${dir ? `${dir}/` : ''}a/b/probe.${extension}`);
        }
      }
    }
    expect(probes.length).toBeGreaterThan(100);
    expect(outside(checkNamed('jest-changed').when, probes)).toEqual([]);
  });

  it('runs admission regressions for admission migrations and Edge functions', () => {
    const check = checkNamed('db-contracts');
    expect(check.command).toContain('&& npm run test:analysis-admission:db');
    expect(scriptsOf('package.json')['test:analysis-admission:db']).toBe('node scripts/verify-analysis-admission.mjs');
    expect(outside(check.when, [
      'supabase/migrations/20261025160000_refund_failed_text_analysis.sql',
      'supabase/migrations/20261025185137_deduplicate_analysis_admission_retries.sql',
      'supabase/functions/api/services/aiAdmission.ts',
      'scripts/verify-analysis-admission.mjs',
    ])).toEqual([]);
  });

  it('scopes db-contracts to every tracked file its tests read', () => {
    // These tests read migrations and sources as files, which no import graph
    // shows: they run here with every file they read recorded.
    const check = checkNamed('db-contracts');
    expect(check.inputs).toEqual(check.when);
    const dir = mkdtempSync(path.join(tmpdir(), 'noctalia-db-reads-'));
    try {
      writeFileSync(path.join(dir, 'recorder.cjs'), READ_RECORDER);
      const run = spawnSync(check.command, {
        cwd: ROOT, shell: true, encoding: 'utf8', maxBuffer: 64 << 20,
        env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ${JSON.stringify(path.join(dir, 'recorder.cjs'))}`, SCOPE_READS_ROOT: ROOT, SCOPE_READS_DIR: dir },
      });
      expect({ status: run.status, output: run.status === 0 ? '' : `${run.stdout}${run.stderr}` }).toEqual({ status: 0, output: '' });
      const files = new Set(tracked());
      const dirs = new Set([...files].flatMap((file) => file.split('/').slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join('/'))));
      const reads = new Set(readdirSync(dir).filter((name) => name.endsWith('.reads'))
        .flatMap((name) => readFileSync(path.join(dir, name), 'utf8').split('\n'))
        // A directory listed stands for every file it holds.
        .flatMap((file) => (files.has(file) ? [file] : dirs.has(file) ? [`${file}/`] : [])));
      expect([...reads].filter((file) => file.startsWith('supabase/migrations/')).length).toBeGreaterThan(0);
      expect(outside(check.when, [...reads])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 180000);

  it('runs benchmark contracts for a change to any benchmark manifest alone', () => {
    // These manifests can change the canonical command or browser version
    // without touching CI YAML. A browser journey cannot detect a skipped guard.
    const result = JSON.parse(execFileSync(process.execPath, [
      '--input-type=module', '-e',
      `import { normaliseConfig, matchesAny } from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'scripts/verify-local.mjs')).href)};
       const config = normaliseConfig(${JSON.stringify(config)});
       const check = config.checks.find(check => check.name === 'ci-contracts');
       const manifests = ['package.json', 'tools/e2e/package.json', 'tools/e2e/package-lock.json'];
       process.stdout.write(JSON.stringify(manifests.map(file => ({file, selected:matchesAny(file, check.when)}))));`,
    ], { encoding: 'utf8' }));
    expect(result).toEqual([
      { file: 'package.json', selected: true },
      { file: 'tools/e2e/package.json', selected: true },
      { file: 'tools/e2e/package-lock.json', selected: true },
    ]);
  });

  it('runs these tests for a change to the configuration or the engine alone', () => {
    // A narrowed scope must meet its guard before release, not at release.
    const check = checkNamed('verify-config');
    expect(check.command).toBe('npm run test:file -- scripts/verify-local-config.test.js');
    expect(outside(check.when, ['verify-local.config.mjs', 'scripts/verify-local.mjs', '.gitattributes'])).toEqual([]);
  });

  it('checks each independent security graph when only its manifest or lockfile changes', () => {
    // A root-only success cannot detect a vulnerable independent installation.
    const projects = [
      ['root', ''],
      ['meditation', 'apps/meditation'],
      ['documentation', 'doc_web_interne/docs'],
      ['site', 'apps/site'],
    ];
    const result = JSON.parse(execFileSync(process.execPath, [
      '--input-type=module', '-e',
      `import { normaliseConfig, matchesAny } from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'scripts/verify-local.mjs')).href)};
       const config = normaliseConfig(${JSON.stringify(config)});
       const projects = ${JSON.stringify(projects)};
       process.stdout.write(JSON.stringify(projects.map(([project, directory]) => {
         const check = config.checks.find(item => item.name === 'dependency-security' + (project === 'root' ? '' : '-' + project));
         return { project, selected: ['package.json', 'package-lock.json'].map(file =>
           Boolean(check && matchesAny((directory ? directory + '/' : '') + file, check.when))),
           scope: check?.env?.DEPENDENCY_SECURITY_PROJECT };
       })));`,
    ], { encoding: 'utf8' }));
    expect(result).toEqual(projects.map(([project]) => ({ project, selected: [true, true], scope: project })));
  });

  it('reuses a pass across a change to a file the check does not read, never one it reads', () => {
    // These are the actual fingerprints used for reuse, not a second classifier.
    // A browser cannot detect a stale proof accidentally accepted for app code.
    const result = JSON.parse(execFileSync(process.execPath, [
      '--input-type=module', '-e',
      `import { normaliseConfig, checkFingerprint } from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'scripts/verify-local.mjs')).href)};
       const config = normaliseConfig(${JSON.stringify(config)});
       const checks = config.checks.filter(check => ['typecheck-app', 'typecheck-tests', 'lint', 'lint-scripts'].includes(check.name));
       const paths = ['docs-src/static/scripts/generate-symbol-pages.js', 'docs-src/static/js/main.js', 'tools/e2e/tests/site.web.e2e.ts', 'app/index.tsx', 'routes/lucid/lucid/index.tsx', 'hooks/useQuota.ts', 'data/dream-symbols.json', 'docs-src/static/img/shared.png', 'scripts/generate-shared-route-types.cjs', 'eslint.config.js', 'tsconfig.json', 'package-lock.json', 'verify-local.config.mjs'];
       const fingerprint = (check, file, object) => checkFingerprint({check, files:[{path:file,mode:'100644',object}],tree:object,sha:object,environment:{}});
       process.stdout.write(JSON.stringify(paths.map(file => ({file, reused:checks.filter(check => fingerprint(check,file,'a') === fingerprint(check,file,'b')).map(check=>check.name)}))));`,
    ], { encoding: 'utf8' }));
    const all = ['typecheck-app', 'typecheck-tests', 'lint', 'lint-scripts'];
    const typecheck = ['typecheck-app', 'typecheck-tests'];
    expect(Object.fromEntries(result.map(({ file, reused }) => [file, reused]))).toEqual({
      'docs-src/static/scripts/generate-symbol-pages.js': all,
      'docs-src/static/js/main.js': all,
      'tools/e2e/tests/site.web.e2e.ts': all,
      // lint-scripts reads scripts/ and the few files scripts import.
      'app/index.tsx': ['lint-scripts'],
      'routes/lucid/lucid/index.tsx': ['lint-scripts'],
      'hooks/useQuota.ts': ['lint-scripts'],
      // tsc reads no asset and only the data the app imports (data/app/).
      'data/dream-symbols.json': [...typecheck, 'lint-scripts'],
      'docs-src/static/img/shared.png': [...typecheck, 'lint-scripts'],
      'scripts/generate-shared-route-types.cjs': [],
      'eslint.config.js': typecheck,
      'tsconfig.json': [],
      'package-lock.json': [],
      'verify-local.config.mjs': [...typecheck, 'lint-scripts'],
    });
  });

  it('runs the independent checks in one parallel step, and the writers, Jest and the browsers serially after it', () => {
    const pr = config.checks.filter((check) => (check.kinds ?? ['pr', 'release']).includes('pr'));
    const parallel = pr.filter((check) => check.parallel).map((check) => check.name);
    // The engine overlaps consecutive parallel checks only: one step, from the first check on.
    expect(pr.slice(0, parallel.length).map((check) => check.name)).toEqual(parallel);
    expect(parallel).toEqual(expect.arrayContaining(['verify-local-engine', 'site-publish-guard', 'typecheck-app', 'lint-scripts', 'db-contracts', 'verify-config']));
    // docs:build rewrites data/site-manifest.json, which lint-scripts reads, and docs/;
    // root and Meditation Jest keep their deadlines; the browser gates come last.
    for (const name of ['site', 'jest-changed', 'meditation', 'edge-functions', 'parcours-touches', 'smoke-journeys']) {
      expect({ name, parallel: Boolean(checkNamed(name).parallel) }).toEqual({ name, parallel: false });
    }
    expect(pr.slice(-2).map((check) => check.name)).toEqual(['parcours-touches', 'smoke-journeys']);
    expect(config.checks.filter((check) => check.kinds && !check.kinds.includes('pr') && check.parallel)).toEqual([]);
  });

  it('reuses the web gates and the scoped contract checks across a docs-only commit, never across a file they read', () => {
    // A follow-up commit that only edits documents or the local backend reran
    // both browser gates (whole-tree fingerprints). The gates pick journeys from
    // the diff against the merge base, so their pass is reused only on that base.
    const result = JSON.parse(execFileSync(process.execPath, [
      '--input-type=module', '-e',
      `import { normaliseConfig, checkFingerprint } from ${JSON.stringify(ENGINE)};
       const config = normaliseConfig(${JSON.stringify(config)});
       const names = ['parcours-touches', 'smoke-journeys', 'meditation', 'edge-functions', 'ci-contracts', 'eas-workflow-contracts'];
       const checks = config.checks.filter(check => names.includes(check.name));
       const paths = ['doc_web_interne/docs/repository-operations.md', 'tools/dev-local/api-server.ts', 'app/index.tsx',
         'apps/meditation/app/index.tsx', 'supabase/functions/api/router.ts', 'scripts/lib/backend-e2e-local.cjs',
         '.circleci/config.yml', 'eas.json'];
       const fingerprint = (check, file, object, mergeBase = 'base') => checkFingerprint({ check, files: [{ path: file, mode: '100644', object }], tree: object, sha: object, environment: {}, mergeBase });
       process.stdout.write(JSON.stringify({
         reused: Object.fromEntries(paths.map(file => [file, checks.filter(check => fingerprint(check, file, 'a') === fingerprint(check, file, 'b')).map(check => check.name).sort()])),
         perBase: checks.filter(check => fingerprint(check, 'app/index.tsx', 'a', 'one') !== fingerprint(check, 'app/index.tsx', 'a', 'two')).map(check => check.name).sort(),
       }));`,
    ], { encoding: 'utf8' }));
    const gates = ['parcours-touches', 'smoke-journeys'];
    const all = ['ci-contracts', 'eas-workflow-contracts', 'edge-functions', 'meditation', ...gates].sort();
    const without = (...names) => all.filter((name) => !names.includes(name));
    expect(result.reused).toEqual({
      'doc_web_interne/docs/repository-operations.md': all,
      'tools/dev-local/api-server.ts': without('edge-functions'),
      'app/index.tsx': without(...gates),
      'apps/meditation/app/index.tsx': without('meditation', ...gates),
      'supabase/functions/api/router.ts': without('edge-functions', ...gates),
      'scripts/lib/backend-e2e-local.cjs': without('edge-functions', 'eas-workflow-contracts', ...gates),
      '.circleci/config.yml': without('ci-contracts', ...gates),
      'eas.json': without('eas-workflow-contracts', ...gates),
    });
    expect(result.perBase).toEqual(gates);
  });

  it('discovers every tracked Edge test in local and coverage commands', () => {
    // UI journeys cannot detect a worker suite silently omitted by a Deno path.
    // Current CircleCI only benchmarks installation; local verification owns Edge execution.
    const edgeTests = execFileSync('git', ['ls-files', '--', 'supabase/functions'], {
      cwd: ROOT, encoding: 'utf8',
    }).trim().split('\n')
      .filter((file) => file.endsWith('.test.ts'))
      .map((file) => file.slice('supabase/functions/'.length));
    expect(edgeTests.length).toBeGreaterThan(0);
    const commands = {
      local: config.checks.find((check) => check.name === 'edge-functions').command,
      coverage: scriptsOf('package.json')['test:coverage:edge'],
    };
    for (const [runner, command] of Object.entries(commands)) {
      const invocations = [...command.replace(/\\\r?\n/g, ' ').matchAll(/\bdeno test ([^;&\n]+)/g)];
      expect(invocations.length).toBeGreaterThan(0);
      const roots = invocations.flatMap(([, argumentsText]) =>
        argumentsText.trim().split(/\s+/).filter((argument) => !argument.startsWith('-'))
      );
      const omitted = edgeTests.filter((file) => !roots.some((root) =>
        file === root || file.startsWith(`${root.replace(/\/$/, '')}/`)
      ));
      expect({ runner, omitted }).toEqual({ runner, omitted: [] });
    }
  });
});

test('the smoke check runs on every path of the stack the smoke gate watches', () => {
  const { stack, when } = JSON.parse(execFileSync(process.execPath, [
    '--input-type=module', '-e',
    `const { SMOKE_STACK } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'tools/e2e/zones.mjs')).href)});
     const { SMOKE_WHEN } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'verify-local.config.mjs')).href)});
     process.stdout.write(JSON.stringify({ stack: SMOKE_STACK, when: SMOKE_WHEN }));`,
  ], { encoding: 'utf8' }));
  expect(stack.filter((entry) => !when.includes(entry))).toEqual([]);
});
