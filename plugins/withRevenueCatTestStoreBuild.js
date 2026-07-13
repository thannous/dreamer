const { withAppBuildGradle } = require('expo/config-plugins');

const TEST_STORE_FLAG_DECLARATION =
  "def isRevenueCatTestStoreBuild = (System.getenv('NOCTALIA_REVENUECAT_TEST_STORE_DEBUGGABLE') ?: 'false').toBoolean()";
const TEST_STORE_COMMENT =
  '// RevenueCat Test Store requires a debuggable standalone binary; production defaults to false.';

function applyRevenueCatTestStoreBuildConfig(contents) {
  let next = String(contents)
    .replace(/^\s*def isRevenueCatTestStoreBuild\s*=.*\r?\n/gm, '')
    .replace(/^\s*\/\/ RevenueCat Test Store requires a debuggable standalone binary; production defaults to false\.\r?\n/gm, '')
    .replace(/^\s*debuggable isRevenueCatTestStoreBuild\s*\r?\n/gm, '');

  const minifyDeclaration = /^(def enableMinifyInReleaseBuilds\s*=.*\r?\n)/m;
  if (!minifyDeclaration.test(next)) {
    throw new Error('Unable to locate the Android Release minify declaration.');
  }
  next = next.replace(
    minifyDeclaration,
    `$1${TEST_STORE_FLAG_DECLARATION}\n`
  );

  const releaseBuildType = /^(\s*)release\s*\{\s*$/m;
  if (!releaseBuildType.test(next)) {
    throw new Error('Unable to locate the Android Release build type.');
  }
  next = next.replace(
    releaseBuildType,
    (_line, indent) => [
      `${indent}release {`,
      `${indent}    ${TEST_STORE_COMMENT}`,
      `${indent}    debuggable isRevenueCatTestStoreBuild`,
    ].join('\n')
  );

  return next;
}

module.exports = function withRevenueCatTestStoreBuild(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('RevenueCat Test Store build configuration requires Groovy Gradle.');
    }
    config.modResults.contents = applyRevenueCatTestStoreBuildConfig(
      config.modResults.contents
    );
    return config;
  });
};

module.exports.applyRevenueCatTestStoreBuildConfig =
  applyRevenueCatTestStoreBuildConfig;
