#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const OUTPUT_NAME = 'ti559-chat20-optimized-run';

function resolveOutput(tmpdir = os.tmpdir(), join = path.join) {
  return join(tmpdir, OUTPUT_NAME);
}

function buildLaunch(environment, tmpdir = os.tmpdir(), mode = 'run') {
  if (mode !== 'run' && mode !== 'preview') throw new Error('Unknown launcher mode.');
  const output = resolveOutput(tmpdir);
  const env = {};
  for (const key of mode === 'preview' ? ['PATH', 'HOME'] : ['PATH', 'HOME', 'GEMINI_API_KEY']) {
    if (typeof environment[key] === 'string') env[key] = environment[key];
  }
  const source = 'doc_web_interne/docs/qa/ti559-chat20-2026-09-09/results.json';
  const script = 'supabase/functions/api/evaluation/ti559/chat-20-optimized.ts';
  const args = mode === 'preview'
    ? ['run', '--no-lock', `--allow-read=${source}`, script, `--output=${output}`]
    : ['run', '--no-lock', `--allow-read=${source},${output}`, `--allow-write=${output}`, '--allow-env', '--allow-net=generativelanguage.googleapis.com', script, '--execute', `--output=${output}`];
  return {
    command: 'deno',
    args,
    options: { cwd: path.resolve(__dirname, '..'), env, shell: false, stdio: 'inherit' },
  };
}

function launch(environment, spawn = spawnSync, tmpdir = os.tmpdir(), mode = 'run') {
  const { command, args, options } = buildLaunch(environment, tmpdir, mode);
  const result = spawn(command, args, options);
  if (result.error || result.signal || typeof result.status !== 'number') {
    console.error('Chat qualification process could not complete.');
    return 1;
  }
  return result.status;
}

if (require.main === module) {
  const extra = process.argv.slice(2);
  if (extra.length === 0) process.exitCode = launch(process.env);
  else if (extra.length === 1 && extra[0] === '--preview') process.exitCode = launch(process.env, spawnSync, os.tmpdir(), 'preview');
  else throw new Error('This launcher accepts no arguments other than --preview.');
}
module.exports = { OUTPUT_NAME, resolveOutput, buildLaunch, launch };
