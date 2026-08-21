import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useDreamsData } from '@/context/DreamsContext';
import { useAppState } from '@/hooks/useAppState';
import { isLucidTrainer } from '@/lib/appVariant';
import {
  buildEngagementReminderPlan,
  getEngagementReminderPlanSignature,
} from '@/lib/engagementReminders';
import { createScopedLogger } from '@/lib/logger';
import type { DreamAnalysis } from '@/lib/types';
import {
  scheduleInactivityReminders,
  scheduleStreakRiskReminder,
} from '@/services/notificationService';
import { getNotificationSettings } from '@/services/storageService';

const log = createScopedLogger('[EngagementReminders]');

/**
 * Keeps the two one-shot engagement families in sync with the journal.
 *
 * Both are dated reminders, so they must be recomputed whenever the underlying
 * facts move: a dream is saved (the streak deadline shifts, the inactivity
 * countdown restarts) or the app returns to the foreground (`now` is stale
 * after a night in the background, and the local day may have changed).
 *
 * The daily reminders, ritual reminders and weekly recap are never touched:
 * each scheduler only replaces its own family.
 */
export function useEngagementReminders(): void {
  const { dreams, loaded } = useDreamsData();
  const unsupported = Platform.OS === 'web' || isLucidTrainer;
  const lastSignatureRef = useRef<string | null>(null);
  const runningRef = useRef(false);
  // Freshest journal that arrived while a run was in flight, replayed at the end
  // of that run. Dropping it would leave a stale plan armed (and a signature
  // that hides the staleness) until the next save or foreground.
  const pendingRef = useRef<readonly DreamAnalysis[] | null>(null);
  // Snapshot for the AppState callback, which fires outside the render cycle.
  const dreamsRef = useRef(dreams);

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
          if (signature !== lastSignatureRef.current) {
            await scheduleStreakRiskReminder(settings, plan.streakRisk);
            await scheduleInactivityReminders(settings, plan.inactivity);
            lastSignatureRef.current = signature;
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
}

export default useEngagementReminders;
