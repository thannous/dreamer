const {
  PLAY_INSTALLER,
  checkPlayInstallSource,
  readPackageInfo,
} = require('./check-play-install-source');

function spawnFor({ dumpsysStatus = 0, dumpsysStdout = '', whichAdb = true } = {}) {
  return (command, args) => {
    if (command === 'which' && args[0] === 'adb') {
      return { status: whichAdb ? 0 : 1, stdout: whichAdb ? '/usr/bin/adb\n' : '', stderr: '' };
    }
    if (command === 'adb' && args.includes('dumpsys')) {
      return {
        status: dumpsysStatus,
        stdout: dumpsysStdout,
        stderr: dumpsysStatus === 0 ? '' : 'dumpsys failed',
      };
    }
    return { status: 1, stdout: '', stderr: '' };
  };
}

describe('Play install source checker', () => {
  it('parses version and installer fields from dumpsys package', () => {
    expect(
      readPackageInfo(`
        Package [com.tanuki75.noctalia] (abc):
          versionCode=24 minSdk=33 targetSdk=36
          versionName=1.2.0
          installerPackageName=com.android.vending
          initiatingPackageName=com.android.vending
      `)
    ).toEqual({
      versionCode: '24',
      versionName: '1.2.0',
      installerPackageName: PLAY_INSTALLER,
      initiatingPackageName: PLAY_INSTALLER,
    });
  });

  it('passes only when installerPackageName is Google Play', () => {
    const report = checkPlayInstallSource({
      spawn: spawnFor({
        dumpsysStdout: `
          Package [com.tanuki75.noctalia] (abc):
            versionCode=24 minSdk=33 targetSdk=36
            versionName=1.2.0
            installerPackageName=com.android.vending
        `,
      }),
    });

    expect(report.ok).toBe(true);
    expect(report.installerPackageName).toBe(PLAY_INSTALLER);
  });

  it('rejects sideloaded or debug installs', () => {
    const report = checkPlayInstallSource({
      spawn: spawnFor({
        dumpsysStdout: `
          Package [com.tanuki75.noctalia] (abc):
            versionCode=1 minSdk=33 targetSdk=36
            versionName=1.2.0
            installerPackageName=null
            initiatingPackageName=com.android.shell
        `,
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.message).toContain('installerPackageName=null');
    expect(report.next).toContain('Internal Testing');
  });

  it('reports when the package is missing', () => {
    const report = checkPlayInstallSource({
      spawn: spawnFor({ dumpsysStdout: 'Unable to find package: com.tanuki75.noctalia\n' }),
    });

    expect(report.ok).toBe(false);
    expect(report.message).toContain('not installed');
  });
});
