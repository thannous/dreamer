module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['babel-plugin-react-compiler', { target: '19' }],
      // Must be last for Reanimated worklets to compile correctly
      'react-native-reanimated/plugin',
    ],
  };
};
