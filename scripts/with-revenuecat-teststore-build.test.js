'use strict';

const appConfig = require('../app.json');
const {
  applyRevenueCatTestStoreBuildConfig,
} = require('../plugins/withRevenueCatTestStoreBuild');

const BASE_GRADLE = `
def enableMinifyInReleaseBuilds = false
def enableShrinkResourcesInReleaseBuilds = false

android {
    buildTypes {
        debug {
        }
        release {
            minifyEnabled enableMinifyInReleaseBuilds
            shrinkResources enableShrinkResourcesInReleaseBuilds
        }
    }
}
`;

describe('withRevenueCatTestStoreBuild', () => {
  it('keeps minification and resource shrinking enabled in the Expo Android config', () => {
    const buildPropertiesPlugin = appConfig.expo.plugins.find(
      (plugin) =>
        Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
    );

    expect(buildPropertiesPlugin?.[1]?.android).toMatchObject({
      enableMinifyInReleaseBuilds: true,
      enableShrinkResourcesInReleaseBuilds: true,
    });
  });

  it('adds a fail-closed environment flag to the Release build type', () => {
    const output = applyRevenueCatTestStoreBuildConfig(BASE_GRADLE);

    expect(output).toContain(
      "System.getenv('NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE') ?: 'false'"
    );
    expect(output).toContain('debuggable isRevenueCatTestStoreBuild');
  });

  it('does not neutralize the Release optimization declarations', () => {
    const output = applyRevenueCatTestStoreBuildConfig(BASE_GRADLE);

    expect(output).toContain('def enableMinifyInReleaseBuilds = false');
    expect(output).toContain('def enableShrinkResourcesInReleaseBuilds = false');
    expect(output).toContain('minifyEnabled enableMinifyInReleaseBuilds');
    expect(output).toContain(
      'shrinkResources enableShrinkResourcesInReleaseBuilds'
    );
  });

  it('is idempotent across repeated Expo prebuilds', () => {
    const once = applyRevenueCatTestStoreBuildConfig(BASE_GRADLE);
    const twice = applyRevenueCatTestStoreBuildConfig(once);

    expect(twice).toBe(once);
    expect(twice.match(/debuggable isRevenueCatTestStoreBuild/g)).toHaveLength(1);
  });
});
