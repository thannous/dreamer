const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getAdbCandidates(env = process.env, platform = process.platform) {
  const sdkRoots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT].filter(Boolean);
  if (platform === 'win32' && env.LOCALAPPDATA) {
    sdkRoots.push(path.join(env.LOCALAPPDATA, 'Android', 'Sdk'));
  }
  if (platform === 'darwin' && env.HOME) {
    sdkRoots.push(path.join(env.HOME, 'Library/Android/sdk'));
  }
  if (platform !== 'win32') {
    sdkRoots.push('/opt/android-sdk', '/usr/local/share/android-sdk');
  }

  const executable = platform === 'win32' ? 'adb.exe' : 'adb';

  return Array.from(
    new Set(sdkRoots.map((sdkRoot) => path.join(sdkRoot, 'platform-tools', executable)))
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
  platform = process.platform,
} = {}) {
  const lookupCommand = platform === 'win32' ? 'where' : 'which';
  const result = spawn(lookupCommand, [command], { encoding: 'utf8' });
  if (result.status === 0) {
    return command;
  }

  if (command === 'adb') {
    return getAdbCandidates(env, platform).find((candidate) => existsSync(candidate)) || null;
  }

  if (command === 'maestro') {
    return getMaestroCandidates(env).find((candidate) => existsSync(candidate)) || null;
  }

  return null;
}

function resolveNpmInvocation({
  env = process.env,
  existsSync = fs.existsSync,
  execPath = process.execPath,
  platform = process.platform,
} = {}) {
  if (env.npm_execpath && existsSync(env.npm_execpath)) {
    return { command: execPath, baseArgs: [env.npm_execpath] };
  }

  if (platform === 'win32') {
    const bundledCli = path.join(
      path.dirname(execPath),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    );
    return existsSync(bundledCli)
      ? { command: execPath, baseArgs: [bundledCli] }
      : null;
  }

  return { command: 'npm', baseArgs: [] };
}

function commandExists(command, spawn = spawnSync) {
  return Boolean(resolveCommand(command, { spawn }));
}

module.exports = {
  commandExists,
  getAdbCandidates,
  getMaestroCandidates,
  resolveCommand,
  resolveNpmInvocation,
};
