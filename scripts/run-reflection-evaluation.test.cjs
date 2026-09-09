'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLaunch, launch } = require('./run-reflection-evaluation.cjs');

test('launcher passes only approved environment keys and never credentials as arguments', () => {
  const environment = {
    PATH: '/mock/bin', HOME: '/mock/home', GEMINI_MODEL: 'model-for-test', GEMINI_API_KEY: 'dummy-not-a-key',
    SUPABASE_SERVICE_ROLE_KEY: 'must-not-pass', GOOGLE_APPLICATION_CREDENTIALS: '/must/not/pass',
    NODE_OPTIONS: '--require=/must/not/pass', DENO_DIR: '/must/not/pass', OTHER_SECRET: 'must-not-pass',
  };
  let called = 0;
  const status = launch(environment, (command, args, options) => {
    called++;
    assert.equal(command, 'deno');
    assert.equal(options.shell, false);
    assert.deepEqual(options.env, {
      PATH: '/mock/bin', HOME: '/mock/home', GEMINI_MODEL: 'model-for-test', GEMINI_API_KEY: 'dummy-not-a-key',
    });
    assert.ok(args.includes('--allow-env'));
    assert.ok(args.includes('--allow-net=generativelanguage.googleapis.com'));
    assert.equal(args.some((arg) => arg.includes('dummy-not-a-key')), false);
    assert.equal(args.some((arg) => arg.includes('must-not-pass')), false);
    assert.equal(args.some((arg) => arg === '--allow-run' || arg === '-A'), false);
    return { status: 7 };
  });
  assert.equal(called, 1);
  assert.equal(status, 7);
  assert.equal(environment.OTHER_SECRET, 'must-not-pass');
});

test('missing optional keys remain absent and launch paths are fixed', () => {
  const { args, options } = buildLaunch({ PATH: '/mock/bin', HOME: '/mock/home' });
  assert.deepEqual(Object.keys(options.env).sort(), ['HOME', 'PATH']);
  assert.ok(args.includes('--allow-write=/private/tmp/ti559-evaluation-run'));
  assert.ok(args.includes('--output=/private/tmp/ti559-evaluation-run'));
  assert.ok(args.includes('--allow-read=supabase/functions/api/evaluation/ti559,supabase/functions/api/services/dreamAnalysis.ts,/private/tmp/ti559-evaluation-run'));
  assert.equal(options.cwd, require('node:path').resolve(__dirname, '..'));
});

test('followup launcher keeps the same sanitized environment and excludes the original output directory', () => {
  const { args, options } = buildLaunch({ PATH: '/mock/bin', HOME: '/mock/home', GEMINI_API_KEY: 'dummy', OTHER_SECRET: 'omit' }, 'followup');
  assert.deepEqual(options.env, { PATH: '/mock/bin', HOME: '/mock/home', GEMINI_API_KEY: 'dummy' });
  assert.equal(options.shell, false);
  assert.ok(args.includes('--suite=followup'));
  assert.ok(args.includes('--allow-write=/private/tmp/ti559-followup-evaluation-run'));
  assert.ok(args.includes('--output=/private/tmp/ti559-followup-evaluation-run'));
  assert.equal(args.some((x) => x.includes('/private/tmp/ti559-evaluation-run')), false);
  assert.throws(() => buildLaunch({}, '../custom'));
});
