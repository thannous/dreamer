/* global __dirname */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');

// Metro resolves expo-asset's native react-native import through Uniwind.
// Exercise that installed resolver and Expo's actual fromModule implementation;
// native modules and the registered audio are the only synthetic boundaries.
const appRoot = path.resolve(__dirname, '../..');
const assetFile = path.join(appRoot, 'node_modules/expo-asset/src/Asset.ts');
const facadeFile = path.join(appRoot, 'node_modules/uniwind/src/components/index.ts');
const nativeFile = path.join(appRoot, 'node_modules/react-native/index.js');
const { withUniwindConfig } = require('uniwind/metro');
const resolveRequest = (_context, name) => ({
  type: 'sourceFile', filePath: name === 'react-native' ? nativeFile : facadeFile,
});
const config = withUniwindConfig({
  projectRoot: appRoot, transformer: {},
  resolver: { sourceExts: ['js'], assetExts: [], resolveRequest },
}, { cssEntryFile: './global.css' });
const actual = config.resolver.resolveRequest({ originModulePath: assetFile }, 'react-native', 'ios');
assert.equal(actual.filePath, facadeFile);

const metadata = { name: 'qa-audio', type: 'm4a', hash: 'qa-hash', scales: [1] };
const registry = { getAssetByID: id => id === 7 ? metadata : undefined };
const native = { AssetRegistry: registry };
const facadeModule = { exports: {} };
runInNewContext(readFileSync(facadeFile, 'utf8'), {
  module: facadeModule,
  require: name => {
    if (name === 'react-native') return native;
    throw new Error(`Unexpected native facade import: ${name}`);
  },
}, { filename: facadeFile });

const { transformSync } = require('@babel/core');
const compiled = transformSync(readFileSync(assetFile, 'utf8'), {
  filename: assetFile, babelrc: false, configFile: false,
  plugins: [require.resolve('@babel/plugin-transform-typescript'),
    require.resolve('@babel/plugin-transform-modules-commonjs')],
});
const modules = {
  'expo-modules-core': { Platform: { OS: 'ios' } },
  'react-native': facadeModule.exports,
  './AssetSources': {}, './AssetUris': {}, './ExpoAsset': {}, './ImageAssets': {},
  './LocalAssets': { getLocalAssetUri: () => null },
  './PlatformUtils': { IS_ENV_WITH_LOCAL_ASSETS: false },
  './resolveAssetSource': { __esModule: true, default: () => ({ uri: 'file:///qa-audio.m4a' }) },
};
const assetExports = {};
runInNewContext(compiled.code, {
  exports: assetExports, module: { exports: assetExports },
  require: name => {
    if (name in modules) return modules[name];
    throw new Error(`Unexpected Expo asset import: ${name}`);
  },
}, { filename: assetFile });
const asset = assetExports.Asset.fromModule(7);
assert.equal(asset.name, 'qa-audio');
assert.equal(asset.type, 'm4a');
assert.equal(asset.uri, 'file:///qa-audio.m4a');
assert.throws(() => assetExports.Asset.fromModule(8), /Module "8" is missing from the asset registry/);
