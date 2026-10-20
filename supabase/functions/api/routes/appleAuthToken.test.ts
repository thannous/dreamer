import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleStoreAppleAuthToken } from './appleAuthToken.ts';
import type { ApiContext } from '../types.ts';

// Isolation gap: forcing Apple exchange/storage failures in the real Auth
// journey would require provider credentials or a destructive service outage.
const ctx = (user: unknown = { id: 'owner' }): ApiContext => ({
  req: new Request('http://127.0.0.1/api/auth/apple-token', { method: 'POST',
    body: JSON.stringify({ authorizationCode: 'synthetic-code', userId: 'forged-owner' }) }),
  user, supabase: {}, supabaseUrl: 'http://127.0.0.1', supabaseServiceRoleKey: 'synthetic-service', storageBucket: 'dream-images',
});
const config = () => ({ clientId: 'synthetic', teamId: 'synthetic', keyId: 'synthetic', privateKey: 'synthetic' });

Deno.test('Apple credential storage rejects unauthenticated callers before exchange', async () => {
  const response = await handleStoreAppleAuthToken(ctx(null), {
    exchangeAuthorizationCode: () => { throw new Error('must not exchange'); },
  });
  assertEquals(response.status, 401);
});

Deno.test('Apple provider errors cannot echo a credential to the response or logs', async () => {
  const original = console.warn;
  const logged: unknown[] = [];
  console.warn = (...args: unknown[]) => { logged.push(args); };
  try {
    const response = await handleStoreAppleAuthToken(ctx(), {
      readConfig: config,
      exchangeAuthorizationCode: () => { throw new Error('sensitive-provider-token'); },
    });
    assertEquals(response.status, 503);
    assertEquals(await response.json(), { error: 'Failed to store Apple token' });
    assertEquals(JSON.stringify(logged).includes('sensitive-provider-token'), false);
  } finally { console.warn = original; }
});

Deno.test('Apple storage failure fails closed and ignores a body-supplied owner', async () => {
  let owner: unknown;
  const response = await handleStoreAppleAuthToken(ctx(), {
    readConfig: config,
    exchangeAuthorizationCode: () => Promise.resolve('sensitive-provider-token'),
    createAdminClient: () => ({ rpc: (_name: string, args: { p_user_id: unknown }) => {
      owner = args.p_user_id;
      return Promise.resolve({ error: { message: 'sensitive-provider-token' } });
    } }),
  });
  assertEquals(response.status, 500);
  assertEquals(await response.json(), { error: 'Failed to store Apple token' });
  assertEquals(owner, 'owner');
});
