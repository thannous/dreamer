const {
  checkAndroidAdbDevice,
  isLikelyEmulator,
  parseAdbDevices,
  summarizePhysicalDeviceState,
  summarizeAdbState,
} = require('./check-android-adb-device');

function spawnFor({ adbStdout, usbStdout = '', adbStatus = 0, whichAdb = true } = {}) {
  return (command, args) => {
    if (command === 'which' && args[0] === 'adb') {
      return { status: whichAdb ? 0 : 1, stdout: whichAdb ? '/usr/bin/adb\n' : '', stderr: '' };
    }
    if (command === 'adb' && args[0] === 'devices') {
      return { status: adbStatus, stdout: adbStdout || '', stderr: adbStatus === 0 ? '' : 'adb failed' };
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
  });
});
