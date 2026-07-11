#!/usr/bin/env node
'use strict';
/* global __dirname */

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { resolveCommand } = require('./check-android-release-gates');
const {
  invalidateVoiceAnalysisEvidence,
  VOICE_ANALYSIS_FLOW,
  writeVoiceAnalysisEvidence,
} = require('./android-voice-analysis-evidence');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MAESTRO_BIN_WINDOWS = 'C:\\Users\\thann\\maestro\\maestro\\bin\\maestro.bat';
const DEFAULT_METRO_PORT = 8081;
const TESTSTORE_READINESS_FLOW = 'maestro/subscription-teststore-release-readiness.yml';
const SENSITIVE_FLOW_GUARD_ENV = 'NOCTALIA_INTERNAL_SENSITIVE_FLOW_GUARD';
const SENSITIVE_FLOW_GUARDS = Object.freeze({
  'maestro/subscription-teststore-purchase-manual.yml': 'purchase-email:v1',
  'maestro/subscription-teststore-purchase-google-manual.yml': 'purchase-google:v1',
  'maestro/subscription-teststore-restore-google-manual.yml': 'restore-google:v1',
  'maestro/subscription-teststore-account-switch-free-email-manual.yml': 'account-switch-email:v1',
});
const MAESTRO_FLOW_ENV_KEYS = Object.freeze({
  'maestro/release-auth-analysis.yml': [
    'REVENUECAT_QA_SWITCH_FREE_EMAIL',
    'REVENUECAT_QA_SWITCH_FREE_PASSWORD',
  ],
  'maestro/release-auth-voice-analysis.yml': [
    'REVENUECAT_QA_SWITCH_FREE_EMAIL',
    'REVENUECAT_QA_SWITCH_FREE_PASSWORD',
  ],
  'maestro/release-auth-offline-sync.yml': [
    'QA_SYNC_SENTINEL',
    'REVENUECAT_QA_SWITCH_FREE_EMAIL',
    'REVENUECAT_QA_SWITCH_FREE_PASSWORD',
  ],
  'maestro/subscription-teststore-paywall-auth.yml': [
    'REVENUECAT_QA_SWITCH_FREE_EMAIL',
    'REVENUECAT_QA_SWITCH_FREE_PASSWORD',
  ],
  'maestro/subscription-teststore-purchase-manual.yml': [
    'QA_EMAIL',
    'QA_EMAIL_REGEX',
    'QA_PASSWORD',
    'QA_PLAN',
  ],
  'maestro/subscription-teststore-purchase-google-manual.yml': [
    'QA_EMAIL_REGEX',
    'QA_PLAN',
  ],
  'maestro/subscription-teststore-restore-google-manual.yml': [
    'QA_EMAIL_REGEX',
  ],
  'maestro/subscription-teststore-account-switch-free-email-manual.yml': [
    'QA_PAID_EMAIL_REGEX',
    'QA_SWITCH_FREE_EMAIL',
    'QA_SWITCH_FREE_EMAIL_REGEX',
    'QA_SWITCH_FREE_PASSWORD',
  ],
  'maestro/android-play-upgrade-seed-v33.yml': ['UPGRADE_SENTINEL'],
  'maestro/android-play-upgrade-verify-v34.yml': ['UPGRADE_SENTINEL'],
});
const ALL_MAESTRO_FLOW_ENV_KEYS = Object.freeze(
  Array.from(new Set(Object.values(MAESTRO_FLOW_ENV_KEYS).flat()))
);
const SENSITIVE_MAESTRO_ENV_KEY_PATTERN = /(?:EMAIL|PASSWORD)/;
const REDACTABLE_MAESTRO_ARTIFACT_EXTENSIONS = new Set([
  '.json',
  '.log',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);
const SENSITIVE_MAESTRO_SCREENSHOT_EXTENSIONS = new Set([
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
]);

const SUITES = {
  smoke: [
    'maestro/smoke.yml',
  ],
  release: [
    'maestro/release-smoke.yml',
    'maestro/release-lifecycle.yml',
    'maestro/release-permissions.yml',
    'maestro/release-offline-local.yml',
  ],
  'release-analysis': [
    'maestro/release-analysis.yml',
  ],
  'release-voice-analysis': [
    'maestro/release-auth-voice-analysis.yml',
  ],
  'release-teststore': [
    'maestro/subscription-teststore-release-readiness.yml',
  ],
  'release-teststore-paywall': [
    'maestro/subscription-teststore-paywall-auth.yml',
  ],
  core: [
    'maestro/smoke.yml',
    'maestro/recording-text-fallback.yml',
    'maestro/recording-bottom-sheet.yml',
    'maestro/mock-existing-user.yml',
    'maestro/mock-existing-quotas.yml',
  ],
  canary: [
    'maestro/mock-existing-user.yml',
    'maestro/journal-badges-filters.yml',
    'maestro/subscription-mock-paywall.yml',
  ],
  onboarding: [
    'maestro/onboarding-persona-paths.yml',
  ],
  mock: [
    'maestro/mock-existing-user.yml',
    'maestro/mock-existing-quotas.yml',
    'maestro/journal-badges-filters.yml',
    'maestro/journal-dream-cta-labels.yml',
    'maestro/edit-dream-metadata.yml',
    'maestro/inspiration-rituals.yml',
    'maestro/subscription-mock-paywall.yml',
    'maestro/subscription-qa-lab.yml',
  ],
  store: [
    'maestro/subscription-teststore-readiness.yml',
  ],
  quotas: [
    'maestro/free-analysis-limit.yml',
    'maestro/guest-chat-limit.yml',
    'maestro/guest-dream-limit-signup.yml',
    'maestro/guest-exploration-limit.yml',
    'maestro/guest-quota-flow.yml',
  ],
  all: [
    'maestro/smoke.yml',
    'maestro/recording-text-fallback.yml',
    'maestro/recording-bottom-sheet.yml',
    'maestro/mock-existing-user.yml',
    'maestro/mock-existing-quotas.yml',
    'maestro/free-analysis-limit.yml',
    'maestro/guest-chat-limit.yml',
    'maestro/guest-dream-limit-signup.yml',
    'maestro/guest-exploration-limit.yml',
    'maestro/guest-quota-flow.yml',
    'maestro/inspiration-rituals.yml',
    'maestro/onboarding-persona-paths.yml',
    'maestro/journal-badges-filters.yml',
    'maestro/journal-dream-cta-labels.yml',
    'maestro/edit-dream-metadata.yml',
    'maestro/subscription-mock-paywall.yml',
    'maestro/subscription-qa-lab.yml',
  ],
};

function parseArgs(argv) {
  const options = {
    suite: 'core',
    retries: 1,
    parallel: 'auto',
    devices: null,
    startMetro: true,
    restartMetro: true,
    metroTimeoutMs: 120000,
    metroPort: DEFAULT_METRO_PORT,
    envFile: '.env.mock',
    flows: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--suite') {
      options.suite = argv[i + 1] ?? options.suite;
      i += 1;
      continue;
    }

    if (arg === '--retries') {
      options.retries = Number.parseInt(argv[i + 1] ?? '1', 10);
      i += 1;
      continue;
    }

    if (arg === '--parallel') {
      options.parallel = argv[i + 1] ?? options.parallel;
      i += 1;
      continue;
    }

    if (arg === '--device') {
      options.devices = (argv[i + 1] ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }

    if (arg === '--flow') {
      options.flows = options.flows ?? [];
      options.flows.push(argv[i + 1] ?? '');
      i += 1;
      continue;
    }

    if (arg === '--no-start-metro') {
      options.startMetro = false;
      continue;
    }

    if (arg === '--no-restart-metro') {
      options.restartMetro = false;
      continue;
    }

    if (arg === '--metro-timeout-ms') {
      options.metroTimeoutMs = Number.parseInt(argv[i + 1] ?? String(options.metroTimeoutMs), 10);
      i += 1;
      continue;
    }

    if (arg === '--env-file') {
      options.envFile = argv[i + 1] ?? options.envFile;
      i += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (Number.isNaN(options.retries) || options.retries < 0) {
    throw new Error(`Invalid --retries value: ${options.retries}`);
  }

  return options;
}

function printHelp() {
  const suites = Object.entries(SUITES)
    .map(([name, flows]) => `  ${name.padEnd(7)} ${flows.length} flow${flows.length > 1 ? 's' : ''}: ${flows.join(', ')}`)
    .join('\n');

  console.log(`
Usage:
  node ./scripts/run-maestro-android.js [--suite <name>] [--parallel auto|<n>] [--retries <n>] [--device <id1,id2>] [--flow <path>]... [--no-restart-metro] [--no-start-metro]

Suites:
${suites}

Fast debug:
  Use --retries 0 for fail-fast runs.
  Use --no-restart-metro when a compatible Metro server is already warm.
  The release suite requires --no-start-metro and a matching non-debuggable app build.

Examples:
  npm run test:e2e
  npm run test:e2e:canary
  npm run test:e2e:canary:fast
  node ./scripts/run-maestro-android.js --suite quotas --parallel auto
  node ./scripts/run-maestro-android.js --suite canary --retries 0 --no-restart-metro
  node ./scripts/run-maestro-android.js --flow maestro/smoke.yml --flow maestro/recording-bottom-sheet.yml --retries 2
`.trim());
}

function resolveFlows(options) {
  if (options.flows?.length) {
    return options.flows.map((flow) => normalizeFlow(flow));
  }

  const suiteFlows = SUITES[options.suite];
  if (!suiteFlows) {
    throw new Error(`Unknown suite "${options.suite}". Available suites: ${Object.keys(SUITES).join(', ')}`);
  }

  return suiteFlows.map((flow) => normalizeFlow(flow));
}

function normalizeFlow(flow) {
  const absoluteFlow = path.resolve(ROOT, String(flow || ''));
  const relativeFlow = path.relative(ROOT, absoluteFlow).replace(/\\/g, '/');
  if (!relativeFlow || relativeFlow.startsWith('../') || path.isAbsolute(relativeFlow)) {
    throw new Error(`Maestro flow must stay inside the repository: ${flow || 'missing'}`);
  }
  if (!fs.existsSync(absoluteFlow)) {
    throw new Error(`Missing Maestro flow: ${relativeFlow}`);
  }
  return relativeFlow;
}

function getSensitiveFlowGuardToken(flow) {
  return SENSITIVE_FLOW_GUARDS[flow] ?? null;
}

function isSensitiveFlow(flow) {
  return Boolean(getSensitiveFlowGuardToken(flow));
}

function shouldBlockNextSensitiveFlow(result, nextFlow) {
  return !result.ok && Boolean(nextFlow) && isSensitiveFlow(nextFlow);
}

function assertSensitiveFlowAuthorization(flows, options, env = process.env) {
  const sensitive = flows
    .map((flow, index) => ({ flow, index, token: getSensitiveFlowGuardToken(flow) }))
    .filter((entry) => entry.token);

  if (sensitive.length === 0) return;
  if (sensitive.length > 1) {
    throw new Error('Run only one guarded Test Store action at a time.');
  }

  if (options?.suite !== 'release-teststore' || options?.startMetro !== false) {
    throw new Error(
      'Sensitive Test Store flows require the release-teststore suite with Metro disabled.'
    );
  }
  if (!Array.isArray(options.devices) || options.devices.length !== 1) {
    throw new Error('Sensitive Test Store flows require exactly one explicit --device target.');
  }

  const [{ flow, index, token }] = sensitive;
  if (index === 0 || flows[index - 1] !== TESTSTORE_READINESS_FLOW) {
    throw new Error(
      `Refusing sensitive Maestro flow ${flow}: run ${TESTSTORE_READINESS_FLOW} immediately before it.`
    );
  }
  if (env[SENSITIVE_FLOW_GUARD_ENV] !== token) {
    throw new Error(
      `Refusing sensitive Maestro flow ${flow}: use its guarded wrapper instead of the generic runner.`
    );
  }
}

function ensureMockEnv(envFileName) {
  const sourcePath = path.resolve(ROOT, envFileName);
  const targetPath = path.resolve(ROOT, '.env.local');

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing env source file: ${sourcePath}`);
  }

  const sourceContent = fs.readFileSync(sourcePath, 'utf8');
  const currentTarget = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;

  if (currentTarget !== sourceContent) {
    fs.writeFileSync(targetPath, sourceContent, 'utf8');
    console.log(`Updated .env.local from ${envFileName}`);
  } else {
    console.log(`Using existing .env.local from ${envFileName}`);
  }
}

function isPortOpen(port, host = '127.0.0.1', timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });

    const close = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => close(true));
    socket.once('timeout', () => close(false));
    socket.once('error', () => close(false));
  });
}

async function waitForPort(port, timeoutMs, host = '127.0.0.1') {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port, host, 1000)) {
      return true;
    }
    await sleep(1500);
  }
  return false;
}

function startMetroDetached() {
  if (process.platform === 'win32') {
    const scriptPath = path.resolve(ROOT, 'scripts', 'start-metro-background.cmd');
    spawn('cmd.exe', ['/c', scriptPath], {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }

  spawn('npx', ['expo', 'start', '--dev-client', '--clear'], {
    cwd: ROOT,
    env: { ...process.env, CI: 'true' },
    detached: true,
    stdio: 'ignore',
  }).unref();
}

function lookupMetroPids(port) {
  if (process.platform === 'win32') {
    const result = spawnSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
    ], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    if (result.status !== 0) {
      return [];
    }

    return result.stdout
      .split(/\r?\n/)
      .map((line) => Number.parseInt(line.trim(), 10))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  const result = spawnSync('bash', ['-lc', `lsof -ti tcp:${port} -sTCP:LISTEN`], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function stopMetro(port) {
  const pids = lookupMetroPids(port);
  if (!pids.length) {
    return false;
  }

  for (const pid of pids) {
    try {
      process.kill(pid);
    } catch (error) {
      if (error?.code !== 'ESRCH') {
        throw error;
      }
    }
  }

  return true;
}

function listAndroidDevices() {
  const adbBin = process.env.ADB_BIN || resolveCommand('adb') || (process.platform === 'win32' ? 'adb.exe' : 'adb');
  const result = spawnSync(adbBin, ['devices'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to list adb devices');
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] === 'device')
    .map((parts) => parts[0]);
}

function readExpectedAndroidBuild(
  rootDir = ROOT,
  readFileSync = fs.readFileSync
) {
  const appConfig = JSON.parse(
    readFileSync(path.join(rootDir, 'app.json'), 'utf8')
  );
  const packageName = String(appConfig?.expo?.android?.package || '').trim();
  const versionName = String(appConfig?.expo?.version || '').trim();
  const versionCode = Number(appConfig?.expo?.android?.versionCode);

  if (!packageName) {
    throw new Error('app.json must define expo.android.package for Release E2E.');
  }
  if (!versionName) {
    throw new Error('app.json must define expo.version for Release E2E.');
  }
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error('app.json must define a positive expo.android.versionCode for Release E2E.');
  }

  return {
    packageName,
    versionName,
    versionCode: String(versionCode),
  };
}

function parseInstalledAndroidBuild(output) {
  const text = String(output || '');
  const packageName = text.match(/^\s*Package \[([^\]]+)\]/m)?.[1] ?? null;
  const versionCode = text.match(/^\s*versionCode=(\d+)\b/m)?.[1] ?? null;
  const versionName = text.match(/^\s*versionName=([^\r\n]+)$/m)?.[1]?.trim() ?? null;
  const packageFlags = text.match(/^\s*pkgFlags=\[([^\]]*)\]/m)?.[1] ?? null;
  const debuggable = packageFlags
    ?.split(/\s+/)
    .filter(Boolean)
    .includes('DEBUGGABLE') ?? false;

  return {
    packageName,
    versionCode,
    versionName,
    packageFlagsAvailable: packageFlags !== null,
    debuggable,
  };
}

function assertInstalledReleaseBinary(deviceId, expected, installed) {
  const mismatches = [];

  if (installed.packageName !== expected.packageName) {
    mismatches.push(
      `package ${installed.packageName || 'missing'} (expected ${expected.packageName})`
    );
  }
  if (installed.versionName !== expected.versionName) {
    mismatches.push(
      `versionName ${installed.versionName || 'missing'} (expected ${expected.versionName})`
    );
  }
  if (installed.versionCode !== expected.versionCode) {
    mismatches.push(
      `versionCode ${installed.versionCode || 'missing'} (expected ${expected.versionCode})`
    );
  }
  if (!installed.packageFlagsAvailable) {
    mismatches.push('Android package flags unavailable (cannot prove a non-debuggable build)');
  } else if (installed.debuggable) {
    mismatches.push('installed package is DEBUGGABLE and may depend on Metro');
  }

  if (mismatches.length) {
    throw new Error(
      `[${deviceId}] Refusing Release Maestro suite: ${mismatches.join('; ')}.`
    );
  }

  return installed;
}

function verifyInstalledReleaseBinary(
  deviceId,
  expected,
  {
    adbBin = process.env.ADB_BIN || resolveCommand('adb') || (process.platform === 'win32' ? 'adb.exe' : 'adb'),
    spawn = spawnSync,
  } = {}
) {
  const result = spawn(
    adbBin,
    ['-s', deviceId, 'shell', 'dumpsys', 'package', expected.packageName],
    { cwd: ROOT, encoding: 'utf8' }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `[${deviceId}] Could not inspect ${expected.packageName}: ${result.stderr || result.stdout || `exit ${result.status}`}`
    );
  }

  const installed = assertInstalledReleaseBinary(
    deviceId,
    expected,
    parseInstalledAndroidBuild(result.stdout)
  );
  console.log(
    `[${deviceId}] Release binary verified: ${installed.packageName} ${installed.versionName} (${installed.versionCode}), non-debuggable; Metro will not be started.`
  );
  return installed;
}

function assertReleaseSuiteDoesNotStartMetro(options) {
  if (options.suite?.startsWith('release') && options.startMetro) {
    throw new Error(
      'The Release Maestro suite requires --no-start-metro so it tests the embedded bundle.'
    );
  }
}

function assertVoiceFlowAuthorization(flows, options) {
  if (!flows.includes(VOICE_ANALYSIS_FLOW)) return;
  if (!Array.isArray(options.devices) || options.devices.length !== 1) {
    throw new Error(
      'The Release voice flow clears app state and requires exactly one explicit --device target.'
    );
  }
}

function configureAndroidInput(deviceId) {
  const adbBin = process.env.ADB_BIN || resolveCommand('adb') || (process.platform === 'win32' ? 'adb.exe' : 'adb');
  const commands = [
    ['shell', 'ime', 'set', 'com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME'],
    ['shell', 'settings', 'put', 'secure', 'stylus_handwriting_enabled', '0'],
    ['shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1'],
  ];

  for (const args of commands) {
    const result = spawnSync(adbBin, ['-s', deviceId, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      console.warn(`[${deviceId}] Android input setup warning: ${result.stderr || result.stdout || args.join(' ')}`);
    }
  }
}

function selectDevices(connectedDevices, requestedDevices) {
  if (!requestedDevices?.length) {
    return connectedDevices;
  }

  const missing = requestedDevices.filter((device) => !connectedDevices.includes(device));
  if (missing.length) {
    throw new Error(`Requested Android devices are not connected: ${missing.join(', ')}`);
  }

  return requestedDevices;
}

function resolveWorkerCount(parallel, deviceCount, flowCount) {
  if (deviceCount <= 1 || flowCount <= 1) {
    return Math.min(deviceCount, flowCount);
  }

  if (parallel === 'auto') {
    return Math.min(deviceCount, flowCount);
  }

  const parsed = Number.parseInt(String(parallel), 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error(`Invalid --parallel value: ${parallel}`);
  }

  return Math.min(parsed, deviceCount, flowCount);
}

function assignFlowsToWorkers(flows, workerCount) {
  const queues = Array.from({ length: workerCount }, () => []);
  flows.forEach((flow, index) => {
    queues[index % workerCount].push(flow);
  });
  return queues;
}

function resolveMaestroInvocation() {
  if (process.env.MAESTRO_BIN) {
    if (process.platform === 'win32') {
      return { command: 'cmd.exe', baseArgs: ['/c', process.env.MAESTRO_BIN] };
    }
    return { command: process.env.MAESTRO_BIN, baseArgs: [] };
  }

  if (process.platform === 'win32' && fs.existsSync(DEFAULT_MAESTRO_BIN_WINDOWS)) {
    return { command: 'cmd.exe', baseArgs: ['/c', DEFAULT_MAESTRO_BIN_WINDOWS] };
  }

  return { command: resolveCommand('maestro') || 'maestro', baseArgs: [] };
}

function decodeExactRegexLiteral(value) {
  const text = String(value || '');
  if (text.length < 2 || !text.startsWith('^') || !text.endsWith('$')) {
    return null;
  }

  const regexMetaCharacters = new Set('\\^$.*+?()[]{}|'.split(''));
  const body = text.slice(1, -1);
  let literal = '';

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === '\\') {
      const escaped = body[index + 1];
      if (!escaped || !regexMetaCharacters.has(escaped)) {
        return null;
      }
      literal += escaped;
      index += 1;
      continue;
    }
    if (regexMetaCharacters.has(character)) {
      return null;
    }
    literal += character;
  }

  return literal;
}

function encodedRedactionVariants(value) {
  const variants = new Set([value]);
  variants.add(JSON.stringify(value).slice(1, -1));
  try {
    variants.add(encodeURIComponent(value));
  } catch {
    // The raw value is still redacted if it contains an invalid Unicode sequence.
  }
  return variants;
}

function buildMaestroFlowRedactions(flow, env = process.env) {
  const redactions = new Map();

  for (const key of MAESTRO_FLOW_ENV_KEYS[flow] ?? []) {
    if (!SENSITIVE_MAESTRO_ENV_KEY_PATTERN.test(key) || !env[key]) {
      continue;
    }

    const replacement = key.includes('PASSWORD')
      ? '<redacted:qa-secret>'
      : '<redacted:qa-identity>';
    const sourceValues = new Set([String(env[key])]);
    if (key.includes('EMAIL')) {
      sourceValues.add(String(env[key]).toLowerCase());
      const literal = decodeExactRegexLiteral(env[key]);
      if (literal) {
        sourceValues.add(literal);
        sourceValues.add(literal.toLowerCase());
      }
    }

    for (const sourceValue of sourceValues) {
      for (const value of encodedRedactionVariants(sourceValue)) {
        if (value) {
          redactions.set(value, replacement);
        }
      }
    }
  }

  return Array.from(redactions, ([value, replacement]) => ({ value, replacement }))
    .sort((left, right) => right.value.length - left.value.length);
}

function normalizeRedactions(redactions) {
  return (redactions ?? [])
    .filter((entry) => entry?.value)
    .map((entry) => ({
      value: String(entry.value),
      replacement: String(entry.replacement || '<redacted>'),
    }))
    .sort((left, right) => right.value.length - left.value.length);
}

function redactSensitiveText(text, redactions) {
  let redacted = String(text ?? '');
  for (const { value, replacement } of normalizeRedactions(redactions)) {
    redacted = redacted.split(value).join(replacement);
  }
  return redacted;
}

function findNextRedaction(text, startIndex, redactions) {
  let next = null;
  for (const redaction of redactions) {
    const index = text.indexOf(redaction.value, startIndex);
    if (index === -1) continue;
    if (!next || index < next.index || (
      index === next.index && redaction.value.length > next.redaction.value.length
    )) {
      next = { index, redaction };
    }
  }
  return next;
}

function createRedactingWriter(destination, redactions) {
  const normalized = normalizeRedactions(redactions);
  const decoder = new StringDecoder('utf8');
  const maxValueLength = Math.max(1, ...normalized.map(({ value }) => value.length));
  const writeDestination = typeof destination === 'function'
    ? destination
    : destination.write.bind(destination);
  let pending = '';
  let ended = false;

  const emitSafePrefix = () => {
    const safeBoundary = Math.max(0, pending.length - maxValueLength + 1);
    let cursor = 0;
    let output = '';

    while (cursor < safeBoundary) {
      const next = findNextRedaction(pending, cursor, normalized);
      if (!next || next.index >= safeBoundary) {
        output += pending.slice(cursor, safeBoundary);
        cursor = safeBoundary;
        break;
      }
      output += pending.slice(cursor, next.index);
      output += next.redaction.replacement;
      cursor = next.index + next.redaction.value.length;
    }

    if (output) {
      writeDestination(output);
    }
    pending = pending.slice(cursor);
  };

  return {
    write(chunk) {
      if (ended) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      pending += decoder.write(buffer);
      emitSafePrefix();
    },
    end() {
      if (ended) return;
      ended = true;
      pending += decoder.end();
      if (pending) {
        writeDestination(redactSensitiveText(pending, normalized));
      }
      pending = '';
    },
  };
}

function sanitizeMaestroArtifacts(
  outputRoot,
  redactions,
  { removeScreenshots = true } = {}
) {
  const normalized = normalizeRedactions(redactions);
  const report = {
    textFilesScanned: 0,
    textFilesRedacted: 0,
    screenshotsRemoved: 0,
  };
  if (!normalized.length || !fs.existsSync(outputRoot)) {
    return report;
  }

  const pendingDirectories = [outputRoot];
  while (pendingDirectories.length) {
    const directory = pendingDirectories.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const artifactPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(artifactPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (removeScreenshots && SENSITIVE_MAESTRO_SCREENSHOT_EXTENSIONS.has(extension)) {
        fs.unlinkSync(artifactPath);
        report.screenshotsRemoved += 1;
        continue;
      }
      if (!REDACTABLE_MAESTRO_ARTIFACT_EXTENSIONS.has(extension)) {
        continue;
      }

      report.textFilesScanned += 1;
      const content = fs.readFileSync(artifactPath, 'utf8');
      const redacted = redactSensitiveText(content, normalized);
      if (redacted !== content) {
        fs.writeFileSync(artifactPath, redacted, 'utf8');
        report.textFilesRedacted += 1;
      }
    }
  }

  return report;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const redactions = normalizeRedactions(options.redactions);
    const redactOutput = redactions.length > 0;
    const child = spawn(command, args, {
      cwd: options.cwd ?? ROOT,
      env: {
        MAESTRO_CLI_NO_ANALYTICS: '1',
        ...(options.env ?? process.env),
      },
      shell: options.shell ?? false,
      stdio: redactOutput ? ['inherit', 'pipe', 'pipe'] : (options.stdio ?? 'inherit'),
    });

    const stdoutRedactor = redactOutput && child.stdout
      ? createRedactingWriter(options.stdoutWriter ?? process.stdout, redactions)
      : null;
    const stderrRedactor = redactOutput && child.stderr
      ? createRedactingWriter(options.stderrWriter ?? process.stderr, redactions)
      : null;
    child.stdout?.on('data', (chunk) => stdoutRedactor?.write(chunk));
    child.stderr?.on('data', (chunk) => stderrRedactor?.write(chunk));

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      stdoutRedactor?.end();
      stderrRedactor?.end();
      resolve(result);
    };

    child.on('close', (code, signal) => {
      finish({
        ok: code === 0,
        code,
        signal,
      });
    });

    child.on('error', (error) => {
      finish({
        ok: false,
        code: null,
        signal: null,
        error,
      });
    });
  });
}

function buildMaestroEnv(sourceEnv = process.env) {
  const sanitizedEnv = { ...sourceEnv };
  for (const key of ALL_MAESTRO_FLOW_ENV_KEYS) {
    delete sanitizedEnv[key];
  }
  delete sanitizedEnv[SENSITIVE_FLOW_GUARD_ENV];

  const maestroHome = sourceEnv.MAESTRO_RUNNER_HOME || path.resolve(ROOT, '.maestro-home');
  fs.mkdirSync(path.join(maestroHome, '.maestro'), { recursive: true });

  return {
    ...sanitizedEnv,
    HOME: maestroHome,
    JAVA_TOOL_OPTIONS: [
      sourceEnv.JAVA_TOOL_OPTIONS,
      `-Duser.home=${maestroHome}`,
    ].filter(Boolean).join(' '),
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
  };
}

function flowSlug(flow) {
  return flow
    .replace(/^maestro\//, '')
    .replace(/\.yml$/, '')
    .replace(/[\\/]/g, '-');
}

function buildMaestroFlowEnvArgs(flow, env = process.env) {
  return (MAESTRO_FLOW_ENV_KEYS[flow] ?? [])
    .filter((key) => env[key])
    .flatMap((key) => ['-e', `${key}=${env[key]}`]);
}

function buildMaestroFlowSourceEnv(flow, env = process.env, now = Date.now) {
  const sourceEnv = { ...env };
  if (flow === 'maestro/release-auth-offline-sync.yml' && !sourceEnv.QA_SYNC_SENTINEL) {
    sourceEnv.QA_SYNC_SENTINEL = `Release authenticated offline sync ${now()}`;
  }
  return sourceEnv;
}

async function runFlowOnDevice({ deviceId, flow, retries, installDriverFirstRun, suiteName }) {
  const { command, baseArgs } = resolveMaestroInvocation();
  const outputRoot = path.resolve(ROOT, 'maestro-results', 'android', suiteName, deviceId, flowSlug(flow));
  const sourceEnv = buildMaestroFlowSourceEnv(flow);
  const flowEnvArgs = buildMaestroFlowEnvArgs(flow, sourceEnv);
  const redactions = buildMaestroFlowRedactions(flow, sourceEnv);
  fs.mkdirSync(outputRoot, { recursive: true });

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const args = [
      ...baseArgs,
      'test',
      ...flowEnvArgs,
      flow,
      '--device',
      deviceId,
      '--format',
      'NOOP',
      '--test-output-dir',
      outputRoot,
      '--debug-output',
      outputRoot,
      '--flatten-debug-output',
    ];

    if (!installDriverFirstRun) {
      args.push('--no-reinstall-driver');
    }

    console.log(`[${deviceId}] ${flow} (attempt ${attempt}/${retries + 1})`);
    const result = await runCommand(command, args, {
      env: buildMaestroEnv(sourceEnv),
      redactions,
    });
    const artifactReport = sanitizeMaestroArtifacts(outputRoot, redactions);
    if (artifactReport.screenshotsRemoved > 0) {
      console.log(
        `[${deviceId}] removed ${artifactReport.screenshotsRemoved} screenshot artifact(s) from credential-bearing flow ${flow}`
      );
    }
    if (result.ok) {
      return { flow, ok: true, attempts: attempt };
    }

    if (attempt <= retries) {
      console.log(`[${deviceId}] retrying ${flow}`);
    }
  }

  return { flow, ok: false, attempts: retries + 1 };
}

async function runWorker(deviceId, flows, retries, suiteName) {
  const results = [];
  let installDriverFirstRun = true;

  for (let index = 0; index < flows.length; index += 1) {
    const flow = flows[index];
    const result = await runFlowOnDevice({
      deviceId,
      flow,
      retries,
      installDriverFirstRun,
      suiteName,
    });
    results.push(result);
    installDriverFirstRun = false;

    if (!result.ok) {
      console.error(`[${deviceId}] failed: ${flow}`);
      const nextFlow = flows[index + 1];
      if (shouldBlockNextSensitiveFlow(result, nextFlow)) {
        console.error(
          `[${deviceId}] refusing sensitive flow ${nextFlow}: prerequisite ${flow} failed.`
        );
        break;
      }
    }
  }

  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const flows = resolveFlows(options);
  assertSensitiveFlowAuthorization(flows, options);
  assertReleaseSuiteDoesNotStartMetro(options);
  assertVoiceFlowAuthorization(flows, options);
  const voiceFlowSelected = flows.includes(VOICE_ANALYSIS_FLOW);
  if (voiceFlowSelected) {
    invalidateVoiceAnalysisEvidence(ROOT);
  }

  if (options.startMetro) {
    ensureMockEnv(options.envFile);
    const portReady = await isPortOpen(options.metroPort);
    if (portReady && options.restartMetro) {
      console.log(`Restarting Metro on port ${options.metroPort}...`);
      stopMetro(options.metroPort);
      await sleep(2000);
      startMetroDetached();
    } else if (!portReady) {
      console.log(`Starting Metro on port ${options.metroPort}...`);
      startMetroDetached();
    } else {
      console.log(`Metro already listening on port ${options.metroPort}`);
    }

    const ready = await waitForPort(options.metroPort, options.metroTimeoutMs);
    if (!ready) {
      throw new Error(`Metro did not start on port ${options.metroPort} within ${options.metroTimeoutMs}ms`);
    }
  }

  const devices = selectDevices(listAndroidDevices(), options.devices);
  if (!devices.length) {
    throw new Error('No Android device detected. Start an emulator or connect a device.');
  }

  const workerCount = resolveWorkerCount(options.parallel, devices.length, flows.length);
  const workerQueues = assignFlowsToWorkers(flows, workerCount);
  const selectedDevices = devices.slice(0, workerCount);
  let expectedReleaseBuild = null;
  if (options.suite?.startsWith('release')) {
    expectedReleaseBuild = readExpectedAndroidBuild();
    selectedDevices.forEach((deviceId) =>
      verifyInstalledReleaseBinary(deviceId, expectedReleaseBuild)
    );
  }
  selectedDevices.forEach((deviceId) => configureAndroidInput(deviceId));

  console.log(`Running suite "${options.suite}" on ${workerCount} Android worker(s)`);
  selectedDevices.forEach((deviceId, index) => {
    console.log(`  worker ${index + 1}: ${deviceId} -> ${workerQueues[index].join(', ')}`);
  });

  const results = await Promise.all(
    selectedDevices.map((deviceId, index) => runWorker(deviceId, workerQueues[index], options.retries, options.suite))
  );

  const flatResults = results.flat();
  const failed = flatResults.filter((result) => !result.ok);

  console.log('');
  flatResults.forEach((result) => {
    const status = result.ok ? 'PASS' : 'FAIL';
    console.log(`${status} ${result.flow} (${result.attempts} attempt${result.attempts > 1 ? 's' : ''})`);
  });

  if (failed.length) {
    process.exitCode = 1;
    return;
  }

  if (voiceFlowSelected) {
    writeVoiceAnalysisEvidence({
      rootDir: ROOT,
      buildIdentity: expectedReleaseBuild,
      targetKind: /^emulator-\d+$/.test(selectedDevices[0]) ? 'emulator' : 'physical',
    });
    console.log('[voice-evidence] Qualifying runtime receipt written for the current Release candidate.');
  }

  console.log(`All ${flatResults.length} Maestro flow(s) passed.`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = {
  assertInstalledReleaseBinary,
  assertReleaseSuiteDoesNotStartMetro,
  assertVoiceFlowAuthorization,
  assertSensitiveFlowAuthorization,
  buildMaestroEnv,
  buildMaestroFlowEnvArgs,
  buildMaestroFlowRedactions,
  buildMaestroFlowSourceEnv,
  createRedactingWriter,
  decodeExactRegexLiteral,
  getSensitiveFlowGuardToken,
  isSensitiveFlow,
  normalizeFlow,
  parseArgs,
  parseInstalledAndroidBuild,
  readExpectedAndroidBuild,
  redactSensitiveText,
  runCommand,
  sanitizeMaestroArtifacts,
  SENSITIVE_FLOW_GUARD_ENV,
  shouldBlockNextSensitiveFlow,
  TESTSTORE_READINESS_FLOW,
  verifyInstalledReleaseBinary,
};
