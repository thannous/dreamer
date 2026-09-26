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
  return /^(components|context|hooks|lib|services|constants|assets|plugins|patches|data)\//.test(file)
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

function gitBytes(root, args, input) {
  return execFileSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], {
    cwd: root,
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });
}

// One diff-tree and one cat-file for the whole range. prepare() plans every app
// against the same commits, so the parsed range is reused until that call ends.
let commitRangeCache = null;

function readCommitRange(root, sourceRef, head) {
  const key = `${root}\0${sourceRef}\0${head}`;
  const cached = commitRangeCache?.get(key);
  if (cached) return cached;
  const listed = git(root, 'rev-list', '--no-merges', `${sourceRef}..${head}`).trim();
  const commits = listed ? listed.split('\n').filter(Boolean) : [];
  const touched = new Map(commits.map(commit => [commit, []]));
  const messages = new Map();
  if (commits.length) {
    // Keep a record for --allow-empty commits so the following paths still
    // map to the right hash in the rev-list sequence.
    const diff = gitBytes(root, ['diff-tree', '--stdin', '--root', '--always', '--name-only', '--no-renames', '-r', '-z'], `${commits.join('\n')}\n`);
    const parts = diff.toString('utf8').split('\0');
    if (parts.at(-1) === '') parts.pop();
    let index = 0;
    let current = null;
    for (const part of parts) {
      if (index < commits.length && part === commits[index]) {
        current = commits[index];
        index += 1;
        continue;
      }
      if (!current) throw new Error(`diff-tree output before commit ${commits[index] ?? '<end>'}`);
      touched.get(current).push(part);
    }
    if (index !== commits.length) throw new Error(`diff-tree reported ${index} of ${commits.length} commits`);

    const raw = gitBytes(root, ['cat-file', '--batch'], `${commits.join('\n')}\n`);
    let offset = 0;
    for (const commit of commits) {
      const newline = raw.indexOf(0x0a, offset);
      if (newline < 0) throw new Error(`cat-file truncated before ${commit}`);
      const header = raw.subarray(offset, newline).toString('utf8');
      const match = header.match(/^([a-f0-9]{40}) commit (\d+)$/);
      if (!match || match[1] !== commit) throw new Error(`Unexpected cat-file record for ${commit}: ${header}`);
      const size = Number(match[2]);
      const start = newline + 1;
      const end = start + size;
      const body = raw.subarray(start, end).toString('utf8');
      const split = body.indexOf('\n\n');
      if (split < 0) throw new Error(`Commit ${commit} has no message`);
      messages.set(commit, body.slice(split + 2).trim());
      offset = end + 1;
    }
  }
  const range = { commits, touched, messages };
  commitRangeCache?.set(key, range);
  return range;
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
  if (app !== 'meditation') {
    const pkg = readJson(root, 'package.json');
    if (pkg.dependencies?.['@kingstinct/react-native-healthkit']) {
      const plist = readJson(root, 'app.json').expo.ios?.infoPlist;
      const missing = ['NSHealthShareUsageDescription', 'NSHealthUpdateUsageDescription']
        .filter(key => typeof plist?.[key] !== 'string' || !plist[key].trim());
      if (missing.length) throw new Error(`HealthKit-linked iOS app needs ${missing.join(', ')} in app.json before a Store build`);
    }
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
    .filter(file => !/(^|\/)(package(-lock)?|app)\.json$/.test(file)
      || normalized(file, contents(root, entry.sourceRef, file) ?? 'null') !== normalized(file, contents(root, head, file) ?? 'null'));
  const relevant = new Set(files);
  let level = files.length ? 'patch' : 'none';
  const reasons = [];
  // No --first-parent: ordinary merge commits often hide the feat/fix subjects.
  const range = files.length ? readCommitRange(root, entry.sourceRef, head) : { commits: [], touched: new Map(), messages: new Map() };
  for (const commit of range.commits) {
    if (!(range.touched.get(commit) ?? []).some(file => relevant.has(file))) continue;
    const message = range.messages.get(commit) ?? '';
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
  commitRangeCache = new Map();
  try {
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
  } finally {
    commitRangeCache = null;
  }
}

function parseArgs(args) {
  const options = { action: args[0], app: process.env.NOCTALIA_APP_VARIANT === 'lucid' ? 'lucid' : 'noctalia', platform: null, id: null, dryRun: false, allowMajor: false };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--app') options.app = args[++i];
    else if (args[i] === '--platform') options.platform = args[++i];
    else if (args[i] === '--id') options.id = args[++i];
    else if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--allow-major') options.allowMajor = true;
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  if (![...APPS, 'all'].includes(options.app)) throw new Error('Choose --app noctalia|lucid|meditation|all');
  if (options.dryRun && options.action !== 'submit-internal') throw new Error('--dry-run is only available for submit-internal');
  return options;
}

function internalSubmitArgs(platform, id) {
  if (!['android', 'ios'].includes(platform)) throw new Error('Internal submission needs --platform android|ios');
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id ?? '')) throw new Error('Internal submission needs an explicit EAS build ID');
  return ['--yes', 'eas-cli@21.0.0', 'submit', '--platform', platform,
    '--profile', platform === 'android' ? 'internal' : 'production', '--id', id, '--non-interactive'];
}

function assertInternalBuild(build, platform, expected) {
  if (build?.status !== 'FINISHED') throw new Error('Internal submission requires a FINISHED EAS build');
  if (build.platform !== platform.toUpperCase()) throw new Error(`EAS build platform does not match ${platform}`);
  if (build.distribution !== 'STORE') throw new Error('Internal Store testing requires a STORE build, not a preview/ad hoc build');
  if (build.buildProfile !== 'production') throw new Error('Internal Store testing requires the production build profile');
  if (build.project?.id !== expected.projectId) throw new Error('EAS build belongs to a different project');
  if (build.appVersion !== expected.version) throw new Error('EAS build version does not match the prepared release');
  if (!build.artifacts?.buildUrl) throw new Error('EAS build has no downloadable Store artifact');
}

function assertIosBuildSource(root, build) {
  const ref = build?.gitCommitHash;
  if (!/^[a-f0-9]{40}$/.test(ref ?? '')) throw new Error('iOS EAS build has no verifiable source commit');
  try { git(root, 'cat-file', '-e', `${ref}^{commit}`); }
  catch { throw new Error(`iOS EAS build source commit ${ref} is unavailable locally; fetch it before submission`); }
  const changed = git(root, 'diff', '--name-only', '--no-renames', '-z', ref, 'HEAD').split('\0').filter(Boolean)
    .filter(file => affects('noctalia', file));
  if (changed.length) throw new Error(`iOS EAS build predates mobile source changes: ${changed.slice(0, 5).join(', ')}. Build a new IPA before submission.`);
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
  if (!['plan', 'check', 'build', 'submit-internal'].includes(options.action)) throw new Error('Usage: mobile-release.js plan|prepare|check|verify|build|submit-internal --app APP [--platform android|ios] [--id EAS_BUILD_ID] [--dry-run] [--allow-major]');
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
  if (options.action === 'submit-internal') {
    if (options.app !== 'noctalia') throw new Error('Internal submission is configured only for Noctalia');
    const args = internalSubmitArgs(options.platform, options.id);
    const eas = readJson(root, 'eas.json');
    if (eas.submit?.internal?.android?.track !== 'internal' || !eas.submit?.production?.ios?.ascAppId) {
      throw new Error('Internal Store submission profiles are missing or could target the wrong app/track');
    }
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const env = { ...process.env, EXPO_NO_DOTENV: '1', NOCTALIA_APP_VARIANT: 'noctalia', EXPO_PUBLIC_APP_VARIANT: 'noctalia' };
    const inspected = spawnSync(command, ['--yes', 'eas-cli@21.0.0', 'build:view', options.id, '--json'], {
      cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 32 * 1024 * 1024,
    });
    if (inspected.error || inspected.status !== 0) throw new Error(`Could not inspect EAS build before submission: ${inspected.error?.message || inspected.status}`);
    let build;
    try { build = JSON.parse(inspected.stdout); }
    catch { throw new Error('EAS build inspection returned invalid JSON; no submission started'); }
    const appConfig = readJson(root, 'app.json').expo;
    assertInternalBuild(build, options.platform, { projectId: appConfig.extra?.eas?.projectId, version: appConfig.version });
    if (options.platform === 'ios') assertIosBuildSource(root, build);
    const submissionLookup = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
      'exec', '--yes', '--package=eas-cli@21.0.0', '--', 'node',
      path.join(root, 'scripts/check-eas-internal-submission.js'),
      '--project-id', appConfig.extra.eas.projectId,
      '--platform', options.platform,
      '--build-id', options.id,
    ], { cwd: root, env, stdio: 'inherit' });
    if (submissionLookup.error || submissionLookup.status !== 0) {
      throw new Error('EAS submission history check failed; no submission started');
    }
    if (options.dryRun) {
      console.log(`Internal ${options.platform} submission ready: build ${options.id}, EAS submit profile ${options.platform === 'android' ? 'internal' : 'production'}. No submission started.`);
      return;
    }
    const submitted = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
    if (submitted.error || submitted.status !== 0) throw new Error(`EAS internal submission failed: ${submitted.error?.message || submitted.status}`);
    return;
  }
  if (apps.length !== 1 || !['android', 'ios'].includes(options.platform)) throw new Error('Build needs one --app and --platform android|ios');
  const app = apps[0];
  const env = { ...process.env, EXPO_NO_DOTENV: '1', NOCTALIA_APP_VARIANT: app === 'lucid' ? 'lucid' : 'noctalia', EXPO_PUBLIC_APP_VARIANT: app === 'lucid' ? 'lucid' : 'noctalia' };
  const preflight = spawnSync(process.execPath, [path.join(root, 'scripts/check-eas-build-inputs.js'), '--app', app, '--platform', options.platform], { cwd: root, env, stdio: 'inherit' });
  if (preflight.error || preflight.status !== 0) throw new Error(`Local EAS build preflight failed; no build started: ${preflight.error?.message || preflight.status}`);
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'eas-cli@21.0.0', 'build', '--platform', options.platform, '--profile', app === 'lucid' ? 'lucid-production' : 'production'], {
    cwd: app === 'meditation' ? path.join(root, 'apps/meditation') : root,
    env,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) throw new Error(`EAS build failed: ${result.error?.message || result.status}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { affects, bump, changeLevel, normalized, plan, prepare, verify, parseArgs, internalSubmitArgs, assertInternalBuild, assertIosBuildSource, main };
