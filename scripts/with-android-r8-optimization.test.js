'use strict';

const appConfig = require('../app.json');
const {
  enableR8Optimization,
  enableOptimizedResourceShrinking,
} = require('../plugins/withAndroidR8Optimization');

const RELEASE_GRADLE = `
android {
    buildTypes {
        release {
            minifyEnabled enableMinifyInReleaseBuilds
            shrinkResources enableShrinkResources
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
`;

describe('Noctalia Android R8 optimization', () => {
  it('keeps the existing release shrinking flags and registers the config plugin', () => {
    const buildProperties = appConfig.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
    );
    expect(buildProperties[1].android).toMatchObject({
      enableMinifyInReleaseBuilds: true,
      enableShrinkResourcesInReleaseBuilds: true,
    });
    expect(appConfig.expo.plugins).toContain('./plugins/withAndroidR8Optimization');
  });

  it('uses the optimized Android default rules without changing custom rules', () => {
    const output = enableR8Optimization(RELEASE_GRADLE);
    expect(output).toContain('getDefaultProguardFile("proguard-android-optimize.txt")');
    expect(output).toContain('"proguard-rules.pro"');
    expect(output).toContain('minifyEnabled enableMinifyInReleaseBuilds');
    expect(enableR8Optimization(output)).toBe(output);
  });

  it('fails when the native Gradle template no longer has an expected default file', () => {
    expect(() => enableR8Optimization('release { }')).toThrow(
      'Unable to identify the Android Release default ProGuard file'
    );
  });

  it('enables optimized resource shrinking once across repeated config application', () => {
    const input = [
      { type: 'comment', value: 'Gradle options' },
      { type: 'property', key: 'android.r8.optimizedResourceShrinking', value: 'false' },
    ];
    const output = enableOptimizedResourceShrinking(input);
    expect(output).toContainEqual({
      type: 'property',
      key: 'android.r8.optimizedResourceShrinking',
      value: 'true',
    });
    expect(enableOptimizedResourceShrinking(output)).toEqual(output);
  });
});
