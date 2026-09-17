const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

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
