import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useDreamsActions } from '@/context/DreamsContext';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { generateUUID } from '@/lib/dreamUtils';
import { createDreamChatSend, type DreamChatSendRequest } from '@/services/dreamChatSend';
import { startOrContinueChat } from '@/services/geminiService';
import { createDreamInSupabase } from '@/services/supabaseDreamService';

/** React lifetime and production ports; the transaction itself has no UI dependency. */
export function useDreamChatSend() {
  const { updateDream, applyServerDreamState } = useDreamsActions();
  const [operation] = useState(createDreamChatSend);
  // The screen shows only whether a turn is in flight, not each of its phases.
  const isSendingSnapshot = useCallback(() => operation.getSnapshot().status === 'sending', [operation]);
  const isSending = useSyncExternalStore(operation.subscribe, isSendingSnapshot, isSendingSnapshot);
  useEffect(() => () => operation.cancel(), [operation]);
  const send = useCallback((request: DreamChatSendRequest) => operation.send(request, {
    createId: generateUUID,
    now: Date.now,
    getFingerprint: getDeviceFingerprint,
    syncDream: createDreamInSupabase,
    updateDream,
    applyServerDream: applyServerDreamState,
    requestReply: startOrContinueChat,
  }), [applyServerDreamState, operation, updateDream]);
  return { isSending, send };
}
