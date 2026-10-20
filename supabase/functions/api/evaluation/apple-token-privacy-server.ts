// Local qualification only: real router/Auth/database, synthetic Apple provider.
// Never served by api/index.ts or deployed as an Edge Function entrypoint.
import { createApiHandler } from '../router.ts';
import { handleStoreAppleAuthToken } from '../routes/appleAuthToken.ts';
import { handleDeleteAccount } from '../routes/account.ts';

const status = JSON.parse(await Deno.readTextFile(Deno.env.get('E2E_BACKEND_STATUS_FILE')!));
const url = new URL(status.API_URL);
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
    status.LOCAL_E2E_STACK?.runtime !== 'native' || !/^[a-f0-9]{64}$/.test(status.LOCAL_E2E_STACK?.id)) {
  throw new Error('Owned local native stack required');
}
const marker = Deno.env.get('APPLE_PRIVACY_SYNTHETIC_TOKEN')!;
if (!marker?.startsWith('synthetic-apple-')) throw new Error('Synthetic provider marker required');
const environment: Record<string, string> = { SUPABASE_URL: url.origin, SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY };
const handler = createApiHandler({
  readEnv: name => environment[name],
  routes: new Map([
    ['POST /auth/apple-token', ctx => handleStoreAppleAuthToken(ctx, {
      readConfig: () => ({ clientId: 'fixture', teamId: 'fixture', keyId: 'fixture', privateKey: 'fixture' }),
      exchangeAuthorizationCode: code => {
        if (code === 'fail-provider') throw new Error(marker);
        return Promise.resolve(marker);
      },
    })],
    ['DELETE /account', ctx => handleDeleteAccount(ctx, undefined, async input => {
      if (input.refreshToken !== marker) throw new Error('Synthetic provider rejected credential');
    })],
  ]),
});
Deno.serve({ hostname: '127.0.0.1', port: 0,
  onListen: address => console.log(`APPLE_AUTH_TEST_READY:${address.port}`),
}, handler);
