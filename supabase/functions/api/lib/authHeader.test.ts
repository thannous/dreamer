import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildSupabaseUserAuthHeaders,
  extractBearerToken,
  resolveSupabaseUserBearer,
} from './authHeader.ts';

function encodeBase64Url(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function unsignedJwt(payload: Record<string, unknown>): string {
  return [
    encodeBase64Url({ alg: 'HS256', typ: 'JWT' }),
    encodeBase64Url(payload),
    'signature',
  ].join('.');
}

Deno.test('extractBearerToken accepts case-insensitive bearer headers', () => {
  assertEquals(extractBearerToken('bearer token-123'), 'token-123');
  assertEquals(extractBearerToken('Bearer token-123'), 'token-123');
  assertEquals(extractBearerToken('token-123'), null);
});

Deno.test('resolveSupabaseUserBearer rejects anon and publishable keys', () => {
  const anonJwt = unsignedJwt({
    iss: 'supabase',
    ref: 'project-ref',
    role: 'anon',
    iat: 1760844510,
    exp: 2076420510,
  });

  assertEquals(resolveSupabaseUserBearer(`Bearer ${anonJwt}`), null);
  assertEquals(resolveSupabaseUserBearer('Bearer sb_publishable_example'), null);
  assertEquals(buildSupabaseUserAuthHeaders(`Bearer ${anonJwt}`), {});
});

Deno.test('resolveSupabaseUserBearer preserves user access tokens with sub claims', () => {
  const userJwt = unsignedJwt({
    iss: 'https://project-ref.supabase.co/auth/v1',
    sub: '4f2b5f35-fc0d-4a7d-8e21-f8ef2a916a11',
    role: 'authenticated',
  });

  assertEquals(resolveSupabaseUserBearer(`Bearer ${userJwt}`), userJwt);
  assertEquals(buildSupabaseUserAuthHeaders(`Bearer ${userJwt}`), {
    Authorization: `Bearer ${userJwt}`,
  });
});
