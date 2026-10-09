'use strict';

// Metro resolver stubs for native bundles. Kept out of metro.config.js so the
// decision is unit-testable without booting Metro.

const RC_WEB_SDK = '@revenuecat/purchases-js-hybrid-mappings';
const MATERIAL_SYMBOLS_FONT = '@expo-google-fonts/material-symbols/400Regular';
const RC_WEB_STUB_OPT_OUT = 'NOCTALIA_DISABLE_RC_WEB_STUB';

// Expo Go has no RevenueCat native module, so react-native-purchases falls back
// to its browser mode and needs the real web SDK. Opt-out is for local Expo Go
// only: EAS build workers set EAS_BUILD, and the stub always stays on there.
function isRevenueCatWebStubDisabled(env = process.env) {
  if (env[RC_WEB_STUB_OPT_OUT] !== '1') return false;
  return !env.EAS_BUILD;
}

function resolveNativeStub(moduleName, platform, env = process.env) {
  // react-native-purchases(-ui) statically import RevenueCat's web SDK (~840 KB
  // minified) for Browser/Preview API mode, which they only enter on web, in
  // Expo Go or in the Rork sandbox. Native builds always ship the native
  // modules, so resolve the web SDK to an empty module everywhere but web.
  if (platform !== 'web' && moduleName === RC_WEB_SDK && !isRevenueCatWebStubDisabled(env)) {
    return { type: 'empty' };
  }
  // expo-router's native tabs import expo-symbols, whose Android build pulls the
  // Material Symbols font (~970 KB). The app uses neither native tabs nor
  // SymbolView on Android (icon-symbol.tsx maps onto MaterialIcons there).
  if (platform === 'android' && moduleName === MATERIAL_SYMBOLS_FONT) {
    return { type: 'empty' };
  }
  return null;
}

module.exports = {
  MATERIAL_SYMBOLS_FONT,
  RC_WEB_SDK,
  RC_WEB_STUB_OPT_OUT,
  isRevenueCatWebStubDisabled,
  resolveNativeStub,
};
