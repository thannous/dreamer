/* global describe, expect, it */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareIosNativeProject } = require('./ios-native-preflight');

function write(file, content = 'x') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function makeProject({ podfileExpo, installedExpo }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ios-preflight-'));
  const cwd = path.join(root, 'app');
  write(path.join(cwd, 'node_modules/expo/package.json'), JSON.stringify({ version: installedExpo }));
  write(path.join(cwd, 'ios/Podfile.lock'), `PODS:\n  - Expo (${podfileExpo}):\n    - ExpoModulesCore\n`);
  const cache = path.join(root, 'cache');
  return { cwd, cache, env: { CP_CACHE_DIR: cache } };
}

describe('prepareIosNativeProject', () => {
  it('regenerates ios/ generated for another Expo SDK', () => {
    const { cwd, env } = makeProject({ podfileExpo: '57.0.23', installedExpo: '58.0.17' });
    const calls = [];
    const result = prepareIosNativeProject({ cwd, env, log: () => {}, prebuild: (args) => calls.push(args) });
    expect(result.regenerated).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('keeps a project matching the installed SDK', () => {
    const { cwd, env } = makeProject({ podfileExpo: '58.0.17', installedExpo: '58.0.17' });
    const prebuild = () => { throw new Error('must not prebuild'); };
    expect(prepareIosNativeProject({ cwd, env, log: () => {}, prebuild }).regenerated).toBe(false);
  });

  it('drops truncated cache entries and the Pods copied from them, keeping healthy ones', () => {
    const { cwd, cache, env } = makeProject({ podfileExpo: '58.0.17', installedExpo: '58.0.17' });
    const truncated = path.join(cache, 'Pods/Release/AppAuth/2.1.0-ef4da');
    fs.mkdirSync(path.join(truncated, 'Sources/AppAuth/iOS'), { recursive: true });
    write(path.join(truncated, 'Sources/AppAuthCore/OIDError.m'));
    const healthy = path.join(cache, 'Pods/Release/GoogleSignIn/9.2.0-e449a');
    write(path.join(healthy, 'GoogleSignIn/Sources/GIDSignIn.m'));
    fs.mkdirSync(path.join(cwd, 'ios/Pods/AppAuth/Sources/AppAuth/iOS'), { recursive: true });

    const result = prepareIosNativeProject({ cwd, env, log: () => {} });

    expect(result.removed).toEqual([{ name: 'AppAuth', dir: truncated }]);
    expect(fs.existsSync(truncated)).toBe(false);
    expect(fs.existsSync(healthy)).toBe(true);
    expect(fs.existsSync(path.join(cwd, 'ios/Pods'))).toBe(false);
  });
});
