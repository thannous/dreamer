'use strict';

// The public values a real Dreamer iOS build bakes in. Without the RevenueCat key the paywall
// has no products; without the Google client IDs sign-in throws. No dependency: EAS runs this
// from its eas-build-pre-install hook, before npm install.
function requireBuildRuntimeEnvironment(env) {
  if (env.EXPO_PUBLIC_MOCK_MODE?.toLowerCase() === 'true') return;
  for (const key of ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_REVENUECAT_IOS_KEY']) {
    if (!env[key]?.trim()) {
      throw new Error(`${key} is required for a real iOS build. Select --profile <file> or provide the build environment.`);
    }
  }
  if (!/^appl_\S+$/.test(env.EXPO_PUBLIC_REVENUECAT_IOS_KEY)) {
    throw new Error('EXPO_PUBLIC_REVENUECAT_IOS_KEY must be an Apple App Store public SDK key (appl_) for a real iOS Release build. Test Store and other platform keys are not supported.');
  }
  return env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
}

module.exports = { requireBuildRuntimeEnvironment };
