#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const {
  checkAndroidAdbDevice,
  isLikelyEmulator,
} = require('./check-android-adb-device');
const {
  checkPlayInstallSource,
  formatReport: formatPlayInstallSourceReport,
} = require('./check-play-install-source');

const DEFAULT_PACKAGE = 'com.tanuki75.noctalia';

function parseArgs(argv) {
  const options = {
    packageName: DEFAULT_PACKAGE,
    reportOnly: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--device') {
      options.device = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--package') {
      options.packageName = argv[i + 1] ?? options.packageName;
      i += 1;
      continue;
    }
    if (arg === '--report-only') {
      options.reportOnly = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node ./scripts/check-play-qa-device.js [--device <adb-id>] [--package <application-id>] [--report-only] [--json]

Checks the two preconditions for Play RevenueCat QA evidence:
1. a physical Android tester device is visible in ADB
2. the app on that device was installed by Google Play
`.trim());
}

function getReadyPhysicalDevices(devices) {
  return devices.filter((device) => device.state === 'device' && !isLikelyEmulator(device));
}

function selectPhysicalDevice(physicalReport, requestedDevice) {
  const physicalDevices = getReadyPhysicalDevices(physicalReport.devices || []);
  if (requestedDevice) {
    const selected = physicalDevices.find((device) => device.id === requestedDevice);
    if (selected) return { ok: true, device: selected };
    return {
      ok: false,
      message: `${requestedDevice} is not a ready physical Android device.`,
      next: 'Run npm run android:device:physical, then pass the physical ADB id with --device.',
    };
  }

  if (physicalDevices.length === 1) {
    return { ok: true, device: physicalDevices[0] };
  }
  if (physicalDevices.length > 1) {
    return {
      ok: false,
      message: `${physicalDevices.length} physical Android devices are ready; choose one explicitly.`,
      next: `Rerun with --device <adb-id>. Ready physical devices: ${physicalDevices
        .map((device) => device.id)
        .join(', ')}`,
    };
  }
  return {
    ok: false,
    message: 'No ready physical Android device is visible.',
    next: 'Connect a physical tester device, enable USB debugging, accept the RSA prompt, then retry.',
  };
}

function checkPlayQaDevice({
  spawn = spawnSync,
  env = process.env,
  platform = process.platform,
  device,
  packageName = DEFAULT_PACKAGE,
} = {}) {
  const physicalReport = checkAndroidAdbDevice({
    spawn,
    env,
    platform,
    requirePhysical: true,
  });
  const selection = selectPhysicalDevice(physicalReport, device);
  if (!physicalReport.ok || !selection.ok) {
    return {
      ok: false,
      packageName,
      selectedDevice: selection.device?.id || device || null,
      physical: physicalReport,
      playInstallSource: null,
      message: selection.message || physicalReport.adb?.message || 'Physical Android device check failed.',
      next: selection.next || physicalReport.adb?.next || 'Connect a physical Android device.',
    };
  }

  const playInstallSource = checkPlayInstallSource({
    spawn,
    env,
    device: selection.device.id,
    packageName,
  });

  return {
    ok: physicalReport.ok && playInstallSource.ok,
    packageName,
    selectedDevice: selection.device.id,
    physical: physicalReport,
    playInstallSource,
    message: playInstallSource.ok
      ? `${selection.device.id} is ready for Play RevenueCat QA.`
      : playInstallSource.message,
    next: playInstallSource.next,
  };
}

function formatReport(report) {
  const lines = ['[play-qa-device] Play RevenueCat device preflight'];
  lines.push(`[play-qa-device] package: ${report.packageName}`);
  lines.push(`[play-qa-device] selectedDevice: ${report.selectedDevice || 'missing'}`);
  lines.push(`[play-qa-device] physicalDevice: ${report.physical.ok ? 'PASS' : 'FAIL'} - ${report.physical.adb.message}`);
  if (report.playInstallSource) {
    lines.push(formatPlayInstallSourceReport(report.playInstallSource));
  }
  lines.push(`[play-qa-device] ${report.ok ? 'PASS' : 'FAIL'} - ${report.message}`);
  if (report.next) lines.push(`  Next: ${report.next}`);
  return lines.join('\n');
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = checkPlayQaDevice(options);
    process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
    if (!report.ok && !options.reportOnly) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkPlayQaDevice,
  formatReport,
  getReadyPhysicalDevices,
  parseArgs,
  selectPhysicalDevice,
};
