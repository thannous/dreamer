import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@jest/globals';

import type { ChatMessage } from '@/lib/types';

import {
  STREAMING_MESSAGE_ID,
  buildDisplayMessages,
  hasCompletedReplyForRequest,
} from '../streamingDisplay';

const model = (id: string, text: string, extra?: Partial<ChatMessage>): ChatMessage => ({
  id,
  role: 'model',
  text,
  createdAt: 1,
  ...extra,
});

const user = (id: string, text: string): ChatMessage => ({
  id,
  role: 'user',
  text,
  createdAt: 1,
});

describe('buildDisplayMessages', () => {
  it('keeps the streaming bubble when a prior model reply has the same text and remoteId is missing', () => {
    // Authenticated sync-first path: history still ends on the preceding model reply
    // because the new user message is not appended until streaming finishes.
    const priorText = 'The river is a path home.';
    const history: ChatMessage[] = [
      user('prior-user', 'What did the river mean?'),
      model('prior-model', priorText),
    ];
    const activeRequestId = 'send-without-remote-id';

    const displayed = buildDisplayMessages(history, priorText, activeRequestId);

    expect(hasCompletedReplyForRequest(history, activeRequestId)).toBe(false);
    expect(displayed).toHaveLength(3);
    expect(displayed[2]).toEqual(
      expect.objectContaining({
        id: STREAMING_MESSAGE_ID,
        role: 'model',
        text: priorText,
      })
    );
  });

  it('keeps streamed tokens visible while they temporarily match a prior model reply', () => {
    const history: ChatMessage[] = [
      user('prior-user', 'Describe the door.'),
      model('prior-model', 'The door opened onto the sea.'),
    ];
    const activeRequestId = 'send-growing';
    const growing = 'The door opened onto the sea.';

    const displayed = buildDisplayMessages(history, growing, activeRequestId);

    expect(displayed[displayed.length - 1]?.id).toBe(STREAMING_MESSAGE_ID);
    expect(displayed[displayed.length - 1]?.text).toBe(growing);
  });

  it('hides the streaming bubble only after this send\'s completed reply is in history', () => {
    const requestId = 'send-complete';
    const replyText = 'The river is a path home.';
    const history: ChatMessage[] = [
      user('prior-user', 'What did the river mean?'),
      model('prior-model', replyText),
      user(requestId, 'Tell me again.'),
      model('model-for-this-send', replyText),
    ];

    expect(hasCompletedReplyForRequest(history, requestId)).toBe(true);
    expect(buildDisplayMessages(history, replyText, requestId)).toEqual(history);
  });

  it('keeps the bubble when the user message for this send is present but its reply is not', () => {
    const requestId = 'send-pending-reply';
    const replyText = 'The same words as before.';
    const history: ChatMessage[] = [
      user('prior-user', 'First question'),
      model('prior-model', replyText),
      user(requestId, 'Ask again'),
    ];

    const displayed = buildDisplayMessages(history, replyText, requestId);
    expect(displayed[displayed.length - 1]?.id).toBe(STREAMING_MESSAGE_ID);
  });

  it('does not treat an error after this send as the completed reply', () => {
    const requestId = 'send-error';
    const history: ChatMessage[] = [
      user(requestId, 'Ask'),
      model('error-1', 'Please try again.', { meta: { isError: true } }),
    ];

    const displayed = buildDisplayMessages(history, 'Partial tokens', requestId);
    expect(displayed[displayed.length - 1]?.id).toBe(STREAMING_MESSAGE_ID);
  });

  it('returns history unchanged when there is no active stream identity', () => {
    const history: ChatMessage[] = [model('prior-model', 'Still there.')];
    expect(buildDisplayMessages(history, 'Still there.', null)).toEqual(history);
    expect(buildDisplayMessages(history, null, 'send-1')).toEqual(history);
  });
});

describe('dream chat streaming identity wiring', () => {
  const source = readFileSync(join(__dirname, '../../../app/dream-chat/[id].tsx'), 'utf8');

  it('replaces the streaming bubble by request identity rather than text compare', () => {
    expect(source).toContain('buildDisplayMessages(');
    expect(source).toContain('streamingRequestIdRef');
    expect(source).not.toContain('lastMessage.text.trim() === streamingReply.trim()');
  });
});
