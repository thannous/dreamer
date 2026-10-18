'use strict';

// verify-local.config.mjs: the checks verify:pr and verify:release announce
// must exist and must keep up with the CircleCI full portfolio, which
// doc_web_interne/docs/circleci-migration.md names as the source of truth of
// the full local validation. A release check runs only at publication, so a
// renamed script or a step added to CircleCI would otherwise surface there.

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
  const continuation = YAML.parse(readFileSync(path.join(ROOT, '.circleci/continue.yml'), 'utf8'));
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
    // The site publish asks the guard for no target, so Docker and the app
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

  it('keeps the former pre-push suite in verify:pr', () => {
    const pr = config.checks.filter((check) => (check.kinds ?? ['pr', 'release']).includes('pr'));
    const commands = pr.map((check) => check.command).join('\n');
    for (const script of ['typecheck:app', 'typecheck:tests', 'lint', 'lint:scripts', 'test:changed', 'docs:build', 'docs:check']) {
      expect(commands).toMatch(new RegExp(`npm run ${script}(?![\\w:-])`));
    }
    expect(commands).toContain('node --test scripts/test-verify-local.mjs');
    expect(pr.find((check) => check.command.includes('docs:build')).when).toEqual(expect.arrayContaining(['docs-src/', 'data/']));
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
});
