import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import type { Route } from 'playwright/test';
import { test as base, repoRoot, backendOrigin, restrictNetwork } from './backend-fixtures';

export { expect, journal, admin } from './backend-fixtures';

export type GuestApiCall = { route: string; status: number };
export type GuestApi = {
  /** The API answers this page received, in order, for the guest routes. */
  calls: GuestApiCall[];
  count: (route: string, status?: number) => number;
};

// The routes a guest journey reads; every other answer still reaches the page.
const GUEST_ROUTE = /\/functions\/v1\/api\/(guest\/session|quota\/status|analyzeDream|dev-local\/guest-reset)$/;
// Cloudflare's widget script, answered here: the always-pass test site key in the backend
// profile then hands the app a token offline, and tools/dev-local/api-server.ts accepts any
// non-empty token (the hosted API verifies it with Cloudflare).
const TURNSTILE_STUB = `window.turnstile = {
  render(container, options) { setTimeout(() => options.callback('e2e-local-turnstile-token'), 0); return 'e2e'; },
  remove() {},
};`;

async function availableLoopbackPort(): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const port = randomInt(20000, 32768);
    const available = await new Promise<boolean>(resolveAvailable => {
      const probe = createServer();
      probe.once('error', () => resolveAvailable(false));
      probe.listen(port, '127.0.0.1', () => probe.close(() => resolveAvailable(true)));
    });
    if (available) return port;
  }
  throw new Error('No available loopback port for the local guest API');
}
const pause = (ms: number) => new Promise<void>(resolvePause => setTimeout(resolvePause, ms));

/**
 * A guest on the owned disposable stack. The browser's API calls go to
 * tools/dev-local/api-server.ts, the never-deployed server of dev:local: the real
 * route table with its local guest verifiers, fixed AI answers and « Nouvel invité ».
 * Auth, PostgREST and Storage stay on the stack; every other destination stays blocked.
 */
export const test = base.extend<{ guestApi: GuestApi }>({
  guestApi: async ({ page, context }, provide) => {
    if (!process.env.E2E_BACKEND_STATUS_FILE) throw new Error('Use npm run test:e2e:backend for the guest API');
    await restrictNetwork(context);
    const port = await availableLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const output = resolve(repoRoot, 'tools/e2e', process.env.E2E_OUTPUT ?? '.e2e/backend-web');
    const dir = resolve(output, `guest-api-${randomUUID()}`);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const manifest = resolve(dir, 'manifest.json');
    writeFileSync(manifest, JSON.stringify({
      kind: 'noctalia-dev-local', schemaVersion: 1,
      status: JSON.parse(readFileSync(process.env.E2E_BACKEND_STATUS_FILE, 'utf8')),
      publicOrigin: origin, port, guestSessionSecret: randomBytes(32).toString('hex'),
      iosAppAttest: { teamId: '27BLU7U28W', bundleIds: ['com.tanuki75.noctalia'] },
    }), { mode: 0o600 });
    const logPath = resolve(output, `guest-api-${randomUUID()}.log`);
    const log = openSync(logPath, 'wx', 0o600);
    const child = (() => {
      try {
        // ImageScript loads its pinned WASM from deno.land when the image worker is imported;
        // the server's own fetch guard then refuses every destination but this machine.
        return spawn('deno', ['run', '--no-config', '--cached-only', '--allow-net=127.0.0.1,deno.land:443', '--allow-env',
          `--allow-read=${repoRoot},${dir}`, 'tools/dev-local/api-server.ts'], {
          cwd: repoRoot, env: { ...process.env, DEV_LOCAL_MANIFEST: manifest }, stdio: ['ignore', log, log],
        });
      } finally { closeSync(log); }
    })();
    let closed = false;
    let childError: Error | undefined;
    const exited = new Promise<void>(resolveExit => {
      child.once('error', error => { childError = error; });
      child.once('close', () => { closed = true; resolveExit(); });
    });
    const calls: GuestApiCall[] = [];
    page.on('response', response => {
      const match = GUEST_ROUTE.exec(new URL(response.url()).pathname);
      if (match && response.request().method() === 'POST') calls.push({ route: match[1], status: response.status() });
    });
    const pattern = /\/functions\/v1\/[^?]*(?:\?.*)?$/;
    let unrouting = false;
    const forward = async (route: Route) => {
      const source = new URL(route.request().url());
      if (source.origin !== backendOrigin) { await route.abort(); return; }
      try {
        const response = await route.fetch({ url: `${origin}${source.pathname}${source.search}` });
        await route.fulfill({ response });
      } catch (error) {
        // The app keeps asking after the test body; once unrouted, it no longer matters.
        if (!unrouting) throw error;
      }
    };
    const turnstile = (route: Route) => route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_STUB });
    let routed = false;
    try {
      const deadline = Date.now() + 60_000;
      while (true) {
        if (closed || childError) throw new Error(`The local guest API exited before ready; see ${logPath}`, { cause: childError });
        try { await fetch(`${origin}/functions/v1/api/quota/status`, { method: 'OPTIONS', signal: AbortSignal.timeout(2000) }); break; }
        catch (error) {
          if (Date.now() >= deadline) throw new Error(`The local guest API did not start; see ${logPath}`, { cause: error });
          await pause(200);
        }
      }
      await page.route(pattern, forward);
      await page.route('https://challenges.cloudflare.com/turnstile/**', turnstile);
      routed = true;
      await provide({
        calls,
        count: (name, status = 200) => calls.filter(call => call.route === name && call.status === status).length,
      });
    } finally {
      try {
        unrouting = true;
        if (routed) {
          await page.unroute(pattern, forward);
          await page.unroute('https://challenges.cloudflare.com/turnstile/**', turnstile);
        }
      } finally {
        if (!closed) {
          child.kill('SIGTERM');
          let timer: ReturnType<typeof setTimeout> | undefined;
          await Promise.race([exited, new Promise<void>(resolveTimeout => { timer = setTimeout(resolveTimeout, 5000); })]);
          if (timer) clearTimeout(timer);
          if (!closed) { child.kill('SIGKILL'); await exited; }
        }
        // The manifest holds this run's service key: it never outlives the test.
        rmSync(dir, { recursive: true, force: true });
      }
    }
  },
});
