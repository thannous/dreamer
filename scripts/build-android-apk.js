#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const EAS_CLI_SPEC = 'eas-cli@21.0.0';

function resolveNpxCommand(platform = process.platform) {
  return platform === 'win32' ? 'npx.cmd' : 'npx';
}

function buildPlan(target, env = process.env) {
  const baseEnv = {
    ...env,
    EAS_LOCAL_BUILD_ARTIFACTS_DIR: path.join(ROOT_DIR, 'dist'),
  };
  const npxCommand = resolveNpxCommand();

  if (target === 'mock') {
    return [{
      command: npxCommand,
      args: ['--yes', EAS_CLI_SPEC, 'build', '-p', 'android', '--profile', 'preview', '--local'],
      env: { ...baseEnv, EXPO_PUBLIC_MOCK_MODE: 'true' },
      label: 'local mock APK',
    }];
  }

  if (target === 'prod') {
    return [
      {
        command: process.execPath,
        args: [path.join(ROOT_DIR, 'scripts', 'check-android-release-gates.js'), '--prebuild'],
        env: baseEnv,
        label: 'Android release prebuild gates',
      },
      {
        command: npxCommand,
        args: [
          '--yes',
          EAS_CLI_SPEC,
          'build',
          '-p',
          'android',
          '--profile',
          'production-apk',
          '--local',
        ],
        env: { ...baseEnv, EXPO_NO_DOTENV: '1' },
        label: 'local production APK',
      },
    ];
  }

  throw new Error('Expected APK target: mock or prod.');
}

function printHelp() {
  console.log('Usage: node scripts/build-android-apk.js <mock|prod>');
}

function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  for (const step of buildPlan(args[0])) {
    console.log(`[build-apk] ${step.label}`);
    const result = spawnSync(step.command, step.args, {
      cwd: ROOT_DIR,
      env: step.env,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error(`${step.label} failed with status ${result.status ?? 'unknown'}`);
    }
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[build-apk] ${error.message || error}`);
    process.exitCode = 1;
  }
}

module.exports = { buildPlan, EAS_CLI_SPEC, resolveNpxCommand };
