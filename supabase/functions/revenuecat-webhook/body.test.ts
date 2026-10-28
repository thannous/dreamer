import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { readLimitedBody } from './body.ts';

const URL = 'https://example.supabase.co/functions/v1/revenuecat-webhook';

function streamedRequest(chunks: Uint8Array[], headers: HeadersInit = {}) {
  let pulled = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled < chunks.length) controller.enqueue(chunks[pulled++]);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request(URL, { method: 'POST', body, headers });
  return { req, pulledChunks: () => pulled, wasCancelled: () => cancelled };
}

Deno.test('RevenueCat webhook body is read in full under the cap', async () => {
  const req = new Request(URL, { method: 'POST', body: '{"event":{"type":"RENEWAL"}}' });
  assertEquals(await readLimitedBody(req, 64), { ok: true, text: '{"event":{"type":"RENEWAL"}}' });
});

Deno.test('RevenueCat webhook body rejects a declared oversize length without reading', async () => {
  const stream = streamedRequest([new Uint8Array(8)], { 'content-length': '65' });
  assertEquals(await readLimitedBody(stream.req, 64), { ok: false, reason: 'too_large' });
  assertEquals(stream.req.bodyUsed, false);
});

Deno.test('RevenueCat webhook body stops streaming once an undeclared body crosses the cap', async () => {
  const chunk = new Uint8Array(40);
  const stream = streamedRequest([chunk, chunk, chunk, chunk]);
  assertEquals(await readLimitedBody(stream.req, 64), { ok: false, reason: 'too_large' });
  assertEquals(stream.pulledChunks() < 4, true);
  assertEquals(stream.wasCancelled(), true);
});

Deno.test('RevenueCat webhook body accepts an empty request', async () => {
  assertEquals(await readLimitedBody(new Request(URL, { method: 'POST' }), 64), { ok: true, text: '' });
});
