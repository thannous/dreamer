import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { ApiContext } from '../types.ts';
import {
  handleGuestQaEnroll,
  handleGuestQaStatus,
  parseGuestQaOperatorIds,
} from './guestQa.ts';

const OPERATOR_ID = '11111111-1111-4111-8111-111111111111';
const FINGERPRINT = 'a'.repeat(64);

const context = (
  path: string,
  body: Record<string, unknown>,
  user: { id: string } | null = { id: OPERATOR_ID }
): ApiContext => ({
  req: new Request(`https://example.test/functions/v1/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  supabase: {},
  user,
  supabaseUrl: 'https://example.test',
  supabaseServiceRoleKey: 'service-role-key',
  storageBucket: 'dream-images',
});

Deno.test('guest QA operator allowlist accepts only UUID values', () => {
  assertEquals(
    [...parseGuestQaOperatorIds(`bad, ${OPERATOR_ID}, thannous@gmail.com`)],
    [OPERATOR_ID]
  );
});

Deno.test('guest QA status rejects authenticated users outside the server allowlist', async () => {
  let createdAdmin = false;
  const response = await handleGuestQaStatus(
    context('/qa/guest-device/status', { fingerprint: FINGERPRINT }),
    {
      readEnv: () => '22222222-2222-4222-8222-222222222222',
      createAdminClient: (() => {
        createdAdmin = true;
        return {};
      }) as any,
    }
  );

  assertEquals(response.status, 403);
  assertEquals(createdAdmin, false);
  assertEquals((await response.json()).code, 'QA_ACCESS_DENIED');
});

Deno.test('guest QA enrollment forwards the fixed 24h, 3-reset and 10-call policy', async () => {
  const calls: { name: string; params: Record<string, unknown> }[] = [];
  const response = await handleGuestQaEnroll(
    context('/qa/guest-device/enroll', {
      fingerprint: FINGERPRINT,
      requestId: '33333333-3333-4333-8333-333333333333',
    }),
    {
      readEnv: () => OPERATOR_ID,
      createAdminClient: (() => ({
        rpc: async (name: string, params: Record<string, unknown>) => {
          calls.push({ name, params });
          return {
            data: {
              allowed: true,
              passportId: '44444444-4444-4444-8444-444444444444',
            },
            error: null,
          };
        },
      })) as any,
    }
  );

  assertEquals(response.status, 200);
  assertEquals(calls, [{
    name: 'enroll_guest_qa_passport',
    params: {
      p_operator_user_id: OPERATOR_ID,
      p_fingerprint: FINGERPRINT,
      p_request_id: '33333333-3333-4333-8333-333333333333',
      p_valid_hours: 24,
      p_daily_reset_limit: 3,
      p_daily_paid_call_limit: 10,
    },
  }]);
});
