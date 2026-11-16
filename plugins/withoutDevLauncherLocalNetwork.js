// Keeps the development client's local network prompt out of store builds.
//
// expo-dev-launcher adds `_expo._tcp` to NSBonjourServices and its own
// NSLocalNetworkUsageDescription ("Expo Dev Launcher uses the local network...") to every
// build, then relies on an Xcode script phase to strip them from Release. That phase does not
// reach the shipped Info.plist: the 3.8.0 (22) and 4.0.0 (23) IPAs still carry the text, which
// App Review reads as a permission the app never uses.
//
// On an EAS build whose profile is not a development client, the keys are removed at prebuild.
// Local builds (no EAS_BUILD_PROFILE) and development-client profiles keep them, so the dev
// client still finds Metro.
const { withInfoPlist } = require('expo/config-plugins');

const EXPO_BONJOUR_SERVICE = '_expo._tcp';
const DEV_LAUNCHER_DESCRIPTION_MARKER = 'Expo Dev Launcher';

function isDevelopmentClientProfile(profileName, easBuild) {
  const seen = new Set();
  let current = profileName;
  while (current && easBuild[current] && !seen.has(current)) {
    seen.add(current);
    const profile = easBuild[current];
    if (typeof profile.developmentClient === 'boolean') return profile.developmentClient;
    current = profile.extends;
  }
  return false;
}

function shouldStripDevLauncherNetworkKeys(env = process.env, easBuild = readEasBuildProfiles()) {
  const profile = env.EAS_BUILD_PROFILE;
  if (!profile) return false;
  return !isDevelopmentClientProfile(profile, easBuild);
}

function readEasBuildProfiles() {
  try {
    return require('../eas.json').build ?? {};
  } catch {
    return {};
  }
}

function stripDevLauncherNetworkKeys(infoPlist) {
  const next = { ...infoPlist };
  if (Array.isArray(next.NSBonjourServices)) {
    const services = next.NSBonjourServices.filter(
      (service) => String(service).toLowerCase().replace(/\.$/, '') !== EXPO_BONJOUR_SERVICE
    );
    if (services.length > 0) next.NSBonjourServices = services;
    else delete next.NSBonjourServices;
  }
  // A description the app wrote itself stays: only the dev launcher's default goes.
  if (String(next.NSLocalNetworkUsageDescription ?? '').includes(DEV_LAUNCHER_DESCRIPTION_MARKER)) {
    delete next.NSLocalNetworkUsageDescription;
  }
  return next;
}

function withoutDevLauncherLocalNetwork(config) {
  if (!shouldStripDevLauncherNetworkKeys()) return config;
  return withInfoPlist(config, (modConfig) => {
    modConfig.modResults = stripDevLauncherNetworkKeys(modConfig.modResults);
    return modConfig;
  });
}

module.exports = withoutDevLauncherLocalNetwork;
module.exports.shouldStripDevLauncherNetworkKeys = shouldStripDevLauncherNetworkKeys;
module.exports.stripDevLauncherNetworkKeys = stripDevLauncherNetworkKeys;
