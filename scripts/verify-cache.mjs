#!/usr/bin/env node
// Carries a file a check writes in the isolated copy, such as TypeScript's
// incremental build info, from one verify:pr run to the next through the
// clone's shared git directory ($VERIFY_LOCAL_COMMON_DIR/verify-cache/<file>).
// Only a PR run restores it, and only a passing PR run saves it: a release, or
// a run outside the engine, starts without it, so a publication never rests on
// an earlier run. The command runs in a shell, as verify-local runs checks.
//
//   node scripts/verify-cache.mjs <file> -- <command...>
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function cachePaths(file, env = process.env, cwd = process.cwd()) {
  if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw new Error(`${file}: expected a path inside the copy.`);
  if (env.VERIFY_LOCAL_KIND !== 'pr' || !env.VERIFY_LOCAL_COMMON_DIR) return null;
  return { local: path.join(cwd, file), kept: path.join(env.VERIFY_LOCAL_COMMON_DIR, 'verify-cache', file) };
}

export function restore(paths) {
  if (!paths || !existsSync(paths.kept)) return false;
  mkdirSync(path.dirname(paths.local), { recursive: true });
  copyFileSync(paths.kept, paths.local);
  return true;
}

export function save(paths) {
  if (!paths || !existsSync(paths.local)) return false;
  mkdirSync(path.dirname(paths.kept), { recursive: true });
  const temporary = `${paths.kept}.${process.pid}`;
  copyFileSync(paths.local, temporary);
  renameSync(temporary, paths.kept);
  return true;
}

function main(argv = process.argv.slice(2)) {
  const separator = argv.indexOf('--');
  if (separator !== 1 || argv.length < 3) throw new Error('Usage: verify-cache.mjs <file> -- <command...>');
  const paths = cachePaths(argv[0]);
  if (restore(paths)) console.log(`[verify-cache] ${argv[0]} restored from an earlier verify:pr run.`);
  const result = spawnSync(argv.slice(2).join(' '), { shell: true, stdio: 'inherit' });
  if (result.error) throw result.error;
  const status = result.status ?? 1;
  if (status === 0 && save(paths)) console.log(`[verify-cache] ${argv[0]} kept for the next verify:pr run.`);
  return status;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
