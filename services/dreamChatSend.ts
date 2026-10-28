import { createExternalStore } from '@/lib/externalStore';
import type { ChatMessage, DreamAnalysis } from '@/lib/types';

type ReplyRequest = typeof import('./geminiService').startOrContinueChat;
export type DreamChatSendState =
  | { status: 'idle' }
  | { status: 'sending'; phase: 'syncing' | 'requesting' | 'persisting'; requestId: string }
  | { status: 'sent'; requestId: string }
  | { status: 'failed'; requestId: string; error: unknown };

type Ports = {
  createId: () => string;
  now: () => number;
  getFingerprint: () => Promise<string>;
  syncDream: (dream: DreamAnalysis, userId: string) => Promise<DreamAnalysis>;
  updateDream: (dream: DreamAnalysis, previous?: DreamAnalysis) => Promise<unknown>;
  applyServerDream: (dream: DreamAnalysis) => Promise<unknown>;
  requestReply: ReplyRequest;
};

export type DreamChatSendRequest = {
  dream: DreamAnalysis;
  userId?: string;
  mock: boolean;
  text: string;
  displayText: string;
  language: string;
  requestId: string;
  meta?: ChatMessage['meta'];
  baseMessages: ChatMessage[];
  /** Auto-sync keeps the old conversation visible until the response arrives. */
  onAccepted: (pendingMessages: ChatMessage[] | null) => void;
  onReply: (messages: ChatMessage[], replyId: string) => void;
  onDelta: (text: string) => void;
};

export type DreamChatSendResult =
  | { status: 'sent'; dream: DreamAnalysis; messages: ChatMessage[]; synced: boolean }
  | { status: 'failed'; error: unknown; pendingMessages: ChatMessage[]; syncing: boolean }
  | { status: 'ignored' }
  | { status: 'cancelled' };

const IDLE: DreamChatSendState = { status: 'idle' };

/** One admitted chat turn: identity, optional sync, reply and durable history. */
export function createDreamChatSend() {
  const { getSnapshot, subscribe, publish } = createExternalStore(IDLE);
  let active: AbortController | null = null;
  return {
    getSnapshot,
    subscribe,
    cancel: () => {
      active?.abort();
      active = null;
      publish(IDLE);
    },
    send: async (request: DreamChatSendRequest, ports: Ports): Promise<DreamChatSendResult> => {
      if (active) return { status: 'ignored' };
      const controller = new AbortController();
      active = controller;
      const current = () => active === controller && !controller.signal.aborted;
      const syncing = Boolean(request.userId && !request.dream.remoteId && !request.mock);
      const phase = (next: 'syncing' | 'requesting' | 'persisting') => {
        publish({ status: 'sending', phase: next, requestId: request.requestId });
      };
      const userMessage: ChatMessage = {
        id: request.requestId, role: 'user', text: request.displayText,
        createdAt: ports.now(), ...(request.meta ? { meta: request.meta } : {}),
      };
      const pendingMessages = [...request.baseMessages, userMessage];
      phase(syncing ? 'syncing' : 'requesting');
      try {
        request.onAccepted(syncing ? null : pendingMessages);
        let dream = request.dream;
        if (syncing) {
          const toSync = dream.clientRequestId ? dream : { ...dream, clientRequestId: ports.createId() };
          if (!dream.clientRequestId) await ports.updateDream(toSync, dream);
          if (!current()) return { status: 'cancelled' };
          const synced = await ports.syncDream(toSync, request.userId!);
          if (!current()) return { status: 'cancelled' };
          await ports.updateDream(synced, toSync);
          if (!current()) return { status: 'cancelled' };
          dream = synced;
        }
        let fingerprint: string | undefined;
        if (!request.userId) {
          // Fingerprinting is best effort; the server remains responsible for admission.
          try { fingerprint = await ports.getFingerprint(); } catch { /* Continue without it. */ }
        }
        if (!current()) return { status: 'cancelled' };
        const guestContext = !request.userId && !dream.remoteId ? {
          transcript: dream.transcript, title: dream.title, interpretation: dream.interpretation,
          shareableQuote: dream.shareableQuote, dreamType: dream.dreamType, theme: dream.theme,
          chatHistory: pendingMessages,
        } : undefined;
        phase('requesting');
        const reply = await ports.requestReply(String(dream.remoteId ?? dream.id), request.text,
          request.language, guestContext, guestContext ? fingerprint : undefined, {
            signal: controller.signal, clientRequestId: request.requestId, messageMeta: request.meta,
            onDelta: text => { if (current()) request.onDelta(text); },
          });
        if (!current()) return { status: 'cancelled' };
        const modelMessage: ChatMessage = {
          id: reply.message?.id ?? ports.createId(), role: 'model', text: reply.text,
          createdAt: ports.now(), ...(reply.message?.parts ? { parts: reply.message.parts } : {}),
        };
        const messages = [...pendingMessages, modelMessage];
        request.onReply(messages, modelMessage.id);
        phase('persisting');
        const saved = { ...dream, chatHistory: messages };
        // The server already committed authenticated turns atomically. Cache them
        // without issuing a redundant full-dream mutation that could race revisions.
        if (request.userId && !request.mock) await ports.applyServerDream(saved);
        else await ports.updateDream(saved);
        if (!current()) return { status: 'cancelled' };
        publish({ status: 'sent', requestId: request.requestId });
        return { status: 'sent', dream, messages, synced: syncing };
      } catch (error) {
        if (!current()) return { status: 'cancelled' };
        publish({ status: 'failed', requestId: request.requestId, error });
        return { status: 'failed', error, pendingMessages, syncing };
      } finally {
        if (active === controller) active = null;
      }
    },
  };
}
