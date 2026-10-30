/* global __filename */
// Metro bundles `.txt` files as assets (metro.config.js). In Jest a required
// text asset is its absolute path, which the symbolContentAsset mock in
// jest.setup.ts reads from disk.
const createCacheKeyFunction = require('@jest/create-cache-key-function').default;

module.exports = {
  process: (_, filename) => ({ code: `module.exports = ${JSON.stringify(filename)};` }),
  getCacheKey: createCacheKeyFunction([__filename]),
};
