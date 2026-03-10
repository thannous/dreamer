const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `expo-sqlite` imports a `.wasm` asset for the web worker (wa-sqlite).
// Expo's default Metro config doesn't include `wasm` in assetExts yet.
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'wasm']));
// Windows can leave transient hidden entries in node_modules/.bin that break Metro's fallback watcher.
config.resolver.blockList = [
  /node_modules[\\/]\.bin[\\/]\.[^\\/]+$/,
];

module.exports = config;
