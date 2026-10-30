#!/usr/bin/env node
'use strict';

// Keep the CLI outside the apps' runtime fingerprints and preserve the caller's
// Expo root. npm --prefix changes cwd, so convenience scripts name it explicitly.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
let args = process.argv.slice(2);
let cwd = process.cwd();
if (args[0] === '--project') {
  if (!args[1]) {
    console.error('Usage: node run.cjs [--project <app-root>] <command> [options]');
    process.exit(1);
  }
  cwd = path.resolve(args[1]);
  args = args.slice(2);
}
let cli;
try {
  cli = require.resolve('@expo/agent-cli/bin/cli.js');
} catch {
  console.error('Install the pinned CLI: npm ci --prefix tools/expo-agent (from the repository root).');
  process.exit(1);
}
const result = spawnSync(process.execPath, [cli, ...args], { cwd, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
if (result.signal) process.kill(process.pid, result.signal);
else process.exitCode = result.status ?? 1;
