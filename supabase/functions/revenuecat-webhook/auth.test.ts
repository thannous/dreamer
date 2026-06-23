import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { verifyRevenueCatWebhookAuthorization } from './auth.ts';

Deno.test('RevenueCat webhook accepts Authorization bearer secret', () => {
  const req = new Request('https://example.supabase.co/functions/v1/revenuecat-webhook', {
    method: 'POST',
    headers: { Authorization: 'Bearer shared-secret' },
  });

  assertEquals(verifyRevenueCatWebhookAuthorization(req, 'shared-secret'), true);
});

Deno.test('RevenueCat webhook rejects shared secret in query string', () => {
  const req = new Request(
    'https://example.supabase.co/functions/v1/revenuecat-webhook?rc_webhook_secret=shared-secret',
    { method: 'POST' }
  );

  assertEquals(verifyRevenueCatWebhookAuthorization(req, 'shared-secret'), false);
});

Deno.test('RevenueCat webhook rejects query string secret when Authorization is not the webhook secret', () => {
  const req = new Request(
    'https://example.supabase.co/functions/v1/revenuecat-webhook?revenuecat_webhook_secret=shared-secret',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer anon-or-wrong-secret' },
    }
  );

  assertEquals(verifyRevenueCatWebhookAuthorization(req, 'shared-secret'), false);
});
