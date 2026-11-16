'use strict';

const path = require('node:path');
const easConfig = require('../eas.json');
const {
  shouldStripDevLauncherNetworkKeys,
  stripDevLauncherNetworkKeys,
} = require('../plugins/withoutDevLauncherLocalNetwork');

const DEV_LAUNCHER_TEXT =
  'Expo Dev Launcher uses the local network to discover and connect to development servers running on your computer.';

describe('withoutDevLauncherLocalNetwork', () => {
  async function introspectedInfoPlist(profile) {
    // expo-widgets warns about its own iOS settings while the mods run.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const previous = process.env.EAS_BUILD_PROFILE;
    if (profile) process.env.EAS_BUILD_PROFILE = profile;
    else delete process.env.EAS_BUILD_PROFILE;
    try {
      const projectRoot = path.join(__dirname, '..');
      const { getPrebuildConfigAsync } = require('@expo/prebuild-config');
      const { compileModsAsync } = require('@expo/config-plugins/build/plugins/mod-compiler.js');
      const { exp } = await getPrebuildConfigAsync(projectRoot, { platforms: ['ios'] });
      await compileModsAsync(exp, {
        projectRoot, introspect: true, platforms: ['ios'], assertMissingModProviders: false,
      });
      return exp.ios.infoPlist;
    } finally {
      warn.mockRestore();
      if (previous === undefined) delete process.env.EAS_BUILD_PROFILE;
      else process.env.EAS_BUILD_PROFILE = previous;
    }
  }

  // The same final Info.plist as `expo config --type introspect`, after every plugin's mods.
  it('leaves no dev launcher network keys in a production Info.plist, and keeps them for the dev client', async () => {
    const production = await introspectedInfoPlist('production');
    expect(production.NSLocalNetworkUsageDescription).toBeUndefined();
    expect(production.NSBonjourServices ?? []).not.toContain('_expo._tcp');

    const development = await introspectedInfoPlist('development');
    expect(development.NSLocalNetworkUsageDescription).toBe(DEV_LAUNCHER_TEXT);
    expect(development.NSBonjourServices).toContain('_expo._tcp');
  }, 180_000);

  it('strips the keys on store and internal EAS profiles, keeps them for the dev client and local builds', () => {
    const easBuild = easConfig.build;
    for (const profile of ['production', 'release-smoke', 'ai-internal', 'preview', 'lucid-production']) {
      expect([profile, shouldStripDevLauncherNetworkKeys({ EAS_BUILD_PROFILE: profile }, easBuild)])
        .toEqual([profile, true]);
    }
    expect(shouldStripDevLauncherNetworkKeys({ EAS_BUILD_PROFILE: 'development' }, easBuild)).toBe(false);
    expect(shouldStripDevLauncherNetworkKeys({}, easBuild)).toBe(false);
  });

  it('removes only the dev launcher service and its default description', () => {
    expect(stripDevLauncherNetworkKeys({
      NSBonjourServices: ['_expo._tcp'],
      NSLocalNetworkUsageDescription: DEV_LAUNCHER_TEXT,
      NSMicrophoneUsageDescription: 'kept',
    })).toEqual({ NSMicrophoneUsageDescription: 'kept' });

    expect(stripDevLauncherNetworkKeys({
      NSBonjourServices: ['_other._tcp', '_expo._tcp.'],
      NSLocalNetworkUsageDescription: 'Our own reason',
    })).toEqual({ NSBonjourServices: ['_other._tcp'], NSLocalNetworkUsageDescription: 'Our own reason' });
  });
});
