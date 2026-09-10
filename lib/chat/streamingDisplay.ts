import type { ChatMessage } from '@/lib/types';

export const STREAMING_MESSAGE_ID = 'streaming-reply';

export const hasCompletedReplyForRequest = (
  messages: ChatMessage[],
  requestId: string | null | undefined
): boolean => {
  if (!requestId) return false;
  const userIndex = messages.findIndex((message) => message.role === 'user' && message.id === requestId);
  if (userIndex < 0) return false;
  const reply = messages[userIndex + 1];
  return Boolean(reply && reply.role === 'model' && !reply.meta?.isError);
};

export const buildDisplayMessages = (
  messages: ChatMessage[],
  streamingReply: string | null,
  streamingRequestId: string | null
): ChatMessage[] => {
  if (!streamingReply || !streamingRequestId) return messages;
  // Replace the virtual bubble only when this send's completed reply is in history.
  // Text equality with an earlier model message is not a match.
  if (hasCompletedReplyForRequest(messages, streamingRequestId)) return messages;
  return [
    ...messages,
    {
      id: STREAMING_MESSAGE_ID,
      role: 'model',
      text: streamingReply,
      createdAt: (messages[messages.length - 1]?.createdAt ?? 0) + 1,
    },
  ];
};
