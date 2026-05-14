#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { resolveCommand } = require('./android-tooling');

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

function parseAdbMdnsServices(output) {
  return String(output || '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [instance, service, address] = line.split(/\s+/);
      return { instance, service, address };
    })
    .filter((service) => service.instance && service.service);
}

function buildAdbMdnsCommands(services) {
  return services
    .filter((service) => service.address)
    .map((service) => {
      if (service.service === '_adb-tls-pairing._tcp.') {
        return `adb pair ${service.address} <pair-code>`;
      }
      if (service.service === '_adb-tls-connect._tcp.') {
        return `adb connect ${service.address}`;
      }
      return null;
    })
    .filter(Boolean);
}

function isLikelyEmulatorMdnsService(service) {
  const instance = String(service?.instance || '');
  const address = String(service?.address || '');
  return /^adb-EMULATOR/i.test(instance) || /^10\.0\.2\.\d+:/i.test(address);
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
    message: 'No device is visible to adb.',
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
  const idVendorMatch = output.match(/"idVendor"\s=\s(\d+)/);
  const idProductMatch = output.match(/"idProduct"\s=\s(\d+)/);
  const signatureMatch = output.match(/"UsbDeviceSignature"\s=\s<([^>]+)>/);
  const usbSignature = signatureMatch?.[1] || '';
  const adbLikeInterface = /ff4201/i.test(usbSignature);
  const parts = [];
  if (productMatch) parts.push(productMatch[1]);
  if (vendorMatch) parts.push(vendorMatch[1]);
  if (serialMatch) parts.push(`serial ${serialMatch[1]}`);
  if (idVendorMatch) parts.push(`idVendor ${idVendorMatch[1]}`);
  if (idProductMatch) parts.push(`idProduct ${idProductMatch[1]}`);
  if (adbLikeInterface) parts.push('Android debug interface signature present');

  return {
    supported: true,
    visible,
    adbLikeInterface,
    idVendor: idVendorMatch?.[1] || null,
    idProduct: idProductMatch?.[1] || null,
    serial: serialMatch?.[1] || null,
    message: visible
      ? `macOS USB sees ${parts.join(', ') || 'an Android-like device'}.`
      : 'macOS USB does not show an Android-like device.',
  };
}

function detectAdbMdnsServices(spawn = spawnSync, adbCommand = 'adb') {
  const result = spawn(adbCommand, ['mdns', 'services'], {
    encoding: 'utf8',
    timeout: 8000,
  });
  if (result.status !== 0) {
    return {
      supported: true,
      services: [],
      message: (result.stderr || result.stdout || 'Unable to inspect ADB mDNS services.').trim(),
    };
  }
  const services = parseAdbMdnsServices(result.stdout);
  const emulatorServices = services.filter(isLikelyEmulatorMdnsService);
  const phoneServices = services.filter((service) => !isLikelyEmulatorMdnsService(service));
  const commands = buildAdbMdnsCommands(phoneServices);
  const pairServices = phoneServices.filter((service) => service.service === '_adb-tls-pairing._tcp.');
  const connectServices = phoneServices.filter((service) => service.service === '_adb-tls-connect._tcp.');
  const parts = [];
  if (pairServices.length > 0) parts.push(`${pairServices.length} pairing service(s)`);
  if (connectServices.length > 0) parts.push(`${connectServices.length} connect service(s)`);
  if (phoneServices.length > 0 && parts.length === 0) parts.push(`${phoneServices.length} non-pairing service(s)`);
  if (emulatorServices.length > 0) parts.push(`${emulatorServices.length} emulator service(s) ignored`);
  return {
    supported: true,
    services,
    phoneServices,
    emulatorServices,
    commands,
    visible: phoneServices.length > 0,
    message:
      phoneServices.length > 0
        ? `ADB mDNS sees ${parts.join(', ') || `${services.length} service(s)`}.`
        : emulatorServices.length > 0
          ? `ADB mDNS only sees ${emulatorServices.length} emulator service(s), which cannot satisfy Play QA.`
        : 'ADB mDNS does not show wireless debugging services.',
    next:
      commands.length > 0
        ? 'Use adb pair <host>:<pair-port> <pair-code>, then adb connect <host>:<connect-port>.'
        : phoneServices.length > 0
          ? 'On the phone, enable Developer options -> Wireless debugging, keep the pairing screen open, then retry.'
          : 'Connect a physical Android phone over USB or enable Wireless debugging on the phone; emulator mDNS services are ignored for Play QA.',
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
      mdns: {
        supported: false,
        services: [],
        message: 'ADB mDNS inspection requires adb.',
      },
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
  const mdns = detectAdbMdnsServices(spawn, adbCommand);

  return {
    ok: adb.status === 'ready',
    requirePhysical,
    adbCommand,
    devices,
    adb,
    usb,
    mdns,
  };
}

function formatReport(report) {
  const lines = ['[android-device] Android device diagnostic'];
  if (report.requirePhysical) {
    lines.push('[android-device] Mode: physical device required');
  }
  lines.push(`[android-device] adb: ${report.adbCommand || 'not found'}`);
  const adbLabel = ['missing-adb', 'adb-error'].includes(report.adb.status) ? 'ADB' : 'ADB DEVICE';
  lines.push(`[android-device] ${adbLabel}: ${report.adb.status.toUpperCase()} - ${report.adb.message}`);
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
    if (report.adb.status === 'missing' && report.usb.adbLikeInterface) {
      lines.push(
        '  Next: The Android debug USB interface is present, but adb has no authorized transport yet. Unlock the phone, accept or recreate the USB debugging RSA authorization, or use Wireless debugging.'
      );
    }
  } else {
    lines.push(`[android-device] USB: SKIPPED - ${report.usb.message}`);
  }
  if (report.mdns.supported) {
    lines.push(
      `[android-device] WIRELESS: ${report.mdns.visible ? 'VISIBLE' : 'NOT VISIBLE'} - ${report.mdns.message}`
    );
    if (report.mdns.next) lines.push(`  Next: ${report.mdns.next}`);
    for (const service of report.mdns.phoneServices || report.mdns.services) {
      lines.push(`[android-device] Wireless ${service.service}: ${service.address || service.instance}`);
    }
    for (const service of report.mdns.emulatorServices || []) {
      lines.push(`[android-device] Wireless emulator ignored ${service.service}: ${service.address || service.instance}`);
    }
    for (const command of report.mdns.commands || []) {
      lines.push(`[android-device] Wireless command: ${command}`);
    }
  } else {
    lines.push(`[android-device] WIRELESS: SKIPPED - ${report.mdns.message}`);
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
  buildAdbMdnsCommands,
  checkAndroidAdbDevice,
  detectAdbMdnsServices,
  detectUsbAndroidDevice,
  formatReport,
  isLikelyEmulatorMdnsService,
  isLikelyEmulator,
  parseAdbDevices,
  parseAdbMdnsServices,
  summarizePhysicalDeviceState,
  summarizeAdbState,
};
