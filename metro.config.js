const { createHash } = require('node:crypto');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// Release export may reuse Metro transforms in CI. Include every statically
// inlined public input so Dreamer/Lucid and their mock/story profiles cannot
// consume another profile's compiled constants. Retain the upstream cache seed;
// only a digest is exposed, never environment values.
const publicBuildInputs = Object.entries(process.env)
  .filter(([key]) => ['NOCTALIA_APP_VARIANT', 'NOCTALIA_DREAMER_QA_BUILD', 'EXPO_ROUTER_APP_ROOT', 'EXPO_ROUTER_IMPORT_MODE'].includes(key) || key.startsWith('EXPO_PUBLIC_'))
  .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
config.cacheVersion = createHash('sha256')
  .update(JSON.stringify([config.cacheVersion, publicBuildInputs]))
  .digest('hex');

// `expo-sqlite` imports a `.wasm` asset for the web worker (wa-sqlite).
// Expo's default Metro config doesn't include `wasm` in assetExts yet.
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'wasm']));
// Windows can leave transient hidden entries in node_modules/.bin that break Metro's fallback watcher.
config.resolver.blockList = [
  /node_modules[\\/]\.bin[\\/]\.[^\\/]+$/,
  /[\\/]\.env(?:\.[^\\/]*)?$/,
  // The meditation app is a second Expo project inside this repo. Its own
  // node_modules would collide with this one in Metro's haste map.
  /apps[\\/]meditation[\\/].*/,
];

// `withUniwindConfig` must stay the outermost wrapper.
module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
  extraThemes: ['morning', 'afterglow'],
});
