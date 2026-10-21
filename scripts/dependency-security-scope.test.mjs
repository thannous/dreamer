import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// A browser cannot notice a CLI test quietly loading the root dependency graph.
test('a missing documentation dependency cannot fall back to the patched root copy', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fixture = mkdtempSync(join(tmpdir(), 'dependency-security-scope-'));
  try {
    const script = join(fixture, 'scripts/dependency-security.test.mjs');
    mkdirSync(dirname(script), { recursive: true });
    copyFileSync(new URL('./dependency-security.test.mjs', import.meta.url), script);
    writeFileSync(join(fixture, 'package.json'), '{}\n');
    const project = join(fixture, 'doc_web_interne/docs');
    mkdirSync(join(project, 'node_modules'), { recursive: true });
    writeFileSync(join(project, 'package.json'), '{}\n');
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    for (const directory of ['tools', 'assets']) symlinkSync(join(root, directory), join(fixture, directory), 'dir');
    const env = { ...process.env, DEPENDENCY_SECURITY_PROJECT: 'documentation' };
    // This is a separate test invocation, not a child of this test runner.
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', script], {
      cwd: fixture,
      env,
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /braces resolved outside the documentation installation/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
