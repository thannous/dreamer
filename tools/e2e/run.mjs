import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, openSync, closeSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, sourceSnapshot, compareSnapshots, verifyReport, aggregateReports, writeOnce, preserveStatus, directoryFiles, hashFiles, createAttemptOutput, verifyEvidenceFiles, verifyNativeCleanup } from './qualification.mjs';
import { normalizeAvdName, appInputs, nativeInputs, binaryInputs, releaseMetadata, validateReleaseReceipt, verifyInstalledRelease, installVerifiedRelease, validateBuildCommand } from './native-release.mjs';

const cwd = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const parameters = process.argv.slice(2);
if (['mobile', 'inspect', 'mcp'].includes(parameters[0])) {
  const mode = parameters.shift();
  if (!parameters[0] || !['android', 'ios'].includes(parameters[1]))
    throw new Error('Native entry requires an explicit product and android|ios.');
  if (mode !== 'mobile') parameters.splice(2, 0, mode);
}
const [product = 'dreamer', platform = 'web', command = 'run', ...rawArgs] = parameters;
let releaseFile = process.env.E2E_RELEASE_RECEIPT;
let installRelease = false;
const args = [];
for (let index = 0; index < rawArgs.length; index++) {
  if (rawArgs[index] === '--release-receipt') {
    releaseFile = rawArgs[++index];
    if (!releaseFile || releaseFile.startsWith('-')) throw new Error('Missing Release receipt.');
  } else if (rawArgs[index] === '--install-release') installRelease = true;
  else args.push(rawArgs[index]);
}
if (!['dreamer', 'lucid', 'meditation', 'site'].includes(product) || !['web', 'android', 'ios'].includes(platform) || !['run', 'list', 'mcp', 'inspect', 'build', 'collect'].includes(command))
  throw new Error('Usage: run.mjs dreamer|lucid|meditation|site web|android|ios [run|list|mcp|inspect] [e2e flags]');
if (product === 'site' && platform !== 'web') throw new Error('Site supports web only.');
if ((releaseFile || installRelease || command === 'build') && platform === 'web') throw new Error('Release options require a native target.');
if (installRelease && command !== 'run') throw new Error('Only a native run can request installation.');
if (command === 'build' && args.length) throw new Error('Build uses the explicit E2E_BUILD_COMMAND descriptor, without SDK flags.');
if (command === 'collect' && (platform !== 'web' || args.length)) throw new Error('Campaign collection takes one web product and no selections.');
if (command === 'inspect' && (platform === 'web' || args.length)) throw new Error('Inspection takes one native product/platform and no test flags.');
if (command === 'mcp' && args.length) throw new Error('The guarded MCP entry fixes its target and one session; pass no additional flags.');
// Selection cannot replace the owned config, device target or evidence directory.
const switches = new Set(['--video', '--trace', '--headed', '--debug', '--no-cache', '--strict-cache']);
const selections = new Set(['--grep', '--grep-invert', '--repeat-each', '--tag', '--exclude-tag', '--tag-mode']);
for (let index = 0; index < args.length; index++) {
  const flag = args[index];
  if (switches.has(flag)) continue;
  if (!selections.has(flag)) throw new Error(`Unsupported E2E option: ${flag}`);
  const value = args[++index];
  if (!value || value.startsWith('-')) throw new Error(`Invalid E2E value for ${flag}.`);
  if (flag === '--repeat-each' && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))))
    throw new Error('Invalid E2E repeat count.');
}
const cli = join(cwd, 'node_modules/e2e/dist/cli/bin.js');
if (!existsSync(cli)) throw new Error('Install with npm run test:testerarmy:setup first.');
// Load the pinned browser matchers before the CLI installs TypeScript hooks.
// Node arguments apply only to the web CLI, never Expo, native or inspection.
const webNodeArgs = platform === 'web' ? ['--import', join(cwd, 'preload-web-matchers.mjs')] : [];
const env = { ...process.env, E2E_PRODUCT: product, E2E_PLATFORM: platform, E2E_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' };
function cliEnvironment() {
  if (platform !== 'web') return env;
  return {
    ...env,
    E2E_APP_NODE_OPTIONS: env.NODE_OPTIONS ?? '',
    E2E_APP_NODE_OPTIONS_PRESENT: Object.hasOwn(env, 'NODE_OPTIONS') ? '1' : '0',
    // Workers do not retain the CLI's execArgv. Construct this after output and
    // PATH are set; only this process family receives the matcher preload.
    NODE_OPTIONS: `${env.NODE_OPTIONS ?? ''} --import ${JSON.stringify(join(cwd, 'preload-web-matchers.mjs'))}`.trim(),
  };
}
env.PATH = [dirname(process.execPath), env.PATH].join(delimiter);
if (process.version !== 'v24.19.0') throw new Error('PINNED_NODE_RUNTIME');
const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT ?? (process.platform === 'darwin' ? join(homedir(), 'Library/Android/sdk') : undefined);
if (sdk && existsSync(sdk)) {
  env.ANDROID_HOME = env.ANDROID_SDK_ROOT = sdk;
  env.PATH = [join(sdk, 'platform-tools'), join(sdk, 'emulator'), env.PATH].join(delimiter);
}
if (command === 'list') {
  if (platform !== 'web' && !env.E2E_DEVICE) env.E2E_DEVICE = platform === 'android' ? 'emulator-0000' : 'iPhone Simulator';
  const result = spawnSync(process.execPath, [...webNodeArgs, cli, command, ...args], { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
const relativeOutput = `.e2e/${product}-${platform}/${Date.now()}-${process.pid}-${randomUUID()}`;
env.E2E_OUTPUT = relativeOutput;
const output = createAttemptOutput(join(cwd, '.e2e', `${product}-${platform}`), basename(relativeOutput));
const bundle = { dreamer: 'com.tanuki75.noctalia', lucid: 'com.tanuki75.noctalia.lucid', meditation: 'com.noctalia.meditation' }[product];
function read(executable, argv, options = {}) {
  const result = spawnSync(executable, argv, { cwd: root, env, encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr || `${executable} failed`);
  return result.stdout.trim();
}
function webInputIdentity() {
  const sourceFiles = ['e2e.config.ts', 'web-engine.ts', 'web-parity-fixtures.ts', 'preload-web-matchers.mjs', 'run.mjs', 'journeys.ts', 'package.json', 'package-lock.json', 'tsconfig.json',
    ...readdirSync(join(cwd, 'tests')).filter(name => name.endsWith('.web.e2e.ts')).map(name => `tests/${name}`),
  ].sort();
  return Object.fromEntries(sourceFiles.map(path => [path, createHash('sha256').update(readFileSync(join(cwd, path))).digest('hex')]));
}
let lock;
let fd;
let identity;
let primary = 0;
let sourceBefore;
let release;
let requestedSignal;
let installedReady = false;
let sdkLaunched = false;
let inspectionStarted = false;
let inspectionClosed = false;
let mcpStarted = false;
let resourceCleanup = 'not-started';
const secondary = [];
const startedAt = Date.now();
const expectedOrigin = platform === 'web' ? `http://127.0.0.1:${env.E2E_WEB_PORT ?? ({ dreamer: 8096, lucid: 8097, meditation: 8098, site: 8099 }[product])}` : undefined;
const pins = Object.fromEntries(['e2e', '@e2e-dev/web', '@e2e-dev/mobile', 'agent-device'].map(name => [name, JSON.parse(readFileSync(join(cwd, 'node_modules', name, 'package.json'), 'utf8')).version]));
if (pins.e2e !== '0.18.0' || pins['@e2e-dev/web'] !== '0.13.0' || pins['@e2e-dev/mobile'] !== '0.10.0' || pins['agent-device'] !== '0.21.22') throw new Error('INSTALLED_SDK_PINS');
const campaignId = env.E2E_CAMPAIGN_ID ?? env.CIRCLE_WORKFLOW_JOB_ID ?? null;
const context = () => ({ locale: env.E2E_WEB_LOCALE ?? (product === 'lucid' ? 'fr-FR' : 'en-US'), featureSheets: env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true' });
async function execute(executable, argv, logName, childEnv = env, workdir = cwd) {
  const logFd = logName ? openSync(join(output, logName), 'wx') : undefined;
  const child = spawn(executable, argv, { cwd: workdir, env: childEnv, stdio: logFd === undefined ? 'inherit' : ['ignore', logFd, logFd], detached: process.platform !== 'win32' });
  const relay = signal => {
    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const interrupt = () => { requestedSignal = 130; relay('SIGINT'); };
  const terminate = () => { requestedSignal = 143; relay('SIGTERM'); };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve(requestedSignal ?? code ?? (signal === 'SIGTERM' ? 143 : signal ? 130 : 1)));
    });
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
    if (logFd !== undefined) closeSync(logFd);
  }
}
async function buildRelease() {
  const require = createRequire(import.meta.url);
  const buildEnv = { ...env, CI: '1', EXPO_NO_DOTENV: '1' };
  const appRoot = product === 'meditation' ? join(root, 'apps/meditation') : root;
  const profileFile = buildEnv.E2E_BUILD_ENV_FILE;
  if (profileFile) {
    if (!['.env.mock', '.env.lucid.mock'].includes(profileFile) || (product === 'dreamer' && profileFile !== '.env.mock') || (product === 'lucid' && profileFile !== '.env.lucid.mock') || product === 'meditation') throw new Error('Unknown build environment profile.');
    require(join(root, 'scripts/expo-safe-runner.js')).loadEnvProfile(profileFile, { cwd: root, env: buildEnv });
  }
  buildEnv.NOCTALIA_APP_VARIANT = buildEnv.EXPO_PUBLIC_APP_VARIANT = product === 'dreamer' ? 'noctalia' : product;
  const buildCommand = JSON.parse(buildEnv.E2E_BUILD_COMMAND ?? 'null');
  validateBuildCommand(buildCommand, platform);
  if (!buildEnv.E2E_RELEASE_BINARY) throw new Error('E2E_RELEASE_BINARY must identify the output APK or Simulator .app.');
  if (platform === 'android') require(join(root, 'scripts/build-android-release-local.js')).assertAndroidJava17(buildEnv);
  if (platform === 'android' && (!sdk || !existsSync(join(sdk, 'platform-tools/adb')) || !existsSync(join(sdk, 'build-tools')))) throw new Error('ANDROID_SDK_MISSING');
  if (platform === 'ios') {
    for (const flag of ['-workspace', '-project']) {
      const index = buildCommand.indexOf(flag);
      if (index >= 0 && !existsSync(resolve(appRoot, buildCommand[index + 1] ?? ''))) throw new Error('IOS_PROJECT_MISSING');
    }
  }
  const native = nativeInputs(root, product, platform); // Existing project/Pods required. No implicit prebuild.
  const source = appInputs(root, product);
  const profile = {
    name: buildEnv.E2E_BUILD_PROFILE,
    mock: buildEnv.EXPO_PUBLIC_MOCK_MODE === 'true', persistence: buildEnv.EXPO_PUBLIC_MOCK_PERSISTENCE === 'true',
    audioMock: buildEnv.EXPO_PUBLIC_MOCK_AUDIO === 'true', featureSheets: buildEnv.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true',
    categorizationDelayMs: Number(buildEnv.EXPO_PUBLIC_MOCK_CATEGORIZATION_DELAY_MS ?? 0),
  };
  if (!['production-apk', 'mock-persistent', 'lucid-mock', 'meditation-local'].includes(profile.name)
    || !Number.isSafeInteger(profile.categorizationDelayMs)
    || (product === 'lucid' && profile.name !== 'lucid-mock') || (product === 'meditation' && profile.name !== 'meditation-local')
    || (product === 'dreamer' && !['production-apk', 'mock-persistent'].includes(profile.name))
    || (profile.name === 'production-apk' && profile.mock)
    || (profile.name === 'mock-persistent' && (!profile.mock || !profile.persistence))
    || (profile.categorizationDelayMs !== 0 && (!profile.mock || !profile.persistence || profile.categorizationDelayMs < 20000 || profile.categorizationDelayMs > 60000)))
    throw new Error('Invalid explicit Release profile.');
  writeOnce(join(output, 'build-start.json'), { source, nativeInputDigest: native.digest, nativeInputs: native.files,
    buildCommand, profile, environmentSha256: digest(JSON.stringify(Object.entries(buildEnv).filter(([key]) => key.startsWith('EXPO_PUBLIC_') || key.startsWith('NOCTALIA_')).sort())) });
  primary = await execute(process.execPath, [join(appRoot, 'node_modules/expo/bin/cli'), 'install', '--check'], 'dependencies-check.log', buildEnv, appRoot);
  if (primary !== 0) return;
  const workdir = basename(buildCommand[0]) === 'gradlew' ? join(appRoot, 'android') : appRoot;
  primary = await execute(buildCommand[0], buildCommand.slice(1), 'build.log', buildEnv, workdir);
  if (primary !== 0) return;
  if (source.inputDigest !== appInputs(root, product).inputDigest || native.digest !== nativeInputs(root, product, platform).digest)
    throw new Error('BUILD_INPUTS_CHANGED');
  const path = resolve(root, buildEnv.E2E_RELEASE_BINARY);
  const readBuild = (executable, argv) => read(executable, argv, { env: buildEnv, cwd: appRoot });
  const metadata = releaseMetadata(path, platform, buildEnv, readBuild);
  if (metadata.bundle !== bundle || (product === 'lucid' && platform === 'ios' && !metadata.signed)) throw new Error('BUILD_PROFILE_IDENTITY');
  release = { schemaVersion: 1, kind: 'noctalia-native-release', product, platform, bundle,
    configuration: 'Release', buildExitCode: 0, startedAt: new Date(startedAt).toISOString(), finishedAt: new Date().toISOString(),
    buildCommand, source, nativeInputDigest: native.digest, nativeInputs: native.files, profile,
    binary: { ...binaryInputs(path, platform), ...metadata } };
  writeOnce(join(output, 'release.json'), release);
  console.log('Release receipt: ' + join(output, 'release.json'));
}
function collectCampaign() {
  if (!campaignId || !/^[a-zA-Z0-9_-]{8,128}$/.test(campaignId)) throw new Error('A unique E2E_CAMPAIGN_ID is required for collection.');
  const base = join(cwd, '.e2e', `${product}-web`);
  const reports = [];
  const required = new Map();
  for (const name of readdirSync(base)) {
    const path = join(base, name);
    if (!existsSync(join(path, 'evidence.json'))) continue;
    const evidence = JSON.parse(readFileSync(join(path, 'evidence.json'), 'utf8'));
    if (evidence.campaignId !== campaignId || evidence.command[4] !== 'run') continue;
    verifyEvidenceFiles(path);
    const runStart = JSON.parse(readFileSync(join(path, 'source-start.json'), 'utf8'));
    const runEnd = JSON.parse(readFileSync(join(path, 'source-end.json'), 'utf8'));
    if (!compareSnapshots(runStart, runEnd).sourceStable || !compareSnapshots(runStart, sourceBefore).sourceStable) throw new Error('CAMPAIGN_INPUTS_CHANGED');
    if (evidence.origin !== expectedOrigin) throw new Error('CAMPAIGN_ORIGIN_CHANGED');
    if (evidence.revision !== sourceBefore.revision || !existsSync(join(path, 'end.json'))) throw new Error('Campaign provenance incomplete.');
    const end = JSON.parse(readFileSync(join(path, 'end.json'), 'utf8'));
    if (end.exitCode !== 0 || !end.stability?.sourceStable || !end.stability.outputsStable) throw new Error('Campaign contains a refused run.');
    const proof = JSON.parse(readFileSync(join(path, 'qualification.json'), 'utf8'));
    if (proof.revision !== evidence.revision || !proof.passed) throw new Error('Campaign qualification missing.');
    const report = JSON.parse(readFileSync(join(path, 'report.json'), 'utf8'));
    const checked = verifyReport(report, { target: `${product}-web`, platform: 'web', revision: sourceBefore.revision,
      startedAt: Date.parse(evidence.startedAt), output: path, context: evidence.context, origin: evidence.origin,
      video: evidence.requestedMedia.video, trace: evidence.requestedMedia.trace,
      collection: JSON.parse(readFileSync(join(path, 'collection.json'), 'utf8')), repeatCount: evidence.repeatCount });
    if (JSON.stringify(checked) !== JSON.stringify(proof)) throw new Error('Campaign proof differs from report.');
    reports.push(checked);
    for (const row of report.run.results) required.set(JSON.stringify([row.targetId, row.testId, row.agent]), { targetId: row.targetId, testId: row.testId, agent: row.agent });
  }
  if (!reports.length) throw new Error('No current campaign reports.');
  if (product === 'dreamer') {
    for (const [locale, featureSheets] of [['en-US', true], ['fr-FR', true], ['de-DE', true], ['en-US', false]]) {
      if (!reports.some(proof => proof.context?.locale === locale && proof.context?.featureSheets === featureSheets)) throw new Error('Dreamer campaign context missing.');
    }
  }
  writeOnce(join(output, 'campaign.json'), { campaignId, revision: sourceBefore.revision, ...aggregateReports(reports, [...required.values()]) });
}
async function runSdk() {
  const collectionArgs = [];
  let repeatCount = 1;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--repeat-each') repeatCount = Number(args[++index]);
    else if (selections.has(args[index])) collectionArgs.push(args[index], args[++index]);
  }
  const collection = JSON.parse(read(process.execPath, [...webNodeArgs, cli, 'list', ...collectionArgs, '--reporter', 'json'], { cwd, env: cliEnvironment() }));
  writeOnce(join(output, 'collection.json'), collection);
  if (!collection.pairs?.length) throw new Error('No selected pairs.');
  sdkLaunched = true;
  primary = await execute(process.execPath, [...webNodeArgs, cli, 'run', ...args], 'sdk.log', cliEnvironment());
  if (primary === 0) {
    const report = JSON.parse(readFileSync(join(output, 'report.json'), 'utf8'));
    const proof = verifyReport(report, { target: `${product}-${platform}`, platform, revision: sourceBefore.revision,
      startedAt, output, context: context(), origin: expectedOrigin, video: args.includes('--video'), trace: platform === 'web' || args.includes('--trace'), collection, repeatCount });
    writeOnce(join(output, 'qualification.json'), proof);
  }
}
try {
  sourceBefore = sourceSnapshot(root, product);
  const device = env.E2E_DEVICE;
  let binary = null;
  if (platform !== 'web' && command !== 'build') {
    if (!device) throw new Error('E2E_DEVICE must name a dedicated emulator or iOS Simulator.');
    if (platform === 'android') {
      if (!/^emulator-\d+$/.test(device)) throw new Error('Physical phones are excluded. Select an emulator serial.');
      if (read('adb', ['-s', device, 'get-state']) !== 'device') throw new Error('Android target is not ready.');
      const rawAvd = read('adb', ['-s', device, 'emu', 'avd', 'name']);
      writeFileSync(join(output, 'avd-raw.txt'), rawAvd, { flag: 'wx' });
      if (normalizeAvdName(rawAvd) !== (env.E2E_AVD_NAME ?? 'Pixel_9_API_37')) throw new Error('Unrelated Android AVD refused.');
      if (read('adb', ['-s', device, 'shell', 'getprop', 'sys.boot_completed']) !== '1') throw new Error('Android target is not booted.');
      identity = device;
    } else {
      const devices = Object.values(JSON.parse(read('xcrun', ['simctl', 'list', 'devices', 'available', '--json'])).devices).flat();
      const matches = devices.filter(entry => entry.name === device || entry.udid === device);
      if (matches.length !== 1) throw new Error('E2E_DEVICE must resolve to exactly one available iOS Simulator.');
      identity = matches[0].udid;
    }
    lock = join(tmpdir(), `noctalia-testerarmy-${createHash('sha256').update(identity).digest('hex')}.lock`);
    fd = openSync(lock, 'wx');
    writeFileSync(fd, JSON.stringify({ pid: process.pid, product, platform, device }));
    if (!releaseFile) throw new Error('E2E_RELEASE_RECEIPT is required; create it through the explicit native build command.');
    release = JSON.parse(readFileSync(resolve(releaseFile), 'utf8'));
    const artifact = binaryInputs(release.binary.path, platform);
    validateReleaseReceipt(release, { product, platform, bundle, inputDigest: appInputs(root, product).inputDigest,
      nativeInputDigest: nativeInputs(root, product, platform).digest, binaryDigest: artifact.sha256 });
    binary = release.binary;
    writeOnce(join(output, 'release-used.json'), release);
    if (Object.hasOwn(env, 'EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED')
      && (env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true') !== release.profile.featureSheets)
      throw new Error('Test onboarding flag differs from compiled Release profile.');
    env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED = String(release.profile.featureSheets);
    env.E2E_NATIVE_MOCK_MODE = String(release.profile.mock);
    env.E2E_NATIVE_MOCK_CATEGORIZATION_MS = String(release.profile.categorizationDelayMs);
    if (command !== 'run') {
      writeOnce(join(output, 'installed-start.json'), verifyInstalledRelease({ receipt: release, device: identity, output, read }));
      installedReady = true;
    }
  }
  if (product === 'site' && command !== 'list' && !existsSync(join(root, 'docs/en/index.html')))
    throw new Error('Build the generated site with npm run docs:build before running.');
  const diff = read('git', ['diff', 'HEAD']);
  writeOnce(join(output, 'source-start.json'), sourceBefore);
  writeOnce(join(output, 'evidence.json'), {
    startedAt: new Date(startedAt).toISOString(), product, platform, device: env.E2E_DEVICE ?? null, bundle, binary,
    campaignId, pins, origin: expectedOrigin, repeatCount: args.includes('--repeat-each') ? Number(args[args.indexOf('--repeat-each') + 1]) : 1, context: context(), requestedMedia: { video: args.includes('--video'), trace: platform === 'web' || args.includes('--trace') },
    revision: read('git', ['rev-parse', 'HEAD']), workingTree: read('git', ['status', '--porcelain']),
    trackedDiffSha256: createHash('sha256').update(diff).digest('hex'),
    command: ['node', 'tools/e2e/run.mjs', product, platform, command, ...args, ...(releaseFile ? ['--release-receipt', resolve(releaseFile)] : []), ...(installRelease ? ['--install-release'] : [])],
    rerunEnvironment: platform === 'web' ? { E2E_WEB_LOCALE: context().locale, EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED: String(context().featureSheets), E2E_WEB_PORT: new URL(expectedOrigin).port } : { E2E_DEVICE: env.E2E_DEVICE ?? null, E2E_AVD_NAME: env.E2E_AVD_NAME ?? 'Pixel_9_API_37' },
    ...(platform === 'web' ? {
      webInputsSha256: webInputIdentity(),
      webLocale: env.E2E_WEB_LOCALE ?? (product === 'lucid' ? 'fr-FR' : 'en-US'),
      onboardingFeatureSheets: env.EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED === 'true',
      playwrightVersion: JSON.parse(readFileSync(join(cwd, 'node_modules/playwright/package.json'), 'utf8')).version,
      nodeOptionsRestored: Object.hasOwn(env, 'NODE_OPTIONS') ? 'original value' : 'absent',
    } : {}),
    release: release ? { receipt: resolve(releaseFile ?? join(output, 'release.json')), buildSource: release.source.revision, profile: release.profile } : null,
    services: platform === 'web' && product !== 'site' ? 'mock services; local real UI' : 'identified local Release / generated site',
  });
  if (command === 'build') {
    await buildRelease();
  } else if (command === 'collect') {
    collectCampaign();
  } else if (command === 'inspect') {
    const deviceCli = join(cwd, 'node_modules/agent-device/bin/agent-device.mjs');
    const session = `noctalia-inspect-${process.pid}-${Date.now()}`;
    const target = ['--session', session, '--platform', platform, platform === 'android' ? '--serial' : '--udid', identity];
    let status = 1;
    try {
      inspectionStarted = true;
      status = await execute(process.execPath, [deviceCli, 'open', bundle, '--foreground', ...target], 'open.txt');
      if (status === 0) status = await execute(process.execPath, [deviceCli, 'snapshot', '-i', ...target], 'screen.txt');
      if (status === 0) status = await execute(process.execPath, [deviceCli, 'screenshot', join(output, 'screen.png'), ...target], 'screenshot.txt');
    } finally {
      primary = status;
      try {
        const closed = await execute(process.execPath, [deviceCli, 'close', ...target], 'close.txt');
        inspectionClosed = closed === 0;
        if (primary === 0 && closed !== 0) primary = closed;
      } catch { secondary.push('INSPECTION_CLOSE'); }
      writeOnce(join(output, 'inspection.json'), { session, status: preserveStatus(primary, secondary), purpose: 'UI inspection; no assertions, reset, install or model call' });
      console.log(`Inspection evidence: tools/e2e/${relativeOutput}`);
    }
  } else {
    if (command === 'mcp') { mcpStarted = true; primary = await execute(process.execPath, [...webNodeArgs, cli, command, '--target', `${product}-${platform}`, '--max-sessions', '1'], undefined, cliEnvironment()); }
    else if (platform === 'web') await runSdk();
    else await installVerifiedRelease({
      install: installRelease ? async () => {
        if (platform === 'android') read('adb', ['-s', identity, 'install', '-r', release.binary.path]);
        else read('xcrun', ['simctl', 'install', identity, release.binary.path]);
      } : undefined,
      verifyInstalled: async () => {
        writeOnce(join(output, 'installed-start.json'), verifyInstalledRelease({ receipt: release, device: identity, output, read }));
        installedReady = true;
      },
      launch: runSdk,
    });
  }
} catch (error) {
  if (primary === 0) primary = 3;
  secondary.push(error.code ?? error.message ?? 'QUALIFICATION_REFUSED');
  console.error(error.message);
} finally {
  // Every final check and lock operation is independent. Persistence failure
  // cannot prevent cleanup or replace the original SDK failure/signal.
  const attempt = (code, body) => { try { return body(); } catch { secondary.push(code); return undefined; } };
  if (installedReady) attempt('INSTALLED_END_REFUSED', () => writeOnce(join(output, 'installed-end.json'), verifyInstalledRelease({ receipt: release, device: identity, output, read })));
  const end = attempt('SOURCE_END_REFUSED', () => sourceSnapshot(root, product));
  const stability = sourceBefore && end ? compareSnapshots(sourceBefore, end) : null;
  if (stability && (!stability.sourceStable || !stability.outputsStable)) secondary.push('SOURCE_OR_OUTPUT_CHANGED');
  if (end) attempt('SOURCE_END_PERSISTENCE', () => writeOnce(join(output, 'source-end.json'), end));
  if (platform !== 'web' && sdkLaunched) {
    resourceCleanup = attempt('NATIVE_CLEANUP_UNPROVEN', () => verifyNativeCleanup(JSON.parse(readFileSync(join(output, 'report.json'), 'utf8')), {
      target: `${product}-${platform}`, platform, revision: sourceBefore.revision, startedAt,
    })) ? 'complete' : 'unproven';
  } else if (inspectionStarted) {
    resourceCleanup = inspectionClosed ? 'complete' : 'unproven';
    if (!inspectionClosed) secondary.push('NATIVE_CLEANUP_UNPROVEN');
  } else if (mcpStarted) {
    resourceCleanup = 'unproven'; secondary.push('NATIVE_MCP_CLEANUP_UNPROVEN');
  }
  if (fd !== undefined) {
    attempt('LOCK_CLOSE', () => closeSync(fd));
    attempt('LOCK_OWNERSHIP', () => {
      const owner = JSON.parse(readFileSync(lock, 'utf8'));
      if (owner.pid !== process.pid || owner.product !== product || owner.device !== env.E2E_DEVICE) throw new Error('Foreign lock.');
      if (resourceCleanup === 'unproven') return;
      unlinkSync(lock);
    });
  }
  attempt('MANIFEST_PERSISTENCE', () => writeOnce(join(output, 'files.json'), hashFiles(output, directoryFiles(output, '.'))));
  attempt('END_PERSISTENCE', () => writeOnce(join(output, 'end.json'), {
    finishedAt: new Date().toISOString(), primaryExitCode: requestedSignal ?? primary,
    exitCode: preserveStatus(requestedSignal ?? primary, secondary), sdkLaunched, installedReady, stability,
    secondaryErrors: secondary, resourceCleanup, lockReleased: lock ? !existsSync(lock) : true,
  }));
  process.exitCode = preserveStatus(requestedSignal ?? primary, secondary);
  console.log('E2E evidence: ' + output);
}
