'use strict';

const {
  applyRevenueCatTestStoreBuildConfig,
} = require('../plugins/withRevenueCatTestStoreBuild');

const BASE_GRADLE = `
def enableMinifyInReleaseBuilds = false

android {
    buildTypes {
        debug {
        }
        release {
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe('withRevenueCatTestStoreBuild', () => {
  it('adds a fail-closed environment flag to the Release build type', () => {
    const output = applyRevenueCatTestStoreBuildConfig(BASE_GRADLE);

    expect(output).toContain(
      "System.getenv('NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE') ?: 'false'"
    );
    expect(output).toContain('debuggable isRevenueCatTestStoreBuild');
  });

  it('is idempotent across repeated Expo prebuilds', () => {
    const once = applyRevenueCatTestStoreBuildConfig(BASE_GRADLE);
    const twice = applyRevenueCatTestStoreBuildConfig(once);

    expect(twice).toBe(once);
    expect(twice.match(/debuggable isRevenueCatTestStoreBuild/g)).toHaveLength(1);
  });
});
