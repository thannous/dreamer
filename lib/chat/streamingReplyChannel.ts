export type StreamingReply = { requestId: string; text: string };

type Listener = (reply: StreamingReply | null) => void;

/**
 * Carries a reply that streams in from the chat screen's send flow to the message list,
 * so each fragment renders the list only, not the whole screen.
 *
 * Listeners are React state setters, called in the publisher's own task: React batches a
 * fragment, or the end of the stream, with the screen's updates of that same task, so the
 * completed reply still replaces the streaming bubble in one commit.
 */
export function createStreamingReplyChannel() {
  let current: StreamingReply | null = null;
  const listeners = new Set<Listener>();
  // History messages that took the place of a bubble already on screen.
  const continued = new Set<string>();

  const publish = (reply: StreamingReply | null) => {
    if (reply === current) return;
    current = reply;
    listeners.forEach((listener) => listener(reply));
  };

  return {
    get: (): StreamingReply | null => current,
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish,
    /** Ends the stream; `replyId` names the history message that now holds its text. */
    end(replyId?: string) {
      if (replyId && current?.text) continued.add(replyId);
      publish(null);
    },
    /** True for a reply whose text was already shown while it streamed in. */
    continuesStream: (messageId: string): boolean => continued.has(messageId),
  };
}

export type StreamingReplyChannel = ReturnType<typeof createStreamingReplyChannel>;
