/* global describe, it, expect, beforeAll, afterAll */

// Isolated checks of checkExternalUrl against a local server: a publish run cannot make PubMed
// answer 502 on demand, so these replay the failures seen there (HEAD 502, then 200) and the
// current policy: persistent 502/503/504 warn; missing pages and other errors still fail.
// The real publication journey cannot reliably make third-party sites fail or recover on demand.
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

  it.each([502, 503, 504])('warns about persistent HTTP %i without claiming the link passed', async (status) => {
    expect(await check(`/always-${status}`, [status])).toEqual({ result: { ok: false, status, unavailable: true }, methods: ['HEAD', 'GET', 'GET', 'GET'] });
  });

  it('keeps the unavailable status when following GETs lose their connection', async () => {
    expect(await check('/gateway-then-drop', [502, 'drop'])).toEqual({ result: { ok: false, status: 502, unavailable: true }, methods: ['HEAD', 'GET', 'GET', 'GET'] });
  });

  it('still detects a missing page after a gateway error and a dropped connection', async () => {
    expect(await check('/outage-drop-missing', [503, 'drop', 404])).toEqual({ result: { ok: false, status: 404 }, methods: ['HEAD', 'GET', 'GET'] });
  });

  it('fails a 404 at once, and a 404 that follows a gateway error', async () => {
    expect(await check('/missing', [404])).toEqual({ result: { ok: false, status: 404 }, methods: ['HEAD'] });
    expect(await check('/gateway-then-missing', [502, 404])).toEqual({ result: { ok: false, status: 404 }, methods: ['HEAD', 'GET'] });
  });

  it.each([404, 410, 500])('still fails HTTP %i, including after a temporary outage', async (status) => {
    expect((await check(`/failure-${status}`, [status])).result).toEqual({ ok: false, status });
    expect((await check(`/outage-then-${status}`, [503, status])).result).toEqual({ ok: false, status });
  });

  it('applies the availability warning after HEAD is refused or loses its connection', async () => {
    expect((await check('/refused-then-outage', [405, 503])).result).toEqual({ ok: false, status: 503, unavailable: true });
    expect((await check('/drop-then-outage', ['drop', 503])).result).toEqual({ ok: false, status: 503, unavailable: true });
  });

  it('keeps the GET fallback for servers that refuse HEAD', async () => {
    expect(await check('/no-head', [405, 200])).toEqual({ result: { ok: true, status: 200 }, methods: ['HEAD', 'GET'] });
    expect(await check('/no-head-missing', [501, 404])).toEqual({ result: { ok: false, status: 404 }, methods: ['HEAD', 'GET'] });
  });
});
