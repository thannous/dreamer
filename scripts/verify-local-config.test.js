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
    // On master nothing changed since origin/master, so `when` checks are out of scope.
    const release = config.checks
      .filter((check) => (check.kinds ?? ['pr', 'release']).includes('release') && !check.when)
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

  it('keeps the former pre-push suite in verify:pr', () => {
    const pr = config.checks.filter((check) => (check.kinds ?? ['pr', 'release']).includes('pr'));
    const commands = pr.map((check) => check.command).join('\n');
    for (const script of ['typecheck:app', 'typecheck:tests', 'lint', 'lint:scripts', 'test:changed', 'docs:build', 'docs:check']) {
      expect(commands).toMatch(new RegExp(`npm run ${script}(?![\\w:-])`));
    }
    expect(commands).toContain('node --test scripts/test-verify-local.mjs');
    expect(pr.find((check) => check.command.includes('docs:build')).when).toEqual(expect.arrayContaining(['docs-src/', 'data/']));
  });
});
