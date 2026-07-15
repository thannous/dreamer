import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { useTranslation } from '@/hooks/useTranslation';
import type { NotificationSettings } from '@/lib/types';
import {
  cancelAllNotifications,
  hasNotificationPermissions,
  requestNotificationPermissions,
  scheduleDailyNotification,
  sendTestNotification,
} from '@/services/notificationService';
import { getNotificationSettings, saveNotificationSettings } from '@/services/storageService';

const DEFAULT_SETTINGS: NotificationSettings = {
  weekdayEnabled: false,
  weekdayTime: '07:00',
  weekendEnabled: false,
  weekendTime: '10:00',
};

export type NotificationTimeInput = Date | string | undefined;

export interface NotificationSettingsController {
  settings: NotificationSettings;
  hasPermissions: boolean;
  isLoading: boolean;
  unsupported: boolean;
  notificationsEnabled: boolean;
  toggleWeekday: (enabled: boolean) => Promise<void>;
  toggleWeekend: (enabled: boolean) => Promise<void>;
  setWeekdayTime: (time: NotificationTimeInput) => Promise<void>;
  setWeekendTime: (time: NotificationTimeInput) => Promise<void>;
  sendTest: () => Promise<void>;
  nextReminderText: string;
}

export function getDateFromTime(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTime(time: NotificationTimeInput): string | null {
  if (!time) {
    return null;
  }
  if (typeof time === 'string') {
    return time;
  }

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function findNextReminder(settings: NotificationSettings, now: Date): { date: Date; time: string } | null {
  if (!settings.weekdayEnabled && !settings.weekendEnabled) {
    return null;
  }

  for (let daysAhead = 0; daysAhead <= 7; daysAhead += 1) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + daysAhead);

    const day = candidate.getDay();
    const isWeekend = day === 0 || day === 6;
    if ((isWeekend && !settings.weekendEnabled) || (!isWeekend && !settings.weekdayEnabled)) {
      continue;
    }

    const time = isWeekend ? settings.weekendTime : settings.weekdayTime;
    const [hours, minutes] = time.split(':').map(Number);
    candidate.setHours(hours, minutes, 0, 0);

    if (candidate > now) {
      return { date: candidate, time };
    }
  }

  return null;
}

export function useNotificationSettingsController(): NotificationSettingsController {
  const unsupported = Platform.OS === 'web';
  const [settings, setSettings] = useState<NotificationSettings>({ ...DEFAULT_SETTINGS });
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  const refreshPermissions = useCallback(async () => {
    if (unsupported) {
      return;
    }

    try {
      setHasPermissions(await hasNotificationPermissions());
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to check notification permissions:', error);
      }
    }
  }, [unsupported]);

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const savedSettings = await getNotificationSettings();
        if (active) {
          setSettings(savedSettings);
          if (!unsupported) {
            await refreshPermissions();
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to load notification settings:', error);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();
    return () => {
      active = false;
    };
  }, [refreshPermissions, unsupported]);

  useEffect(() => {
    if (unsupported) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshPermissions();
      }
    });

    return () => subscription.remove();
  }, [refreshPermissions, unsupported]);

  const requestPermissionsIfNeeded = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (!enabled || hasPermissions) {
      return true;
    }

    const granted = await requestNotificationPermissions();
    if (!granted) {
      Alert.alert(
        t('notifications.alert.permission_required.title'),
        t('notifications.alert.permission_required.message'),
        [{ text: t('common.done') }]
      );
      return false;
    }

    setHasPermissions(true);
    return true;
  }, [hasPermissions, t]);

  const updateToggle = useCallback(async (
    key: 'weekdayEnabled' | 'weekendEnabled',
    enabled: boolean
  ) => {
    if (!unsupported && !(await requestPermissionsIfNeeded(enabled))) {
      return;
    }

    const previousSettings = settings;
    const newSettings = { ...settings, [key]: enabled };
    setSettings(newSettings);

    try {
      await saveNotificationSettings(newSettings);
      if (!unsupported) {
        if (newSettings.weekdayEnabled || newSettings.weekendEnabled) {
          await scheduleDailyNotification(newSettings);
        } else {
          await cancelAllNotifications();
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update notification settings:', error);
      }
      setSettings(previousSettings);
      Alert.alert(
        t('notifications.alert.update_failed.title'),
        t('notifications.alert.update_failed.message')
      );
    }
  }, [requestPermissionsIfNeeded, settings, t, unsupported]);

  const toggleWeekday = useCallback(
    (enabled: boolean) => updateToggle('weekdayEnabled', enabled),
    [updateToggle]
  );
  const toggleWeekend = useCallback(
    (enabled: boolean) => updateToggle('weekendEnabled', enabled),
    [updateToggle]
  );

  const updateTime = useCallback(async (
    key: 'weekdayTime' | 'weekendTime',
    value: NotificationTimeInput
  ) => {
    const time = formatTime(value);
    if (!time) {
      return;
    }

    const newSettings = { ...settings, [key]: time };
    setSettings(newSettings);

    try {
      await saveNotificationSettings(newSettings);
      if (!unsupported && (newSettings.weekdayEnabled || newSettings.weekendEnabled)) {
        await scheduleDailyNotification(newSettings);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update notification time:', error);
      }
    }
  }, [settings, unsupported]);

  const setWeekdayTime = useCallback(
    (time: NotificationTimeInput) => updateTime('weekdayTime', time),
    [updateTime]
  );
  const setWeekendTime = useCallback(
    (time: NotificationTimeInput) => updateTime('weekendTime', time),
    [updateTime]
  );

  const sendTest = useCallback(async () => {
    if (unsupported || !(await requestPermissionsIfNeeded(true))) {
      return;
    }

    try {
      await sendTestNotification();
      Alert.alert(
        t('notifications.alert.test_scheduled.title'),
        t('notifications.alert.test_scheduled.message'),
        [{ text: t('common.done') }]
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to send test notification:', error);
      }
      Alert.alert(
        t('notifications.alert.update_failed.title'),
        t('notifications.alert.update_failed.message')
      );
    }
  }, [requestPermissionsIfNeeded, t, unsupported]);

  const nextReminderText = useMemo(() => {
    const now = new Date();
    const next = findNextReminder(settings, now);
    if (!next) {
      return t('notifications.setting.enable_hint_inactive');
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (next.date.toDateString() === now.toDateString()) {
      return t('notifications.next_reminder_today', { time: next.time });
    }
    if (next.date.toDateString() === tomorrow.toDateString()) {
      return t('notifications.next_reminder_tomorrow', { time: next.time });
    }

    return t('notifications.next_reminder', {
      day: next.date.toLocaleDateString('default', { weekday: 'long' }),
      time: next.time,
    });
  }, [settings, t]);

  return {
    settings,
    hasPermissions,
    isLoading,
    unsupported,
    notificationsEnabled: settings.weekdayEnabled || settings.weekendEnabled,
    toggleWeekday,
    toggleWeekend,
    setWeekdayTime,
    setWeekendTime,
    sendTest,
    nextReminderText,
  };
}

export default useNotificationSettingsController;
