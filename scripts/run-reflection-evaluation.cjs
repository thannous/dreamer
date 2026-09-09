#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ENVIRONMENT_KEYS = ['PATH', 'HOME', 'GEMINI_MODEL', 'GEMINI_API_KEY'];
const OUTPUTS = { initial: '/private/tmp/ti559-evaluation-run', followup: '/private/tmp/ti559-followup-evaluation-run', gemini38: '/private/tmp/ti559-gemini38-evaluation-run' };
const ENTRY = 'supabase/functions/api/evaluation/ti559/evaluate.ts';

function buildLaunch(environment, suite = 'initial') {
  if (!Object.hasOwn(OUTPUTS, suite)) throw new Error('Unknown evaluation suite.');
  const output = OUTPUTS[suite];
  const env = {};
  for (const key of ENVIRONMENT_KEYS) {
    if (typeof environment[key] === 'string') env[key] = environment[key];
  }
  return {
    command: 'deno',
    args: [
      'run', '--no-lock',
      `--allow-read=supabase/functions/api/evaluation/ti559,supabase/functions/api/services/dreamAnalysis.ts,${output}`,
      `--allow-write=${output}`,
      // The SDK enumerates its environment. Only the four keys above reach Deno.
      '--allow-env', '--allow-net=generativelanguage.googleapis.com',
      suite === 'gemini38' ? ENTRY.replace('evaluate.ts', 'evaluate-models.ts') : ENTRY, '--execute', ...(suite === 'followup' ? ['--suite=followup'] : []), `--output=${output}`,
    ],
    options: { cwd: path.resolve(__dirname, '..'), env, shell: false, stdio: 'inherit' },
  };
}

function launch(environment, spawn = spawnSync, suite = 'initial') {
  const { command, args, options } = buildLaunch(environment, suite);
  const result = spawn(command, args, options);
  if (result.error || result.signal || typeof result.status !== 'number') {
    // Do not print spawn errors, arguments or environment values containing credentials.
    console.error('Reflection evaluation process could not complete.');
    return 1;
  }
  return result.status;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--followup', '--gemini38'].includes(args[0]))) {
    console.error('Reflection evaluation accepts only fixed --followup or --gemini38 modes.');
    process.exitCode = 1;
  } else {
    process.exitCode = launch(process.env, spawnSync, args[0] === '--gemini38' ? 'gemini38' : args[0] === '--followup' ? 'followup' : 'initial');
  }
}
module.exports = { buildLaunch, launch };
