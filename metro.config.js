const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `expo-sqlite` imports a `.wasm` asset for the web worker (wa-sqlite).
// Expo's default Metro config doesn't include `wasm` in assetExts yet.
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'wasm']));

module.exports = config;
