#!/usr/bin/env node
// One unattended command for a mobile release candidate on the Mac mini: Release builds
// for the iOS Simulator and the Android emulator, the native TesterArmy journeys on each,
// and one French report. A physical phone is then needed only for PHONE_ONLY below.
// It chains the guarded runners (tools/e2e/run.mjs build/run, native-backend-stack,
// native-recovery-api) in a managed workspace of the commit; their checks stay in force.
// Each run leases its simulator or emulator from the shared Simlock pool, like other agents.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, openSync, closeSync, readFileSync, readdirSync, renameSync, statfsSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, hostname, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const NODE = 'v24.22.1';
export const SUITES = {
  production: { label: 'Configuration production', profile: 'production-apk',
    covers: 'le build tel que publié (configuration de eas.json `production`, OTA coupée) : ouverture, accueil, réglages, langue et thème, menu, offre Plus, liens des widgets' },
  mock: { label: 'Compte et achats simulés', profile: 'mock-persistent',
    covers: 'les mêmes parcours avec un compte de test, plus achat, restauration, quotas Free/Plus, collection et liens de réinitialisation' },
  backend: { label: 'Serveur local réel', profile: 'local-backend',
    covers: 'vrai Auth/Postgres et vraies routes en local (IA déterministe) : hors ligne puis synchro, invité vers compte, séparation des comptes, analyse et chat repris après coupure, permission micro' },
};
export const PHONE_ONLY = [
  'App Attest : une analyse en invité sur iPhone (le simulateur n’a pas App Attest). Sur Android, Play Integrity demande aussi un vrai téléphone.',
  'Achat et restauration réels avec un compte de test Apple ou Google (les simulateurs ne testent que l’achat simulé).',
  'Installation depuis TestFlight ou Google Play : signature de production, groupe partagé app + widget, mise à jour par-dessus la version précédente.',
  'Micro physique et dictée en direct (le simulateur reconnaît un fichier audio, pas une voix).',
  'Fluidité ressentie sur un vrai téléphone.',
];
const DEFAULTS = { ref: 'origin/master', platform: 'all', suites: 'production,mock,backend', 'wait-minutes': '30', 'min-free-gb': '30' };
const BACKEND_PORT = 31283;
const RECOVERY_PORT = 31284;

export function parseOptions(argv) {
  const { values } = parseArgs({ args: argv, options: {
    ref: { type: 'string' }, platform: { type: 'string' }, suites: { type: 'string' },
    'wait-minutes': { type: 'string' }, 'min-free-gb': { type: 'string' },
    'no-fetch': { type: 'boolean' }, keep: { type: 'boolean' }, plan: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  const options = { ...DEFAULTS, ...values };
  const platforms = options.platform === 'all' ? ['ios', 'android'] : [options.platform];
  if (platforms.some(platform => !['ios', 'android'].includes(platform))) throw new Error('--platform takes ios, android or all.');
  const suites = [...new Set(options.suites.split(',').map(suite => suite.trim()).filter(Boolean))];
  if (!suites.length || suites.some(suite => !SUITES[suite])) throw new Error(`--suites takes a comma list of ${Object.keys(SUITES).join(', ')}.`);
  const minFreeGb = Number(options['min-free-gb']);
  if (!Number.isFinite(minFreeGb) || minFreeGb < 0) throw new Error('--min-free-gb takes a number.');
  const waitMinutes = Number(options['wait-minutes']);
  if (!Number.isInteger(waitMinutes) || waitMinutes < 1) throw new Error('--wait-minutes takes a whole number of minutes.');
  if (!/^[A-Za-z0-9._/~^@-]+$/.test(options.ref)) throw new Error('Invalid --ref.');
  return { ref: options.ref, platforms, suites: Object.keys(SUITES).filter(suite => suites.includes(suite)),
    waitMinutes, minFreeGb, fetch: !options['no-fetch'], keep: !!options.keep,
    plan: !!options.plan, help: !!options.help };
}

// production and mock share one generated project; the local backend needs the QA app
// (its own bundle id) and a live stack, so it runs last, after a second generation.
// Simlock resets each device on release, so no run inherits an app from the previous one.
export function planSteps({ platforms, suites }) {
  const steps = [];
  for (const platform of platforms) {
    const ordinary = suites.filter(suite => suite !== 'backend');
    if (ordinary.length) steps.push({ kind: 'prebuild', platform, qa: false });
    for (const suite of ordinary) steps.push({ kind: 'build', platform, suite }, { kind: 'run', platform, suite });
  }
  if (suites.includes('backend')) {
    steps.push({ kind: 'backend-start' });
    for (const platform of platforms) {
      steps.push({ kind: 'prebuild', platform, qa: true },
        { kind: 'build', platform, suite: 'backend' }, { kind: 'run', platform, suite: 'backend' });
    }
    steps.push({ kind: 'backend-stop' });
  }
  return steps;
}

// The generated projects enable expo-updates; a qualified Release runs its embedded bundle.
export function disableAndroidUpdates(manifest) {
  let found = false;
  const next = manifest.replace(/<meta-data\b[^>]*android:name="expo\.modules\.updates\.ENABLED"[^>]*\/?>/g, element => {
    found = true;
    return element.replace(/android:value="[^"]*"/, 'android:value="false"');
  });
  return { manifest: next, found };
}

export function suiteBuildEnv(suite, { easProduction = {}, backend } = {}) {
  if (suite === 'production') {
    const shipped = Object.fromEntries(Object.entries(easProduction).filter(([key]) => /^(EXPO_PUBLIC_|NOCTALIA_)/.test(key)));
    return { ...shipped, E2E_BUILD_PROFILE: 'production-apk', EXPO_PUBLIC_MOCK_MODE: 'false', EXPO_PUBLIC_MOCK_PERSISTENCE: 'false',
      EXPO_PUBLIC_MOCK_AUDIO: 'false', EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED: 'true' };
  }
  if (suite === 'mock') return { E2E_BUILD_PROFILE: 'mock-persistent', E2E_BUILD_ENV_FILE: '.env.mock', EXPO_PUBLIC_MOCK_MODE: 'true',
    EXPO_PUBLIC_MOCK_PERSISTENCE: 'true', EXPO_PUBLIC_MOCK_AUDIO: 'true', EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED: 'true' };
  if (!backend) throw new Error('The local backend suite needs its live stack.');
  return { E2E_BUILD_PROFILE: 'local-backend', E2E_NATIVE_JOURNEYS: '1', E2E_NATIVE_BACKEND_MANIFEST: backend.manifestFile };
}

export function buildCommand(platform, { scheme, suite }) {
  // Three Release builds in a row exhausted Gradle's Metaspace on the Mac mini (3.8.0 run).
  // The layers share one Gradle project and RN's bundle task only declares JS/TS inputs, so rerun it
  // or the mock APK keeps the production bundle (same fix as build-android-release-local.js).
  if (platform === 'android') return { command: ['./gradlew', ':app:createBundleReleaseJsAndAssets', '--rerun', ':app:assembleRelease', '--no-daemon', '--max-workers=4',
    '-Dorg.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1536m', '-PreactNativeArchitectures=arm64-v8a'],
    binary: 'android/app/build/outputs/apk/release/app-release.apk' };
  // The leased Simulator is known only at run time; the Mac mini's pool is Apple silicon.
  // Ad hoc signing gives the Simulator app its entitlements (keychain, app group).
  return { command: ['xcodebuild', '-workspace', `ios/${scheme}.xcworkspace`, '-scheme', scheme, '-configuration', 'Release',
    '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator', 'ARCHS=arm64', '-derivedDataPath', `ios/build/${suite}`,
    'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-', 'build'],
  binary: `ios/build/${suite}/Build/Products/Release-iphonesimulator/${scheme}.app` };
}

// The runbook leaves microphone injection out on both platforms and file recognition out on iOS.
// `prebuild --no-install` leaves only the .xcodeproj; CocoaPods adds the .xcworkspace later.
export function iosScheme(names) {
  const schemes = names.filter(name => name.endsWith('.xcodeproj')).map(name => name.slice(0, -'.xcodeproj'.length));
  if (schemes.length !== 1) throw new Error(`Expected one Xcode project in ios/, found ${schemes.length}.`);
  return schemes[0];
}
// test-results holds the local Supabase runtime (SUPABASE_HOME of native-backend-stack).
export const WORKSPACE_REGENERABLE = ['node_modules', 'tools/e2e/node_modules', 'tools/e2e/.e2e', 'ios', 'android', '.expo', '.tmp',
  'expo-env.d.ts', 'test-results'];

// The light/dark background matrices are visual captures reviewed on their own, not a release check.
export const runSelection = (platform, suite) => suite === 'production' ? []
  : suite === 'mock' ? ['--exclude-tag', 'contextual-backgrounds']
    : ['--exclude-tag', 'native-real-dictation', ...(platform === 'ios' ? ['--exclude-tag', 'native-speech-file'] : [])];

export function readRun(dir) {
  const read = file => { try { return JSON.parse(readFileSync(join(dir, file), 'utf8')); } catch { return null; } };
  const end = read('end.json');
  const run = read('report.json')?.run;
  const summary = run?.summary ?? {};
  const failed = (run?.results ?? []).filter(result => result.selected && !['passed', 'skipped'].includes(result.status));
  const failures = failed.map(result => (result.titlePath ?? [result.title ?? result.testId]).join(' > '));
  // One line per distinct first error, from the last attempt, so a shared cause reads at once.
  const causes = new Map();
  for (const result of failed) {
    const error = result.attempts?.at(-1)?.error;
    if (!error) continue;
    const where = error.source ? ` (${error.source.file}:${error.source.line})` : '';
    const text = `${error.code}: ${String(error.message ?? '').split('\n')[0].slice(0, 200)}${where}`;
    causes.set(text, (causes.get(text) ?? 0) + 1);
  }
  const lease = end?.simlock;
  return { qualified: end?.applicationQualified === true, exitCode: end?.exitCode ?? null, passed: summary.passed ?? 0,
    failed: summary.failed ?? failures.length, skipped: summary.skipped ?? 0, failures,
    causes: [...causes].map(([text, count]) => ({ text, count })), errors: end?.secondaryErrors ?? [], device: lease ? `${lease.model}, ${lease.osVersion} (Simlock ${lease.deviceId})` : null };
}

const PLATFORM_LABEL = { ios: 'iPhone (simulateur)', android: 'Android (émulateur)' };
function cell(result) {
  if (!result) return 'non lancé';
  if (result.error) return `ÉCHEC : ${result.error}`;
  const counts = `${result.passed} réussis${result.failed ? `, ${result.failed} en échec` : ''}${result.skipped ? `, ${result.skipped} hors profil` : ''}`;
  return `${result.qualified ? 'OK' : 'ÉCHEC'} (${counts})`;
}

export function renderReport({ revision, ref, startedAt, finishedAt, platforms, suites, results, environment = [], notes = [], evidence }) {
  const all = suites.flatMap(suite => platforms.map(platform => results[`${suite}:${platform}`]));
  const done = all.length > 0 && all.every(result => result?.qualified);
  const lines = [`# Tests sur simulateurs : ${ref} (${revision.slice(0, 12)})`, '',
    `Commit ${revision}, du ${startedAt} au ${finishedAt ?? 'en cours'}.`, '',
    done ? '**Tout est passé sur les simulateurs.** Il ne reste que la courte liste « vrai téléphone » ci-dessous.'
      : finishedAt ? '**Des parcours ont échoué ou n’ont pas tourné.** Voir le tableau et les échecs.' : '**Campagne en cours.**', '',
    `| Couche | ${platforms.map(platform => PLATFORM_LABEL[platform]).join(' | ')} |`, `| --- |${platforms.map(() => ' --- |').join('')}`,
    ...suites.map(suite => `| ${SUITES[suite].label} | ${platforms.map(platform => cell(results[`${suite}:${platform}`])).join(' | ')} |`), ''];
  const failures = suites.flatMap(suite => platforms.flatMap(platform => {
    const result = results[`${suite}:${platform}`];
    if (!result || result.qualified) return [];
    const where = result.dir ? ` (dossier \`${result.dir}\`${result.error ? '' : ', lire \`summary.md\` puis la page \`trace.md\` du test'})` : '';
    return [`- ${SUITES[suite].label}, ${PLATFORM_LABEL[platform]}${where} :`,
      ...(result.failures?.length ? result.failures.map(title => `  - ${title}`) : [`  - ${result.error ?? `code ${result.exitCode}, ${result.errors?.join(', ') || 'voir le dossier'}`}`]),
      ...(result.causes ?? []).map(cause => `  - Cause (${cause.count} parcours) : \`${cause.text}\``)];
  }));
  if (failures.length) lines.push('## Échecs', '', ...failures, '');
  lines.push('## Ce que couvre chaque couche', '', ...suites.map(suite => `- ${SUITES[suite].label} (profil \`${SUITES[suite].profile}\`) : ${SUITES[suite].covers}.`), '',
    '## À faire sur un vrai téléphone, avant la soumission', '',
    'Une seule courte session sur le build TestFlight (et Google Play en test interne) :', '',
    ...PHONE_ONLY.map(item => `- ${item}`), '');
  if (environment.length) lines.push('## Environnement', '', ...environment.map(entry => `- ${entry}`), '');
  if (notes.length) lines.push('## Notes', '', ...notes.map(note => `- ${note}`), '');
  if (evidence) lines.push(`Preuves complètes (reçus de build, rapports TesterArmy, captures) : \`${evidence}\`.`, '');
  return lines.join('\n');
}

const HELP = `Usage: mise exec -- npm run release:simulators -- [options]

Builds the candidate for the iOS Simulator and the Android emulator on this Mac,
runs the native TesterArmy journeys on devices leased from Simlock and writes
outputs/release-simulators/<run>/rapport.md.
  --ref <commit>        commit to test (default origin/master, fetched first)
  --platform <p>        ios, android or all (default all)
  --suites <list>       production,mock,backend (default all three)
  --wait-minutes <n>    how long each run waits for a Simlock device (default ${DEFAULTS['wait-minutes']})
  --min-free-gb <n>     refuse to start below this free disk space (default ${DEFAULTS['min-free-gb']})
  --no-fetch            do not fetch origin before resolving --ref
  --keep                keep the workspace (faster rerun of the same commit)
  --plan                print the steps and stop
No EAS build, Store submission, deployment or physical phone is involved.`;

// ---------------------------------------------------------------- host side effects

function read(executable, argv, options = {}) {
  const result = spawnSync(executable, argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${executable} ${argv.slice(0, 3).join(' ')} failed: ${(result.stderr || result.stdout || result.error?.message || '').trim().slice(-2000)}`);
  return result.stdout.trim();
}

const children = new Set();
let stopping = false;
function stream(executable, argv, { cwd, env, log }) {
  return new Promise((resolvePromise, reject) => {
    const out = createWriteStream(log, { flags: 'a' });
    const child = spawn(executable, argv, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    let tail = '';
    const relay = target => chunk => { target.write(chunk); out.write(chunk); tail = (tail + chunk).slice(-20000); };
    child.stdout.on('data', relay(process.stdout));
    child.stderr.on('data', relay(process.stderr));
    child.once('error', reject);
    child.once('close', code => { children.delete(child); out.end(); resolvePromise({ code: code ?? 1, tail }); });
  });
}

function startService(executable, argv, { cwd, env, log, ready, timeoutMs }) {
  return new Promise((resolvePromise, reject) => {
    const out = createWriteStream(log, { flags: 'a' });
    const child = spawn(executable, argv, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    let buffer = '';
    const timer = setTimeout(() => {
      child.kill('SIGINT'); // Its close handler then reports the timeout's rejection first.
      reject(new Error(`${executable} ${argv[0]} not ready after ${timeoutMs / 1000} s; see ${log}`));
    }, timeoutMs);
    const onData = chunk => {
      out.write(chunk);
      buffer = (buffer + chunk).slice(-50000);
      const match = ready(buffer);
      if (match) { clearTimeout(timer); resolvePromise({ child, match }); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', chunk => out.write(chunk));
    child.once('close', code => { children.delete(child); out.end(); clearTimeout(timer); reject(new Error(`service exited (${code}); see ${log}`)); });
  });
}

function stopService(service) {
  if (!service || service.child.exitCode !== null) return Promise.resolve();
  return new Promise(resolvePromise => {
    // The stack starter tears its disposable database down on SIGINT; give it time.
    const kill = setTimeout(() => service.child.kill('SIGKILL'), 180_000);
    service.child.once('close', () => { clearTimeout(kill); resolvePromise(); });
    service.child.kill('SIGINT');
  });
}

function javaHome(env) {
  const candidates = [env.JAVA_HOME];
  try { candidates.push(read('/usr/libexec/java_home', ['-v', '17'])); } catch { /* not registered with macOS */ }
  const mise = join(homedir(), '.local/share/mise/installs/java');
  if (existsSync(mise)) candidates.push(...readdirSync(mise).filter(name => /17\./.test(name)).sort().reverse().map(name => join(mise, name)));
  for (const home of candidates.filter(Boolean)) {
    const result = spawnSync(join(home, 'bin/java'), ['-version'], { encoding: 'utf8' });
    if (result.status === 0 && /version "17[."]/.test(result.stderr + result.stdout)) return home;
  }
  throw new Error('JAVA_17_MISSING: install a JDK 17 (for example `mise use -g java@temurin-17`) for Android Release builds.');
}

function androidSdk(env) {
  const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT ?? join(homedir(), 'Library/Android/sdk');
  if (!existsSync(join(sdk, 'platform-tools/adb'))) throw new Error('ANDROID_SDK_MISSING: install Android Studio with the platform tools.');
  return sdk;
}

function cleanEnv(env) {
  // The shell may carry a profile from another task; each step states its own. The Simlock
  // settings of this machine (binary, model) pass through.
  return Object.fromEntries(Object.entries(env).filter(([key]) => !/^(EXPO_PUBLIC_|E2E_(?!SIMLOCK_)|NOCTALIA_)/.test(key)));
}

function parseDotEnv(file) {
  return Object.fromEntries(readFileSync(file, 'utf8').split('\n').map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
}

function prebuild(workspace, platform, qa, env, backend, log) {
  // Prebuild fetches its native template, so it runs online; builds check dependencies offline.
  const prebuildEnv = { ...env, EXPO_NO_GIT_STATUS: '1', CI: '1', EXPO_NO_DOTENV: '1',
    NOCTALIA_APP_VARIANT: 'noctalia', EXPO_PUBLIC_APP_VARIANT: 'noctalia',
    ...(qa ? { ...parseDotEnv(backend.profileFile), NOCTALIA_DREAMER_QA_BUILD: '1', EXPO_PUBLIC_NATIVE_QA_AUDIO: 'true' } : {}) };
  return stream(process.execPath, [join(workspace, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', platform, '--clean', '--no-install'],
    { cwd: workspace, env: prebuildEnv, log }).then(async ({ code }) => {
    if (code !== 0) throw new Error(`expo prebuild ${platform} failed (code ${code})`);
    if (platform === 'android') {
      const file = join(workspace, 'android/app/src/main/AndroidManifest.xml');
      const { manifest, found } = disableAndroidUpdates(readFileSync(file, 'utf8'));
      if (found) writeFileSync(file, manifest);
      return null;
    }
    const scheme = iosScheme(readdirSync(join(workspace, 'ios')));
    const expoPlist = join(workspace, 'ios', scheme, 'Supporting/Expo.plist');
    if (existsSync(expoPlist)) read('plutil', ['-replace', 'EXUpdatesEnabled', '-bool', 'NO', expoPlist]);
    const { removeTruncatedCocoaPodsEntries } = require('./ios-native-preflight.js');
    removeTruncatedCocoaPodsEntries(process.env.CP_CACHE_DIR ?? join(homedir(), 'Library/Caches/CocoaPods'));
    const pods = await stream('pod', ['install'], { cwd: join(workspace, 'ios'), env: prebuildEnv, log });
    if (pods.code !== 0) throw new Error(`pod install failed (code ${pods.code})`);
    if (!existsSync(join(workspace, 'ios', `${scheme}.xcworkspace`))) throw new Error(`pod install did not create ios/${scheme}.xcworkspace.`);
    return scheme;
  });
}

function lastPath(tail, label) {
  const match = [...tail.matchAll(new RegExp(`${label}: (.+)`, 'g'))].pop();
  return match ? resolve(match[1].trim()) : null;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) { console.log(HELP); return 0; }
  const steps = planSteps(options);
  if (options.plan) {
    for (const step of steps) console.log([step.kind, step.platform, step.suite ?? (step.qa ? 'qa-app' : step.qa === false ? 'app' : '')].filter(Boolean).join(' '));
    return 0;
  }
  if (process.platform !== 'darwin') throw new Error('Run this on the Mac mini: the iOS Simulator needs macOS.');
  if (process.version !== NODE) throw new Error(`Node ${NODE} is required: run it through \`mise exec -- npm run release:simulators\`.`);

  const here = fileURLToPath(new URL('..', import.meta.url));
  const primary = dirname(read('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: here }));
  const free = statfsSync(primary);
  const freeGb = Number(free.bavail) * Number(free.bsize) / 1e9;
  if (freeGb < options.minFreeGb) throw new Error(`Only ${freeGb.toFixed(0)} GB free on this disk; ${options.minFreeGb} GB needed (builds, Pods, emulator).`);
  const known = () => spawnSync('git', ['rev-parse', '--verify', '--quiet', `${options.ref}^{commit}`], { cwd: primary }).status === 0;
  // A branch is refreshed; a commit is fetched only when this clone lacks it (a PR head, for example).
  if (options.fetch && (options.ref.startsWith('origin/') || !known()))
    read('git', ['fetch', 'origin', options.ref.replace(/^origin\//, '')], { cwd: primary });
  const revision = read('git', ['rev-parse', '--verify', '--end-of-options', `${options.ref}^{commit}`], { cwd: primary });
  // The runs use the candidate's own runner; without Simlock it would need a named device.
  if (spawnSync('git', ['cat-file', '-e', `${revision}:tools/e2e/simlock-native.mjs`], { cwd: primary }).status !== 0)
    throw new Error(`${revision.slice(0, 12)} predates the Simlock reservation of tools/e2e/run.mjs (PR #645); test a commit that contains it.`);

  const lockFile = join(tmpdir(), 'noctalia-release-simulators.lock');
  try { const fd = openSync(lockFile, 'wx'); writeFileSync(fd, String(process.pid)); closeSync(fd); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const owner = Number(readFileSync(lockFile, 'utf8'));
    let alive = false;
    try { process.kill(owner, 0); alive = true; } catch { /* stale */ }
    if (alive) throw new Error(`Another release:simulators run (pid ${owner}) is in progress.`);
    writeFileSync(lockFile, String(process.pid));
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const reportDir = join(primary, 'outputs/release-simulators', `${stamp}-${revision.slice(0, 12)}`);
  const logDir = join(reportDir, 'logs');
  mkdirSync(logDir, { recursive: true });
  const reportFile = join(reportDir, 'rapport.md');
  const results = {}, notes = [], environment = [`Mac : ${hostname()}, Node ${process.version}`], startedAt = new Date().toISOString();
  let evidence = null, finishedAt = null;
  const report = () => writeFileSync(reportFile, renderReport({ revision, ref: options.ref, startedAt, finishedAt, platforms: options.platforms,
    suites: options.suites, results, environment, notes, evidence: evidence && relative(primary, evidence) }));
  report();
  console.log(`Rapport : ${reportFile}`);

  const { prepare, release } = require('./lib/local-workspace.js');
  const task = `release-sim-${revision.slice(0, 12)}`;
  const baseEnv = { ...cleanEnv(process.env), CI: '1' };
  let workspace = null;
  let backend = null, stack = null, api = null;
  const schemes = {};
  const onSignal = () => { stopping = true; for (const child of children) child.kill('SIGINT'); };
  // A campaign lasts hours: keep the Mac awake while this process lives.
  spawn('caffeinate', ['-i', '-w', String(process.pid)], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    workspace = prepare({ task, repo: primary, ref: revision, ownerPid: String(process.pid), regenerable: WORKSPACE_REGENERABLE }).path;
    const easProduction = JSON.parse(readFileSync(join(workspace, 'eas.json'), 'utf8')).build?.production?.env ?? {};
    const log = name => join(logDir, name);
    for (const [label, argv, cwd] of [['npm ci', ['ci'], workspace], ['TesterArmy install', ['ci', '--prefix', 'tools/e2e'], workspace]]) {
      const { code } = await stream('npm', argv, { cwd, env: baseEnv, log: log('install.log') });
      if (code !== 0) throw new Error(`${label} failed (code ${code}); see logs/install.log.`);
    }
    if (options.platforms.includes('android')) baseEnv.JAVA_HOME = javaHome(baseEnv);
    // The runs use the tested commit's runner and pins, not this checkout's.
    const { SDK_PINS } = await import(pathToFileURL(join(workspace, 'tools/e2e/qualification.mjs')).href);
    environment.push(`TesterArmy : ${Object.entries(SDK_PINS).map(([name, version]) => `${name} ${version}`).join(', ')}`);
    if (options.platforms.includes('ios')) environment.push(`Xcode : ${read('xcodebuild', ['-version']).split('\n').join(', ')}`);
    if (options.platforms.includes('android')) {
      const sdk = androidSdk(baseEnv);
      Object.assign(baseEnv, { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk });
    }
    const leased = new Set(), warmed = new Set();
    const receipts = {};
    for (const step of steps) {
      if (stopping) throw new Error('Interrupted.');
      const key = `${step.suite}:${step.platform}`;
      console.log(`\n== ${step.kind} ${step.platform ?? ''} ${step.suite ?? ''}`.trimEnd());
      try {
        if (step.kind === 'prebuild') {
          if (step.qa && !backend) continue;
          schemes[step.platform] = await prebuild(workspace, step.platform, step.qa, baseEnv, backend, log(`prebuild-${step.platform}.log`));
          warmed.delete(step.platform);
        } else if (step.kind === 'backend-start') {
          const qaDir = join(process.platform === 'darwin' ? '/private/tmp' : tmpdir(), `noctalia-release-simulators-${stamp}-${process.pid}`);
          stack = await startService(process.execPath, ['tools/e2e/native-backend-stack.mjs', '--output', qaDir, '--port', String(BACKEND_PORT),
            '--functions-origin', `http://127.0.0.1:${RECOVERY_PORT}`], { cwd: workspace, env: baseEnv, log: log('backend-stack.log'), timeoutMs: 900_000,
            ready: text => text.split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } }).find(value => value?.ready === true) });
          backend = stack.match;
          const apiEnv = { ...baseEnv, E2E_NATIVE_BACKEND_MANIFEST: backend.manifestFile };
          const cached = await stream('deno', ['cache', '--no-config', 'tools/e2e/test-support/native-recovery-api.ts'], { cwd: workspace, env: apiEnv, log: log('backend-api.log') });
          if (cached.code !== 0) throw new Error('deno cache of the recovery API failed; see logs/backend-api.log.');
          api = await startService('deno', ['run', '--no-config', '--cached-only', '--allow-net=127.0.0.1,deno.land:443', '--allow-read', '--allow-env',
            'tools/e2e/test-support/native-recovery-api.ts'], { cwd: workspace, env: apiEnv, log: log('backend-api.log'), timeoutMs: 300_000,
            ready: text => text.includes(`Native recovery API ready on loopback:${RECOVERY_PORT}`) });
        } else if (step.kind === 'backend-stop') {
          await stopService(api); await stopService(stack); api = stack = null;
        } else if (results[key]?.error) {
          continue; // The build of this layer failed; its run is reported as such.
        } else if (step.suite === 'backend' && !backend) {
          results[key] = { error: 'le serveur local n’a pas démarré (voir logs/backend-stack.log)' };
        } else if (step.kind === 'build') {
          const { command, binary } = buildCommand(step.platform, { scheme: schemes[step.platform], suite: step.suite });
          const env = { ...baseEnv, ...suiteBuildEnv(step.suite, { easProduction, backend }), EXPO_NO_DOTENV: '1', EXPO_OFFLINE: '1',
            E2E_BUILD_COMMAND: JSON.stringify(command), E2E_RELEASE_BINARY: binary };
          if (step.platform === 'ios' && !warmed.has('ios')) {
            // The first build after a prebuild rewrites native inputs (prebuilt Expo pods switch to
            // Release, dSYM plists), which the runner refuses as BUILD_INPUTS_CHANGED; build once outside it.
            const warm = await stream(command[0], command.slice(1), { cwd: workspace, env, log: log(`build-warmup-${step.suite}-ios.log`) });
            if (warm.code !== 0) { results[key] = { error: `build de préparation en échec (logs/build-warmup-${step.suite}-ios.log)` }; report(); continue; }
            warmed.add('ios');
          }
          const { code, tail } = await stream(process.execPath, ['tools/e2e/run.mjs', 'dreamer', step.platform, 'build'], { cwd: workspace, env, log: log(`build-${step.suite}-${step.platform}.log`) });
          receipts[key] = lastPath(tail, 'Release receipt');
          if (code !== 0 || !receipts[key]) results[key] = { error: `build en échec (logs/build-${step.suite}-${step.platform}.log, puis build.log du dossier)`, dir: lastPath(tail, 'E2E evidence') };
        } else if (step.kind === 'run') {
          // No E2E_DEVICE: the runner leases a pooled device, installs the receipt's Release and releases it.
          const env = { ...baseEnv, E2E_RELEASE_RECEIPT: receipts[key], E2E_SIMLOCK_TIMEOUT_SECONDS: String(options.waitMinutes * 60),
            ...(step.suite === 'backend' ? { E2E_NATIVE_JOURNEYS: '1', E2E_NATIVE_BACKEND_MANIFEST: backend.manifestFile } : {}) };
          const { tail } = await stream(process.execPath, ['tools/e2e/run.mjs', 'dreamer', step.platform, 'run', '--install-release', ...runSelection(step.platform, step.suite)],
            { cwd: workspace, env, log: log(`run-${step.suite}-${step.platform}.log`) });
          const dir = lastPath(tail, 'E2E evidence');
          results[key] = dir ? { ...readRun(dir), dir } : { error: `le run n’a pas démarré (logs/run-${step.suite}-${step.platform}.log)` };
          const device = results[key].device && `${PLATFORM_LABEL[step.platform]} : ${results[key].device}`;
          if (device && !leased.has(device)) { leased.add(device); environment.push(device); }
        }
      } catch (error) {
        if (step.kind === 'prebuild' || step.kind === 'backend-start') {
          // Every layer that needed this step is reported failed; the others still run.
          for (const suite of options.suites) for (const platform of options.platforms) {
            const needs = step.kind === 'backend-start' ? suite === 'backend' : platform === step.platform && (suite === 'backend') === step.qa;
            if (needs && !results[`${suite}:${platform}`]) results[`${suite}:${platform}`] = { error: error.message.slice(0, 300) };
          }
        } else throw error;
      }
      report();
    }
  } catch (error) {
    notes.push(`Arrêt : ${error.message.slice(0, 500)}`);
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    await stopService(api); await stopService(stack);
    const runs = workspace && join(workspace, 'tools/e2e/.e2e');
    if (runs && existsSync(runs)) {
      try {
        renameSync(runs, join(reportDir, 'e2e'));
        evidence = join(reportDir, 'e2e');
        for (const result of Object.values(results)) if (result.dir?.startsWith(runs)) result.dir = relative(primary, join(evidence, relative(runs, result.dir)));
      } catch (error) { notes.push(`Preuves laissées dans ${runs} (${error.message.slice(0, 200)}).`); }
    }
    if (workspace && options.keep) notes.push(`Espace de travail gardé : ${workspace} (le libérer : npm run workspace -- release --task ${task} --owner-pid $$).`);
    else if (workspace) {
      try { release({ task, repo: primary, ownerPid: String(process.pid) }); }
      catch (error) { notes.push(`Espace de travail non supprimé (${error.message.slice(0, 200)}) : ${workspace}.`); }
    }
    finishedAt = new Date().toISOString();
    report();
    try { unlinkSync(lockFile); } catch { /* already gone */ }
  }
  console.log(`\nRapport : ${reportFile}`);
  const all = options.suites.flatMap(suite => options.platforms.map(platform => results[`${suite}:${platform}`]));
  return all.every(result => result?.qualified) ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }, error => { console.error(error.message); process.exitCode = 1; });
}
