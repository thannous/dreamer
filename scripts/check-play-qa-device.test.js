const {
  checkPlayQaDevice,
  formatReport,
  getReadyPhysicalDevices,
  selectPhysicalDevice,
} = require('./check-play-qa-device');

function spawnFor({ adbDevicesStdout, dumpsysStdout, dumpsysStatus = 0, whichAdb = true } = {}) {
  return (command, args) => {
    if (command === 'which' && args[0] === 'adb') {
      return { status: whichAdb ? 0 : 1, stdout: whichAdb ? '/usr/bin/adb\n' : '', stderr: '' };
    }
    if (command === 'adb' && args[0] === 'devices') {
      return { status: 0, stdout: adbDevicesStdout || 'List of devices attached\n', stderr: '' };
    }
    if (command === 'adb' && args.includes('dumpsys')) {
      return {
        status: dumpsysStatus,
        stdout: dumpsysStdout || '',
        stderr: dumpsysStatus === 0 ? '' : 'dumpsys failed',
      };
    }
    return { status: 1, stdout: '', stderr: '' };
  };
}

describe('Play RevenueCat QA device preflight', () => {
  it('filters ready physical devices from emulators', () => {
    expect(
      getReadyPhysicalDevices([
        { id: 'emulator-5554', state: 'device', details: 'product:sdk_gphone64_arm64' },
        { id: '57275d36', state: 'device', details: 'product:poco model:POCO_F8' },
      ])
    ).toEqual([{ id: '57275d36', state: 'device', details: 'product:poco model:POCO_F8' }]);
  });

  it('requires an explicit device when multiple physical devices are ready', () => {
    const selection = selectPhysicalDevice({
      devices: [
        { id: '57275d36', state: 'device', details: 'product:poco' },
        { id: 'ABC123', state: 'device', details: 'product:honor' },
      ],
    });

    expect(selection.ok).toBe(false);
    expect(selection.next).toContain('--device <adb-id>');
  });

  it('passes when a physical device has a Play-installed package', () => {
    const report = checkPlayQaDevice({
      spawn: spawnFor({
        adbDevicesStdout: 'List of devices attached\n57275d36\tdevice product:poco model:POCO_F8\n',
        dumpsysStdout: `
          Package [com.tanuki75.noctalia] (abc):
            versionCode=24 minSdk=33 targetSdk=36
            versionName=1.2.0
            installerPackageName=com.android.vending
        `,
      }),
      platform: 'linux',
    });

    expect(report.ok).toBe(true);
    expect(report.selectedDevice).toBe('57275d36');
    expect(report.playInstallSource.installerPackageName).toBe('com.android.vending');
    expect(report.evidenceArgs).toBe('--device-id 57275d36 --installer-package-name com.android.vending');
    expect(formatReport(report)).toContain(
      '[play-qa-device] evidenceArgs: --device-id 57275d36 --installer-package-name com.android.vending'
    );
  });

  it('fails when only an emulator is ready', () => {
    const report = checkPlayQaDevice({
      spawn: spawnFor({
        adbDevicesStdout: 'List of devices attached\nemulator-5554\tdevice product:sdk_gphone64_arm64\n',
      }),
      platform: 'linux',
    });

    expect(report.ok).toBe(false);
    expect(report.message).toContain('No ready physical Android device');
  });

  it('fails when the app is sideloaded on the physical device', () => {
    const report = checkPlayQaDevice({
      spawn: spawnFor({
        adbDevicesStdout: 'List of devices attached\n57275d36\tdevice product:poco model:POCO_F8\n',
        dumpsysStdout: `
          Package [com.tanuki75.noctalia] (abc):
            versionCode=24 minSdk=33 targetSdk=36
            versionName=1.2.0
            installerPackageName=null
            initiatingPackageName=com.android.shell
        `,
      }),
      platform: 'linux',
    });

    expect(report.ok).toBe(false);
    expect(report.playInstallSource.message).toContain('installerPackageName=null');
  });
});
