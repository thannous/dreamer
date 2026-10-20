import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useDreamsData } from '@/context/DreamsContext';
import { useAppState } from '@/hooks/useAppState';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDreamDate } from '@/lib/dateUtils';
import { lastDreamImageKey, pickLastPaintedDream } from '@/lib/homeWidgets';
import { updateLastDreamWidget } from '@/services/lastDreamWidget';
import { endSleepTimer, getNoctaliaWidgets, updateCaptureWidget } from '@/services/noctaliaWidgets';

/**
 * Keeps the home and lock screen widgets in step with the app: the capture widget in the
 * app's language, the last painted dream as the journal changes, and no sleep countdown
 * left on the lock screen by a launch that ended while a sound played.
 */
export function useHomeWidgets(): void {
  const { dreams, loaded } = useDreamsData();
  const userId = useAuth().user?.id ?? null;
  const { t, currentLang } = useTranslation();
  const available = getNoctaliaWidgets() !== null;

  useEffect(() => {
    if (available) endSleepTimer();
  }, [available]);

  const label = t('widgets.capture.label');
  useEffect(() => {
    if (available) updateCaptureWidget(label);
  }, [available, label]);

  const dream = available && loaded ? pickLastPaintedDream(dreams) : undefined;
  const empty = t('widgets.last_dream.empty');
  const title = dream?.title?.trim() || t('journal.detail.untitled_dream');
  // Everything the widget draws. The journal hands out new dream objects far more often.
  const shown = JSON.stringify([dream && lastDreamImageKey(dream, userId), title, currentLang, empty]);
  const sentRef = useRef<string | null>(null);
  const sendingRef = useRef<string | null>(null);

  // Also run when the app returns: a painting that could not be fetched offline is fetched then.
  const sync = useCallback(() => {
    if (!available || dream === undefined || sentRef.current === shown || sendingRef.current === shown) return;
    sendingRef.current = shown;
    void updateLastDreamWidget({
      dream,
      userId,
      title,
      date: dream ? formatDreamDate(dream.id, currentLang) : null,
      empty,
    }).then((done) => {
      if (done) sentRef.current = shown;
    }).finally(() => {
      if (sendingRef.current === shown) sendingRef.current = null;
    });
  }, [available, currentLang, dream, empty, shown, title, userId]);

  useEffect(sync, [sync]);
  useAppState(sync);
}
