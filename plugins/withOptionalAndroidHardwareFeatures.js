// plugins/withOptionalAndroidHardwareFeatures.js
// Keep Play device filtering broad for features that have in-app fallbacks.
const { withAndroidManifest } = require('@expo/config-plugins');

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function upsertOptionalFeature(features, featureName) {
  const existing = features.find(
    (feature) => feature?.$?.['android:name'] === featureName
  );

  if (existing) {
    existing.$ = existing.$ || {};
    existing.$['android:required'] = 'false';
    return features;
  }

  features.push({
    $: {
      'android:name': featureName,
      'android:required': 'false',
    },
  });

  return features;
}

module.exports = function withOptionalAndroidHardwareFeatures(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const optionalFeatures = [
      'android.hardware.camera',
      'android.hardware.camera.any',
      'android.hardware.microphone',
    ];

    const features = asArray(manifest.manifest['uses-feature']);
    manifest.manifest['uses-feature'] = optionalFeatures.reduce(
      upsertOptionalFeature,
      features
    );

    console.log('[withOptionalAndroidHardwareFeatures] Marked camera and microphone as optional');
    return config;
  });
};
