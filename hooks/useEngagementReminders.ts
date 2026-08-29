import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useDreamsData } from '@/context/DreamsContext';
import { useAnalysisActivity } from '@/context/AnalysisActivityContext';
import { useAppState } from '@/hooks/useAppState';
import { isLucidTrainer } from '@/lib/appVariant';
import { resolveDreamerTimeContext, shouldPresentAnalysisReadyNotification } from '@/lib/dreamerNotifications';
import {
  buildEngagementReminderPlan,
  getEngagementReminderPlanSignature,
} from '@/lib/engagementReminders';
import { createScopedLogger } from '@/lib/logger';
import type { DreamAnalysis } from '@/lib/types';
import {
  presentAnalysisReadyNotification,
  reconcileDreamerReminders,
} from '@/services/notificationService';
import { getNotificationSettings } from '@/services/storageService';

const log = createScopedLogger('[EngagementReminders]');

/**
 * Keeps the two one-shot engagement families in sync with the journal.
 *
 * Both are dated reminders, so they must be recomputed whenever the underlying
 * facts move: a dream is saved (the streak deadline shifts, the inactivity
 * countdown restarts) or the app returns to the foreground (`now` is stale
 * after a night in the background, and timezone/DST may have changed).
 *
 * Reconciliation also rebuilds the essential morning and weekly recap
 * families against the current offset, and cancels leftover ritual/orphan
 * schedules. Lucid Trainer notifications are left alone.
 */
export function useEngagementReminders(): void {
  const { dreams, loaded } = useDreamsData();
  const { lastAnalysisOutcome } = useAnalysisActivity();
  const unsupported = Platform.OS === 'web' || isLucidTrainer;
  const lastSignatureRef = useRef<string | null>(null);
  const lastTimeContextRef = useRef<string | null>(null);
  const runningRef = useRef(false);
  // Freshest journal that arrived while a run was in flight, replayed at the end
  // of that run. Dropping it would leave a stale plan armed (and a signature
  // that hides the staleness) until the next save or foreground.
  const pendingRef = useRef<readonly DreamAnalysis[] | null>(null);
  // Snapshot for the AppState callback, which fires outside the render cycle.
  const dreamsRef = useRef(dreams);
  const lastNotifiedAnalysisRef = useRef<{ dreamId: number; completedAt: number } | null>(null);

  const sync = useCallback(async (journal: readonly DreamAnalysis[]) => {
    if (unsupported) {
      return;
    }
    if (runningRef.current) {
      // A remote merge or a save can land mid-run: remember the newest journal
      // instead of discarding the request, the loop below picks it up.
      pendingRef.current = journal;
      return;
    }
    runningRef.current = true;
    try {
      let next: readonly DreamAnalysis[] | null = journal;
      while (next) {
        const current = next;
        // Cleared before awaiting so a request arriving during the round-trip
        // below is captured rather than overwritten by this iteration.
        pendingRef.current = null;
        try {
          const settings = await getNotificationSettings();
          const plan = buildEngagementReminderPlan(current);
          const signature = getEngagementReminderPlanSignature(plan, settings);
          const timeContext = resolveDreamerTimeContext();
          const timeContextKey = `${timeContext.timeZone}|${timeContext.offsetMinutes}`;
          if (signature !== lastSignatureRef.current || timeContextKey !== lastTimeContextRef.current) {
            await reconcileDreamerReminders({
              settings,
              timeContext,
              streakRisk: plan.streakRisk,
              inactivity: plan.inactivity,
            });
            lastSignatureRef.current = signature;
            lastTimeContextRef.current = timeContextKey;
          }
        } catch (error) {
          // A failed run must not swallow the journal that arrived meanwhile.
          log.warn('Failed to sync engagement reminders', error);
        }
        next = pendingRef.current;
      }
    } finally {
      runningRef.current = false;
      pendingRef.current = null;
    }
  }, [unsupported]);

  useEffect(() => {
    dreamsRef.current = dreams;
    if (!loaded) {
      return;
    }
    void sync(dreams);
    // `dreams` is the trigger: a new (or deleted) dream moves both deadlines.
  }, [dreams, loaded, sync]);

  useAppState(
    useCallback(() => {
      if (loaded) {
        void sync(dreamsRef.current);
      }
    }, [loaded, sync])
  );

  useEffect(() => {
    if (unsupported) return;
    const decision = shouldPresentAnalysisReadyNotification({
      appState: AppState.currentState,
      outcome: lastAnalysisOutcome,
      lastNotified: lastNotifiedAnalysisRef.current,
    });
    if (!decision || !lastAnalysisOutcome) return;
    lastNotifiedAnalysisRef.current = {
      dreamId: lastAnalysisOutcome.dreamId,
      completedAt: lastAnalysisOutcome.completedAt,
    };
    void presentAnalysisReadyNotification(decision.dreamId).catch((error) => {
      log.warn('Failed to present analysis-ready notification', error);
    });
  }, [lastAnalysisOutcome, unsupported]);
}

export default useEngagementReminders;
