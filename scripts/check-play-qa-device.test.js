const path = require('path');
const { spawnSync } = require('child_process');

const {
  buildPlayEvidenceCommands,
  checkPlayQaDevice,
  formatReport,
  getReadyPhysicalDevices,
  selectPhysicalDevice,
} = require('./check-play-qa-device');

const SCRIPT = path.join(__dirname, 'check-play-qa-device.js');

function spawnFor({
  adbDevicesStdout,
  dumpsysStdout,
  dumpsysStatus = 0,
  mdnsStdout = 'List of discovered mdns services\n',
  usbStdout = '',
  whichAdb = true,
} = {}) {
  return (command, args) => {
    if (command === 'which' && args[0] === 'adb') {
      return { status: whichAdb ? 0 : 1, stdout: whichAdb ? '/usr/bin/adb\n' : '', stderr: '' };
    }
    if (command === 'adb' && args[0] === 'devices') {
      return { status: 0, stdout: adbDevicesStdout || 'List of devices attached\n', stderr: '' };
    }
    if (command === 'adb' && args[0] === 'mdns') {
      return { status: 0, stdout: mdnsStdout, stderr: '' };
    }
    if (command === 'adb' && args.includes('dumpsys')) {
      return {
        status: dumpsysStatus,
        stdout: dumpsysStdout || '',
        stderr: dumpsysStatus === 0 ? '' : 'dumpsys failed',
      };
    }
    if (command === 'ioreg') {
      return { status: 0, stdout: usbStdout, stderr: '' };
    }
    return { status: 1, stdout: '', stderr: '' };
  };
}

describe('Play RevenueCat QA device preflight', () => {
  it('documents evidenceArgs in help output', () => {
    const result = spawnSync(process.execPath, [SCRIPT, '--help'], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('evidenceArgs');
    expect(result.stdout).toContain('npm run subscription:qa:evidence');
  });

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
    expect(report.evidenceCommands).toHaveLength(3);
    expect(report.evidenceCommands[0]).toContain('--gate play_monthly');
    expect(report.evidenceCommands[0]).toContain('--device-id 57275d36');
    expect(report.evidenceCommands[1]).toContain('base plan P1Y confirmed');
    expect(report.evidenceCommands[2]).toContain('RevenueCat webhook and backend state converged');
    expect(formatReport(report)).toContain(
      '[play-qa-device] evidenceArgs: --device-id 57275d36 --installer-package-name com.android.vending'
    );
    expect(formatReport(report)).toContain('[play-qa-device] evidenceCommands:');
  });

  it('fails when the Play-installed build is not the expected versionCode', () => {
    const report = checkPlayQaDevice({
      spawn: spawnFor({
        adbDevicesStdout: 'List of devices attached\n57275d36\tdevice product:poco model:POCO_F8\n',
        dumpsysStdout: `
          Package [com.tanuki75.noctalia] (abc):
            versionCode=12 minSdk=33 targetSdk=36
            versionName=1.1.0
            installerPackageName=com.android.vending
        `,
      }),
      platform: 'linux',
      expectedVersionCode: '24',
    });

    expect(report.ok).toBe(false);
    expect(report.versionCodeMatches).toBe(false);
    expect(report.evidenceArgs).toBe(null);
    expect(report.evidenceCommands).toEqual([]);
    expect(report.message).toContain('does not match expected 24');
    expect(report.next).toContain('update or reinstall');
    expect(formatReport(report)).toContain('[play-qa-device] expectedVersionCode: 24 - FAIL');
  });

  it('passes when the expected versionCode matches the Play-installed build', () => {
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
      expectedVersionCode: 24,
    });

    expect(report.ok).toBe(true);
    expect(report.versionCodeMatches).toBe(true);
    expect(report.evidenceArgs).toBe('--device-id 57275d36 --installer-package-name com.android.vending');
    expect(formatReport(report)).toContain('[play-qa-device] expectedVersionCode: 24 - PASS');
  });

  it('builds no evidence commands until Play install source has passed', () => {
    expect(buildPlayEvidenceCommands(null)).toEqual([]);
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

  it('surfaces USB and wireless diagnostics when no physical device is ready', () => {
    const report = checkPlayQaDevice({
      spawn: spawnFor({
        adbDevicesStdout: 'List of devices attached\n',
        mdnsStdout:
          'List of discovered mdns services\nadb-123._adb-tls-pairing._tcp.\t_adb-tls-pairing._tcp.\t192.168.1.24:37123\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(formatReport(report)).toContain('usb: NOT VISIBLE');
    expect(formatReport(report)).toContain('wireless: VISIBLE');
    expect(formatReport(report)).toContain('wirelessCommand: adb pair 192.168.1.24:37123 <pair-code>');
  });

  it('prioritizes USB debugging authorization when a phone is visible over USB but adb is empty', () => {
    const report = checkPlayQaDevice({
      spawn: spawnFor({
        adbDevicesStdout: 'List of devices attached\n',
        usbStdout: '"USB Product Name" = "POCO F8 Ultra"\n"USB Vendor Name" = "Xiaomi"\n',
      }),
      platform: 'darwin',
    });

    expect(report.ok).toBe(false);
    expect(report.message).toContain('visible over USB');
    expect(report.next).toContain('accept the RSA fingerprint prompt');
    expect(report.next).toContain('revoke USB debugging authorizations');
    expect(formatReport(report)).toContain('usb: VISIBLE');
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
