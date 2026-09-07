/* global __dirname */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    overrides: [{
      // Only the root composition test needs its deferred startup imports
      // resolved through Jest. Preserve other modules' existing semantics.
      test: require('node:path').resolve(__dirname, 'app/_layout.tsx'),
      env: {
        test: {
          plugins: ['@babel/plugin-transform-dynamic-import'],
        },
      },
    }],
  };
};
