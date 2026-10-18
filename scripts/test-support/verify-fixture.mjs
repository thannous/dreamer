import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cleanGitEnv, ENGINE_FILE_SHA256 } from '../verify-local.mjs';
export const ENGINE = fileURLToPath(new URL('../verify-local.mjs', import.meta.url));
// The engine's sha256 is pinned in this repository's own verify-local.config.mjs
// (export ENGINE_SHA256). No other repository is read or compared.
export const CONFIG_PATH = fileURLToPath(new URL('../../verify-local.config.mjs', import.meta.url));
export const scratch = mkdtempSync(path.join(os.tmpdir(), 'verify-local-test-'));

/** Whether a process is gone (or a zombie waiting to be reaped), within about 5 s. */
export async function gone(pid) {
  const dead = () => {
    try { process.kill(pid, 0); } catch { return true; }
    try { return /^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch { return false; }
  };
  for (let i = 0; i < 100 && !dead(); i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  return dead();
}
after(() => rmSync(scratch, { recursive: true, force: true }));

export const CONFIG = `export const ENGINE_SHA256 = '${ENGINE_FILE_SHA256}';
export default {
  mainBranch: 'main',
  commands: { pr: 'npm run verify:pr', release: 'npm run verify:release' },
  deps: { mode: 'link', lockfile: 'package-lock.json', install: 'echo install >> "$RUN_LOG" && mkdir -p node_modules' },
  checks: [
    { name: 'lint', command: 'echo lint >> "$RUN_LOG"', inputs: ['src/**'] },
    { name: 'test', command: 'echo test >> "$RUN_LOG" && grep -q ok src/a.js && test -z "$GIT_DIR" && test -z "$FAIL_TEST"' },
    { name: 'db', command: 'echo db >> "$RUN_LOG" && test -z "$FAIL_DB"', when: ['db/'], specialised: true, requires: { command: 'test -n "$DB_AVAILABLE"', hint: 'start the database' } },
    { name: 'site', command: 'echo site-check >> "$RUN_LOG"', when: ['site/'], releaseAlways: true },
    { name: 'build', command: 'echo build:$VERIFY_LOCAL_SHA >> "$RUN_LOG" && test -z "$FAIL_BUILD"', kinds: ['release'], perCommit: true },
    { name: 'bundle', command: 'echo bundle >> "$RUN_LOG" && test ! -e node_modules/ext && test -z "$FAIL_BUNDLE"', kinds: ['release'], targets: ['app'], install: true },
    { name: 'site-e2e', command: 'echo site >> "$RUN_LOG"', kinds: ['release'], targets: ['site'], specialised: true },
  ],
  hook: { maxFileBytes: 1024 * 1024, allow: ['public/*.pem'] },
  externalSources: ['https://ci.example/run/'],
};
`;

let counter = 0;

export function makeRepository() {
  counter += 1;
  const base = path.join(scratch, `case-${counter}`);
  const origin = path.join(base, 'origin.git');
  const work = path.join(base, 'work');
  const runLog = path.join(base, 'run.log');
  mkdirSync(base, { recursive: true });
  const env = {
    ...cleanGitEnv(),
    RUN_LOG: runLog,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    GIT_CONFIG_NOSYSTEM: '1',
    HOME: base,
    // Each fixture takes its own heavy-check lock, never the machine's.
    VERIFY_LOCAL_HEAVY_LOCK: path.join(base, 'heavy.lock'),
  };
  const git = (args, cwd = work, extra = {}) => {
    const result = spawnSync('git', args, { cwd, env: { ...env, ...extra }, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };
  git(['init', '--quiet', '--bare', '--initial-branch=main', origin], base);
  git(['clone', '--quiet', origin, work], base);
  git(['checkout', '--quiet', '-b', 'main']);
  const write = (file, content) => {
    mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
    writeFileSync(path.join(work, file), content);
  };
  write('verify-local.config.mjs', CONFIG);
  write('package.json', '{ "name": "fixture", "packageManager": "npm@11.0.0" }\n');
  write('package-lock.json', '{ "lockfileVersion": 3 }\n');
  write('src/a.js', 'export const value = "ok";\n');
  write('docs/readme.md', '# fixture\n');
  write('.gitignore', 'node_modules/\n');
  git(['add', '-A']);
  git(['commit', '--quiet', '-m', 'init']);
  git(['push', '--quiet', 'origin', 'main']);
  const commit = (message, files) => {
    for (const [file, content] of Object.entries(files)) write(file, content);
    git(['add', '-A']);
    git(['commit', '--quiet', '-m', message]);
    return git(['rev-parse', 'HEAD']);
  };
  const runs = () => (existsSync(runLog) ? readFileSync(runLog, 'utf8').trim().split('\n').filter(Boolean) : []);
  const clearRuns = () => rmSync(runLog, { force: true });
  const lines = [];
  const options = { cwd: work, env, log: (line) => lines.push(line), worktreeRoot: path.join(base, 'worktrees') };
  return { base, origin, work, env, git, write, commit, runs, clearRuns, lines, options };
}

