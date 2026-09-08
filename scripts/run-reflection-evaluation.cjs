#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ENVIRONMENT_KEYS = ['PATH', 'HOME', 'GEMINI_MODEL', 'GEMINI_API_KEY'];
const OUTPUT = '/private/tmp/ti559-evaluation-run';
const ENTRY = 'supabase/functions/api/evaluation/ti559/evaluate.ts';

function buildLaunch(environment) {
  const env = {};
  for (const key of ENVIRONMENT_KEYS) {
    if (typeof environment[key] === 'string') env[key] = environment[key];
  }
  return {
    command: 'deno',
    args: [
      'run', '--no-lock',
      `--allow-read=supabase/functions/api/evaluation/ti559,supabase/functions/api/services/dreamAnalysis.ts,${OUTPUT}`,
      `--allow-write=${OUTPUT}`,
      // The SDK enumerates its environment. Only the four keys above reach Deno.
      '--allow-env', '--allow-net=generativelanguage.googleapis.com',
      ENTRY, '--execute', `--output=${OUTPUT}`,
    ],
    options: { cwd: path.resolve(__dirname, '..'), env, shell: false, stdio: 'inherit' },
  };
}

function launch(environment, spawn = spawnSync) {
  const { command, args, options } = buildLaunch(environment);
  const result = spawn(command, args, options);
  if (result.error || result.signal || typeof result.status !== 'number') {
    // Do not print spawn errors, arguments or environment values containing credentials.
    console.error('Reflection evaluation process could not complete.');
    return 1;
  }
  return result.status;
}

if (require.main === module) {
  if (process.argv.length !== 2) {
    console.error('Reflection evaluation accepts no launcher arguments.');
    process.exitCode = 1;
  } else {
    process.exitCode = launch(process.env);
  }
}
module.exports = { buildLaunch, launch };
