import { createServer, request } from 'node:http';

export function localOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('Native backend proxy accepts an explicit loopback HTTP origin only.');
  return url.origin;
}

/** Cut the app's real transport without changing journal, Auth or sync code. */
export async function startNativeBackendProxy({ backendOrigin, functionsOrigin, port, controlToken }) {
  const backend = localOrigin(backendOrigin);
  const functions = functionsOrigin ? localOrigin(functionsOrigin) : undefined;
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || typeof controlToken !== 'string' || controlToken.length < 32)
    throw new Error('An explicit unprivileged proxy port and private control token are required.');
  let online = true;
  let blocked = 0;
  let forwarded = 0;
  const active = new Set();
  const server = createServer(async (req, res) => {
    const reply = (code, value) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (!req.url?.startsWith('/') || req.url.startsWith('//')) return reply(400, { error: 'Relative local paths only' });
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (path.startsWith('/__control/')) {
      if (req.headers['x-e2e-control-token'] !== controlToken) return reply(403, { error: 'Forbidden' });
      if (path === '/__control/state' && req.method === 'GET') return reply(200, { online, blocked, forwarded });
      if (path !== '/__control/network' || req.method !== 'POST') return reply(404, { error: 'Unknown control' });
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 1024) return reply(413, { error: 'Body too large' });
      }
      let value;
      try { value = JSON.parse(body); } catch { return reply(400, { error: 'Invalid JSON' }); }
      if (typeof value?.online !== 'boolean') return reply(400, { error: 'online must be boolean' });
      online = value.online;
      if (!online) for (const upstream of active) upstream.destroy();
      return reply(200, { online, blocked, forwarded });
    }
    if (!online) { blocked++; req.socket.destroy(); return; }
    const targetOrigin = path.startsWith('/functions/v1/api/') || path === '/functions/v1/api'
      ? functions : /^\/(?:auth|rest|storage)\/v1(?:\/|$)/.test(path) ? backend : undefined;
    if (!targetOrigin) return reply(503, { error: 'This local qualification does not provide that service' });
    forwarded++;
    // Construct the destination from the guarded origin, never Host or an absolute request URL.
    const target = new URL(targetOrigin);
    const headers = { ...req.headers, host: target.host };
    delete headers['x-e2e-control-token'];
    const upstream = request({ hostname: target.hostname, port: target.port,
      path: req.url, method: req.method, headers }, response => {
      // A local fixture must never redirect the app to a hosted service.
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume(); reply(502, { error: 'Redirect refused by local qualification' }); return;
      }
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    });
    active.add(upstream);
    upstream.once('close', () => active.delete(upstream));
    upstream.on('error', () => { if (!res.headersSent) reply(503, { error: 'Local upstream unavailable' }); else res.destroy(); });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    origin: `http://127.0.0.1:${port}`,
    close: async () => {
      for (const upstream of active) upstream.destroy();
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
