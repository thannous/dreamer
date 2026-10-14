import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useDreamsActions, useDreamsData } from '@/context/DreamsContext';
import { useAppState } from '@/hooks/useAppState';
import { useTranslation } from '@/hooks/useTranslation';
import { buildDraftDream } from '@/lib/dreamUtils';
import { createScopedLogger } from '@/lib/logger';
import {
  readNotificationDreamInbox,
  removeImportedNotificationDreams,
  subscribeNotificationDreamInbox,
} from '@/services/notificationDreamInbox';

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
  const { loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const dreamsRef = useRef(dreams);
  const importingRef = useRef(false);
  const rerunRef = useRef(false);
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
        for (const capture of captures) {
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
              continue;
            }
          }
          imported.push(capture.id);
        }
        await removeImportedNotificationDreams(imported);
      } while (rerunRef.current);
    } catch (error) {
      log.warn('Unable to read dictated dreams', error);
    } finally {
      importingRef.current = false;
    }
  }, [addDream, ready, t]);

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
    void importPending();
  });
}
