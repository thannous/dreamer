#!/usr/bin/env node
'use strict';
/* global __dirname */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readReleaseIdentity(rootDir = ROOT, readFileSync = fs.readFileSync) {
  const appConfig = JSON.parse(readFileSync(path.join(rootDir, 'app.json'), 'utf8'));
  const packageConfig = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const version = String(appConfig?.expo?.version || '').trim();
  const packageVersion = String(packageConfig?.version || '').trim();
  const runtimeVersion = String(appConfig?.expo?.runtimeVersion || '').trim();
  const versionCode = Number(appConfig?.expo?.android?.versionCode);

  if (!version) throw new Error('app.json must define expo.version.');
  if (packageVersion !== version) {
    throw new Error(`package.json version ${packageVersion || 'missing'} does not match app.json ${version}.`);
  }
  if (runtimeVersion !== version) {
    throw new Error(`runtimeVersion ${runtimeVersion || 'missing'} does not match app version ${version}.`);
  }
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error('app.json must define a positive expo.android.versionCode.');
  }

  return { version, versionCode };
}

function validateReleaseRef({
  builtVersionCode = '',
  refName = '',
  refType = '',
  releaseIdentity,
}) {
  if (refType === 'tag') {
    const expectedTag = `v${releaseIdentity.version}`;
    if (refName !== expectedTag) {
      throw new Error(`Release tag ${refName || 'missing'} does not match ${expectedTag}.`);
    }
  }

  if (builtVersionCode && String(releaseIdentity.versionCode) !== String(builtVersionCode)) {
    throw new Error(
      `EAS build versionCode ${builtVersionCode} does not match app.json ${releaseIdentity.versionCode}.`
    );
  }

  return {
    ...releaseIdentity,
    builtVersionCode,
    refName,
    refType,
  };
}

function main(env = process.env) {
  const result = validateReleaseRef({
    builtVersionCode: String(env.BUILT_ANDROID_VERSION_CODE || '').trim(),
    refName: String(env.RELEASE_REF_NAME || '').trim(),
    refType: String(env.RELEASE_REF_TYPE || '').trim(),
    releaseIdentity: readReleaseIdentity(),
  });
  process.stdout.write(
    `Android release identity valid: ${result.version} (${result.versionCode})${
      result.refType === 'tag' ? ` / ${result.refName}` : ''
    }${result.builtVersionCode ? ' / EAS build matched' : ''}\n`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  readReleaseIdentity,
  validateReleaseRef,
};
