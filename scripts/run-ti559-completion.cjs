'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
function launch(source = process.env, spawn = spawnSync) {
  const env = {};
  for (const key of ['PATH', 'HOME', 'GEMINI_API_KEY']) if (typeof source[key] === 'string') env[key] = source[key];
  const output = '/private/tmp/ti559-completion-evaluation-run';
  return spawn('deno', ['run', '--no-lock', `--allow-read=supabase/functions/api,${output}`, `--allow-write=${output}`, '--allow-env', '--allow-net=generativelanguage.googleapis.com', 'supabase/functions/api/evaluation/ti559/completion.ts', '--execute'], { cwd: path.resolve(__dirname, '..'), env, shell: false, stdio: 'inherit' });
}
module.exports = { launch };
if (require.main === module) {
  if (process.argv.length !== 2) throw new Error('No arguments allowed');
  const result = launch();
  process.exitCode = result.error || result.signal || typeof result.status !== 'number' ? 1 : result.status;
}
