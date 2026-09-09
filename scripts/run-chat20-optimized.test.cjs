'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { OUTPUT_NAME, resolveOutput, buildLaunch, launch } = require('./run-chat20-optimized.cjs');

test('output lives under the platform temp directory on this host', () => {
  const output = resolveOutput();
  assert.equal(output, path.join(os.tmpdir(), OUTPUT_NAME));
  assert.equal(path.basename(output), OUTPUT_NAME);
});

test('linux and macos parents join to the same leaf name', () => {
  assert.equal(resolveOutput('/tmp'), '/tmp/ti559-chat20-optimized-run');
  assert.equal(resolveOutput('/private/tmp'), '/private/tmp/ti559-chat20-optimized-run');
  assert.equal(resolveOutput('/var/folders/xx/yy/T'), '/var/folders/xx/yy/T/ti559-chat20-optimized-run');
  assert.equal(resolveOutput('/tmp/'), '/tmp/ti559-chat20-optimized-run');
});

test('windows temp parents join to the same leaf name', () => {
  assert.equal(resolveOutput('C:\\Users\\foo\\AppData\\Local\\Temp', path.win32.join), 'C:\\Users\\foo\\AppData\\Local\\Temp\\ti559-chat20-optimized-run');
  assert.equal(resolveOutput('C:\\Users\\foo\\AppData\\Local\\Temp\\', path.win32.join), 'C:\\Users\\foo\\AppData\\Local\\Temp\\ti559-chat20-optimized-run');
});

test('launcher passes the resolved path to Deno as output, read, and write', () => {
  const tmpdir = '/tmp';
  const output = resolveOutput(tmpdir);
  const { args, options } = buildLaunch({ PATH: '/mock/bin', HOME: '/mock/home', GEMINI_API_KEY: 'dummy-not-a-key', OTHER_SECRET: 'omit' }, tmpdir);
  assert.equal(options.shell, false);
  assert.deepEqual(options.env, { PATH: '/mock/bin', HOME: '/mock/home', GEMINI_API_KEY: 'dummy-not-a-key' });
  assert.ok(args.includes(`--allow-write=${output}`));
  assert.ok(args.includes(`--output=${output}`));
  assert.ok(args.includes(`--allow-read=doc_web_interne/docs/qa/ti559-chat20-2026-09-09/results.json,${output}`));
  assert.equal(args.some((arg) => arg.includes('/private/tmp')), false);
  assert.equal(args.some((arg) => arg.includes('dummy-not-a-key')), false);
});

test('preview and run share the launcher output path', () => {
  const tmpdir = '/var/folders/xx/yy/T';
  const output = resolveOutput(tmpdir);
  const preview = buildLaunch({ PATH: '/mock/bin', HOME: '/mock/home', GEMINI_API_KEY: 'dummy-not-a-key', OTHER_SECRET: 'omit' }, tmpdir, 'preview');
  const run = buildLaunch({ PATH: '/mock/bin', HOME: '/mock/home', GEMINI_API_KEY: 'dummy-not-a-key' }, tmpdir, 'run');
  assert.ok(preview.args.includes(`--output=${output}`));
  assert.ok(run.args.includes(`--output=${output}`));
  assert.equal(preview.args.includes('--execute'), false);
  assert.equal(preview.args.includes('--allow-env'), false);
  assert.equal(preview.args.includes('--allow-write=' + output), false);
  assert.equal(preview.args.some((arg) => arg.startsWith('--allow-net=')), false);
  assert.deepEqual(preview.options.env, { PATH: '/mock/bin', HOME: '/mock/home' });
  assert.ok(run.args.includes('--execute'));
  assert.throws(() => buildLaunch({}, tmpdir, 'other'));
});

test('launch reports a generic failure when the process cannot complete', () => {
  const status = launch({ PATH: '/mock/bin' }, () => ({ error: new Error('spawn failed') }), '/tmp');
  assert.equal(status, 1);
});

test('deno accepts windows and posix launcher outputs and rejects traversal or the wrong leaf', () => {
  const cwd = path.resolve(__dirname, '..');
  const script = 'supabase/functions/api/evaluation/ti559/chat-20-optimized.ts';
  const read = 'doc_web_interne/docs/qa/ti559-chat20-2026-09-09/results.json';
  const run = (output) => spawnSync('deno', ['run', '--no-lock', `--allow-read=${read}`, script, `--output=${output}`], { cwd, encoding: 'utf8', shell: false });
  const posix = run('/tmp/ti559-chat20-optimized-run');
  assert.equal(posix.status, 0, posix.stderr);
  assert.equal(JSON.parse(posix.stdout).output, '/tmp/ti559-chat20-optimized-run');
  const windows = run('C:\\Users\\foo\\AppData\\Local\\Temp\\ti559-chat20-optimized-run');
  assert.equal(windows.status, 0, windows.stderr);
  assert.equal(JSON.parse(windows.stdout).output, 'C:\\Users\\foo\\AppData\\Local\\Temp\\ti559-chat20-optimized-run');
  const macos = run('/var/folders/xx/yy/T/ti559-chat20-optimized-run');
  assert.equal(macos.status, 0, macos.stderr);
  assert.equal(JSON.parse(macos.stdout).output, '/var/folders/xx/yy/T/ti559-chat20-optimized-run');
  assert.notEqual(run('/tmp/../etc/ti559-chat20-optimized-run').status, 0);
  assert.notEqual(run('C:\\Users\\foo\\AppData\\Local\\Temp\\..\\ti559-chat20-optimized-run').status, 0);
  assert.notEqual(run('/tmp/other-name').status, 0);
  assert.notEqual(run('C:\\Users\\foo\\AppData\\Local\\Temp\\other-name').status, 0);
  const missing = spawnSync('deno', ['run', '--no-lock', `--allow-read=${read}`, script], { cwd, encoding: 'utf8', shell: false });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Preview requires --output from the launcher/);
});
