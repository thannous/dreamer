/* global __dirname */
module.exports = function (api) {
  const isTest = api.env('test');
  return {
    presets: ['babel-preset-expo'],
    ...(isTest
      ? {
          overrides: [{
            // Root composition and its extracted bootstrap resolve deferred imports
            // through Jest. Preserve other modules' existing semantics.
            test: [
              require('node:path').resolve(__dirname, 'app/_layout.tsx'),
              require('node:path').resolve(__dirname, 'lib/productBootstrap.ts'),
            ],
            plugins: ['@babel/plugin-transform-dynamic-import'],
          }],
        }
      : {}),
  };
};
