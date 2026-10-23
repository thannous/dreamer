import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { localOrigin, startNativeBackendProxy } from './native-backend-proxy.mjs';

// Native journeys cannot safely exercise hostile hosted targets or stolen controls.
// These transport tests cover that concrete safety boundary, without mocking sync.
async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
async function fixture(action, functions = false) {
  const calls = [];
  const upstream = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    calls.push({ path: req.url, body, control: req.headers['x-e2e-control-token'] });
    if (req.url === '/auth/v1/redirect') { res.writeHead(302, { location: 'https://example.com/' }); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ body }));
  });
  const upstreamPort = await listen(upstream);
  const reservation = createServer();
  const port = await listen(reservation);
  await close(reservation);
  const token = randomUUID();
  const backendOrigin = `http://127.0.0.1:${upstreamPort}`;
  const proxy = await startNativeBackendProxy({ backendOrigin, functionsOrigin: functions ? backendOrigin : undefined, port, controlToken: token });
  try { await action({ calls, token, proxy }); }
  finally { await proxy.close(); await close(upstream); }
}

test('native proxy refuses non-loopback destinations and unconfigured API routes', async () => {
  for (const url of ['https://127.0.0.1:1234', 'http://localhost:1234', 'http://example.com:1234',
    'http://user:pass@127.0.0.1:1234', 'http://127.0.0.1:1234/path']) assert.throws(() => localOrigin(url));
  await fixture(async ({ calls, proxy }) => {
    assert.equal((await fetch(`${proxy.origin}/functions/v1/api/chat`)).status, 503);
    assert.equal((await fetch(`${proxy.origin}/unknown`)).status, 503);
    const code = await new Promise((resolve, reject) => {
      const req = request(proxy.origin, { path: 'http://example.com/auth/v1/token' }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(code, 400);
    assert.deepEqual(calls, []);
  });
});

test('native proxy requires a private token, cuts real connections, and recovers transport', async () => {
  await fixture(async ({ calls, token, proxy }) => {
    const control = online => fetch(`${proxy.origin}/__control/network`, {
      method: 'POST', headers: { 'x-e2e-control-token': token }, body: JSON.stringify({ online }),
    });
    assert.equal((await fetch(`${proxy.origin}/__control/network`, { method: 'POST', body: '{"online":false}' })).status, 403);
    assert.equal((await fetch(`${proxy.origin}/auth/v1/token`, { method: 'POST', body: 'first' })).status, 200);
    assert.equal((await control(false)).status, 200);
    await assert.rejects(fetch(`${proxy.origin}/rest/v1/dreams`));
    assert.equal(calls.length, 1);
    assert.equal((await control(true)).status, 200);
    assert.equal((await fetch(`${proxy.origin}/rest/v1/dreams`)).status, 200);
    const state = await (await fetch(`${proxy.origin}/__control/state`, { headers: { 'x-e2e-control-token': token } })).json();
    assert.equal(state.online, true);
    assert.ok(state.blocked >= 1);
    assert.equal(state.forwarded, 2);
  });
});

test('native proxy forwards real request bodies but strips control token and rejects hosted redirects', async () => {
  await fixture(async ({ calls, token, proxy }) => {
    const result = await fetch(`${proxy.origin}/functions/v1/api/chat`, {
      method: 'POST', headers: { 'x-e2e-control-token': token }, body: '{"message":"owned fixture"}',
    });
    assert.equal(result.status, 200);
    assert.deepEqual(calls, [{ path: '/functions/v1/api/chat', body: '{"message":"owned fixture"}', control: undefined }]);
    assert.equal((await fetch(`${proxy.origin}/auth/v1/redirect`)).status, 502);
  }, true);
});
