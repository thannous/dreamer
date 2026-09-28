const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const LEGACY_PROGUARD = /getDefaultProguardFile\((["'])proguard-android\.txt\1\)/g;
const OPTIMIZED_PROGUARD = /getDefaultProguardFile\((["'])proguard-android-optimize\.txt\1\)/;
const OPTIMIZED_RESOURCE_PROPERTY = 'android.r8.optimizedResourceShrinking';

function enableR8Optimization(contents) {
  const legacyMatches = [...contents.matchAll(LEGACY_PROGUARD)];
  if (legacyMatches.length === 1) {
    return contents.replace(
      LEGACY_PROGUARD,
      (_match, quote) => `getDefaultProguardFile(${quote}proguard-android-optimize.txt${quote})`
    );
  }
  if (legacyMatches.length === 0 && OPTIMIZED_PROGUARD.test(contents)) {
    return contents;
  }
  throw new Error('Unable to identify the Android Release default ProGuard file.');
}

function enableOptimizedResourceShrinking(properties) {
  let found = false;
  const next = properties.flatMap((item) => {
    if (item.type !== 'property' || item.key !== OPTIMIZED_RESOURCE_PROPERTY) {
      return [item];
    }
    if (found) return [];
    found = true;
    return [{ ...item, value: 'true' }];
  });
  if (!found) {
    next.push({ type: 'property', key: OPTIMIZED_RESOURCE_PROPERTY, value: 'true' });
  }
  return next;
}

module.exports = function withAndroidR8Optimization(config) {
  const withGradle = withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error('Android R8 optimization requires Groovy Gradle.');
    }
    modConfig.modResults.contents = enableR8Optimization(modConfig.modResults.contents);
    return modConfig;
  });

  return withGradleProperties(withGradle, (modConfig) => {
    modConfig.modResults = enableOptimizedResourceShrinking(modConfig.modResults);
    return modConfig;
  });
};

module.exports.enableR8Optimization = enableR8Optimization;
module.exports.enableOptimizedResourceShrinking = enableOptimizedResourceShrinking;
