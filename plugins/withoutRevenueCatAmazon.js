const { withAppBuildGradle } = require('expo/config-plugins');

// Noctalia sells through Google Play only and never configures RevenueCat with
// useAmazon. purchases-store-amazon nevertheless brings the Amazon Appstore SDK,
// its exported IAP receiver, and a `-keep class com.amazon.** {*;}` rule that keeps
// the whole SDK through R8. Both modules are excluded from every configuration.
// RevenueCat's own com.revenuecat.purchases.amazon classes live in its core
// library, which also ships `-dontwarn com.amazon.**`, so Play billing is unaffected.
const MARKER = '// noctalia: without RevenueCat Amazon Appstore';
const EXCLUSIONS = [
  MARKER,
  'configurations.configureEach {',
  "    exclude group: 'com.revenuecat.purchases', module: 'purchases-store-amazon'",
  "    exclude group: 'com.amazon.device', module: 'amazon-appstore-sdk'",
  '}',
].join('\n');

function excludeRevenueCatAmazon(contents) {
  const source = String(contents);
  if (source.includes(MARKER)) return source;
  return `${source.replace(/\s*$/, '')}\n\n${EXCLUSIONS}\n`;
}

module.exports = function withoutRevenueCatAmazon(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error('Excluding RevenueCat Amazon requires Groovy Gradle.');
    }
    modConfig.modResults.contents = excludeRevenueCatAmazon(modConfig.modResults.contents);
    return modConfig;
  });
};

module.exports.excludeRevenueCatAmazon = excludeRevenueCatAmazon;
