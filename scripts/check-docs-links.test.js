/* global describe, it, expect, beforeAll, afterAll */

// Isolated checks of checkExternalUrl against a local server: a publish run cannot make PubMed
// answer 502 on demand, so these replay the failures seen there (HEAD 502, then 200) and the
// cases the retry must not hide (a 502 that lasts, a 404).
const http = require('http');
const { checkExternalUrl } = require('./check-docs-links');

describe('checkExternalUrl', () => {
  let server;
  let baseUrl;
  const scripts = new Map();
  const seen = new Map();

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const replies = scripts.get(req.url) || [];
      const log = seen.get(req.url) || [];
      log.push(req.method);
      seen.set(req.url, log);
      const reply = replies.length > 1 ? replies.shift() : replies[0] || 500;
      // 'drop' cuts the connection without any HTTP answer.
      if (reply === 'drop') {
        req.socket.destroy();
        return;
      }
      res.writeHead(reply);
      res.end(req.method === 'HEAD' ? undefined : 'body');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  // Each path answers its statuses in order, the last one from then on.
  const check = async (path, statuses) => {
    scripts.set(path, [...statuses]);
    const result = await checkExternalUrl(baseUrl + path, { timeoutMs: 5000, retryDelaysMs: [5, 5] });
    return { result, methods: seen.get(path) };
  };

  it('accepts a page whose HEAD gets a gateway error and whose GET succeeds', async () => {
    expect(await check('/head-502', [502, 200])).toEqual({ result: { ok: true, status: 200 }, methods: ['HEAD', 'GET'] });
  });

  it('retries a gateway error a bounded number of times, with spaced GETs', async () => {
    expect(await check('/recovers', [502, 503, 504, 200])).toEqual({ result: { ok: true, status: 200 }, methods: ['HEAD', 'GET', 'GET', 'GET'] });
  });

  it('fails a gateway error that lasts', async () => {
    expect(await check('/always-502', [502])).toEqual({ result: { ok: false, status: 502 }, methods: ['HEAD', 'GET', 'GET', 'GET'] });
  });

  it('keeps a gateway error when the following GETs lose their connection, without skipping it', async () => {
    expect(await check('/gateway-then-drop', [502, 'drop'])).toEqual({ result: { ok: false, status: 502 }, methods: ['HEAD', 'GET'] });
  });

  it('fails a 404 at once, and a 404 that follows a gateway error', async () => {
    expect(await check('/missing', [404])).toEqual({ result: { ok: false, status: 404 }, methods: ['HEAD'] });
    expect(await check('/gateway-then-missing', [502, 404])).toEqual({ result: { ok: false, status: 404 }, methods: ['HEAD', 'GET'] });
  });

  it('keeps the GET fallback for servers that refuse HEAD', async () => {
    expect(await check('/no-head', [405, 200])).toEqual({ result: { ok: true, status: 200 }, methods: ['HEAD', 'GET'] });
    expect(await check('/no-head-missing', [501, 404])).toEqual({ result: { ok: false, status: 404 }, methods: ['HEAD', 'GET'] });
  });
});
