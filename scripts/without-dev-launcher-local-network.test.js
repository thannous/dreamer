'use strict';

const appConfig = require('../app.json');
const easConfig = require('../eas.json');
const {
  shouldStripDevLauncherNetworkKeys,
  stripDevLauncherNetworkKeys,
} = require('../plugins/withoutDevLauncherLocalNetwork');

const DEV_LAUNCHER_TEXT =
  'Expo Dev Launcher uses the local network to discover and connect to development servers running on your computer.';

describe('withoutDevLauncherLocalNetwork', () => {
  it('is listed first, so its Info.plist change runs after the dev launcher adds the keys', () => {
    expect(appConfig.expo.plugins[0]).toBe('./plugins/withoutDevLauncherLocalNetwork');
  });

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
