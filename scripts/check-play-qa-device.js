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
    if (arg === '--expected-version-code') {
      options.expectedVersionCode = argv[i + 1];
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
  node ./scripts/check-play-qa-device.js [--device <adb-id>] [--package <application-id>] [--expected-version-code <code>] [--report-only] [--json]

Checks the two preconditions for Play RevenueCat QA evidence:
1. a physical Android tester device is visible in ADB
2. the app on that device was installed by Google Play
3. optionally, the installed versionCode matches the expected Play build

When both checks pass, the report prints evidenceArgs that can be copied into
npm run subscription:qa:evidence for play_* gates.
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
  if (physicalReport.usb?.supported && physicalReport.usb.visible) {
    return {
      ok: false,
      message: 'A physical Android phone is visible over USB, but no authorized ADB device is ready.',
      next: 'Unlock the phone, enable USB debugging, select File transfer / Android Auto USB mode, and accept the RSA fingerprint prompt. If no prompt appears, toggle USB debugging or revoke USB debugging authorizations, then reconnect.',
    };
  }
  return {
    ok: false,
    message: 'No ready physical Android device is visible.',
    next: 'Connect a physical tester device, enable USB debugging, accept the RSA prompt, then retry.',
  };
}

function buildPlayEvidenceCommands(evidenceArgs) {
  if (!evidenceArgs) return [];
  const base =
    'npm run subscription:qa:evidence -- --tester <tester-email> --app-user-id <revenuecat-app-user-uuid> --eas-build-id <eas-build-uuid>';
  return [
    `${base} --gate play_monthly ${evidenceArgs} --evidence "Play monthly purchase completed after installed from Play (com.android.vending), product noctalia_plus:monthly, base plan P1M confirmed, backend converged"`,
    `${base} --gate play_annual ${evidenceArgs} --evidence "Play annual purchase completed after installed from Play (com.android.vending), product noctalia_plus:annual, base plan P1Y confirmed, backend converged"`,
    `${base} --gate play_cancellation_and_expiry ${evidenceArgs} --evidence "Play cancellation or expiry observed after installed from Play (com.android.vending), RevenueCat webhook and backend state converged"`,
  ];
}

function checkPlayQaDevice({
  spawn = spawnSync,
  env = process.env,
  platform = process.platform,
  device,
  packageName = DEFAULT_PACKAGE,
  expectedVersionCode,
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
  const expectedVersionCodeText =
    expectedVersionCode === undefined || expectedVersionCode === null ? null : String(expectedVersionCode).trim();
  const versionCodeMatches =
    !expectedVersionCodeText || playInstallSource.versionCode === expectedVersionCodeText;
  const versionCodeMessage = expectedVersionCodeText
    ? versionCodeMatches
      ? `Installed versionCode ${playInstallSource.versionCode} matches expected ${expectedVersionCodeText}.`
      : `Installed versionCode ${playInstallSource.versionCode || 'missing'} does not match expected ${expectedVersionCodeText}.`
    : null;
  const playReady = playInstallSource.ok && versionCodeMatches;
  const evidenceArgs = playReady
    ? [
        `--device-id ${selection.device.id}`,
        `--installer-package-name ${playInstallSource.installerPackageName}`,
        `--version-code ${playInstallSource.versionCode}`,
      ].join(' ')
    : null;
  const evidenceCommands = buildPlayEvidenceCommands(evidenceArgs);

  return {
    ok: physicalReport.ok && playReady,
    packageName,
    selectedDevice: selection.device.id,
    expectedVersionCode: expectedVersionCodeText,
    physical: physicalReport,
    playInstallSource,
    versionCodeMatches,
    versionCodeMessage,
    evidenceArgs,
    evidenceCommands,
    message: playReady
      ? `${selection.device.id} is ready for Play RevenueCat QA.`
      : versionCodeMessage && !versionCodeMatches
        ? versionCodeMessage
        : playInstallSource.message,
    next:
      versionCodeMessage && !versionCodeMatches
        ? 'Open the Play Store listing and update or reinstall the Internal Testing build, then rerun this preflight.'
        : playInstallSource.next,
  };
}

function formatReport(report) {
  const lines = ['[play-qa-device] Play RevenueCat device preflight'];
  lines.push(`[play-qa-device] package: ${report.packageName}`);
  lines.push(`[play-qa-device] selectedDevice: ${report.selectedDevice || 'missing'}`);
  lines.push(`[play-qa-device] physicalDevice: ${report.physical.ok ? 'PASS' : 'FAIL'} - ${report.physical.adb.message}`);
  if (report.physical.usb?.supported) {
    lines.push(
      `[play-qa-device] usb: ${report.physical.usb.visible ? 'VISIBLE' : 'NOT VISIBLE'} - ${report.physical.usb.message}`
    );
  }
  if (report.physical.mdns?.supported) {
    lines.push(
      `[play-qa-device] wireless: ${report.physical.mdns.visible ? 'VISIBLE' : 'NOT VISIBLE'} - ${report.physical.mdns.message}`
    );
    for (const command of report.physical.mdns.commands || []) {
      lines.push(`[play-qa-device] wirelessCommand: ${command}`);
    }
  }
  if (report.playInstallSource) {
    lines.push(formatPlayInstallSourceReport(report.playInstallSource));
  }
  if (report.expectedVersionCode) {
    lines.push(
      `[play-qa-device] expectedVersionCode: ${report.expectedVersionCode} - ${
        report.versionCodeMatches ? 'PASS' : 'FAIL'
      } - ${report.versionCodeMessage}`
    );
  }
  if (report.evidenceArgs) {
    lines.push(`[play-qa-device] evidenceArgs: ${report.evidenceArgs}`);
  }
  if (report.evidenceCommands?.length > 0) {
    lines.push('[play-qa-device] evidenceCommands:');
    for (const command of report.evidenceCommands) {
      lines.push(`  ${command}`);
    }
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
  buildPlayEvidenceCommands,
  formatReport,
  getReadyPhysicalDevices,
  parseArgs,
  selectPhysicalDevice,
};
