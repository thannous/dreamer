#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { syncAndroidNativeVersion } = require('./sync-android-native-version');

const PROJECT_ID = 'cfd1b275-9dad-40d7-9d9a-147c7bb38415';
const APP_ID = 'com.tanuki75.noctalia';
const EAS_VERSION = '21.0.0';

function usesNoctaliaBuildVersions(env = process.env) {
  return (!env.NOCTALIA_APP_VARIANT || env.NOCTALIA_APP_VARIANT === 'noctalia')
    && (!env.EXPO_PUBLIC_APP_VARIANT || env.EXPO_PUBLIC_APP_VARIANT === 'noctalia')
    && env.NOCTALIA_DREAMER_QA_BUILD !== '1';
}

function readRemoteBuildVersions(root, platform, env) {
  const args = ['build:version:get', '--platform', platform, '--profile', 'production', '--json', '--non-interactive'];
  let command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  let commandArgs = ['--yes', `eas-cli@${EAS_VERSION}`, ...args];
  // Reuse the pinned CLI when it is already on PATH, including an npm exec shell.
  for (const directory of (env.PATH || '').split(path.delimiter)) {
    try {
      const binary = fs.realpathSync(path.join(directory, 'eas'));
      const cliRoot = path.resolve(binary, '../..');
      if (JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8')).version === EAS_VERSION) {
        command = process.execPath;
        commandArgs = [binary, ...args];
        break;
      }
    } catch { /* Use the pinned npm command when no matching CLI is installed. */ }
  }
  const result = spawnSync(command, commandArgs, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 4 * 1024 * 1024, timeout: 120000,
    env: { ...env, EXPO_NO_DOTENV: '1', NOCTALIA_APP_VARIANT: 'noctalia', EXPO_PUBLIC_APP_VARIANT: 'noctalia' },
  });
  if (result.error || result.status !== 0) {
    throw new Error(`EAS version lookup failed; no local version was changed. ${result.error?.message || result.stderr?.trim() || result.status}`);
  }
  try { return JSON.parse(result.stdout); }
  catch { throw new Error('EAS returned invalid version JSON; no local version was changed.'); }
}

function assertNotLower(next, current, label) {
  if (current === undefined) return;
  const a = String(next).split('.').map(Number);
  const b = String(current).split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) < (b[index] || 0)) throw new Error(`${label} would decrease from ${current} to ${next}; inspect the EAS project before syncing.`);
    if ((a[index] || 0) > (b[index] || 0)) return;
  }
}

function planIosVersions(root, config, originals, writes) {
  const projectFile = 'ios/Noctalia.xcodeproj/project.pbxproj';
  const plistFile = 'ios/Noctalia/Info.plist';
  if (originals.get(projectFile) === null && originals.get(plistFile) === null) {
    if (fs.existsSync(path.join(root, 'ios'))) throw new Error('Generated iOS project identity is not Noctalia; no files changed.');
    return;
  }
  if (originals.get(projectFile) === null || originals.get(plistFile) === null) throw new Error('Incomplete Noctalia iOS project; no files changed.');
  const { IOSConfig } = require('@expo/config-plugins');
  const plist = require('@expo/plist').default;
  const project = require('xcode').project(path.join(root, projectFile));
  project.parseSync();
  const { target } = IOSConfig.XcodeUtils.getApplicationNativeTarget({ project, projectName: 'Noctalia' });
  const configurations = IOSConfig.XcodeUtils.getBuildConfigurationsForListId(project, target.buildConfigurationList);
  if (configurations.length === 0) throw new Error('Missing Noctalia Xcode build configurations.');
  const unquote = value => String(value).replace(/^"|"$/g, '');
  let projectChanged = false;
  for (const [, entry] of configurations) {
    const settings = entry.buildSettings;
    if (unquote(settings.PRODUCT_BUNDLE_IDENTIFIER) !== APP_ID || unquote(settings.INFOPLIST_FILE) !== 'Noctalia/Info.plist') {
      throw new Error('Generated iOS app identity differs from Noctalia; no files changed.');
    }
    assertNotLower(config.ios.buildNumber, settings.CURRENT_PROJECT_VERSION, 'Xcode buildNumber');
    if (unquote(settings.CURRENT_PROJECT_VERSION) !== config.ios.buildNumber || unquote(settings.MARKETING_VERSION) !== config.version) {
      settings.CURRENT_PROJECT_VERSION = config.ios.buildNumber;
      settings.MARKETING_VERSION = config.version;
      projectChanged = true;
    }
  }
  const info = plist.parse(originals.get(plistFile));
  if (![APP_ID, '$(PRODUCT_BUNDLE_IDENTIFIER)'].includes(info.CFBundleIdentifier)) throw new Error('iOS plist app identity differs from Noctalia.');
  assertNotLower(config.ios.buildNumber, info.CFBundleVersion, 'iOS buildNumber');
  if (info.CFBundleVersion !== config.ios.buildNumber || info.CFBundleShortVersionString !== config.version) {
    writes.set(plistFile, plist.build(IOSConfig.Version.setBuildNumber(config, IOSConfig.Version.setVersion(config, info))) + '\n');
  }
  if (projectChanged) writes.set(projectFile, project.writeSync());
}

function syncMobileBuildVersions({ root = process.cwd(), platform = 'all', check = false, env = process.env, readRemote = readRemoteBuildVersions } = {}) {
  if (!['android', 'ios', 'all'].includes(platform)) throw new Error('Choose --platform android|ios|all');
  const android = platform !== 'ios';
  const ios = platform !== 'android';
  const files = ['app.json', 'eas.json',
    ...(android ? ['android/app/build.gradle'] : []),
    ...(ios ? ['ios/Noctalia/Info.plist', 'ios/Noctalia.xcodeproj/project.pbxproj'] : [])];
  const read = file => fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : null;
  const originals = new Map(files.map(file => [file, read(file)]));
  const app = JSON.parse(originals.get('app.json'));
  const config = app?.expo;
  if (!usesNoctaliaBuildVersions(env) || config?.extra?.eas?.projectId !== PROJECT_ID
      || config?.android?.package !== APP_ID || config?.ios?.bundleIdentifier !== APP_ID) {
    throw new Error('Version sync supports only the Noctalia project identity.');
  }
  if (JSON.parse(originals.get('eas.json'))?.cli?.appVersionSource !== 'remote') throw new Error('Version sync requires the remote EAS version source.');
  const versions = readRemote(root, platform, env);
  if (android) {
    const value = String(versions?.versionCode ?? '');
    if (!/^[1-9]\d*$/.test(value) || Number(value) > 2100000000) throw new Error('Missing or invalid EAS Android versionCode.');
    assertNotLower(value, config.android.versionCode, 'Android versionCode');
    config.android.versionCode = Number(value);
  }
  if (ios) {
    const value = String(versions?.buildNumber ?? '');
    if (!/^[1-9]\d*(?:\.\d+){0,2}$/.test(value)) throw new Error('Missing or invalid EAS iOS buildNumber.');
    assertNotLower(value, config.ios.buildNumber, 'iOS buildNumber');
    config.ios.buildNumber = value;
  }
  const writes = new Map();
  if (JSON.stringify(app) !== JSON.stringify(JSON.parse(originals.get('app.json')))) writes.set('app.json', `${JSON.stringify(app, null, 2)}\n`);
  if (android) {
    const currentCode = originals.get('android/app/build.gradle')?.match(/\bversionCode\s+(\d+)/)?.[1];
    assertNotLower(config.android.versionCode, currentCode, 'Native Android versionCode');
    syncAndroidNativeVersion({ cwd: root, expoConfig: config,
      writeFileSync: (file, contents) => writes.set(path.relative(root, file), contents) });
  }
  if (ios) planIosVersions(root, config, originals, writes);
  // The service lookup can take time. Preserve edits made while it was running.
  for (const [file, before] of originals) {
    if (read(file) !== before) throw new Error(`${file} changed during EAS lookup; retry after coordinating the edit. No sync writes applied.`);
  }
  if (check && writes.size) throw new Error(`Local build versions are out of sync: ${[...writes.keys()].join(', ')}. Run npm run release:versions:sync.`);
  for (const [file, contents] of writes) fs.writeFileSync(path.join(root, file), contents);
  return { source: 'EAS', platform,
    ...(android ? { versionCode: config.android.versionCode } : {}),
    ...(ios ? { buildNumber: config.ios.buildNumber } : {}),
    version: config.version, changed: [...writes.keys()] };
}

module.exports = { syncMobileBuildVersions, usesNoctaliaBuildVersions };
