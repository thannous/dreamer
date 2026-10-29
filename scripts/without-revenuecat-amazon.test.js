'use strict';

const appConfig = require('../app.json');
const { excludeRevenueCatAmazon } = require('../plugins/withoutRevenueCatAmazon');

describe('RevenueCat Amazon Appstore module on Android', () => {
  it('is registered for the app build', () => {
    expect(appConfig.expo.plugins).toContain('./plugins/withoutRevenueCatAmazon');
  });

  // Excluding only purchases-store-amazon would drop the SDK's keep rule but leave
  // the SDK on the classpath; both modules must go.
  it('excludes both the RevenueCat Amazon module and the Amazon Appstore SDK, once', () => {
    const gradle = 'android {\n}\n\ndependencies {\n}\n';
    const output = excludeRevenueCatAmazon(gradle);

    expect(output.startsWith(gradle.trimEnd())).toBe(true);
    expect(output).toContain("exclude group: 'com.revenuecat.purchases', module: 'purchases-store-amazon'");
    expect(output).toContain("exclude group: 'com.amazon.device', module: 'amazon-appstore-sdk'");
    expect(excludeRevenueCatAmazon(output)).toBe(output);
  });
});
