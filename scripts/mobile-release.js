#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const STATE = 'release/mobile-versions.json';
const APPS = ['noctalia', 'lucid', 'meditation'];
const LEVELS = ['none', 'patch', 'minor', 'major'];

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
}

function readJson(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function bump(version, level) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid release version: ${version}`);
  const [major, minor, patch] = version.split('.').map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  if (level === 'patch') return `${major}.${minor}.${patch + 1}`;
  return version;
}

// Conservative shared-runtime routing. App-specific paths do not bump siblings.
function affects(app, file) {
  if (/(^|\/)(__tests__|tests|maestro)\//.test(file)
      || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || /\.md$/.test(file)) return false;
  if (file.startsWith('apps/meditation/')) return app === 'meditation';
  if (file.startsWith('apps/') || file.startsWith('docs') || file.startsWith('release/')) return false;
  if (app === 'meditation') return false;
  const lucid = /(^|\/)(lucid[^/]*|Lucid[^/]*)\//.test(file)
    || /(^|\/)(useLucid|lucid|Lucid)[^/]*\.[jt]sx?$/.test(file);
  if (lucid) return app === 'lucid';
  if (/^app\/[_+][^/]*\.[jt]sx?$/.test(file)) return true;
  if (/^(app\/|assets\/images\/|lib\/i18n\/)/.test(file)) return app === 'noctalia';
  return /^(components|context|hooks|lib|services|constants|assets|plugins|data)\//.test(file)
    || /^scripts\/(build-android[^/]*|expo-safe-runner|sync-android-native-version)\.js$/.test(file)
    || /^(app\.config\.ts|app\.json|package(-lock)?\.json|eas\.json|metro\.config\.js|babel\.config\.js|global\.css)$/.test(file);
}

// Release metadata alone must not generate another release after its PR merges.
function normalized(file, value) {
  if (/(^|\/)(package(-lock)?|app)\.json$/.test(file)) {
    const data = JSON.parse(value);
    if (data === null) return 'null';
    delete data.version;
    if (data.packages?.['']) delete data.packages[''].version;
    if (data.expo) {
      delete data.expo.version;
      if (data.expo.android) delete data.expo.android.versionCode;
      if (data.expo.ios) delete data.expo.ios.buildNumber;
    }
    return JSON.stringify(data);
  }
  return value;
}

function contents(root, ref, file) {
  try { return git(root, 'show', `${ref}:${file}`); }
  catch { return null; } // Added/deleted file; git diff below already validated the revisions.
}

function changeLevel(message) {
  const subject = message.split('\n')[0];
  if (/^[a-z]+(?:\([^\n]*\))?!:/i.test(subject) || /^BREAKING[ -]CHANGE:\s/m.test(message)) return 'major';
  if (/^feat(?:\([^\n]*\))?:/i.test(subject)) return 'minor';
  // Runtime changes with non-conventional or maintenance titles still need a patch.
  return 'patch';
}

function verify(root, app) {
  if (!APPS.includes(app)) throw new Error(`Unknown app: ${app}`);
  const state = readJson(root, STATE);
  if (state.schemaVersion !== 1) throw new Error('Unsupported mobile release state');
  const entry = state.apps[app];
  bump(entry.version, 'none');
  if (!/^[a-f0-9]{40}$/.test(entry.sourceRef)) throw new Error(`Invalid sourceRef for ${app}`);
  const eas = readJson(root, app === 'meditation' ? 'apps/meditation/eas.json' : 'eas.json');
  const profile = app === 'lucid' ? 'lucid-production' : 'production';
  if (eas.cli?.appVersionSource !== 'remote' || eas.build?.[profile]?.autoIncrement !== true) {
    throw new Error(`${app} distribution requires remote EAS versions and autoIncrement on ${profile}`);
  }
  if (app !== 'lucid') {
    const prefix = app === 'meditation' ? 'apps/meditation/' : '';
    const versions = [readJson(root, `${prefix}app.json`).expo.version,
      readJson(root, `${prefix}package.json`).version,
      readJson(root, `${prefix}package-lock.json`).version,
      readJson(root, `${prefix}package-lock.json`).packages[''].version];
    if (versions.some(version => version !== entry.version)) throw new Error(`Version drift for ${app}: ${versions.join(', ')} vs ${entry.version}`);
  }
  return entry;
}

function plan(root, app) {
  const entry = verify(root, app);
  const head = git(root, 'rev-parse', 'HEAD').trim();
  try { git(root, 'cat-file', '-e', `${entry.sourceRef}^{commit}`); }
  catch { throw new Error(`Missing baseline ${entry.sourceRef}; fetch the release history before planning. No version guessed.`); }
  const files = git(root, 'diff', '--name-only', '--no-renames', '-z', entry.sourceRef, head).split('\0').filter(Boolean)
    .filter(file => affects(app, file))
    .filter(file => normalized(file, contents(root, entry.sourceRef, file) ?? 'null') !== normalized(file, contents(root, head, file) ?? 'null'));
  const relevant = new Set(files);
  let level = files.length ? 'patch' : 'none';
  const reasons = [];
  // No --first-parent: ordinary merge commits often hide the feat/fix subjects.
  const commits = files.length ? git(root, 'rev-list', '--no-merges', `${entry.sourceRef}..${head}`).trim().split('\n').filter(Boolean) : [];
  for (const commit of commits) {
    const touched = git(root, 'diff-tree', '--root', '--no-commit-id', '--name-only', '--no-renames', '-r', '-z', commit).split('\0');
    if (!touched.some(file => relevant.has(file))) continue;
    const message = git(root, 'show', '-s', '--format=%B', commit).trim();
    const impact = changeLevel(message);
    if (LEVELS.indexOf(impact) > LEVELS.indexOf(level)) level = impact;
    reasons.push({ commit, impact, subject: message.split('\n')[0] });
  }
  return { app, current: entry.version, next: bump(entry.version, level), level, sourceRef: entry.sourceRef, head, files, reasons };
}

function assertClean(root) {
  if (git(root, 'status', '--porcelain', '--untracked-files=all').trim()) throw new Error('Commit or isolate your changes before preparing/building a release. Nothing was changed.');
}

function prepare(root, apps, allowMajor = false) {
  assertClean(root);
  // Keep the recorded source reachable even when the generated release PR is squashed.
  const head = git(root, 'rev-parse', 'HEAD').trim();
  if (head !== git(root, 'rev-parse', 'refs/remotes/origin/master').trim()) throw new Error('Prepare from the current origin/master snapshot (on a release branch). Fetch first.');
  const plans = apps.map(app => plan(root, app));
  if (!allowMajor && plans.some(item => item.level === 'major')) throw new Error('Breaking change detected. Inspect release:plan, then use --allow-major intentionally.');
  const state = readJson(root, STATE);
  const writes = new Map();
  for (const item of plans.filter(item => item.level !== 'none')) {
    state.apps[item.app] = { version: item.next, sourceRef: head, baseline: 'Prepared source snapshot; not a Store publication claim' };
    if (item.app === 'lucid') continue;
    const prefix = item.app === 'meditation' ? 'apps/meditation/' : '';
    for (const name of ['app.json', 'package.json', 'package-lock.json']) {
      const file = prefix + name;
      const data = readJson(root, file);
      if (name === 'app.json') data.expo.version = item.next;
      else {
        data.version = item.next;
        if (data.packages?.['']) data.packages[''].version = item.next;
      }
      writes.set(file, data);
    }
  }
  if (writes.size || plans.some(item => item.app === 'lucid' && item.level !== 'none')) writes.set(STATE, state);
  // Validate every plan before writing any file. No commit, tag, build or upload here.
  for (const [file, value] of writes) fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);
  return plans;
}

function parseArgs(args) {
  const options = { action: args[0], app: process.env.NOCTALIA_APP_VARIANT === 'lucid' ? 'lucid' : 'noctalia', platform: null, allowMajor: false };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--app') options.app = args[++i];
    else if (args[i] === '--platform') options.platform = args[++i];
    else if (args[i] === '--allow-major') options.allowMajor = true;
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  if (![...APPS, 'all'].includes(options.app)) throw new Error('Choose --app noctalia|lucid|meditation|all');
  return options;
}

function main(args = process.argv.slice(2), root = ROOT) {
  const options = parseArgs(args);
  const apps = options.app === 'all' ? APPS : [options.app];
  if (options.action === 'verify') {
    apps.forEach(app => verify(root, app));
    console.log(`Mobile version metadata consistent: ${apps.join(', ')}`);
    return;
  }
  if (options.action === 'prepare') {
    console.log(JSON.stringify(prepare(root, apps, options.allowMajor), null, 2));
    return;
  }
  if (!['plan', 'check', 'build'].includes(options.action)) throw new Error('Usage: mobile-release.js plan|prepare|check|verify|build --app APP [--platform android|ios] [--allow-major]');
  const plans = apps.map(app => plan(root, app));
  if (options.action === 'plan') {
    console.log(JSON.stringify(plans, null, 2));
    return;
  }
  assertClean(root);
  if (plans.some(item => item.level !== 'none')) throw new Error('Unversioned mobile changes. Run release:plan and release:prepare, then commit/merge the release metadata before building.');
  if (options.action === 'check') {
    console.log('Prepared release versions cover all committed mobile changes.');
    return;
  }
  if (apps.length !== 1 || !['android', 'ios'].includes(options.platform)) throw new Error('Build needs one --app and --platform android|ios');
  const app = apps[0];
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'eas-cli@21.0.0', 'build', '--platform', options.platform, '--profile', app === 'lucid' ? 'lucid-production' : 'production'], {
    cwd: app === 'meditation' ? path.join(root, 'apps/meditation') : root,
    env: { ...process.env, EXPO_NO_DOTENV: '1', NOCTALIA_APP_VARIANT: app === 'lucid' ? 'lucid' : 'noctalia', EXPO_PUBLIC_APP_VARIANT: app === 'lucid' ? 'lucid' : 'noctalia' },
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) throw new Error(`EAS build failed: ${result.error?.message || result.status}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { affects, bump, changeLevel, normalized, plan, prepare, verify, parseArgs, main };
