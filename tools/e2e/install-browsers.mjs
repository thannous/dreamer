import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { constants } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Resolve from the web engine, not the root application's other Playwright.
export function browserInstallArgs(args, require = createRequire(import.meta.url)) {
  if (args.some(arg => !['--with-deps', '--only-shell'].includes(arg)))
    throw new Error('Usage: browsers:install [--with-deps] [--only-shell]');
  const web = require.resolve('@e2e-dev/web');
  const engineRequire = createRequire(web);
  const core = engineRequire.resolve('playwright-core/package.json');
  const matcher = require.resolve('playwright/package.json');
  if (JSON.parse(readFileSync(core)).version !== JSON.parse(readFileSync(matcher)).version)
    throw new Error('The web engine and browser matchers must use the same Playwright version.');
  return [join(dirname(core), 'cli.js'), 'install', 'chromium', ...args];
}

export function installBrowsers(args, { launch = spawn, processHost = process } = {}) {
  const child = launch(processHost.execPath, args, {
    stdio: 'inherit',
    env: { ...processHost.env, PLAYWRIGHT_SKIP_BROWSER_GC: '1' },
  });
  const forward = signal => child.kill(signal);
  processHost.on('SIGINT', forward);
  processHost.on('SIGTERM', forward);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      processHost.off('SIGINT', forward);
      processHost.off('SIGTERM', forward);
    };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => {
      cleanup();
      resolve(code ?? (signal ? 128 + constants.signals[signal] : 1));
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await installBrowsers(browserInstallArgs(process.argv.slice(2)));
