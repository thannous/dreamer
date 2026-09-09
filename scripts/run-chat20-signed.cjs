#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const output = '/private/tmp/ti559-chat20-signed-run';
if (process.argv.length !== 2) throw new Error('This launcher accepts no arguments.');
const env = {};
for (const key of ['PATH', 'HOME', 'GEMINI_API_KEY']) {
  if (typeof process.env[key] === 'string') env[key] = process.env[key];
}
const result = spawnSync('deno', ['run', '--no-lock', `--allow-read=doc_web_interne/docs/qa/ti559-chat20-2026-09-09/results.json,${output}`, `--allow-write=${output}`, '--allow-env', '--allow-net=generativelanguage.googleapis.com', 'supabase/functions/api/evaluation/ti559/chat-20-signed.ts', '--execute'], { cwd: path.resolve(__dirname, '..'), env, shell: false, stdio: 'inherit' });
if (result.error || result.signal || typeof result.status !== 'number') {
  console.error('Chat qualification process could not complete.');
  process.exitCode = 1;
} else process.exitCode = result.status;
