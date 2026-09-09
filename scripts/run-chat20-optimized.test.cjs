'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
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

test('launch reports a generic failure when the process cannot complete', () => {
  const status = launch({ PATH: '/mock/bin' }, () => ({ error: new Error('spawn failed') }), '/tmp');
  assert.equal(status, 1);
});
