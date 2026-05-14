#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const { resolveCommand } = require('./check-android-release-gates');

const DEFAULT_PACKAGE = 'com.tanuki75.noctalia';
const PLAY_INSTALLER = 'com.android.vending';

function parseArgs(argv) {
  const options = {
    packageName: DEFAULT_PACKAGE,
    reportOnly: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--device') {
      options.device = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--package') {
      options.packageName = argv[i + 1] ?? options.packageName;
      i += 1;
      continue;
    }
    if (arg === '--report-only') {
      options.reportOnly = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node ./scripts/check-play-install-source.js [--device <adb-id>] [--package <application-id>] [--report-only] [--json]

Checks that the installed Android package came from Google Play. Play RevenueCat
purchase evidence must only be recorded when installerPackageName is ${PLAY_INSTALLER}.
`.trim());
}

function readPackageInfo(output) {
  const text = String(output || '');
  return {
    versionCode: text.match(/\bversionCode=(\d+)/)?.[1] ?? null,
    versionName: text.match(/\bversionName=([^\s]+)/)?.[1] ?? null,
    installerPackageName: text.match(/\binstallerPackageName=([^\s]+)/)?.[1] ?? null,
    initiatingPackageName: text.match(/\binitiatingPackageName=([^\s]+)/)?.[1] ?? null,
  };
}

function checkPlayInstallSource({
  spawn = spawnSync,
  env = process.env,
  device,
  packageName = DEFAULT_PACKAGE,
} = {}) {
  const adbCommand = resolveCommand('adb', { spawn, env });
  if (!adbCommand) {
    return {
      ok: false,
      packageName,
      adbCommand: null,
      installerPackageName: null,
      message: 'adb is not available in PATH or common Android SDK locations.',
      next: 'Install Android SDK platform-tools or add adb to PATH.',
    };
  }

  const args = [];
  if (device) args.push('-s', device);
  args.push('shell', 'dumpsys', 'package', packageName);

  const result = spawn(adbCommand, args, {
    encoding: 'utf8',
    timeout: 10000,
  });
  if (result.status !== 0) {
    return {
      ok: false,
      packageName,
      adbCommand,
      installerPackageName: null,
      message: (result.stderr || result.stdout || 'Unable to inspect package.').trim(),
      next: 'Install the Internal Testing build from Google Play on the connected device, then retry.',
    };
  }

  const info = readPackageInfo(result.stdout);
  if (!result.stdout.includes(`Package [${packageName}]`)) {
    return {
      ok: false,
      packageName,
      adbCommand,
      ...info,
      message: `${packageName} is not installed on the selected device.`,
      next: 'Install Noctalia from Google Play Internal Testing before recording Play evidence.',
    };
  }

  const ok = info.installerPackageName === PLAY_INSTALLER;
  return {
    ok,
    packageName,
    adbCommand,
    ...info,
    message: ok
      ? `${packageName} is Play-installed (${PLAY_INSTALLER}).`
      : `${packageName} is not Play-installed; installerPackageName=${info.installerPackageName || 'missing'}.`,
    next: ok
      ? null
      : 'Do not record Play purchase evidence from this install. Install via Google Play Internal Testing.',
  };
}

function formatReport(report) {
  const lines = ['[play-install-source] Google Play install source check'];
  lines.push(`[play-install-source] adb: ${report.adbCommand || 'not found'}`);
  lines.push(`[play-install-source] package: ${report.packageName}`);
  if (report.versionCode) lines.push(`[play-install-source] versionCode: ${report.versionCode}`);
  if (report.versionName) lines.push(`[play-install-source] versionName: ${report.versionName}`);
  lines.push(`[play-install-source] installerPackageName: ${report.installerPackageName || 'missing'}`);
  if (report.initiatingPackageName) {
    lines.push(`[play-install-source] initiatingPackageName: ${report.initiatingPackageName}`);
  }
  lines.push(`[play-install-source] ${report.ok ? 'PASS' : 'FAIL'} - ${report.message}`);
  if (report.next) lines.push(`  Next: ${report.next}`);
  return lines.join('\n');
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = checkPlayInstallSource(options);
    process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
    if (!report.ok && !options.reportOnly) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  PLAY_INSTALLER,
  checkPlayInstallSource,
  formatReport,
  parseArgs,
  readPackageInfo,
};
