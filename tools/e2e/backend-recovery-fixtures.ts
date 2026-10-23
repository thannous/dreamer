import { randomInt, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import type { Route } from 'playwright/test';
import { test as base, repoRoot, backendOrigin } from './backend-fixtures';

export { expect, login, journal, client, admin } from './backend-fixtures';

export type RecoveryState = {
  analysisProviderCalls: number;
  analysisDispatches: number;
  analysisRequests: string[];
  pendingWorkers: number;
  analysisHold: boolean;
  analysisText: string;
  imageDispatches: number;
  heldImageJobs: string[];
  imageRequests: { clientRequestId: string; dreamId: number; imageSize?: string; previousImageUrl?: string }[];
  blockedExternalRequests: number;
  workerFailures: number;
  backendFailures: { route: string; status: number; code?: string; message?: string }[];
};
export type RecoveryFixture = {
  origin: string;
  control: (command: { reset?: boolean; analysisHold?: boolean }) => Promise<void>;
  state: () => Promise<RecoveryState>;
};

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
  throw new Error('No available owned recovery API port');
}
const pause = (ms: number) => new Promise<void>(resolvePause => setTimeout(resolvePause, ms));

export const test = base.extend<{ recovery: RecoveryFixture }>({
  recovery: async ({ page, accounts }, provide) => {
    // Teardown this API before the inherited fixture removes its owned accounts.
    void accounts;
    if (process.env.E2E_BACKEND_RECOVERY !== '1' || !process.env.E2E_BACKEND_STATUS_FILE)
      throw new Error('Use npm run test:e2e:backend for the owned recovery fixture');
    const port = await availableLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const token = randomUUID() + randomUUID();
    const output = resolve(repoRoot, 'tools/e2e', process.env.E2E_OUTPUT ?? '.e2e/backend-web');
    mkdirSync(output, { recursive: true });
    const logPath = resolve(output, `recovery-api-${randomUUID()}.log`);
    const log = openSync(logPath, 'wx', 0o600);
    const env: NodeJS.ProcessEnv = { ...process.env, E2E_NATIVE_RECOVERY_PORT: String(port), E2E_BACKEND_RECOVERY_CONTROL_TOKEN: token };
    delete env.E2E_NATIVE_BACKEND_MANIFEST;
    const child = (() => {
      try {
        return spawn('deno', ['run', '--no-config', '--cached-only',
          '--allow-net=127.0.0.1,deno.land:443', '--allow-read', '--allow-env',
          'tools/e2e/test-support/native-recovery-api.ts'], {
          cwd: repoRoot, env, stdio: ['ignore', log, log],
        });
      } finally { closeSync(log); }
    })();
    let closed = false;
    let childError: Error | undefined;
    const exited = new Promise<void>(resolveExit => {
      child.once('error', error => { childError = error; });
      child.once('close', () => { closed = true; resolveExit(); });
    });
    const request = async <T>(path: '/__state' | '/__control', body?: Record<string, unknown>): Promise<T> => {
      const response = await fetch(`${origin}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'X-E2E-Control-Token': token },
        signal: AbortSignal.timeout(2000), ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw new Error(`Recovery control failed (${response.status}); see ${logPath}`);
      return response.json() as Promise<T>;
    };
    const recovery: RecoveryFixture = {
      origin,
      state: () => request<RecoveryState>('/__state'),
      control: async command => { await request('/__control', command); },
    };
    const pattern = /\/functions\/v1\/(?:api\/[^?]*|illustration-hd\/image-jobs)(?:\?.*)?$/;
    const forward = async (route: Route) => {
      // Only this page's API transport is redirected. Auth, PostgREST and Storage
      // keep the base fixture's guarded real stack; all other destinations stay blocked.
      const source = new URL(route.request().url());
      if (source.origin !== backendOrigin) { await route.abort(); return; }
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: {
          'Access-Control-Allow-Origin': 'http://127.0.0.1:8085',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': route.request().headers()['access-control-request-headers'] ?? '',
        } });
        return;
      }
      const response = await route.fetch({ url: `${origin}${source.pathname}${source.search}` });
      await route.fulfill({ response });
    };
    let routed = false;
    try {
      const deadline = Date.now() + 30_000;
      while (true) {
        if (closed || childError) throw new Error(`Recovery API exited before ready; see ${logPath}`, { cause: childError });
        try { await recovery.state(); break; }
        catch (error) {
          if (Date.now() >= deadline) throw new Error(`Recovery API did not start; see ${logPath}`, { cause: error });
          await pause(100);
        }
      }
      await page.route(pattern, forward);
      routed = true;
      await provide(recovery);
    } finally {
      try {
        if (routed) await page.unroute(pattern, forward);
      } finally {
        // No worker is left holding a test account when its fixture is removed.
        // Held image dispatches never start a worker or reserve an HD credit.
        if (!closed) {
          await recovery.control({ analysisHold: false }).catch(() => undefined);
          child.kill('SIGTERM');
          let timer: ReturnType<typeof setTimeout> | undefined;
          await Promise.race([exited, new Promise<void>(resolveTimeout => {
            timer = setTimeout(resolveTimeout, 5000);
          })]);
          if (timer) clearTimeout(timer);
          if (!closed) { child.kill('SIGKILL'); await exited; }
        }
      }
    }
  },
});
