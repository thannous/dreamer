#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');

const STORE_BUNDLES = {
  noctalia: 'com.tanuki75.noctalia',
  lucid: 'com.tanuki75.noctalia.lucid',
};
const HEALTH_PURPOSE_KEYS = ['NSHealthShareUsageDescription', 'NSHealthUpdateUsageDescription'];

function assertPortableFingerprint(fingerprint) {
  if (!Array.isArray(fingerprint?.sources)) throw new Error('Expo did not return fingerprint sources. No EAS build started.');
  const external = fingerprint.sources.filter(source =>
    (source.type === 'file' || source.type === 'dir')
    && typeof source.filePath === 'string'
    && (path.isAbsolute(source.filePath) || path.win32.isAbsolute(source.filePath) || source.filePath.split(/[\\/]/).includes('..'))
  );
  if (external.length) {
    const samples = external.slice(0, 3).map(source => source.filePath).join(', ');
    throw new Error(`Expo fingerprint includes ${external.length} source(s) outside this checkout: ${samples}. Run npm ci in an isolated checkout before EAS Build.`);
  }
  return fingerprint.sources.length;
}

function assertAndroidStoreConfig(config, app) {
  const expectedPackage = STORE_BUNDLES[app];
  if (!expectedPackage) throw new Error(`No Android store identity configured for ${app}`);
  if (config?.android?.package !== expectedPackage) {
    throw new Error(`Resolved android.package ${config?.android?.package ?? '<missing>'} does not match ${expectedPackage}. No EAS build started.`);
  }
}

function assertIosStoreConfig(config, app) {
  const expectedBundle = STORE_BUNDLES[app];
  if (!expectedBundle) throw new Error(`No iOS store identity configured for ${app}`);
  if (config?.ios?.bundleIdentifier !== expectedBundle) {
    throw new Error(`Resolved iOS bundleIdentifier ${config?.ios?.bundleIdentifier ?? '<missing>'} does not match ${expectedBundle}. No EAS build started.`);
  }
  const plist = config?._internal?.modResults?.ios?.infoPlist;
  if (!plist || typeof plist !== 'object') throw new Error('Expo introspection did not return the final iOS Info.plist. No EAS build started.');
  const missing = HEALTH_PURPOSE_KEYS.filter(key => typeof plist[key] !== 'string' || !plist[key].trim());
  if (missing.length) throw new Error(`Resolved iOS Info.plist is missing ${missing.join(', ')}; Apple can reject the upload with 90683. No EAS build started.`);
}

async function checkBuildInputs(root, app, platform) {
  if (!['noctalia', 'lucid', 'meditation'].includes(app) || !['android', 'ios'].includes(platform)) {
    throw new Error('Use --app noctalia|lucid|meditation --platform android|ios');
  }
  const projectRoot = app === 'meditation' ? path.join(root, 'apps/meditation') : root;
  const eas = JSON.parse(fs.readFileSync(path.join(projectRoot, 'eas.json'), 'utf8'));
  const profile = app === 'lucid' ? 'lucid-production' : 'production';
  Object.assign(process.env, eas.build?.base?.env ?? {}, eas.build?.[profile]?.env ?? {}, {
    EXPO_NO_DOTENV: '1', NOCTALIA_APP_VARIANT: app === 'lucid' ? 'lucid' : 'noctalia',
    EXPO_PUBLIC_APP_VARIANT: app === 'lucid' ? 'lucid' : 'noctalia',
  });
  const projectRequire = createRequire(path.join(projectRoot, 'package.json'));
  let createFingerprintAsync;
  try { ({ createFingerprintAsync } = projectRequire('expo/fingerprint')); }
  catch (error) { throw new Error(`Install project dependencies with npm ci in ${projectRoot} before EAS Build: ${error.message}`); }
  const fingerprint = await createFingerprintAsync(projectRoot, { platforms: [platform], silent: true });
  const sourceCount = assertPortableFingerprint(fingerprint);

  if (app !== 'meditation') {
    const expo = path.join(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'expo.cmd' : 'expo');
    const output = execFileSync(expo, ['config', '--type', 'introspect', '--json'], {
      cwd: projectRoot,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 32 * 1024 * 1024,
    });
    const config = JSON.parse(output);
    if (platform === 'ios') assertIosStoreConfig(config, app);
    else assertAndroidStoreConfig(config, app);
  }
  return { sourceCount, platform, app };
}

function parseCli(args) {
  const options = { app: null, platform: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--app') options.app = args[++i];
    else if (args[i] === '--platform') options.platform = args[++i];
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  return options;
}

if (require.main === module) {
  try {
    const { app, platform } = parseCli(process.argv.slice(2));
    checkBuildInputs(process.cwd(), app, platform)
      .then(result => console.log(`EAS build inputs ready: ${result.app} ${result.platform}, ${result.sourceCount} local fingerprint sources.`))
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { assertPortableFingerprint, assertIosStoreConfig, assertAndroidStoreConfig, checkBuildInputs };
