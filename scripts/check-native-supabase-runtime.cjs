#!/usr/bin/env node
'use strict';
// Probe for the e2e-backend check: can this machine run the disposable Supabase
// stack natively (no Docker)? It only answers; it never starts anything.
// A failing probe makes verify:release report e2e-backend as unavailable, never passed.
// Platforms: https://supabase.com/docs/guides/local-development/docker-and-native-runtimes
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MIN_CLI = [2, 119, 0];
const MIN_GLIBC = [2, 35];
const MIN_DARWIN_KERNEL = 23; // macOS 14 Sonoma
// Printed with every refusal so whoever cannot run it knows where it can run.
const SUPPORTED_HINT = 'needs Linux glibc>=2.35 (WSL2 on Windows) or macOS 14+ Apple silicon';

const parse = (text, size) => {
  const match = new RegExp(`^(\\d+)${'\\.(\\d+)'.repeat(size - 1)}`).exec(String(text ?? '').trim());
  return match ? match.slice(1).map(Number) : null;
};
const atLeast = (version, minimum) => {
  for (let i = 0; i < minimum.length; i++) {
    if (version[i] !== minimum[i]) return version[i] > minimum[i];
  }
  return true;
};

function nativeRuntimeProblems({ platform, arch, glibc, darwinRelease, uid, postgresUser, cliVersion }) {
  const problems = [];
  if (platform === 'linux') {
    if (!['x64', 'arm64'].includes(arch)) problems.push(`Linux on ${arch} is not supported (amd64 or arm64 only)`);
    const version = parse(glibc, 2);
    if (!version) problems.push('Linux without glibc is not supported');
    else if (!atLeast(version, MIN_GLIBC)) problems.push(`glibc ${glibc} is older than 2.35`);
  } else if (platform === 'darwin') {
    if (arch !== 'arm64') problems.push('macOS on Intel is not supported (Apple silicon only)');
    const kernel = parse(darwinRelease, 1);
    if (!kernel || kernel[0] < MIN_DARWIN_KERNEL) problems.push('macOS older than 14 is not supported');
  } else {
    problems.push(`${platform} is not supported by the native Supabase runtime (Linux or macOS on Apple silicon; on Windows use WSL2 with glibc 2.35 or later)`);
  }
  if (uid === 0 && !postgresUser) problems.push('running as root needs SUPABASE_NATIVE_POSTGRES_USER (Postgres initdb refuses root)');
  const cli = parse(cliVersion, 3);
  if (!cli) problems.push('the pinned Supabase CLI is not installed (npm ci)');
  else if (!atLeast(cli, MIN_CLI)) problems.push(`Supabase CLI ${cliVersion} is older than 2.119.0`);
  return problems;
}

function probe(root = path.resolve(__dirname, '..')) {
  const cli = process.env.E2E_SUPABASE_CLI || path.join(root, 'node_modules/.bin/supabase');
  const result = spawnSync(cli, ['--version'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 });
  return nativeRuntimeProblems({
    platform: process.platform,
    arch: process.arch,
    glibc: process.report?.getReport?.().header?.glibcVersionRuntime,
    darwinRelease: process.platform === 'darwin' ? os.release() : undefined,
    uid: typeof process.getuid === 'function' ? process.getuid() : undefined,
    postgresUser: process.env.SUPABASE_NATIVE_POSTGRES_USER,
    cliVersion: result.status === 0 ? result.stdout : null,
  });
}

if (require.main === module) {
  const problems = probe();
  if (problems.length) {
    console.error(`Native Supabase runtime unavailable: ${problems.join('; ')}. Hint: ${SUPPORTED_HINT}.`);
    process.exitCode = 1;
  } else {
    console.log('Native Supabase runtime supported here.');
  }
}

module.exports = { SUPPORTED_HINT, nativeRuntimeProblems, probe };
