#!/usr/bin/env node
'use strict';
/* global __dirname */

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MAESTRO_BIN_WINDOWS = 'C:\\Users\\thann\\maestro\\maestro\\bin\\maestro.bat';
const DEFAULT_METRO_PORT = 8081;

const SUITES = {
  smoke: [
    'maestro/smoke.yml',
  ],
  core: [
    'maestro/smoke.yml',
    'maestro/recording-bottom-sheet.yml',
    'maestro/mock-existing-user.yml',
    'maestro/mock-existing-quotas.yml',
  ],
  mock: [
    'maestro/mock-existing-user.yml',
    'maestro/mock-existing-quotas.yml',
    'maestro/journal-badges-filters.yml',
    'maestro/journal-dream-cta-labels.yml',
    'maestro/edit-dream-metadata.yml',
    'maestro/inspiration-rituals.yml',
    'maestro/subscription-mock-paywall.yml',
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
    'maestro/recording-bottom-sheet.yml',
    'maestro/mock-existing-user.yml',
    'maestro/mock-existing-quotas.yml',
    'maestro/free-analysis-limit.yml',
    'maestro/guest-chat-limit.yml',
    'maestro/guest-dream-limit-signup.yml',
    'maestro/guest-exploration-limit.yml',
    'maestro/guest-quota-flow.yml',
    'maestro/inspiration-rituals.yml',
    'maestro/journal-badges-filters.yml',
    'maestro/journal-dream-cta-labels.yml',
    'maestro/edit-dream-metadata.yml',
    'maestro/subscription-mock-paywall.yml',
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
  console.log(`
Usage:
  node ./scripts/run-maestro-android.js [--suite <name>] [--parallel auto|<n>] [--retries <n>] [--device <id1,id2>] [--flow <path>]...

Examples:
  npm run test:e2e
  node ./scripts/run-maestro-android.js --suite quotas --parallel auto
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
  const relativeFlow = flow.replace(/\\/g, '/');
  const absoluteFlow = path.resolve(ROOT, relativeFlow);
  if (!fs.existsSync(absoluteFlow)) {
    throw new Error(`Missing Maestro flow: ${relativeFlow}`);
  }
  return relativeFlow;
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
  const adbBin = process.platform === 'win32' ? 'adb.exe' : 'adb';
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

  return { command: 'maestro', baseArgs: [] };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? ROOT,
      env: options.env ?? process.env,
      shell: options.shell ?? false,
      stdio: options.stdio ?? 'inherit',
    });

    child.on('exit', (code, signal) => {
      resolve({
        ok: code === 0,
        code,
        signal,
      });
    });

    child.on('error', (error) => {
      resolve({
        ok: false,
        code: null,
        signal: null,
        error,
      });
    });
  });
}

function flowSlug(flow) {
  return flow
    .replace(/^maestro\//, '')
    .replace(/\.yml$/, '')
    .replace(/[\\/]/g, '-');
}

async function runFlowOnDevice({ deviceId, flow, retries, installDriverFirstRun, suiteName }) {
  const { command, baseArgs } = resolveMaestroInvocation();
  const outputRoot = path.resolve(ROOT, 'maestro-results', 'android', suiteName, deviceId, flowSlug(flow));
  fs.mkdirSync(outputRoot, { recursive: true });

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const args = [
      ...baseArgs,
      'test',
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
    const result = await runCommand(command, args);
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

  for (const flow of flows) {
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
    }
  }

  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const flows = resolveFlows(options);

  ensureMockEnv(options.envFile);

  if (options.startMetro) {
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

  console.log(`All ${flatResults.length} Maestro flow(s) passed.`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
