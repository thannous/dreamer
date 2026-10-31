'use strict';

// Metro resolver stubs for native bundles. Kept out of metro.config.js so the
// decision is unit-testable without booting Metro.

const path = require('node:path');

const RC_WEB_SDK = '@revenuecat/purchases-js-hybrid-mappings';
const MATERIAL_SYMBOLS_FONT = '@expo-google-fonts/material-symbols/400Regular';
const RC_WEB_STUB_OPT_OUT = 'NOCTALIA_DISABLE_RC_WEB_STUB';
const SHIMS_DIR = path.join(__dirname, 'metro-shims');
const SHIMS = {
  characterEntities: path.join(SHIMS_DIR, 'character-entities-lite.js'),
  culori: path.join(SHIMS_DIR, 'culori-lite.js'),
  qaLabsOff: path.join(SHIMS_DIR, 'qa-labs-off.js'),
  supabaseRealtime: path.join(SHIMS_DIR, 'supabase-realtime.js'),
};

// Reanimated's index re-exports every layout-animation preset. The app only
// uses FadeIn/FadeOut, LinearTransition and the keyframe/CSS APIs, so the other
// preset files and the screen-transition helpers resolve to empty modules on
// native. eslint.config.js bans importing the names they export; re-check the
// importers below on every Reanimated upgrade.
const REANIMATED_STUBBED_MODULES = {
  'src/layoutReanimation/defaultAnimations/index.ts': [
    './Bounce', './Flip', './Lightspeed', './Pinwheel', './Roll', './Rotate', './Slide', './Stretch', './Zoom',
  ],
  'src/layoutReanimation/defaultTransitions/index.ts': [
    './CurvedTransition', './FadingTransition', './JumpingTransition', './SequencedTransition',
  ],
  'src/index.ts': ['./screenTransition'],
};
const REANIMATED_STUBBED_EXPORTS = [
  'BounceIn', 'BounceInDown', 'BounceInUp', 'BounceInLeft', 'BounceInRight',
  'BounceOut', 'BounceOutDown', 'BounceOutUp', 'BounceOutLeft', 'BounceOutRight',
  'FlipInXUp', 'FlipInYLeft', 'FlipInXDown', 'FlipInYRight', 'FlipInEasyX', 'FlipInEasyY',
  'FlipOutXUp', 'FlipOutYLeft', 'FlipOutXDown', 'FlipOutYRight', 'FlipOutEasyX', 'FlipOutEasyY',
  'LightSpeedInRight', 'LightSpeedInLeft', 'LightSpeedOutRight', 'LightSpeedOutLeft',
  'PinwheelIn', 'PinwheelOut',
  'RollInLeft', 'RollInRight', 'RollOutLeft', 'RollOutRight',
  'RotateInDownLeft', 'RotateInDownRight', 'RotateInUpLeft', 'RotateInUpRight',
  'RotateOutDownLeft', 'RotateOutDownRight', 'RotateOutUpLeft', 'RotateOutUpRight',
  'SlideInRight', 'SlideInLeft', 'SlideOutRight', 'SlideOutLeft',
  'SlideInUp', 'SlideInDown', 'SlideOutUp', 'SlideOutDown',
  'StretchInX', 'StretchInY', 'StretchOutX', 'StretchOutY',
  'ZoomIn', 'ZoomInRotate', 'ZoomInLeft', 'ZoomInRight', 'ZoomInUp', 'ZoomInDown',
  'ZoomInEasyUp', 'ZoomInEasyDown', 'ZoomOut', 'ZoomOutRotate', 'ZoomOutLeft',
  'ZoomOutRight', 'ZoomOutUp', 'ZoomOutDown', 'ZoomOutEasyUp', 'ZoomOutEasyDown',
  'CurvedTransition', 'FadingTransition', 'JumpingTransition', 'SequencedTransition',
  'ScreenTransition', 'startScreenTransition', 'finishScreenTransition',
];

const EMPTY = Object.freeze({ type: 'empty' });

// Expo Go has no RevenueCat native module, so react-native-purchases falls back
// to its browser mode and needs the real web SDK. Opt-out is for local Expo Go
// only: EAS build workers set EAS_BUILD, and the stub always stays on there.
function isRevenueCatWebStubDisabled(env = process.env) {
  if (env[RC_WEB_STUB_OPT_OUT] !== '1') return false;
  return !env.EAS_BUILD;
}

function toPosix(filePath) {
  return String(filePath ?? '').replace(/\\/g, '/');
}

function originIn(originModulePath, packageFile) {
  return toPosix(originModulePath).endsWith(`/node_modules/${packageFile}`);
}

function originInsidePackage(originModulePath, packageName) {
  return toPosix(originModulePath).includes(`/node_modules/${packageName}/`);
}

function sourceFile(filePath) {
  return { type: 'sourceFile', filePath };
}

function resolveReanimatedPresetStub(moduleName, originModulePath) {
  for (const [file, stubbed] of Object.entries(REANIMATED_STUBBED_MODULES)) {
    if (stubbed.includes(moduleName) && originIn(originModulePath, `react-native-reanimated/${file}`)) {
      return EMPTY;
    }
  }
  return null;
}

/**
 * @param {string} moduleName
 * @param {string} platform
 * @param {Record<string, string | undefined>} [env]
 * @param {{ originModulePath?: string, dev?: boolean }} [context] Metro resolution context.
 */
function resolveNativeStub(moduleName, platform, env = process.env, context = {}) {
  const originModulePath = context.originModulePath ?? '';
  const isNative = platform !== 'web';
  // react-native-purchases(-ui) statically import RevenueCat's web SDK (~840 KB
  // minified) for Browser/Preview API mode, which they only enter on web, in
  // Expo Go or in the Rork sandbox. Native builds always ship the native
  // modules, so resolve the web SDK to an empty module everywhere but web. The
  // browser module that wraps it is read only in browser mode as well.
  if (isNative && !isRevenueCatWebStubDisabled(env)) {
    if (moduleName === RC_WEB_SDK) return EMPTY;
    if (moduleName === './browser/nativeModule' && originIn(originModulePath, 'react-native-purchases/dist/purchases.js')) {
      return EMPTY;
    }
  }
  // expo-router's native tabs import expo-symbols, whose Android build pulls the
  // Material Symbols font (~970 KB) and its 79 KB glyph map. The app uses
  // neither native tabs nor SymbolView on Android (icon-symbol.tsx maps onto
  // MaterialIcons there), and expo-router wraps the require in try, so
  // requireExpoSymbols() only throws if native tabs with `md` icons are adopted.
  if (platform === 'android') {
    if (moduleName === MATERIAL_SYMBOLS_FONT) return EMPTY;
    if (moduleName === 'expo-symbols' && originIn(originModulePath, 'expo-router/build/optional-libraries/expo-symbols.js')) {
      return EMPTY;
    }
  }
  if (!isNative) return null;

  const reanimated = resolveReanimatedPresetStub(moduleName, originModulePath);
  if (reanimated) return reanimated;

  // supabase-js always constructs a RealtimeClient; the app subscribes to no
  // channel. The shim keeps the methods the client calls. storage-js only
  // touches iceberg-js inside its analytics-bucket method.
  if (moduleName === '@supabase/realtime-js' && originInsidePackage(originModulePath, '@supabase/supabase-js')) {
    return sourceFile(SHIMS.supabaseRealtime);
  }
  if (moduleName === 'iceberg-js' && originInsidePackage(originModulePath, '@supabase/storage-js')) {
    return EMPTY;
  }
  // The package index re-exports the Markdown editor; the app only renders
  // EnrichedMarkdownText (eslint.config.js bans importing the editor).
  if (moduleName === './EnrichedMarkdownTextInput.js' && originIn(originModulePath, 'react-native-enriched-markdown/lib/module/index.js')) {
    return EMPTY;
  }
  // Uniwind's native runtime only parses hex/rgb/hsl colours and mixes them.
  // Its Node-side CSS compiler keeps the full culori.
  if (moduleName === 'culori' && originInsidePackage(originModulePath, 'uniwind')) {
    return sourceFile(SHIMS.culori);
  }
  // micromark's named-reference decoder ships all 2,125 HTML entities. The
  // Markdown policy pass only needs the common ones; md4c renders the rest.
  if (moduleName === 'character-entities' && originInsidePackage(originModulePath, 'decode-named-character-reference')) {
    return sourceFile(SHIMS.characterEntities);
  }

  if (!context.dev) {
    // Release has its own HMRClient shim (setUpBatchedBridge); only the
    // unstable-internals getter still pulls Expo's dev HMR client.
    if (moduleName === '../Libraries/Utilities/HMRClient' && originIn(originModulePath, 'react-native/src/unstable-internals-do-not-use.js')) {
      return EMPTY;
    }
    // expo-sqlite only requires its devtools client under __DEV__.
    if (moduleName === 'expo/devtools' && /\/node_modules\/expo-sqlite\/build\/SQLiteDevToolsClient\.js$/.test(toPosix(originModulePath))) {
      return EMPTY;
    }
    // Reanimated only checks the worklets version under __DEV__.
    if (moduleName === 'react-native-reanimated/scripts/validate-worklets-version') {
      return EMPTY;
    }
  }
  return null;
}

function isEnvTrue(value) {
  return String(value ?? '').toLowerCase() === 'true';
}

// Read like lib/env.ts isMockModeEnabled().
function isMockModeBuild(env = process.env) {
  return isEnvTrue(env.EXPO_PUBLIC_MOCK_MODE);
}

// Mock services and QA labs that a build can never use given its inlined
// flags. Matched on the resolved file, relative to the project root, so every
// import specifier of the same file is covered.
const MOCK_ONLY_FILES = [
  'lib/mockAuth.ts',
  'services/mocks/geminiServiceMock.ts',
  'services/mocks/notificationServiceMock.ts',
  'services/mocks/storageServiceMock.ts',
  'services/quota/MockQuotaProvider.ts',
];

/**
 * @param {string} projectRoot
 * @param {{ type: string, filePath?: string }} resolution Metro's resolution.
 * @param {string} platform
 * @param {Record<string, string | undefined>} [env]
 * @param {{ dev?: boolean }} [context]
 */
function resolveBuildFlagStub(projectRoot, resolution, platform, env = process.env, context = {}) {
  if (!resolution || resolution.type !== 'sourceFile' || !resolution.filePath) return null;
  const relative = toPosix(path.relative(projectRoot, resolution.filePath));
  const mockMode = isMockModeBuild(env);
  // Each importer only reaches these behind `isMockMode` (storage, gemini,
  // notification and quota services, lib/auth*.ts), and a namespace import of
  // an empty module is an empty object, so loading the importer stays safe.
  if (!mockMode && MOCK_ONLY_FILES.includes(relative)) return EMPTY;
  // Settings renders the labs unconditionally and each one hides itself; the
  // shim renders nothing under the same conditions.
  if (relative === 'components/subscription/SubscriptionQALab.tsx'
    && !mockMode && env.EXPO_PUBLIC_SUBSCRIPTION_QA_LAB !== 'true') {
    return sourceFile(SHIMS.qaLabsOff);
  }
  if (relative === 'components/guest/GuestProdQALab.tsx'
    && (platform !== 'android' || !isEnvTrue(env.EXPO_PUBLIC_GUEST_QA_LAB))) {
    return sourceFile(SHIMS.qaLabsOff);
  }
  if (relative === 'components/dev/GuestRecordingQaReset.tsx' && !context.dev) {
    return sourceFile(SHIMS.qaLabsOff);
  }
  return null;
}

module.exports = {
  MATERIAL_SYMBOLS_FONT,
  MOCK_ONLY_FILES,
  REANIMATED_STUBBED_EXPORTS,
  REANIMATED_STUBBED_MODULES,
  RC_WEB_SDK,
  RC_WEB_STUB_OPT_OUT,
  SHIMS,
  isMockModeBuild,
  isRevenueCatWebStubDisabled,
  resolveBuildFlagStub,
  resolveNativeStub,
};
