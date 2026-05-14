#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { resolveCommand } = require('./check-android-release-gates');

function parseAdbDevices(output) {
  return String(output || '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, state, ...details] = line.split(/\s+/);
      return { id, state, details: details.join(' ') };
    })
    .filter((device) => device.id && device.state);
}

function summarizeAdbState(devices) {
  if (devices.some((device) => device.state === 'device')) {
    return {
      status: 'ready',
      message: `${devices.filter((device) => device.state === 'device').length} ADB device(s) ready.`,
    };
  }
  if (devices.some((device) => device.state === 'unauthorized')) {
    return {
      status: 'unauthorized',
      message: 'ADB sees the phone, but USB debugging has not been authorized on the phone.',
      next: 'Unlock the phone and accept the RSA fingerprint prompt.',
    };
  }
  if (devices.some((device) => device.state === 'offline')) {
    return {
      status: 'offline',
      message: 'ADB sees the phone, but it is offline.',
      next: 'Reconnect USB, then run adb kill-server && adb start-server.',
    };
  }
  return {
    status: 'missing',
    message: 'No ADB device is visible.',
    next: 'Enable USB debugging, use File transfer / Android Auto USB mode, and accept the RSA prompt.',
  };
}

function isLikelyEmulator(device) {
  const id = String(device?.id || '');
  const details = String(device?.details || '');
  return (
    /^emulator-\d+$/i.test(id) ||
    /\b(model|product|device):sdk_/i.test(details) ||
    /\b(model|product|device):.*emulator/i.test(details)
  );
}

function summarizePhysicalDeviceState(devices) {
  const readyDevices = devices.filter((device) => device.state === 'device');
  const physicalDevices = readyDevices.filter((device) => !isLikelyEmulator(device));
  if (physicalDevices.length > 0) {
    return {
      status: 'ready',
      message: `${physicalDevices.length} physical Android device(s) ready.`,
    };
  }
  if (readyDevices.length > 0) {
    return {
      status: 'emulator-only',
      message: `${readyDevices.length} ADB device(s) ready, but all visible ready devices look like emulators.`,
      next: 'Connect a Play-compatible Android phone, enable USB debugging, accept the RSA prompt, then install Noctalia from Play Internal Testing.',
    };
  }
  return summarizeAdbState(devices);
}

function detectUsbAndroidDevice(spawn = spawnSync, platform = process.platform) {
  if (platform !== 'darwin') {
    return {
      supported: false,
      visible: false,
      message: 'USB registry inspection is only implemented for macOS.',
    };
  }

  const result = spawn('ioreg', ['-p', 'IOUSB', '-l', '-w', '0'], {
    encoding: 'utf8',
    timeout: 8000,
  });
  if (result.status !== 0) {
    return {
      supported: true,
      visible: false,
      message: (result.stderr || result.stdout || 'Unable to inspect macOS USB registry.').trim(),
    };
  }

  const output = String(result.stdout || '');
  const visible = /\b(Android|Xiaomi|POCO|Pixel|Samsung|OnePlus|Motorola)\b/i.test(output);
  const productMatch = output.match(/"USB Product Name"\s=\s"([^"]+)"/);
  const vendorMatch = output.match(/"USB Vendor Name"\s=\s"([^"]+)"/);
  const serialMatch = output.match(/"USB Serial Number"\s=\s"([^"]+)"/);
  const parts = [];
  if (productMatch) parts.push(productMatch[1]);
  if (vendorMatch) parts.push(vendorMatch[1]);
  if (serialMatch) parts.push(`serial ${serialMatch[1]}`);

  return {
    supported: true,
    visible,
    message: visible
      ? `macOS USB sees ${parts.join(', ') || 'an Android-like device'}.`
      : 'macOS USB does not show an Android-like device.',
  };
}

function checkAndroidAdbDevice({
  spawn = spawnSync,
  env = process.env,
  platform = process.platform,
  requirePhysical = false,
} = {}) {
  const adbCommand = resolveCommand('adb', { spawn, env });
  if (!adbCommand) {
    return {
      ok: false,
      adbCommand: null,
      devices: [],
      adb: {
        status: 'missing-adb',
        message: 'adb is not available in PATH or common Android SDK locations.',
        next: 'Install Android SDK platform-tools or add adb to PATH.',
      },
      usb: detectUsbAndroidDevice(spawn, platform),
    };
  }

  const adbResult = spawn(adbCommand, ['devices', '-l'], {
    encoding: 'utf8',
    timeout: 8000,
  });
  const devices = adbResult.status === 0 ? parseAdbDevices(adbResult.stdout) : [];
  const adb = adbResult.status === 0
    ? requirePhysical
      ? summarizePhysicalDeviceState(devices)
      : summarizeAdbState(devices)
    : {
        status: 'adb-error',
        message: (adbResult.stderr || adbResult.stdout || 'Unable to list ADB devices.').trim(),
        next: 'Restart adb with adb kill-server && adb start-server.',
      };
  const usb = detectUsbAndroidDevice(spawn, platform);

  return {
    ok: adb.status === 'ready',
    requirePhysical,
    adbCommand,
    devices,
    adb,
    usb,
  };
}

function formatReport(report) {
  const lines = ['[android-device] Android device diagnostic'];
  if (report.requirePhysical) {
    lines.push('[android-device] Mode: physical device required');
  }
  lines.push(`[android-device] adb: ${report.adbCommand || 'not found'}`);
  lines.push(`[android-device] ADB: ${report.adb.status.toUpperCase()} - ${report.adb.message}`);
  if (report.adb.next) lines.push(`  Next: ${report.adb.next}`);
  if (report.devices.length > 0) {
    for (const device of report.devices) {
      lines.push(
        `[android-device] Device ${device.id}: ${device.state}${device.details ? ` ${device.details}` : ''}`
      );
    }
  }
  if (report.usb.supported) {
    lines.push(
      `[android-device] USB: ${report.usb.visible ? 'VISIBLE' : 'NOT VISIBLE'} - ${report.usb.message}`
    );
  } else {
    lines.push(`[android-device] USB: SKIPPED - ${report.usb.message}`);
  }
  return lines.join('\n');
}

function main() {
  const json = process.argv.includes('--json');
  const reportOnly = process.argv.includes('--report-only');
  const requirePhysical = process.argv.includes('--require-physical');
  const report = checkAndroidAdbDevice({ requirePhysical });
  process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
  if (!report.ok && !reportOnly) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkAndroidAdbDevice,
  detectUsbAndroidDevice,
  formatReport,
  isLikelyEmulator,
  parseAdbDevices,
  summarizePhysicalDeviceState,
  summarizeAdbState,
};
