const { withGradleProperties } = require('expo/config-plugins');

// React Native's <Image> only needs Fresco's GIF and WebP add-ons for animated
// images; Android decodes static GIF and WebP on its own since API 18. The app
// shows no animated image through <Image> (artwork goes through expo-image,
// which uses Glide), so both native add-ons (~0.8 MB) are left out of the APK.
const DISABLED_PROPERTIES = ['expo.gif.enabled', 'expo.webp.enabled', 'expo.webp.animated'];

function disableImageDecoders(properties) {
  const seen = new Set();
  const next = properties.flatMap((item) => {
    if (item.type !== 'property' || !DISABLED_PROPERTIES.includes(item.key)) return [item];
    if (seen.has(item.key)) return [];
    seen.add(item.key);
    return [{ ...item, value: 'false' }];
  });
  for (const key of DISABLED_PROPERTIES) {
    if (!seen.has(key)) next.push({ type: 'property', key, value: 'false' });
  }
  return next;
}

module.exports = function withoutReactNativeImageDecoders(config) {
  return withGradleProperties(config, (modConfig) => {
    modConfig.modResults = disableImageDecoders(modConfig.modResults);
    return modConfig;
  });
};

module.exports.disableImageDecoders = disableImageDecoders;
