import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { ApiContext } from '../types.ts';
import { handleChat, sanitizeClientHistoryMessage, sanitizeGuestModelParts } from './chat.ts';

const buildContext = (body: Record<string, unknown>) => ({
  req: new Request('https://example.test/functions/v1/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  user: { id: 'user-1' },
  supabase: {},
  supabaseUrl: 'https://example.test',
  supabaseServiceRoleKey: 'service-role-key',
  storageBucket: 'dream-images',
}) as unknown as ApiContext;

Deno.test('chat rejects unsafe idempotency keys before admission or provider work', async () => {
  const response = await handleChat(buildContext({
    dreamId: '42',
    message: 'What could this symbol mean?',
    clientRequestId: 'unsafe request id',
  }));

  assertEquals(response.status, 400);
  assertEquals((await response.json()).field, 'clientRequestId');
});

Deno.test('chat rejects oversized messages before admission or provider work', async () => {
  const response = await handleChat(buildContext({
    dreamId: '42',
    message: 'x'.repeat(4001),
    clientRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
  }));

  assertEquals(response.status, 413);
  assertEquals((await response.json()).field, 'message');
});

Deno.test('chat replays an authenticated completed turn without provider work', async () => {
  const requestId = '3f73ab45-9a14-4db9-94a3-d24724457d9e';
  const rpcCalls: string[] = [];
  const context = buildContext({
    dreamId: '42',
    message: 'What could this symbol mean?',
    clientRequestId: requestId,
  });
  context.supabase = {
    rpc: async (name: string) => {
      rpcCalls.push(name);
      if (name !== 'begin_authenticated_chat_turn') {
        return { data: null, error: { code: 'UNEXPECTED_RPC' } };
      }
      return {
        data: {
          allowed: true,
          duplicate: true,
          completed: true,
          modelMessage: {
            id: '97af87b7-70bd-480f-93ac-77b38183a8b1',
            role: 'model',
            text: 'A cached interpretation.',
          },
          history: [],
          dream: {
            id: 42,
            transcript: 'A short dream',
            title: 'Dream',
            interpretation: '',
            shareable_quote: '',
            dream_type: 'Dream',
            theme: null,
          },
        },
        error: null,
      };
    },
  } as unknown as ApiContext['supabase'];

  const response = await handleChat(context, {
    admitRequest: async () => ({ tier: 'free', actorClass: 'FREE' }),
  });

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    text: 'A cached interpretation.',
    message: {
      id: '97af87b7-70bd-480f-93ac-77b38183a8b1',
      role: 'model',
      text: 'A cached interpretation.',
    },
  });
  assertEquals(rpcCalls, ['begin_authenticated_chat_turn']);
});

Deno.test('guest history preserves opaque signed model steps after JSON reload', () => {
  const parts = [{ thought: true, thoughtSignature: 'fixture-signature', thoughtSummary: [{ type: 'text' as const, text: 'private summary' }] }, { text: 'Visible answer' }];
  assertEquals(sanitizeGuestModelParts(JSON.parse(JSON.stringify(parts)), 'Visible answer'), parts);
  assertThrows(() => sanitizeGuestModelParts([{ thought: true, thoughtSignature: 'x', thoughtSummary: [{ type: 'tool', command: 'x' }] }, { text: 'Answer' }], 'Answer'));
  assertThrows(() => sanitizeGuestModelParts([{ thought: true }, { text: 'Answer' }], 'Answer'));
  assertThrows(() => sanitizeGuestModelParts([{ text: 'Other answer' }], 'Answer'));
  assertThrows(() => sanitizeGuestModelParts(Array(129).fill({ text: 'a' }), 'a'));
});

Deno.test('guest history preserves long signed answers without widening legacy text limits', () => {
  const text = 'a'.repeat(5000);
  const parts = [{ thought: true, thoughtSignature: 'fixture-signature' }, { text }];
  const saved = JSON.parse(JSON.stringify({ role: 'model', text, parts }));
  assertEquals(sanitizeClientHistoryMessage(saved), saved);
  assertEquals(sanitizeClientHistoryMessage({ role: 'model', text })?.text?.length, 4000);
  assertEquals(sanitizeClientHistoryMessage({ role: 'user', text, parts: [{ text }] })?.text?.length, 4000);
  const oversized = 'a'.repeat(32001);
  assertThrows(() => sanitizeClientHistoryMessage({ role: 'model', text: oversized, parts: [{ text: oversized }] }));
});
