import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Uniwind's Metro dependency registers Node loader hooks, which Jest correctly
// refuses inside its own runtime; run the real resolver in an isolated process.
test('bundled audio resolves a registered asset through the native Uniwind facade', () => {
  execFileSync(process.execPath, [path.join(__dirname, 'uniwind-asset-contract.cjs')], {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'pipe',
  });
});
