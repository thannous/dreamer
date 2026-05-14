const {
  buildAdbMdnsCommands,
  checkAndroidAdbDevice,
  formatReport,
  isLikelyEmulatorMdnsService,
  isLikelyEmulator,
  parseAdbDevices,
  parseAdbMdnsServices,
  summarizePhysicalDeviceState,
  summarizeAdbState,
} = require('./check-android-adb-device');

function spawnFor({ adbStdout, mdnsStdout = 'List of discovered mdns services\n', usbStdout = '', adbStatus = 0, whichAdb = true } = {}) {
  return (command, args) => {
    if (command === 'which' && args[0] === 'adb') {
      return { status: whichAdb ? 0 : 1, stdout: whichAdb ? '/usr/bin/adb\n' : '', stderr: '' };
    }
    if (command === 'adb' && args[0] === 'devices') {
      return { status: adbStatus, stdout: adbStdout || '', stderr: adbStatus === 0 ? '' : 'adb failed' };
    }
    if (command === 'adb' && args[0] === 'mdns') {
      return { status: 0, stdout: mdnsStdout, stderr: '' };
    }
    if (command === 'ioreg') {
      return { status: 0, stdout: usbStdout, stderr: '' };
    }
    return { status: 1, stdout: '', stderr: '' };
  };
}

describe('android ADB device diagnostic', () => {
  it('parses adb devices with details', () => {
    expect(
      parseAdbDevices(
        'List of devices attached\n57275d36\tdevice product:poco model:POCO_F8 device:poco\n'
      )
    ).toEqual([
      {
        id: '57275d36',
        state: 'device',
        details: 'product:poco model:POCO_F8 device:poco',
      },
    ]);
  });

  it('parses adb mDNS wireless debugging services', () => {
    const services = parseAdbMdnsServices(
      'List of discovered mdns services\nadb-123._adb-tls-pairing._tcp.\t_adb-tls-pairing._tcp.\t192.168.1.24:37123\nadb-123._adb-tls-connect._tcp.\t_adb-tls-connect._tcp.\t192.168.1.24:41235\n'
    );

    expect(services).toEqual([
      {
        instance: 'adb-123._adb-tls-pairing._tcp.',
        service: '_adb-tls-pairing._tcp.',
        address: '192.168.1.24:37123',
      },
      {
        instance: 'adb-123._adb-tls-connect._tcp.',
        service: '_adb-tls-connect._tcp.',
        address: '192.168.1.24:41235',
      },
    ]);
    expect(buildAdbMdnsCommands(services)).toEqual([
      'adb pair 192.168.1.24:37123 <pair-code>',
      'adb connect 192.168.1.24:41235',
    ]);
  });

  it('treats ready devices as ok', () => {
    const report = checkAndroidAdbDevice({
      spawn: spawnFor({
        adbStdout: 'List of devices attached\n57275d36\tdevice product:poco\n',
        usbStdout: '"USB Product Name" = "POCO F8 Ultra"\n"USB Vendor Name" = "Xiaomi"\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(true);
    expect(report.adb.status).toBe('ready');
    expect(report.usb.visible).toBe(true);
  });

  it('explains unauthorized devices', () => {
    const summary = summarizeAdbState([{ id: '57275d36', state: 'unauthorized' }]);

    expect(summary.status).toBe('unauthorized');
    expect(summary.next).toContain('RSA');
  });

  it('detects likely emulators from adb id and sdk details', () => {
    expect(isLikelyEmulator({ id: 'emulator-5554', details: 'product:sdk_gphone64_arm64' })).toBe(true);
    expect(isLikelyEmulator({ id: '57275d36', details: 'product:poco model:POCO_F8' })).toBe(false);
  });

  it('can require a physical device for Play validation', () => {
    const summary = summarizePhysicalDeviceState([
      { id: 'emulator-5554', state: 'device', details: 'product:sdk_gphone64_arm64 model:sdk_gphone64_arm64' },
    ]);

    expect(summary.status).toBe('emulator-only');
    expect(summary.next).toContain('Play-compatible Android phone');
  });

  it('fails requirePhysical mode when only an emulator is ready', () => {
    const report = checkAndroidAdbDevice({
      spawn: spawnFor({
        adbStdout: 'List of devices attached\nemulator-5554\tdevice product:sdk_gphone64_arm64 model:sdk_gphone64_arm64\n',
      }),
      platform: 'darwin',
      requirePhysical: true,
    });

    expect(report.ok).toBe(false);
    expect(report.adb.status).toBe('emulator-only');
    expect(report.requirePhysical).toBe(true);
  });

  it('distinguishes USB-visible from ADB-missing on macOS', () => {
    const report = checkAndroidAdbDevice({
      spawn: spawnFor({
        adbStdout: 'List of devices attached\n',
        usbStdout: '"USB Product Name" = "POCO F8 Ultra"\n"USB Vendor Name" = "Xiaomi"\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(report.adb.status).toBe('missing');
    expect(report.usb.visible).toBe(true);
    expect(formatReport(report)).toContain('ADB DEVICE: MISSING - No device is visible to adb.');
    expect(formatReport(report)).not.toContain('ADB: MISSING');
  });

  it('keeps the ADB label when adb itself is unavailable', () => {
    const report = checkAndroidAdbDevice({
      spawn: spawnFor({ whichAdb: false }),
      env: { HOME: '/tmp/no-such-android-sdk-for-adb-test' },
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(report.adb.status).toBe('missing-adb');
    expect(formatReport(report)).toContain('adb: not found');
    expect(formatReport(report)).toContain('ADB: MISSING-ADB - adb is not available');
  });

  it('surfaces wireless debugging services when no USB device is connected', () => {
    const report = checkAndroidAdbDevice({
      spawn: spawnFor({
        adbStdout: 'List of devices attached\n',
        mdnsStdout:
          'List of discovered mdns services\nadb-123._adb-tls-pairing._tcp.\t_adb-tls-pairing._tcp.\t192.168.1.24:37123\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(report.mdns.services).toHaveLength(1);
    expect(report.mdns.commands).toEqual(['adb pair 192.168.1.24:37123 <pair-code>']);
    expect(report.mdns.message).toContain('pairing service');
    expect(report.mdns.next).toContain('adb pair');
    expect(formatReport(report)).toContain(
      '[android-device] Wireless command: adb pair 192.168.1.24:37123 <pair-code>'
    );
  });

  it('does not suggest adb pair for non-pairing mDNS services', () => {
    const report = checkAndroidAdbDevice({
      spawn: spawnFor({
        adbStdout: 'List of devices attached\n',
        mdnsStdout: 'List of discovered mdns services\nadb-123._adb._tcp.\t_adb._tcp.\t192.168.1.24:5555\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(report.mdns.services).toHaveLength(1);
    expect(report.mdns.commands).toEqual([]);
    expect(report.mdns.message).toContain('non-pairing service');
    expect(report.mdns.next).toContain('Wireless debugging');
    expect(report.mdns.next).not.toContain('adb pair');
  });

  it('ignores emulator mDNS services for physical Play validation', () => {
    const report = checkAndroidAdbDevice({
      spawn: spawnFor({
        adbStdout: 'List of devices attached\n',
        mdnsStdout:
          'List of discovered mdns services\nadb-EMULATOR36X5X11X0\t_adb._tcp\t10.0.2.16:5555\n',
      }),
      platform: 'darwin',
      requirePhysical: true,
    });

    expect(isLikelyEmulatorMdnsService(report.mdns.services[0])).toBe(true);
    expect(report.mdns.visible).toBe(false);
    expect(report.mdns.phoneServices).toHaveLength(0);
    expect(report.mdns.emulatorServices).toHaveLength(1);
    expect(report.mdns.message).toContain('only sees 1 emulator service');
    expect(formatReport(report)).toContain('WIRELESS: NOT VISIBLE');
    expect(formatReport(report)).toContain('Wireless emulator ignored _adb._tcp: 10.0.2.16:5555');
  });
});
