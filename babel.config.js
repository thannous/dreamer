/* global __dirname */
module.exports = function (api) {
  const isTest = api.env('test');
  return {
    presets: ['babel-preset-expo'],
    ...(isTest
      ? {
          overrides: [{
            // Only the root composition test needs its deferred startup imports
            // resolved through Jest. Preserve other modules' existing semantics.
            test: require('node:path').resolve(__dirname, 'app/_layout.tsx'),
            plugins: ['@babel/plugin-transform-dynamic-import'],
          }],
        }
      : {}),
  };
};
