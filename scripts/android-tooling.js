const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getAdbCandidates(env = process.env) {
  const sdkRoots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT].filter(Boolean);
  if (env.HOME) {
    sdkRoots.push(path.join(env.HOME, 'Library/Android/sdk'));
  }
  sdkRoots.push('/opt/android-sdk', '/usr/local/share/android-sdk');

  return Array.from(
    new Set(sdkRoots.map((sdkRoot) => path.join(sdkRoot, 'platform-tools', 'adb')))
  );
}

function getMaestroCandidates(env = process.env) {
  const candidates = [];
  if (env.MAESTRO_CLI_PATH) {
    candidates.push(env.MAESTRO_CLI_PATH);
  }
  candidates.push(
    '/opt/homebrew/opt/maestro/bin/maestro',
    '/usr/local/opt/maestro/bin/maestro'
  );
  return Array.from(new Set(candidates));
}

function resolveCommand(command, {
  spawn = spawnSync,
  existsSync = fs.existsSync,
  env = process.env,
} = {}) {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  const result = spawn(lookupCommand, [command], { encoding: 'utf8' });
  if (result.status === 0) {
    return command;
  }

  if (command === 'adb') {
    return getAdbCandidates(env).find((candidate) => existsSync(candidate)) || null;
  }

  if (command === 'maestro') {
    return getMaestroCandidates(env).find((candidate) => existsSync(candidate)) || null;
  }

  return null;
}

function commandExists(command, spawn = spawnSync) {
  return Boolean(resolveCommand(command, { spawn }));
}

module.exports = {
  commandExists,
  getAdbCandidates,
  getMaestroCandidates,
  resolveCommand,
};
