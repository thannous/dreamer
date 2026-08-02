#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { resolveCommand } = require('./android-tooling');
const { parseAdbDevices } = require('./check-android-adb-device');

const DEFAULT_PACKAGE = 'com.tanuki75.noctalia';
const DEFAULT_ACTIVITY = '.MainActivity';
const MODES = new Set(['cold', 'warm', 'resume', 'all']);
const FATAL_PATTERN = /FATAL EXCEPTION|ANR in|AndroidRuntime: FATAL|SIG(?:SEGV|ABRT)|OutOfMemoryError/i;
const DEV_TRANSPORT_PATTERN = /Development Build|expo-dev-launcher|https?:\/\/[^\s]+:8081|tcp:8081|Metro waiting|Connecting to Metro/i;

function parseArgs(argv) {
  const options = {
    activity: DEFAULT_ACTIVITY,
    apk: null,
    device: null,
    mode: 'cold',
    output: null,
    packageName: DEFAULT_PACKAGE,
    runs: 5,
    settleMs: 1000,
    timeoutMs: 8000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    if (arg === '--device') options.device = value;
    else if (arg === '--apk') options.apk = path.resolve(value);
    else if (arg === '--package') options.packageName = value;
    else if (arg === '--activity') options.activity = value;
    else if (arg === '--mode') options.mode = value;
    else if (arg === '--output') options.output = path.resolve(value);
    else if (arg === '--runs') options.runs = parsePositiveInteger(value, '--runs');
    else if (arg === '--settle-ms') options.settleMs = parseNonNegativeInteger(value, '--settle-ms');
    else if (arg === '--timeout-ms') options.timeoutMs = parsePositiveInteger(value, '--timeout-ms');
    else throw new Error(`Unknown argument: ${arg}`);
    index += 1;
  }

  if (!MODES.has(options.mode)) {
    throw new Error(`Unsupported --mode ${options.mode}. Expected cold, warm, resume, or all.`);
  }
  return options;
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function parseNumber(output, pattern) {
  const match = String(output || '').match(pattern);
  return match ? Number(match[1]) : null;
}

function parseLaunch(output) {
  return {
    activity: String(output || '').match(/^Activity:\s+(.+)$/m)?.[1]?.trim() ?? null,
    launchState: String(output || '').match(/^LaunchState:\s+(.+)$/m)?.[1]?.trim() ?? null,
    status: String(output || '').match(/^Status:\s+(.+)$/m)?.[1]?.trim() ?? null,
    totalTimeMs: parseNumber(output, /^TotalTime:\s+(\d+)$/m),
    waitTimeMs: parseNumber(output, /^WaitTime:\s+(\d+)$/m),
  };
}

function parseMarkers(output) {
  const values = {};
  const markerPattern = /\[NoctaliaPerf\] name=startup\.([a-z_]+) elapsed_ms=([0-9.]+)/g;
  for (const match of String(output || '').matchAll(markerPattern)) {
    values[match[1]] = Number(match[2]);
  }
  const delta = (start, end) =>
    Number.isFinite(values[start]) && Number.isFinite(values[end])
      ? Number((values[end] - values[start]).toFixed(1))
      : null;
  return {
    values,
    rootToInteractiveMs: delta('root_mounted', 'interactive'),
    rootToNavigationMs: delta('root_mounted', 'navigation_replace'),
    navigationToRouteMs: delta('navigation_replace', 'route_committed'),
    routeToInteractiveMs: delta('route_committed', 'interactive'),
  };
}

function parseGfxinfo(output) {
  return {
    deadlineMisses: parseNumber(output, /Number Frame deadline missed:\s+(\d+)/),
    frames: parseNumber(output, /Total frames rendered:\s+(\d+)/),
    jankyFrames: parseNumber(output, /Janky frames:\s+(\d+)/),
    jankyPercent: parseNumber(output, /Janky frames:\s+\d+\s+\(([0-9.]+)%\)/),
    p50Ms: parseNumber(output, /50th percentile:\s+(\d+)ms/),
    p90Ms: parseNumber(output, /90th percentile:\s+(\d+)ms/),
    p95Ms: parseNumber(output, /95th percentile:\s+(\d+)ms/),
    p99Ms: parseNumber(output, /99th percentile:\s+(\d+)ms/),
  };
}

function parseMeminfo(output) {
  const summary = String(output || '').split('App Summary')[1] || output;
  return {
    graphicsKb: parseNumber(summary, /Graphics:\s+(\d+)/),
    javaHeapKb: parseNumber(summary, /Java Heap:\s+(\d+)/),
    nativeHeapKb: parseNumber(summary, /Native Heap:\s+(\d+)/),
    totalPssKb: parseNumber(summary, /TOTAL PSS:\s+(\d+)/),
    totalRssKb: parseNumber(summary, /TOTAL RSS:\s+(\d+)/),
  };
}

function parseDeviceReadiness(powerOutput, windowPolicyOutput) {
  const wakefulness = String(powerOutput || '').match(/mWakefulness=([^\s]+)/)?.[1] ?? null;
  const keyguardSection = String(windowPolicyOutput || '').match(
    /KeyguardServiceDelegate[\s\S]{0,800}/
  )?.[0] ?? String(windowPolicyOutput || '');
  const keyguardShowing = keyguardSection.match(/\bshowing=(true|false)/)?.[1] === 'true';
  const keyguardOccluded = keyguardSection.match(/\boccluded=(true|false)/)?.[1] === 'true';
  return {
    keyguardOccluded,
    keyguardShowing,
    ready: wakefulness === 'Awake' && (!keyguardShowing || keyguardOccluded),
    wakefulness,
  };
}

function getRunFailureReasons(run) {
  const reasons = [];
  if (run.fatalError) reasons.push('fatal_error');
  if (run.devTransportDetected) reasons.push('development_transport');
  if (!run.activityResumed) reasons.push('activity_not_resumed');
  if (run.launch.status !== 'ok') reasons.push('launch_status_not_ok');
  if (run.launch.totalTimeMs === null) reasons.push('missing_am_total_time');
  if (run.mode === 'cold' && run.markers.rootToInteractiveMs === null) {
    reasons.push('missing_cold_interactive_marker');
  }
  return reasons;
}

function percentile(values, percentileValue) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarizeRuns(runs) {
  const field = (selector) => runs.map(selector).filter(Number.isFinite);
  return {
    count: runs.length,
    amTotalMs: {
      median: percentile(field((run) => run.launch.totalTimeMs), 50),
      p95: percentile(field((run) => run.launch.totalTimeMs), 95),
    },
    rootToInteractiveMs: {
      median: percentile(field((run) => run.markers.rootToInteractiveMs), 50),
      p95: percentile(field((run) => run.markers.rootToInteractiveMs), 95),
    },
    frameP95Ms: { median: percentile(field((run) => run.gfxinfo.p95Ms), 50) },
    frameP99Ms: { median: percentile(field((run) => run.gfxinfo.p99Ms), 50) },
    jankyPercent: { median: percentile(field((run) => run.gfxinfo.jankyPercent), 50) },
    deadlineMisses: { median: percentile(field((run) => run.gfxinfo.deadlineMisses), 50) },
    totalPssKb: { median: percentile(field((run) => run.meminfo.totalPssKb), 50) },
    nativeHeapKb: { median: percentile(field((run) => run.meminfo.nativeHeapKb), 50) },
    graphicsKb: { median: percentile(field((run) => run.meminfo.graphicsKb), 50) },
    fatalRuns: runs.filter((run) => run.fatalError).length,
    devTransportRuns: runs.filter((run) => run.devTransportDetected).length,
  };
}

function sleep(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function createAdb(adbCommand, serial, env = process.env) {
  return (args, { allowFailure = false } = {}) => {
    const result = spawnSync(adbCommand, ['-s', serial, ...args], {
      encoding: 'utf8',
      env,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (!allowFailure && (result.error || result.status !== 0)) {
      const detail = result.error?.message || result.stderr?.trim() || result.stdout?.trim();
      throw new Error(`adb ${args.join(' ')} failed: ${detail || `exit ${result.status}`}`);
    }
    return {
      status: result.status,
      stderr: String(result.stderr || ''),
      stdout: String(result.stdout || ''),
    };
  };
}

function resolveDevice(adbCommand, requestedDevice, env = process.env) {
  if (requestedDevice) return requestedDevice;
  const result = spawnSync(adbCommand, ['devices', '-l'], { encoding: 'utf8', env });
  if (result.error || result.status !== 0) {
    throw new Error(`Unable to list adb devices: ${result.error?.message || result.stderr}`);
  }
  const ready = parseAdbDevices(result.stdout).filter((device) => device.state === 'device');
  if (ready.length !== 1) {
    throw new Error(`Expected exactly one ready adb device, found ${ready.length}. Pass --device.`);
  }
  return ready[0].id;
}

function getDefaultOutputDirectory() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(os.tmpdir(), `noctalia-android-performance-${timestamp}`);
}

function writeArtifact(directory, filename, contents) {
  fs.writeFileSync(path.join(directory, filename), String(contents || ''));
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function waitForInteractive(adb, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let logcat = '';
  while (Date.now() < deadline) {
    logcat = adb(['logcat', '-d', '-v', 'epoch']).stdout;
    if (/\[NoctaliaPerf\] name=startup\.interactive/.test(logcat)) return logcat;
    sleep(200);
  }
  return logcat || adb(['logcat', '-d', '-v', 'epoch']).stdout;
}

function assertReleasePreflight(adb, packageName, apkPath, outputDirectory) {
  const packagePath = adb(['shell', 'pm', 'path', packageName]).stdout.trim();
  if (!packagePath.startsWith('package:')) {
    throw new Error(`${packageName} is not installed.`);
  }
  const runAs = adb(['shell', 'run-as', packageName, 'id'], { allowFailure: true });
  if (runAs.status === 0) {
    throw new Error(`${packageName} is debuggable; install a non-debuggable Release.`);
  }

  const reverse = adb(['reverse', '--list'], { allowFailure: true }).stdout;
  if (/tcp:8081/.test(reverse)) {
    adb(['reverse', '--remove', 'tcp:8081'], { allowFailure: true });
  }
  const reverseAfter = adb(['reverse', '--list'], { allowFailure: true }).stdout;
  if (/tcp:8081/.test(reverseAfter)) {
    throw new Error('Metro adb reverse tcp:8081 is still active.');
  }
  const packageDump = adb(['shell', 'dumpsys', 'package', packageName]).stdout;
  const artifact = apkPath ? (() => {
    if (!fs.existsSync(apkPath)) throw new Error(`APK not found: ${apkPath}`);
    const installedApkPath = path.join(outputDirectory, 'installed-base.apk');
    const remoteApkPath = packagePath.replace(/^package:/, '');
    adb(['pull', remoteApkPath, installedApkPath]);
    const expectedSha256 = sha256(apkPath);
    const installedSha256 = sha256(installedApkPath);
    if (expectedSha256 !== installedSha256) {
      throw new Error(`Installed APK SHA-256 ${installedSha256} does not match ${expectedSha256}.`);
    }
    return { expectedPath: apkPath, expectedSha256, installedSha256 };
  })() : null;
  return {
    artifact,
    packagePath,
    reverse: reverseAfter.trim(),
    runAsError: runAs.stderr.trim(),
    targetSdk: parseNumber(packageDump, /targetSdk=(\d+)/),
    versionCode: parseNumber(packageDump, /versionCode=(\d+)/),
    versionName: packageDump.match(/versionName=([^\s]+)/)?.[1] ?? null,
  };
}

function assertDeviceReady(adb) {
  adb(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], { allowFailure: true });
  adb(['shell', 'wm', 'dismiss-keyguard'], { allowFailure: true });
  adb(['shell', 'cmd', 'statusbar', 'collapse'], { allowFailure: true });
  sleep(250);
  const readiness = parseDeviceReadiness(
    adb(['shell', 'dumpsys', 'power']).stdout,
    adb(['shell', 'dumpsys', 'window', 'policy']).stdout
  );
  if (!readiness.ready) {
    throw new Error(
      `Device is not ready (wakefulness=${readiness.wakefulness ?? 'unknown'}, keyguardShowing=${readiness.keyguardShowing}). Unlock it and leave the screen on.`
    );
  }
  return readiness;
}

function bootstrapBackgroundRun(adb, component, packageName, backgroundMs) {
  adb(['shell', 'am', 'force-stop', packageName]);
  adb(['shell', 'am', 'start', '-W', '-n', component]);
  sleep(1000);
  adb(['shell', 'input', 'keyevent', 'KEYCODE_HOME']);
  sleep(backgroundMs);
}

function measureRun({ adb, activity, mode, outputDirectory, packageName, runNumber, settleMs, timeoutMs }) {
  const component = `${packageName}/${activity}`;
  if (mode === 'cold') {
    adb(['shell', 'am', 'force-stop', packageName]);
  } else {
    bootstrapBackgroundRun(adb, component, packageName, mode === 'resume' ? 5000 : 250);
  }

  adb(['shell', 'dumpsys', 'gfxinfo', packageName, 'reset'], { allowFailure: true });
  adb(['logcat', '-c']);
  const launchOutput = adb(['shell', 'am', 'start', '-W', '-n', component]).stdout;
  let logcat = mode === 'cold'
    ? waitForInteractive(adb, timeoutMs)
    : adb(['logcat', '-d', '-v', 'epoch']).stdout;
  sleep(settleMs);
  logcat = adb(['logcat', '-d', '-v', 'epoch']).stdout || logcat;

  const gfxinfo = adb(['shell', 'dumpsys', 'gfxinfo', packageName]).stdout;
  const framestats = adb(['shell', 'dumpsys', 'gfxinfo', packageName, 'framestats']).stdout;
  const meminfo = adb(['shell', 'dumpsys', 'meminfo', packageName]).stdout;
  const thermal = adb(['shell', 'dumpsys', 'thermalservice']).stdout;
  const battery = adb(['shell', 'dumpsys', 'battery']).stdout;
  const activityState = adb(['shell', 'dumpsys', 'activity', 'activities']).stdout;
  const prefix = `${mode}-${String(runNumber).padStart(2, '0')}`;

  writeArtifact(outputDirectory, `${prefix}-am-start.txt`, launchOutput);
  writeArtifact(outputDirectory, `${prefix}-logcat.txt`, logcat);
  writeArtifact(outputDirectory, `${prefix}-gfxinfo.txt`, gfxinfo);
  writeArtifact(outputDirectory, `${prefix}-framestats.txt`, framestats);
  writeArtifact(outputDirectory, `${prefix}-meminfo.txt`, meminfo);
  writeArtifact(outputDirectory, `${prefix}-thermal.txt`, thermal);
  writeArtifact(outputDirectory, `${prefix}-battery.txt`, battery);

  return {
    activityResumed: new RegExp(`topResumedActivity=.*${packageName.replace(/\./g, '\\.')}`).test(activityState),
    batteryLevel: parseNumber(battery, /^\s*level:\s+(\d+)$/m),
    batteryTemperatureDeciC: parseNumber(battery, /^\s*temperature:\s+(\d+)$/m),
    devTransportDetected: DEV_TRANSPORT_PATTERN.test(logcat),
    fatalError: FATAL_PATTERN.test(logcat),
    gfxinfo: parseGfxinfo(gfxinfo),
    launch: parseLaunch(launchOutput),
    markers: parseMarkers(logcat),
    meminfo: parseMeminfo(meminfo),
    mode,
    run: runNumber,
    thermalStatus: parseNumber(thermal, /Thermal Status:\s+(\d+)/),
  };
}

function toCsv(runs) {
  const headers = [
    'mode', 'run', 'am_total_ms', 'root_to_interactive_ms', 'frame_p95_ms',
    'frame_p99_ms', 'janky_percent', 'deadline_misses', 'pss_kb',
    'native_heap_kb', 'graphics_kb', 'thermal_status', 'fatal_error',
    'dev_transport_detected',
  ];
  const rows = runs.map((run) => [
    run.mode,
    run.run,
    run.launch.totalTimeMs,
    run.markers.rootToInteractiveMs,
    run.gfxinfo.p95Ms,
    run.gfxinfo.p99Ms,
    run.gfxinfo.jankyPercent,
    run.gfxinfo.deadlineMisses,
    run.meminfo.totalPssKb,
    run.meminfo.nativeHeapKb,
    run.meminfo.graphicsKb,
    run.thermalStatus,
    run.fatalError,
    run.devTransportDetected,
  ]);
  return [headers, ...rows].map((row) => row.map((value) => value ?? '').join(',')).join('\n') + '\n';
}

function printHelp() {
  process.stdout.write([
    'Measure Noctalia Android Release performance without clearing app data.',
    '',
    'Usage:',
    '  npm run android:perf:measure -- --device <serial> [--apk <release.apk>] [--mode cold|warm|resume|all] [--runs 15] [--output <dir>]',
    '',
    'The script refuses debuggable builds, removes tcp:8081 adb reverse, records raw artifacts, and writes report.json/report.csv.',
    'warm = task brought back after 250 ms in background; resume = task restored after 5 s in background.',
    '',
  ].join('\n'));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const adbCommand = process.env.ADB_BIN || resolveCommand('adb') || 'adb';
  const serial = resolveDevice(adbCommand, options.device);
  const adb = createAdb(adbCommand, serial);
  const outputDirectory = options.output || getDefaultOutputDirectory();
  fs.mkdirSync(outputDirectory, { recursive: true });
  const deviceReadiness = assertDeviceReady(adb);
  const preflight = assertReleasePreflight(
    adb,
    options.packageName,
    options.apk,
    outputDirectory
  );
  const modes = options.mode === 'all' ? ['cold', 'warm', 'resume'] : [options.mode];
  const runs = [];

  for (const mode of modes) {
    for (let runNumber = 1; runNumber <= options.runs; runNumber += 1) {
      const run = measureRun({
        adb,
        activity: options.activity,
        mode,
        outputDirectory,
        packageName: options.packageName,
        runNumber,
        settleMs: options.settleMs,
        timeoutMs: options.timeoutMs,
      });
      runs.push(run);
      process.stdout.write(
        `[android-perf] ${mode} ${runNumber}/${options.runs}: am=${run.launch.totalTimeMs ?? 'n/a'}ms interactive=${run.markers.rootToInteractiveMs ?? 'n/a'}ms pss=${run.meminfo.totalPssKb ?? 'n/a'}KB\n`
      );
    }
  }

  const report = {
    capturedAt: new Date().toISOString(),
    device: serial,
    packageName: options.packageName,
    preflight: { ...preflight, deviceReadiness },
    runs,
    summary: Object.fromEntries(modes.map((mode) => [
      mode,
      summarizeRuns(runs.filter((run) => run.mode === mode)),
    ])),
  };
  const failures = runs.flatMap((run) =>
    getRunFailureReasons(run).map((reason) => ({ mode: run.mode, run: run.run, reason }))
  );
  report.failures = failures;
  writeArtifact(outputDirectory, 'report.json', `${JSON.stringify(report, null, 2)}\n`);
  writeArtifact(outputDirectory, 'report.csv', toCsv(runs));
  process.stdout.write(`[android-perf] Artifacts: ${outputDirectory}\n`);

  if (failures.length > 0) {
    process.stderr.write(
      `[android-perf] Invalid runs: ${failures.map((failure) => `${failure.mode}-${failure.run}:${failure.reason}`).join(', ')}\n`
    );
    process.exitCode = 2;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[android-perf] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEV_TRANSPORT_PATTERN,
  FATAL_PATTERN,
  parseArgs,
  parseDeviceReadiness,
  parseGfxinfo,
  parseLaunch,
  parseMarkers,
  parseMeminfo,
  percentile,
  getRunFailureReasons,
  summarizeRuns,
  toCsv,
};
