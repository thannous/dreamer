import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { GUEST_DREAM_RECORDING_LIMIT } from '@/constants/limits';

import { useAuth } from '@/context/AuthContext';
import { useDreamsActions, useDreamsData } from '@/context/DreamsContext';
import { useAppState } from '@/hooks/useAppState';
import { useTranslation } from '@/hooks/useTranslation';
import { buildDraftDream } from '@/lib/dreamUtils';
import { GuestDreamLimitError } from '@/lib/errors';
import { canImportNotificationDream, notificationDreamScope } from '@/lib/notificationDreamCapture';
import { createScopedLogger } from '@/lib/logger';
import {
  claimWaitingNotificationDreams,
  readNotificationDreamInbox,
  removeImportedNotificationDreams,
  subscribeNotificationDreamInbox,
} from '@/services/notificationDreamInbox';
import { registerDreamCaptureBackgroundTask } from '@/services/notificationDreamTask';

const log = createScopedLogger('[NotificationDreamImport]');

/**
 * Saves dreams dictated from a reminder reply into the journal. The reply
 * itself only reaches a device inbox (the app may have been headless); this
 * hook turns each one into a journal entry through the regular `addDream`
 * path, so guest limits and cloud sync behave as for any other capture.
 */
export function useNotificationDreamImport(): void {
  const { dreams, loaded } = useDreamsData();
  const { addDream } = useDreamsActions();
  const { user, loading: authLoading } = useAuth();
  const scope = notificationDreamScope(user?.id);
  const { t } = useTranslation();
  const dreamsRef = useRef(dreams);
  const importingRef = useRef(false);
  const rerunRef = useRef(false);
  const guestLimitShownRef = useRef(false);
  const ready = Platform.OS !== 'web' && loaded && !authLoading;

  useEffect(() => {
    dreamsRef.current = dreams;
  }, [dreams]);

  const importPending = useCallback(async () => {
    if (!ready) return;
    if (importingRef.current) {
      rerunRef.current = true;
      return;
    }
    importingRef.current = true;
    try {
      do {
        rerunRef.current = false;
        const captures = await readNotificationDreamInbox();
        const imported: string[] = [];
        const waiting: string[] = [];
        let blockedByGuestLimit = false;
        for (const capture of captures) {
          if (!canImportNotificationDream(capture, scope)) continue;
          const alreadySaved = dreamsRef.current.some(
            (dream) => dream.clientRequestId === capture.clientRequestId
          );
          if (!alreadySaved) {
            try {
              await addDream({
                ...buildDraftDream(capture.text, {
                  defaultTitle: t('recording.draft.default_title'),
                  now: () => capture.capturedAt,
                }),
                clientRequestId: capture.clientRequestId,
              });
            } catch (error) {
              // Kept in the inbox (a full guest journal, a storage error): the
              // next launch or return to the app tries again.
              log.warn('Unable to save a dictated dream', error);
              if (error instanceof GuestDreamLimitError) blockedByGuestLimit = true;
              waiting.push(capture.id);
              continue;
            }
          }
          imported.push(capture.id);
        }
        await removeImportedNotificationDreams(imported);
        // A reply that has to wait stays with this journal, even if another
        // account signs in on the device before the next try.
        await claimWaitingNotificationDreams(waiting, scope);
        // The reply notice already said the dream was saved: it is, on this
        // device, but a full guest journal keeps it out of the journal. Say so
        // once per launch, while the user is looking at the app.
        if (blockedByGuestLimit && !guestLimitShownRef.current && AppState.currentState === 'active') {
          guestLimitShownRef.current = true;
          Alert.alert(
            t('recording.guest_recording.limit_title'),
            t('notifications.dream_capture.guest_limit_message', { limit: GUEST_DREAM_RECORDING_LIMIT }),
            [
              { text: t('recording.guest_recording.signup'), onPress: () => router.push('/settings?section=account&auth=signup') },
              { text: t('notifications.dream_capture.later'), style: 'cancel' },
            ]
          );
        }
      } while (rerunRef.current);
    } catch (error) {
      log.warn('Unable to read dictated dreams', error);
    } finally {
      importingRef.current = false;
    }
  }, [addDream, ready, scope, t]);

  useEffect(() => {
    void importPending();
  }, [importPending]);

  useEffect(
    () => subscribeNotificationDreamInbox(() => {
      void importPending();
    }),
    [importPending]
  );

  useAppState(() => {
    void registerDreamCaptureBackgroundTask();
    void importPending();
  });
}
