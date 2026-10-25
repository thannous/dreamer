import { assertEquals, assertStrictEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { corsHeaders } from './lib/constants.ts';
import {
  type ApiHandlerDependencies,
  createApiHandler,
  type RouteHandler,
  routeSegmentAllowlist,
  toLoggedRoute,
  toLoggedRouterReason,
} from './router.ts';

// The entrypoint (index.ts) calls serve() at module load and its route table pulls
// in heavy dependencies, so the dispatch logic is exercised through the
// createApiHandler factory it delegates to, with a small injected route table.

const encodeBase64Url = (value: unknown): string =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const USER_JWT = [
  encodeBase64Url({ alg: 'HS256', typ: 'JWT' }),
  encodeBase64Url({ sub: 'user-1', role: 'authenticated' }),
  'signature',
].join('.');

const fakeCreateClient = (() => ({
  auth: {
    getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }),
  },
})) as unknown as ApiHandlerDependencies['createClient'];

const readEnv = (name: string): string | undefined =>
  ({
    SUPABASE_URL: 'https://example.test',
    SUPABASE_ANON_KEY: 'anon-key',
  })[name];

const buildHandler = (routes: Record<string, RouteHandler>) =>
  createApiHandler({
    routes: new Map(Object.entries(routes)),
    createClient: fakeCreateClient,
    readEnv,
  });

const request = (
  path: string,
  init: RequestInit & { authenticated?: boolean } = {}
): Request => {
  const { authenticated, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  if (authenticated) headers.set('Authorization', `Bearer ${USER_JWT}`);
  // The edge runtime hands the function `/api/<route>` (the `/functions/v1` prefix is stripped upstream).
  return new Request(`https://example.test/api${path}`, {
    method: 'POST',
    ...requestInit,
    headers,
  });
};

const withSilencedConsoleError = async <T>(
  run: (calls: unknown[][]) => Promise<T>
): Promise<T> => {
  const calls: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    return await run(calls);
  } finally {
    console.error = original;
  }
};

Deno.test('a route handler that throws yields a JSON 500 with CORS headers', async () => {
  const handler = buildHandler({
    'POST /boom': () => Promise.reject(new Error('database exploded')),
  });

  await withSilencedConsoleError(async (calls) => {
    const response = await handler(
      request('/boom', { body: JSON.stringify({ transcript: 'secret dream content' }) })
    );

    assertEquals(response.status, 500);
    assertEquals(response.headers.get('Content-Type'), 'application/json');
    assertEquals(response.headers.get('Access-Control-Allow-Origin'), corsHeaders['Access-Control-Allow-Origin']);
    assertEquals(response.headers.get('Access-Control-Allow-Headers'), corsHeaders['Access-Control-Allow-Headers']);
    assertEquals(await response.json(), { error: 'Internal server error' });

    assertEquals(calls.length, 1);
    assertEquals(calls[0][0], '[api] unhandled error');
    assertEquals(calls[0][1], { route: 'POST /boom', method: 'POST', message: 'database exploded' });
    // The log payload must never carry the request body or headers.
    assertEquals(JSON.stringify(calls[0]).includes('secret dream content'), false);
  });
});

Deno.test('a synchronous throw inside a route handler is also converted to a JSON 500', async () => {
  const handler = buildHandler({
    'POST /boom-sync': (() => {
      throw new TypeError('bad input');
    }) as unknown as RouteHandler,
  });

  await withSilencedConsoleError(async (calls) => {
    const response = await handler(request('/boom-sync'));

    assertEquals(response.status, 500);
    assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(await response.json(), { error: 'Internal server error' });
    assertEquals(calls.length, 1);
    assertEquals(calls[0][1], { route: 'POST /boom-sync', method: 'POST', message: 'bad input' });
  });
});

Deno.test('a route handler that returns a Response is passed through untouched', async () => {
  const routeResponse = new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', 'X-Route': 'yes' },
  });
  const handler = buildHandler({
    'POST /fine': () => Promise.resolve(routeResponse),
  });

  const response = await handler(request('/fine'));

  assertStrictEquals(response, routeResponse);
  assertEquals(response.status, 201);
  assertEquals(response.headers.get('X-Route'), 'yes');
  assertEquals(await response.json(), { ok: true });
});

Deno.test('OPTIONS preflight is answered before dispatch with CORS headers', async () => {
  const handler = buildHandler({
    'OPTIONS /anything': () => Promise.reject(new Error('should not be called')),
  });

  const response = await handler(request('/anything', { method: 'OPTIONS' }));

  assertEquals(response.status, 200);
  assertEquals(await response.text(), 'ok');
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), corsHeaders['Access-Control-Allow-Origin']);
  assertEquals(response.headers.get('Access-Control-Allow-Headers'), corsHeaders['Access-Control-Allow-Headers']);
});

Deno.test('unknown routes return 401 for anonymous callers and 404 for authenticated users', async () => {
  const handler = buildHandler({});

  const anonymous = await handler(request('/missing'));
  assertEquals(anonymous.status, 401);
  assertEquals(anonymous.headers.get('Content-Type'), 'application/json');
  assertEquals(anonymous.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await anonymous.json(), { error: 'Unauthorized' });

  const authenticated = await handler(request('/missing', { authenticated: true }));
  assertEquals(authenticated.status, 404);
  assertEquals(authenticated.headers.get('Content-Type'), 'application/json');
  assertEquals(authenticated.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await authenticated.json(), { error: 'Not found' });
});


Deno.test('scoped clients are checked before privileged route dispatch', async () => {
  for (const [product, route, expected] of [
    ['journal', 'POST /analyzeDream', 200],
    ['lucid', 'POST /analyzeDream', 403],
    ['unknown', 'POST /analyzeDream', 403],
    ['legacy', 'POST /analyzeDream', 403],
    ['journal', 'DELETE /account', 403],
    ['lucid', 'DELETE /account', 403],
    ['journal', 'POST /subscription/reconcile', 403],
    ['journal', 'POST /new-unclassified', 403],
    ['lucid', 'POST /analytics/events', 200],
  ] as const) {
    let dispatched = 0;
    let resolved = 0;
    const [method, path] = route.split(' ');
    const token = [encodeBase64Url({ alg: 'HS256' }),
      encodeBase64Url({ sub: 'user-1', client_id: 'registered-client' }), 'signature'].join('.');
    const createClient = (() => ({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
      rpc: (name: string) => {
        assertEquals(name, 'current_app_product');
        resolved++;
        return Promise.resolve({ data: product, error: null });
      },
    })) as unknown as ApiHandlerDependencies['createClient'];
    const handler = createApiHandler({ readEnv, createClient, routes: new Map([
      [route, () => { dispatched++; return Promise.resolve(new Response('ok')); }],
    ]) });
    const response = await handler(request(path, { method, headers: {
      Authorization: `Bearer ${token}`, 'X-App-Id': 'journal',
    } }));
    assertEquals(response.status, expected, `${product} ${route}`);
    assertEquals(dispatched, expected === 200 ? 1 : 0);
    assertEquals(resolved, 1);
  }
});

Deno.test('invalid scoped tokens cannot become guests; resolver failure denies dispatch', async () => {
  for (const mode of ['invalid', 'error', 'throw', 'null-claim'] as const) {
    let dispatched = false;
    const token = [encodeBase64Url({ alg: 'HS256' }),
      encodeBase64Url({ sub: 'user-1', client_id: mode === 'null-claim' ? null : 'client' }), 'signature'].join('.');
    const createClient = (() => ({
      auth: { getUser: () => Promise.resolve({ data: { user: mode === 'invalid' ? null : { id: 'user-1' } } }) },
      rpc: () => {
        if (mode === 'throw') throw new Error('resolver down');
        return Promise.resolve({ data: 'unknown', error: mode === 'error' ? { message: 'down' } : null });
      },
    })) as unknown as ApiHandlerDependencies['createClient'];
    const handler = createApiHandler({ readEnv, createClient, routes: new Map([
      ['POST /analyzeDream', () => { dispatched = true; return Promise.resolve(new Response('ok')); }],
    ]) });
    const response = await handler(request('/analyzeDream', { headers: { Authorization: `Bearer ${token}` } }));
    assertEquals(response.status, mode === 'invalid' ? 401 : mode === 'null-claim' ? 403 : 503);
    assertEquals(dispatched, false);
  }
});

const captureWarnings = async (run: () => Promise<void>): Promise<unknown[][]> => {
  const calls: unknown[][] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    await run();
  } finally {
    console.warn = original;
  }
  return calls;
};

Deno.test('an anonymous unmatched route logs only the method and route shape', async () => {
  const unused = () => Promise.reject(new Error('must not be called'));
  const handler = buildHandler({ 'POST /guest/session': unused, 'POST /dreams/share': unused, 'GET /a/b': unused });
  const secretId = '7f3c2a10-1111-4222-8333-944455556666';
  const secretToken = 'eyJhbGciOiJIUzI1NiJ9.secret-token-value';
  const warnings = await captureWarnings(async () => {
    const plain = await handler(request('/guest/session/challenge'));
    assertEquals(plain.status, 401);
    await plain.body?.cancel();
    const withIds = await handler(request(`/dreams/${secretId}/share/${secretToken}`, {
      method: 'GET',
      headers: { 'X-Forwarded-For': '203.0.113.7', 'x-guest-fingerprint': 'f'.repeat(64) },
    }));
    assertEquals(withIds.status, 401);
    await withIds.body?.cancel();
    const odd = await handler(request('/a/b/a/b/a/b/a/b', { method: 'PROPFIND' }));
    assertEquals(odd.status, 401);
    await odd.body?.cancel();
    const username = await handler(request('/users/secret-user-id', { method: 'GET' }));
    assertEquals(username.status, 401);
    await username.body?.cancel();
  });

  assertEquals(warnings, [
    ['[api] unmatched route without user', { method: 'POST', route: '/guest/session/:param' }],
    ['[api] unmatched route without user', { method: 'GET', route: '/dreams/:param/share/:param' }],
    ['[api] unmatched route without user', { method: 'OTHER', route: '/a/b/a/b/a/b/:more' }],
    ['[api] unmatched route without user', { method: 'GET', route: '/:param/:param' }],
  ]);
  const serialized = JSON.stringify(warnings);
  for (const secret of [secretId, secretToken, '203.0.113.7', 'f'.repeat(64), 'secret-user-id', 'users']) {
    assertEquals(serialized.includes(secret), false, `log must not contain ${secret}`);
  }
});

Deno.test('a scoped bearer without a valid user logs an allowlisted reason code only', async () => {
  const token = [encodeBase64Url({ alg: 'HS256' }),
    encodeBase64Url({ sub: 'secret-user-id', client_id: 'secret-client-id' }), 'signature'].join('.');
  const warnings = await captureWarnings(async () => {
    for (const mode of ['no-user', 'lookup-throws'] as const) {
      const createClient = (() => ({
        auth: {
          getUser: () => mode === 'lookup-throws'
            ? Promise.reject(new Error(`auth down for ${token}`))
            : Promise.resolve({ data: { user: null } }),
        },
        rpc: () => Promise.reject(new Error('must not be called')),
      })) as unknown as ApiHandlerDependencies['createClient'];
      const handler = createApiHandler({ readEnv, createClient, routes: new Map() });
      const response = await handler(request('/analyzeDream', {
        headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': '203.0.113.7' },
      }));
      assertEquals(response.status, 401);
      await response.body?.cancel();
    }
  });

  assertEquals(warnings, [
    ['[api] scoped bearer rejected', { reason: 'scoped_bearer_no_user', method: 'POST' }],
    ['[api] scoped bearer rejected', { reason: 'scoped_bearer_lookup_failed', method: 'POST' }],
  ]);
  const serialized = JSON.stringify(warnings);
  for (const secret of [token, 'secret-user-id', 'secret-client-id', '203.0.113.7']) {
    assertEquals(serialized.includes(secret), false, `log must not contain ${secret}`);
  }
});

Deno.test('router reason and route helpers map anything outside the allowlist to safe values', () => {
  assertEquals(toLoggedRouterReason('scoped_bearer_no_user'), 'scoped_bearer_no_user');
  assertEquals(toLoggedRouterReason('scoped_bearer_lookup_failed'), 'scoped_bearer_lookup_failed');
  assertEquals(toLoggedRouterReason('leak:token'), 'unknown');
  assertEquals(toLoggedRouterReason(undefined), 'unknown');
  const known = routeSegmentAllowlist(['DELETE /account', 'POST /guest/session', 'GET /users/me']);
  assertEquals([...known].sort(), ['account', 'guest', 'me', 'session', 'users']);
  assertEquals(toLoggedRoute('DELETE', '/account', known), { method: 'DELETE', route: '/account' });
  assertEquals(toLoggedRoute('POST', '/', known), { method: 'POST', route: '/' });
  assertEquals(toLoggedRoute('GET', '/users/someone@example.com/x9', known), { method: 'GET', route: '/users/:param/:param' });
  assertEquals(toLoggedRoute('GET', '/users/secret-user-id', known), { method: 'GET', route: '/users/:param' });
});
