/* global describe, expect, it, jest */

const {
  formatReleaseSmoke,
  parseArgs,
  runReleaseSmoke,
  toJsonReceipt,
} = require('./run-subscription-release-smoke');

function passingDevice() {
  return {
    ok: true,
    selectedDevice: 'physical-device',
    message: 'Play-installed candidate is ready.',
    playInstallSource: {
      installerPackageName: 'com.android.vending',
    },
  };
}

function qaReport(overrides = {}) {
  const assertions = overrides.assertions ?? [
    {
      key: 'restore_after_reinstall',
      label: 'Restore',
      scenario: 'Restore after reinstall',
      status: 'pass',
    },
    {
      key: 'account_switch',
      label: 'Account isolation',
      scenario: 'Account switch',
      status: 'pass',
    },
  ];
  const remaining = assertions.filter((assertion) => assertion.status !== 'pass').length;
  return {
    exitCode: overrides.exitCode ?? (remaining === 0 ? 0 : 1),
    releaseSmoke: {
      status: remaining === 0 ? 'pass' : 'blocked',
      total: assertions.length,
      verified: assertions.length - remaining,
      remaining,
      assertions,
    },
  };
}

function dependencies(overrides = {}) {
  return {
    readAppIdentity: () => ({
      packageName: 'com.tanuki75.noctalia',
      versionCode: '52',
      versionName: '3.1.0',
    }),
    checkPlayQaDevice: jest.fn(() => passingDevice()),
    generateSubscriptionQaReport: jest.fn(() => qaReport()),
    ...overrides,
  };
}

describe('subscription release smoke', () => {
  it('parses the optional device, version and output flags', () => {
    expect(
      parseArgs([
        '--device',
        '192.168.1.10:12345',
        '--version-code',
        '52',
        '--json',
        '--report-only',
      ])
    ).toEqual({
      device: '192.168.1.10:12345',
      versionCode: '52',
      json: true,
      reportOnly: true,
    });
    expect(() => parseArgs(['--version-code', '0'])).toThrow(
      '--version-code must be a positive integer'
    );
  });

  it('returns one PASS when Play identity, restore and account isolation pass', () => {
    const deps = dependencies();
    const result = runReleaseSmoke({ device: 'physical-device', versionCode: '52' }, deps);

    expect(result).toMatchObject({
      ok: true,
      verified: 3,
      total: 3,
      installerPackageName: 'com.android.vending',
    });
    expect(result.assertions.map((assertion) => assertion.label)).toEqual([
      'Play candidate identity',
      'Restore',
      'Account isolation',
    ]);
    expect(deps.checkPlayQaDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        device: 'physical-device',
        expectedVersionCode: '52',
        packageName: 'com.tanuki75.noctalia',
      })
    );
    expect(formatReleaseSmoke(result)).toContain('PASS - final release smoke');
    expect(toJsonReceipt(result)).toMatchObject({ status: 'pass', verified: 3, total: 3 });
  });

  it('blocks when the requested Play version does not match app.json', () => {
    const result = runReleaseSmoke({ versionCode: '53' }, dependencies());

    expect(result.ok).toBe(false);
    expect(result.assertions[0]).toMatchObject({
      label: 'Play candidate identity',
      status: 'blocked',
    });
    expect(result.assertions[0].detail).toContain(
      'Requested versionCode 53 does not match app.json 52'
    );
  });

  it('blocks the single verdict when account isolation evidence is missing', () => {
    const assertions = qaReport().releaseSmoke.assertions.map((assertion) =>
      assertion.key === 'account_switch' ? { ...assertion, status: 'blocked' } : assertion
    );
    const result = runReleaseSmoke(
      {},
      dependencies({
        generateSubscriptionQaReport: () => qaReport({ assertions, exitCode: 1 }),
      })
    );

    expect(result.ok).toBe(false);
    expect(result.verified).toBe(2);
    expect(result.assertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Account isolation', status: 'blocked' }),
      ])
    );
  });

  it('blocks when no matching Play-installed physical candidate is available', () => {
    const result = runReleaseSmoke(
      {},
      dependencies({
        checkPlayQaDevice: () => ({ ok: false, message: 'No ready physical Android device.' }),
      })
    );

    expect(result.ok).toBe(false);
    expect(result.assertions[0]).toMatchObject({
      status: 'blocked',
      detail: 'No ready physical Android device.',
    });
  });
});
