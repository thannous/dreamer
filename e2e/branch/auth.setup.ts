import { execFileSync } from 'node:child_process';
import { test as setup } from 'playwright/test';

// Logs both test accounts in through the guarded CLI and writes
// .auth/free.json and .auth/premium.json (gitignored). The CLI refuses
// production and unlisted projects before any request.
setup('save the test account sessions', () => {
  execFileSync(process.execPath, ['./scripts/test-auth-setup.mjs'], { stdio: 'inherit' });
});
