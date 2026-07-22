import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { claimGuestQaPaidCall, isGuestQaQuotaSubject } from './guestQa.ts';

Deno.test('guest QA subjects are unguessable passport UUID namespaces', () => {
  assertEquals(
    isGuestQaQuotaSubject('qa:11111111-1111-4111-8111-111111111111'),
    true
  );
  assertEquals(isGuestQaQuotaSubject('qa:not-a-uuid'), false);
  assertEquals(isGuestQaQuotaSubject('device-fingerprint'), false);
});

Deno.test('normal guests do not pay the QA lookup cost', async () => {
  let called = false;
  const response = await claimGuestQaPaidCall({
    adminClient: {
      rpc: async () => {
        called = true;
        return { data: null, error: null };
      },
    },
    capability: 'chat',
    quotaSubject: 'normal-device-fingerprint',
  });

  assertEquals(response, null);
  assertEquals(called, false);
});

Deno.test('QA daily budget blocks provider admission with retry metadata', async () => {
  const response = await claimGuestQaPaidCall({
    adminClient: {
      rpc: async () => ({
        data: {
          qa: true,
          allowed: false,
          code: 'QA_DAILY_BUDGET_EXCEEDED',
          used: 10,
          limit: 10,
          retryAfter: 120,
        },
        error: null,
      }),
    },
    capability: 'chat',
    quotaSubject: 'qa:11111111-1111-4111-8111-111111111111',
    requestKey: '22222222-2222-4222-8222-222222222222',
  });

  assertEquals(response?.status, 429);
  assertEquals(response?.headers.get('Retry-After'), '120');
  assertEquals((await response?.json()).code, 'QA_DAILY_BUDGET_EXCEEDED');
});
