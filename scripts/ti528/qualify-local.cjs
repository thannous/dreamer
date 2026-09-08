'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { readLocalStatus } = require('./local-config.cjs');
readLocalStatus(process.env.TI528_LOCAL_STATUS); // fail rather than a green skipped suite
const root = path.resolve(__dirname, '../..');
for (const args of [
  ['run', 'db:contract:check:local', '--', '--db-url', 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'],
  ['run', 'test:file', '--', 'scripts/ti528/journal-local.test.ts', 'scripts/ti528/admission-local.test.ts', 'scripts/ti528/jobs-local.test.ts', 'scripts/ti528/leases-local.test.ts', '--watchman=false'],
]) {
  const result = spawnSync('npm', args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
