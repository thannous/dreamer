'use strict';

// verify-local.config.mjs: the checks verify:pr and verify:release announce
// must exist and retain the former CircleCI validation portfolio. The frozen
// fixture prevents removing a remote job from silently dropping local coverage.

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '..');

// The config is an ES module; Jest runs this project without ESM support.
const config = JSON.parse(execFileSync(process.execPath, [
  '--input-type=module',
  '-e',
  `const { default: config } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'verify-local.config.mjs')).href)});
   process.stdout.write(JSON.stringify(config));`,
], { encoding: 'utf8' }));

const scriptsOf = (file) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8')).scripts;

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
    // A release of the app target runs every release check, `when` ones included.
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
  });

  it('verify:release runs the app checks the web app publish requires; verify:release:site leaves them out', () => {
    // The site publish asks the guard for no target, so the backend journey and the app
    // campaigns never hold back noctalia.app. A target dropped on any side
    // would let the web app or a mobile release ship without those checks.
    const { RELEASE_TARGETS } = require('./web-deploy');
    expect(RELEASE_TARGETS).toEqual(['app']);
    const scripts = scriptsOf('package.json');
    expect(scripts['verify:release']).toBe('node scripts/verify-local.mjs release --target app');
    expect(scripts['verify:release:site']).toBe('node scripts/verify-local.mjs release');
    const app = config.checks.filter((check) => check.targets).map((check) => [check.name, check.targets]);
    expect(app).toEqual([
      ['web-build', ['app']],
      ['e2e-backend', ['app']],
      ['testerarmy-dreamer', ['app']],
      ['testerarmy-lucid', ['app']],
      ['testerarmy-meditation', ['app']],
    ]);
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

  it('checks each independent security graph when only its manifest or lockfile changes', () => {
    // A root-only success cannot detect a vulnerable independent installation.
    const projects = [
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
         const check = config.checks.find(item => item.name === 'dependency-security-' + project);
         return { project, selected: ['package.json', 'package-lock.json'].map(file =>
           Boolean(check && matchesAny(directory + '/' + file, check.when))),
           scope: check?.env?.DEPENDENCY_SECURITY_PROJECT };
       })));`,
    ], { encoding: 'utf8' }));
    expect(result).toEqual(projects.map(([project]) => ({ project, selected: [true, true], scope: project })));
  });

  it('reuses site-only inputs but invalidates every shared mobile source and tool', () => {
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
    for (const entry of result.slice(0, 3)) expect(entry.reused).toHaveLength(4);
    for (const entry of result.slice(3)) expect(entry).toEqual({ file: entry.file, reused: [] });
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
