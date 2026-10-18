import * as AppIntents from 'expo-app-intents';

import { generateUUID } from '@/lib/dreamUtils';
import { createScopedLogger } from '@/lib/logger';
import { NOTE_DREAM_INTENT, parseSiriDreamInvocation } from '@/lib/siriDreamCapture';
import { keepDictatedDream } from '@/services/notificationDreamInbox';

const log = createScopedLogger('[SiriDreamCapture]');

/**
 * Moves dreams told to Siri from the native queue into the dictated-dream
 * inbox, where `useNotificationDreamImport` saves them to the journal. iOS only;
 * elsewhere the queue is always empty.
 *
 * Delivery is at least once: an invocation leaves the queue only after its
 * dream is stored, and a replay finds the same inbox id and stores nothing new.
 */
export function useSiriDreamCapture(): void {
  AppIntents.useAppIntents(async (pendingIntents) => {
    for (const invocation of pendingIntents) {
      // Another action is not ours to acknowledge.
      if (invocation.name !== NOTE_DREAM_INTENT) continue;
      try {
        const capture = parseSiriDreamInvocation(invocation, {
          now: Date.now(),
          createClientRequestId: generateUUID,
        });
        // Siri never sends an empty dream, so one without words is dropped.
        if (capture) await keepDictatedDream(capture);
        await AppIntents.removePendingInvocationAsync(invocation.id);
      } catch (error) {
        // Still queued: the next Siri dream or launch tries again.
        log.warn('A dream told to Siri stays queued', error);
      }
    }
  });
}
