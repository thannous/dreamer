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
  const runtimeVersion = appConfig?.expo?.runtimeVersion;
  const runtimePolicy = typeof runtimeVersion === 'object' && runtimeVersion
    ? String(runtimeVersion.policy || '').trim()
    : '';
  const versionCode = Number(appConfig?.expo?.android?.versionCode);

  if (!version) throw new Error('app.json must define expo.version.');
  if (packageVersion !== version) {
    throw new Error(`package.json version ${packageVersion || 'missing'} does not match app.json ${version}.`);
  }
  if (runtimePolicy !== 'fingerprint') {
    const actual = runtimePolicy
      ? `policy ${runtimePolicy}`
      : typeof runtimeVersion === 'string' && runtimeVersion.trim()
        ? `string ${runtimeVersion.trim()}`
        : 'missing';
    throw new Error(`runtimeVersion must use policy fingerprint, received ${actual}.`);
  }
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error('app.json must define a positive expo.android.versionCode.');
  }

  return { version, versionCode, runtimeVersionPolicy: runtimePolicy };
}

function validateReleaseRef({
  builtVersionCode = '',
  expectedRemoteVersionCode = '',
  versionSource = 'local',
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

  if (!['local', 'remote'].includes(versionSource)) throw new Error('Unknown appVersionSource');
  if (builtVersionCode && !/^[1-9]\d*$/.test(String(builtVersionCode))) throw new Error('Invalid built versionCode');
  if (builtVersionCode && versionSource === 'remote') {
    if (!/^[1-9]\d*$/.test(String(expectedRemoteVersionCode))) {
      throw new Error('Remote versioning requires EXPECTED_ANDROID_VERSION_CODE from the exact EAS build metadata.');
    }
    if (String(expectedRemoteVersionCode) !== String(builtVersionCode)) {
      throw new Error(`Built versionCode ${builtVersionCode} does not match the EAS build ${expectedRemoteVersionCode}.`);
    }
  }
  if (builtVersionCode && versionSource === 'local' && String(releaseIdentity.versionCode) !== String(builtVersionCode)) {
    throw new Error(
      `EAS build versionCode ${builtVersionCode} does not match app.json ${releaseIdentity.versionCode}.`
    );
  }

  return {
    ...releaseIdentity,
    versionCode: versionSource === 'remote' && builtVersionCode ? Number(builtVersionCode) : releaseIdentity.versionCode,
    builtVersionCode,
    refName,
    refType,
  };
}

function main(env = process.env) {
  const easConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  const result = validateReleaseRef({
    builtVersionCode: String(env.BUILT_ANDROID_VERSION_CODE || '').trim(),
    expectedRemoteVersionCode: String(env.EXPECTED_ANDROID_VERSION_CODE || '').trim(),
    versionSource: easConfig.cli?.appVersionSource || 'local',
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
