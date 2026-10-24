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
import { isSiriDreamCapture } from '@/lib/siriDreamCapture';
import {
  claimNotificationDreams,
  rememberNotificationDreamScope,
  readNotificationDreamInbox,
  removeImportedNotificationDreams,
  subscribeNotificationDreamInbox,
} from '@/services/notificationDreamInbox';
import { recordBadgeEvent } from '@/services/badgeLedgerStore';
import { registerDreamCaptureBackgroundTask } from '@/services/notificationDreamTask';
import { ensureDreamCaptureReplyAction } from '@/services/notificationService';

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
  const scopeRef = useRef(scope);
  const latestImportRef = useRef<(() => Promise<void>) | null>(null);
  const ready = Platform.OS !== 'web' && loaded && !authLoading;

  useEffect(() => {
    dreamsRef.current = dreams;
  }, [dreams]);

  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  // A reply made while the app is closed belongs to the journal open here.
  // Written again whenever the app comes and goes, so a failed write is retried
  // before the next closed-app reply.
  const rememberScope = useCallback(() => {
    if (!ready) return;
    rememberNotificationDreamScope(scope).catch((error) => {
      log.warn('Unable to remember the open journal', error);
    });
  }, [ready, scope]);

  useEffect(() => {
    rememberScope();
  }, [rememberScope]);

  const importPending = useCallback(async () => {
    if (!ready) return;
    if (importingRef.current) {
      rerunRef.current = true;
      return;
    }
    importingRef.current = true;
    // A pass started for one account stops as soon as another signs in; the
    // newest pass then runs with its own journal.
    const stale = () => scopeRef.current !== scope;
    try {
      do {
        rerunRef.current = false;
        const captures = (await readNotificationDreamInbox()).filter((capture) =>
          canImportNotificationDream(capture, scope)
        );
        if (stale()) break;
        // Tie each reply to this journal before saving it, so a failed save or
        // cleanup never leaves it open to another account signing in here.
        await claimNotificationDreams(
          captures.map((capture) => capture.id),
          scope
        );
        const imported: string[] = [];
        let blockedByGuestLimit = false;
        for (const capture of captures) {
          if (stale()) break;
          const alreadySaved = dreamsRef.current.some(
            (dream) => dream.clientRequestId === capture.clientRequestId
          );
          if (!alreadySaved) {
            try {
              const saved = await addDream({
                ...buildDraftDream(capture.text, {
                  defaultTitle: t('recording.draft.default_title'),
                  now: () => capture.capturedAt,
                }),
                clientRequestId: capture.clientRequestId,
              });
              // Told to Siri: a voice capture. A notification reply may be typed or
              // dictated by the keyboard, which nothing here can tell.
              if (isSiriDreamCapture(capture)) {
                recordBadgeEvent({ type: 'dream_saved', dream: saved, voiced: true, answered: false });
              }
            } catch (error) {
              // Kept in the inbox (a full guest journal, a storage error): the
              // next launch or return to the app tries again.
              log.warn('Unable to save a dictated dream', error);
              if (error instanceof GuestDreamLimitError) blockedByGuestLimit = true;
              continue;
            }
          }
          imported.push(capture.id);
        }
        await removeImportedNotificationDreams(imported);
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
      } while (rerunRef.current && !stale());
    } catch (error) {
      log.warn('Unable to read dictated dreams', error);
    } finally {
      importingRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        void latestImportRef.current?.();
      }
    }
  }, [addDream, ready, scope, t]);

  useEffect(() => {
    latestImportRef.current = importPending;
  }, [importPending]);

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
    rememberScope();
    void registerDreamCaptureBackgroundTask();
    void ensureDreamCaptureReplyAction().catch(() => undefined);
    void importPending();
  }, rememberScope);
}
