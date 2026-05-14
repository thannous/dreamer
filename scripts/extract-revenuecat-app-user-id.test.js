const {
  extractRevenueCatAppUserId,
  formatReport,
  getRevenueCatKey,
  mask,
  parseAppUserIdFromPrefsXml,
  parseArgs,
} = require('./extract-revenuecat-app-user-id');

const RC_KEY = 'test_zqltcBoDiTWPWmuyXTXTbYkJPrz';
const APP_USER_ID = '1239729f-7468-48c9-b26a-7aa8b4a82591';

function prefsXml({
  key = RC_KEY,
  appUserId = APP_USER_ID,
} = {}) {
  return `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
  <string name="com.revenuecat.purchases.${key}.new">${appUserId}</string>
  <string name="com.revenuecat.purchases.${key}.${appUserId}">{&quot;subscriber&quot;:{}}</string>
</map>`;
}

function spawnFor({ xml = prefsXml(), whichAdb = true, adbStatus = 0 } = {}) {
  return (command, args) => {
    if (command === 'which' && args[0] === 'adb') {
      return { status: whichAdb ? 0 : 1, stdout: whichAdb ? '/usr/bin/adb\n' : '', stderr: '' };
    }
    if (command === 'adb') {
      return {
        status: adbStatus,
        stdout: adbStatus === 0 ? xml : '',
        stderr: adbStatus === 0 ? '' : 'run-as failed',
        args,
      };
    }
    return { status: 1, stdout: '', stderr: '' };
  };
}

describe('RevenueCat app user id extractor', () => {
  it('parses the exact RevenueCat .new preference for the configured key', () => {
    const xml = `${prefsXml({ key: 'other_key', appUserId: '00000000-0000-4000-8000-000000000001' })}
${prefsXml()}`;

    expect(parseAppUserIdFromPrefsXml(xml, RC_KEY)).toBe(APP_USER_ID);
  });

  it('falls back to a single valid .new preference when the key has changed', () => {
    expect(parseAppUserIdFromPrefsXml(prefsXml({ key: 'legacy_key' }), RC_KEY)).toBe(APP_USER_ID);
  });

  it('rejects ambiguous fallback identities', () => {
    const xml = `${prefsXml({ key: 'first_key', appUserId: '00000000-0000-4000-8000-000000000001' })}
${prefsXml({ key: 'second_key', appUserId: '00000000-0000-4000-8000-000000000002' })}`;

    expect(() => parseAppUserIdFromPrefsXml(xml, RC_KEY)).toThrow('Found 2 RevenueCat app user ids');
  });

  it('reads the SDK key from an env file', () => {
    expect(
      getRevenueCatKey('/tmp/.env.teststore', () => `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY='${RC_KEY}'\n`)
    ).toBe(RC_KEY);
  });

  it('extracts identity from adb run-as output', () => {
    const report = extractRevenueCatAppUserId({
      device: 'emulator-5554',
      existsSync: () => true,
      readFile: () => `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=${RC_KEY}\n`,
      spawn: spawnFor(),
    });

    expect(report).toMatchObject({
      appId: 'com.tanuki75.noctalia',
      appUserId: APP_USER_ID,
      device: 'emulator-5554',
      envFile: '.env.teststore',
      revenueCatKeyMasked: 'test_z...JPrz',
    });
  });

  it('formats a non-secret diagnostic report', () => {
    const output = formatReport({
      appId: 'com.tanuki75.noctalia',
      appUserId: APP_USER_ID,
      device: 'emulator-5554',
      envFile: '.env.teststore',
      revenueCatKeyMasked: mask(RC_KEY),
    });

    expect(output).toContain('appUserId: 1239729f-7468-48c9-b26a-7aa8b4a82591');
    expect(output).toContain('sdk key: test_z...JPrz');
    expect(output).not.toContain(RC_KEY);
  });

  it('parses CLI options', () => {
    expect(
      parseArgs([
        '--device',
        'emulator-5554',
        '--env-file',
        '.env.playstore',
        '--app-id',
        'com.example.app',
        '--json',
      ])
    ).toEqual({
      appId: 'com.example.app',
      device: 'emulator-5554',
      envFile: '.env.playstore',
      json: true,
    });
  });
});
