#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const OUTPUT_NAME = 'ti559-chat20-optimized-run';

function resolveOutput(tmpdir = os.tmpdir()) {
  return path.join(tmpdir, OUTPUT_NAME);
}

function buildLaunch(environment, tmpdir = os.tmpdir()) {
  const output = resolveOutput(tmpdir);
  const env = {};
  for (const key of ['PATH', 'HOME', 'GEMINI_API_KEY']) {
    if (typeof environment[key] === 'string') env[key] = environment[key];
  }
  return {
    command: 'deno',
    args: ['run', '--no-lock', `--allow-read=doc_web_interne/docs/qa/ti559-chat20-2026-09-09/results.json,${output}`, `--allow-write=${output}`, '--allow-env', '--allow-net=generativelanguage.googleapis.com', 'supabase/functions/api/evaluation/ti559/chat-20-optimized.ts', '--execute', `--output=${output}`],
    options: { cwd: path.resolve(__dirname, '..'), env, shell: false, stdio: 'inherit' },
  };
}

function launch(environment, spawn = spawnSync, tmpdir = os.tmpdir()) {
  const { command, args, options } = buildLaunch(environment, tmpdir);
  const result = spawn(command, args, options);
  if (result.error || result.signal || typeof result.status !== 'number') {
    console.error('Chat qualification process could not complete.');
    return 1;
  }
  return result.status;
}

if (require.main === module) {
  if (process.argv.length !== 2) throw new Error('This launcher accepts no arguments.');
  process.exitCode = launch(process.env);
}
module.exports = { OUTPUT_NAME, resolveOutput, buildLaunch, launch };
