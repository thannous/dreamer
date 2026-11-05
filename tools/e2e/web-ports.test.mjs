import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BRANCH_WEB_PORT } from '../../scripts/test-auth-setup.mjs';
import { FIXED_WEB_PORTS, sameServedOrigin, webPort } from './web-ports.mjs';

test('mock web products ask for a free port unless E2E_WEB_PORT pins one', () => {
  for (const product of ['dreamer', 'lucid', 'meditation', 'site']) assert.equal(webPort(product, {}), 0, product);
  assert.equal(webPort('dreamer', { E2E_WEB_PORT: '8096' }), 8096);
  assert.equal(webPort('site', { E2E_WEB_PORT: '0' }), 0);
  for (const invalid of ['', ' 8096', '80.5', '-1', '65536', '123456', 'port'])
    assert.throws(() => webPort('dreamer', { E2E_WEB_PORT: invalid }), /E2E_WEB_PORT/, invalid);
});

test('backend and saved branch sessions keep their fixed origin', () => {
  assert.equal(FIXED_WEB_PORTS.branch, BRANCH_WEB_PORT);
  assert.equal(webPort('backend', {}), 8085);
  assert.equal(webPort('branch', {}), 8087);
  assert.equal(webPort('backend', { E2E_WEB_PORT: '8085' }), 8085);
  for (const [product, port] of [['backend', '0'], ['branch', '8096'], ['backend', '8087']])
    assert.throws(() => webPort(product, { E2E_WEB_PORT: port }), /fixed local origin/, `${product}:${port}`);
});

test('a free-port declaration accepts the loopback port the run was given, nothing else', () => {
  const free = 'http://127.0.0.1:0';
  assert.equal(sameServedOrigin(free, 'http://127.0.0.1:53111'), true);
  assert.equal(sameServedOrigin(free, 'http://127.0.0.1:1'), true);
  for (const served of ['http://localhost:53111', 'http://[::1]:53111', 'https://127.0.0.1:53111', 'https://foreign.invalid',
    'http://127.0.0.1:0', 'http://127.0.0.1', 'http://127.0.0.1:65536', 'http://127.0.0.1:053111', 'http://127.0.0.1:53111/', undefined, null, 53111])
    assert.equal(sameServedOrigin(free, served), false, String(served));
});

test('a pinned port still requires exactly that origin', () => {
  assert.equal(sameServedOrigin('http://127.0.0.1:8096', 'http://127.0.0.1:8096'), true);
  for (const served of ['http://127.0.0.1:53111', 'http://localhost:8096', 'https://foreign.invalid', undefined])
    assert.equal(sameServedOrigin('http://127.0.0.1:8096', served), false, String(served));
});
