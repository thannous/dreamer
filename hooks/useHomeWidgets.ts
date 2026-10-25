import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useDreamsData } from '@/context/DreamsContext';
import { useAppState } from '@/hooks/useAppState';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDreamDate, formatShortDate } from '@/lib/dateUtils';
import { upcomingAnniversaries } from '@/lib/dreamAnniversary';
import { lastDreamImageKey, pickLastPaintedDream } from '@/lib/homeWidgets';
import { getLocalDateKey } from '@/lib/ritualProgressUtils';
import { updateLastDreamWidget, type WidgetAnniversary } from '@/services/lastDreamWidget';
import { endSleepTimer, getNoctaliaWidgets, updateCaptureWidget } from '@/services/noctaliaWidgets';

/** The anniversaries the widget lays ahead: a week, renewed each time the app comes back. */
const ANNIVERSARY_DAYS_AHEAD = 7;

/**
 * Keeps the home and lock screen widgets in step with the app: the capture widget in the
 * app's language, the last painted dream as the journal changes with the coming week's
 * anniversaries, and no sleep countdown left on the lock screen by a launch that ended
 * while a sound played.
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
  // The day the anniversaries are counted from: a new one once the app comes back on it.
  const [now, setNow] = useState(() => Date.now());
  const untitled = t('journal.detail.untitled_dream');
  const monthAgo = t('home.anniversary.month');
  const yearAgo = t('home.anniversary.year');
  // Without a painted dream the widget waits for one, and lays no anniversary either.
  const painted = Boolean(dream);
  const anniversaries = useMemo<WidgetAnniversary[]>(() => (painted
    ? upcomingAnniversaries(dreams, now, ANNIVERSARY_DAYS_AHEAD).map(({ from, until, anniversary }) => ({
      from,
      until,
      dream: anniversary.dream,
      title: anniversary.dream.title?.trim() || untitled,
      eyebrow: anniversary.span === 'year' ? yearAgo : monthAgo,
    }))
    : []), [dreams, monthAgo, now, painted, untitled, yearAgo]);
  // Everything the widget draws. The journal hands out new dream objects far more often.
  const shown = JSON.stringify([dream && lastDreamImageKey(dream, userId), title, currentLang, empty,
    anniversaries.map((day) => [day.from, lastDreamImageKey(day.dream, userId), day.title, day.eyebrow])]);
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
      shortDate: dream ? formatShortDate(dream.id, currentLang) : null,
      empty,
      anniversaries,
    }).then((done) => {
      if (done) sentRef.current = shown;
    }).finally(() => {
      if (sendingRef.current === shown) sendingRef.current = null;
    });
  }, [anniversaries, available, currentLang, dream, empty, shown, title, userId]);

  // Back on another day, the week ahead moves on, and the widget with it.
  const returned = useCallback(() => {
    const today = Date.now();
    setNow((previous) => (getLocalDateKey(new Date(previous)) === getLocalDateKey(new Date(today)) ? previous : today));
    sync();
  }, [setNow, sync]);

  useEffect(sync, [sync]);
  useAppState(returned);
}
