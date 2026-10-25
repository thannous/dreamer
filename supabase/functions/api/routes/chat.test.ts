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

const sse = (events: unknown[], named = false) => new Response(
  events.map((event) => `${named ? `event: ${(event as { type: string }).type}\n` : ''}data: ${JSON.stringify(event)}\n\n`).join(''),
  { headers: { 'Content-Type': 'text/event-stream' } },
);

const claudeStream = (text: string) => sse([
  { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 1 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 40 } },
  { type: 'message_stop' },
], true);

/** An authenticated turn whose history holds a signed Gemini answer and the new question. */
const streamingTurn = () => {
  const committed: unknown[] = [];
  const context = buildContext({ dreamId: '42', message: 'Est-ce une dépression ?', clientRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e', stream: true, lang: 'fr' });
  context.supabase = {
    rpc: async (name: string) => {
      assertEquals(name, 'begin_authenticated_chat_turn');
      return {
        data: {
          allowed: true, completed: false, attemptCount: 1,
          history: [
            { id: 'u1', role: 'user', text: 'Que veut dire la porte ?' },
            { id: 'm1', role: 'model', text: 'Une porte fermée.', parts: [{ thought: true, thoughtSignature: 'opaque-fixture', text: 'private reasoning' }, { text: 'Une porte fermée.' }] },
            { id: 'u2', role: 'user', text: 'Est-ce une dépression ?' },
          ],
          dream: { id: 42, transcript: 'Une porte fermée.', title: 'Porte', interpretation: '', shareable_quote: '', dream_type: 'Dream', theme: null },
        },
        error: null,
      };
    },
  } as unknown as ApiContext['supabase'];
  const createAdminClient = ((url: string, key: string) => {
    assertEquals(url, context.supabaseUrl);
    assertEquals(key, context.supabaseServiceRoleKey);
    return {
      rpc: async (name: string, params: Record<string, unknown>) => {
        assertEquals(name, 'complete_authenticated_chat_turn');
        assertEquals(params.p_user_id, context.user.id);
        committed.push(params.p_model_message);
        return { data: { completed: true }, error: null };
      },
    };
  }) as any;
  return { context, committed, createAdminClient };
};

Deno.test('authenticated chat requires a service completion client before starting a turn', async () => {
  const context = buildContext({
    dreamId: '42',
    message: 'What could this symbol mean?',
    clientRequestId: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
  });
  context.supabaseServiceRoleKey = null;
  let beganTurn = false;
  context.supabase = { rpc: async () => { beganTurn = true; return { data: null, error: null }; } };

  const response = await handleChat(context, {
    admitRequest: async () => ({ tier: 'free', actorClass: 'FREE' }),
  });

  assertEquals(response.status, 503);
  assertEquals(beganTurn, false);
});

Deno.test('authenticated chat releases a failed turn through the service client only', async () => {
  const previousKey = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.delete('ANTHROPIC_API_KEY');
  try {
    const { context } = streamingTurn();
    const released: { name: string; args: Record<string, unknown> }[] = [];
    const response = await handleChat(context, {
      admitRequest: async () => ({ tier: 'free', actorClass: 'FREE' }),
      createAdminClient: ((url: string, key: string) => {
        assertEquals(url, context.supabaseUrl);
        assertEquals(key, context.supabaseServiceRoleKey);
        return {
          rpc: async (name: string, args: Record<string, unknown>) => {
            released.push({ name, args });
            return { data: true, error: null };
          },
        };
      }) as any,
    });

    assertEquals(response.status, 503);
    assertEquals(released, [{
      name: 'fail_authenticated_chat_turn',
      args: {
        p_user_id: context.user!.id,
        p_dream_id: 42,
        p_request_id: '3f73ab45-9a14-4db9-94a3-d24724457d9e',
        p_attempt_count: 1,
        p_error_code: 'CHAT_REQUEST_FAILED',
      },
    }]);
  } finally {
    if (previousKey == null) Deno.env.delete('ANTHROPIC_API_KEY');
    else Deno.env.set('ANTHROPIC_API_KEY', previousKey);
  }
});

const withChatKeys = async (run: () => Promise<void>) => {
  const originalFetch = globalThis.fetch;
  const saved = { gemini: Deno.env.get('GEMINI_API_KEY'), anthropic: Deno.env.get('ANTHROPIC_API_KEY') };
  Deno.env.delete('GEMINI_API_KEY');
  Deno.env.set('ANTHROPIC_API_KEY', 'synthetic-anthropic-key');
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of [['GEMINI_API_KEY', saved.gemini], ['ANTHROPIC_API_KEY', saved.anthropic]] as const) {
      if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value);
    }
  }
};

Deno.test('with an Anthropic key, chat streams Claude Haiku at medium effort from text-only history', () => withChatKeys(async () => {
  const hosts: string[] = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    hosts.push(new URL(request.url).hostname);
    const body = await request.json();
    assertEquals(body.model, 'claude-haiku-5-5');
    assertEquals(body.output_config.effort, 'medium');
    // A reply must fit the 32,000-character history limit when it is replayed.
    assertEquals(body.max_tokens, 4096);
    assertEquals(body.stream, true);
    assertEquals(body.messages.map((message: { role: string }) => message.role), ['user', 'assistant', 'user']);
    assertEquals(JSON.stringify(body.messages).includes('private reasoning'), false);
    return claudeStream('Un rêve ne peut pas répondre à cela.');
  };
  const { context, committed, createAdminClient } = streamingTurn();
  const response = await handleChat(context, { admitRequest: async () => ({ tier: 'free', actorClass: 'FREE' }), createAdminClient });
  const events = (await response.text()).split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')));
  assertEquals(hosts, ['api.anthropic.com']);
  assertEquals(events[0], { delta: 'Un rêve ne peut pas répondre à cela.' });
  assertEquals(events.at(-1).done, true);
  assertEquals((committed[0] as { parts: unknown }).parts, [{ text: 'Un rêve ne peut pas répondre à cela.' }]);
}));

Deno.test('a chat stream that fails before its first Claude text fails without Gemini', () => withChatKeys(async () => {
  const hosts: string[] = [];
  globalThis.fetch = async (input, init) => {
    const host = new URL(new Request(input, init).url).hostname;
    hosts.push(host);
    if (host === 'api.anthropic.com') {
      return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }), { status: 529, headers: { 'Content-Type': 'application/json' } });
    }
    return sse([
      { event_type: 'step.start', index: 0, step: { type: 'model_output', content: [{ type: 'text', text: 'Réponse Gemini.' }] } },
      { event_type: 'step.stop', index: 0 },
      { event_type: 'interaction.completed', interaction: { status: 'completed' } },
    ]);
  };
  const { context, createAdminClient } = streamingTurn();
  const response = await handleChat(context, { admitRequest: async () => ({ tier: 'free', actorClass: 'FREE' }), createAdminClient });
  assertEquals(response.status, 502);
  assertEquals(hosts, ['api.anthropic.com']);
  assertEquals(await response.json(), { error: 'Text AI unavailable, please retry' });
}));

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

Deno.test('an interrupted Claude stream reports retryable failure without committing partial text', () => withChatKeys(async () => {
  const hosts: string[] = [];
  const { context } = streamingTurn();
  const writes: string[] = [];
  let interrupt: (() => void) | undefined;
  globalThis.fetch = async (input, init) => {
    hosts.push(new URL(new Request(input, init).url).hostname);
    const frames = [
      { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Une réponse inachevée…' } },
    ];
    const encode = (event: { type: string }) => new TextEncoder().encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    return new Response(new ReadableStream({ start(controller) {
      frames.forEach(frame => controller.enqueue(encode(frame)));
      interrupt = () => {
        controller.enqueue(encode({ type: 'error', error: { type: 'overloaded_error', message: 'Unavailable' } } as { type: string }));
        controller.close();
      };
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  };
  const response = await handleChat(context, {
    admitRequest: async () => ({ tier: 'free', actorClass: 'FREE' }),
    createAdminClient: (() => ({ rpc: async (name: string) => { writes.push(name); return { data: true, error: null }; } })) as never,
  });
  interrupt!();
  const events = (await response.text()).split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')));
  assertEquals(events[0].delta, 'Une réponse inachevée…');
  assertEquals(events.at(-1), { error: 'Text AI unavailable, please retry', status: 502 });
  assertEquals(events.some(event => event.done), false);
  assertEquals(writes, ['fail_authenticated_chat_turn']);
  assertEquals(hosts, ['api.anthropic.com']);
}));
