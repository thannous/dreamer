import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { corsHeaders } from './constants.ts';
import { errorResponse, jsonResponse } from './http.ts';

Deno.test('jsonResponse defaults to 200 with JSON content type and CORS headers', async () => {
  const response = jsonResponse({ ok: true });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Content-Type'), 'application/json');
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), corsHeaders['Access-Control-Allow-Origin']);
  assertEquals(response.headers.get('Access-Control-Allow-Headers'), corsHeaders['Access-Control-Allow-Headers']);
  assertEquals(await response.json(), { ok: true });
});

Deno.test('jsonResponse honours an explicit status and merges extra headers', async () => {
  const response = jsonResponse({ error: 'busy', retryAfter: 30 }, 503, { 'Retry-After': '30' });

  assertEquals(response.status, 503);
  assertEquals(response.headers.get('Retry-After'), '30');
  assertEquals(response.headers.get('Content-Type'), 'application/json');
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await response.json(), { error: 'busy', retryAfter: 30 });
});

Deno.test('errorResponse wraps the message and optional extra fields', async () => {
  const plain = errorResponse('Not found', 404);
  assertEquals(plain.status, 404);
  assertEquals(plain.headers.get('Content-Type'), 'application/json');
  assertEquals(plain.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await plain.json(), { error: 'Not found' });

  const withExtra = errorResponse('Quota exceeded', 429, { code: 'QUOTA_EXCEEDED' });
  assertEquals(withExtra.status, 429);
  assertEquals(await withExtra.json(), { error: 'Quota exceeded', code: 'QUOTA_EXCEEDED' });
});
