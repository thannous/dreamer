// Shared contracts have exactly the same cases on every host. Native Linux
// qualification is additional evidence, announced separately rather than skipped.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const run = files => {
  const result = spawnSync(process.execPath, ['--test', ...files], { cwd, stdio: 'inherit' });
  return result.error || result.signal ? 1 : result.status ?? 1;
};
let status = run(['scripts/test-verify-local.mjs', 'scripts/test-platform-contracts.mjs']);
if (!status && process.platform === 'linux') {
  // These commands are prerequisites of the native suite, never conditions on
  // a common case. A Linux verifier must qualify the actual cleanup as before.
  console.log('[verify-tests] additional Linux native process/lock qualification');
  status = run(['scripts/test-verify-local-native.mjs', 'scripts/test-test-auth-permissions-native.mjs']);
} else if (!status) {
  console.log('[verify-tests] common contracts passed; Linux native qualification is a separate run on Linux');
}
process.exitCode = status;
