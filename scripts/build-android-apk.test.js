'use strict';

const path = require('node:path');
const { buildPlan, EAS_CLI_SPEC, resolveNpxCommand } = require('./build-android-apk');

describe('build-android-apk', () => {
  it('uses the exact EAS CLI version through npx for mock builds', () => {
    const plan = buildPlan('mock', { KEEP: 'yes' });
    expect(plan).toHaveLength(1);
    expect(plan[0].command).toBe(resolveNpxCommand());
    expect(plan[0].args).toEqual([
      '--yes',
      EAS_CLI_SPEC,
      'build',
      '-p',
      'android',
      '--profile',
      'preview',
      '--local',
    ]);
    expect(plan[0].env).toMatchObject({ EXPO_PUBLIC_MOCK_MODE: 'true', KEEP: 'yes' });
  });

  it('runs the release gate before production builds', () => {
    const plan = buildPlan('prod', {});
    expect(plan[0].command).toBe(process.execPath);
    expect(path.basename(plan[0].args[0])).toBe('check-android-release-gates.js');
    expect(plan[1].command).toBe(resolveNpxCommand());
    expect(plan[1].args).toContain(EAS_CLI_SPEC);
    expect(plan[1].args).toContain('production-apk');
    expect(plan[1].env.EXPO_NO_DOTENV).toBe('1');
  });

  it('uses the Windows npx shim when needed', () => {
    expect(resolveNpxCommand('win32')).toBe('npx.cmd');
  });

  it('rejects an unknown build target', () => {
    expect(() => buildPlan('unknown')).toThrow('Expected APK target: mock or prod.');
  });
});
