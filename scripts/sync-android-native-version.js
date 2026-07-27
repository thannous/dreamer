#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function syncAndroidNativeVersion({
  cwd = process.cwd(),
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  writeFileSync = fs.writeFileSync,
} = {}) {
  const appConfigPath = path.join(cwd, 'app.json');
  const buildGradlePath = path.join(cwd, 'android', 'app', 'build.gradle');

  if (!existsSync(buildGradlePath)) {
    return { status: 'native-project-missing' };
  }

  const appConfig = JSON.parse(readFileSync(appConfigPath, 'utf8'));
  const versionName = appConfig?.expo?.version;
  const versionCode = appConfig?.expo?.android?.versionCode;

  if (!versionName || !Number.isInteger(versionCode)) {
    throw new Error(
      'app.json must define expo.version and an integer expo.android.versionCode',
    );
  }

  const currentGradle = readFileSync(buildGradlePath, 'utf8');
  const versionCodePattern = /(\bversionCode\s+)\d+/;
  const versionNamePattern = /(\bversionName\s+)"[^"]*"/;

  if (
    !versionCodePattern.test(currentGradle)
    || !versionNamePattern.test(currentGradle)
  ) {
    throw new Error(
      'android/app/build.gradle is missing versionCode or versionName',
    );
  }

  const nextGradle = currentGradle
    .replace(versionCodePattern, `$1${versionCode}`)
    .replace(versionNamePattern, `$1"${versionName}"`);

  if (nextGradle === currentGradle) {
    return { status: 'already-synced', versionCode, versionName };
  }

  writeFileSync(buildGradlePath, nextGradle);

  return { status: 'updated', versionCode, versionName };
}

if (require.main === module) {
  try {
    const result = syncAndroidNativeVersion();
    if (result.status === 'updated') {
      console.error(
        `[android] Synced native version ${result.versionName} (${result.versionCode})`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  syncAndroidNativeVersion,
};
