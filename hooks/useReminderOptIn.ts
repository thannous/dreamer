import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useDreamsData } from '@/context/DreamsContext';
import { trackProductEvent } from '@/lib/analytics';
import { isLucidTrainer } from '@/lib/appVariant';
import { createScopedLogger } from '@/lib/logger';
import {
  buildOptInNotificationSettings,
  DEFAULT_REMINDER_OPT_IN_TIME,
  getReminderTimeBucket,
  REMINDER_OPT_IN_PRESETS,
  type ReminderOptInPreset,
} from '@/lib/reminderOptIn';
import {
  requestNotificationPermissions,
  scheduleDailyNotification,
  scheduleWeeklyRecapReminder,
} from '@/services/notificationService';
import {
  getNotificationSettings,
  getReminderPromptDismissed,
  saveNotificationSettings,
  saveReminderPromptDismissed,
} from '@/services/storageService';

const log = createScopedLogger('[ReminderOptIn]');

export type ReminderOptInSurface = 'journal_detail' | 'home';

export type ReminderOptInController = {
  /** True once storage has been read and the card should be rendered. */
  visible: boolean;
  presets: readonly ReminderOptInPreset[];
  selectedTime: ReminderOptInPreset;
  selectTime: (time: ReminderOptInPreset) => void;
  busy: boolean;
  /** Set after the user accepted and the reminder was scheduled. */
  enabled: boolean;
  enable: () => Promise<void>;
  dismiss: () => Promise<void>;
};

/**
 * Drives the one-time "morning reminder" opt-in card shown after the first
 * dream. The card is only offered on native, to users with at least one dream,
 * whose reminders are still off and who have not dismissed the card before.
 */
export function useReminderOptIn(surface: ReminderOptInSurface): ReminderOptInController {
  const { dreams, loaded } = useDreamsData();
  const [eligible, setEligible] = useState(false);
  const [selectedTime, setSelectedTime] = useState<ReminderOptInPreset>(DEFAULT_REMINDER_OPT_IN_TIME);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const unsupported = Platform.OS === 'web' || isLucidTrainer;
  const hasDream = loaded && dreams.length > 0;

  useEffect(() => {
    if (unsupported || !hasDream) {
      return;
    }
    let active = true;
    void (async () => {
      try {
        const [settings, dismissed] = await Promise.all([
          getNotificationSettings(),
          getReminderPromptDismissed(),
        ]);
        if (!active) return;
        const remindersOn = settings.weekdayEnabled || settings.weekendEnabled;
        setEligible(!remindersOn && !dismissed);
      } catch (error) {
        log.warn('Failed to resolve reminder opt-in eligibility', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [hasDream, unsupported]);

  const selectTime = useCallback((time: ReminderOptInPreset) => {
    setSelectedTime(time);
  }, []);

  const dismiss = useCallback(async () => {
    setEligible(false);
    void trackProductEvent('reminder_prompt_action', {
      surface,
      action: 'dismissed',
      time_bucket: getReminderTimeBucket(selectedTime),
    });
    try {
      await saveReminderPromptDismissed(true);
    } catch (error) {
      log.warn('Failed to persist reminder opt-in dismissal', error);
    }
  }, [selectedTime, surface]);

  const enable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        void trackProductEvent('reminder_prompt_action', {
          surface,
          action: 'denied',
          time_bucket: getReminderTimeBucket(selectedTime),
        });
        // Denied permission: keep the card out of the way; Settings shows the
        // permission warning and remains the recovery path.
        await saveReminderPromptDismissed(true).catch(() => undefined);
        if (mountedRef.current) setEligible(false);
        return;
      }
      const current = await getNotificationSettings();
      const next = buildOptInNotificationSettings(current, selectedTime);
      await saveNotificationSettings(next);
      await scheduleDailyNotification(next);
      await scheduleWeeklyRecapReminder(next);
      await saveReminderPromptDismissed(true).catch(() => undefined);
      void trackProductEvent('reminder_prompt_action', {
        surface,
        action: 'enabled',
        time_bucket: getReminderTimeBucket(selectedTime),
      });
      if (mountedRef.current) setEnabled(true);
    } catch (error) {
      log.warn('Failed to enable reminders from the opt-in card', error);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [busy, selectedTime, surface]);

  return {
    visible: eligible && !unsupported,
    presets: REMINDER_OPT_IN_PRESETS,
    selectedTime,
    selectTime,
    busy,
    enabled,
    enable,
    dismiss,
  };
}
