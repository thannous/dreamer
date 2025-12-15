import DateTimePicker from '@react-native-community/datetimepicker';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
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

export interface NotificationSettingsCardHandle {
  scrollIntoView: () => void;
}

interface NotificationSettingsCardProps {
  scrollViewRef?: React.RefObject<ScrollView | null>;
}

function NotificationSettingsCardComponent(
  props: NotificationSettingsCardProps,
  ref: React.ForwardedRef<NotificationSettingsCardHandle>
) {
  const [settings, setSettings] = useState<NotificationSettings>({
    isEnabled: false,
    weekdayTime: '07:00',
    weekendTime: '10:00',
  });
  const [hasPermissions, setHasPermissions] = useState(false);
  const [showWeekdayPicker, setShowWeekdayPicker] = useState(false);
  const [showWeekendPicker, setShowWeekendPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const optionsContainerRef = useRef<View>(null);
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Expose scrollIntoView method to parent
  useImperativeHandle(ref, () => ({
    scrollIntoView: () => {
      if (optionsContainerRef.current && props.scrollViewRef?.current) {
        // Schedule scroll on next frame to ensure layout is complete
        setTimeout(() => {
          optionsContainerRef.current?.measure((x, y, width, height, pageX, pageY) => {
            // y = position relative to parent (ScrollView)
            // Scroll vers le bas pour montrer les options
            const scrollToY = y + height + 50;
            props.scrollViewRef?.current?.scrollTo({
              y: scrollToY,
              animated: true,
            });
            if (__DEV__) {
              console.log(`[NotificationSettingsCard] Scroll vers le bas: ${scrollToY}`);
            }
          });
        }, 100);
      }
    },
  }), [props]);

  // Auto-scroll vers le bas quand les notifications sont activées
  useEffect(() => {
    if (settings.isEnabled && optionsContainerRef.current && props.scrollViewRef?.current) {
      // Délai pour que React ait rendu le contenu
      setTimeout(() => {
        optionsContainerRef.current?.measure((x, y, width, height, pageX, pageY) => {
          // Scroll vers le bas pour montrer les options
          const scrollToY = y + height + 50;
          props.scrollViewRef?.current?.scrollTo({
            y: scrollToY,
            animated: true,
          });
        });
      }, 300);
    }
  }, [settings.isEnabled, props]);

  const refreshPermissions = useCallback(async () => {
    try {
      const permissions = await hasNotificationPermissions();
      setHasPermissions(permissions);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to check notification permissions:', error);
      }
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const savedSettings = await getNotificationSettings();
      setSettings(savedSettings);
      await refreshPermissions();
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to load notification settings:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshPermissions]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshPermissions]);

  const handleToggle = async (enabled: boolean) => {
    if (enabled && !hasPermissions) {
      // Request permissions first
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          t('notifications.alert.permission_required.title'),
          t('notifications.alert.permission_required.message'),
          [{ text: t('common.done') }]
        );
        return;
      }
      setHasPermissions(true);
    }

    const newSettings = { ...settings, isEnabled: enabled };
    setSettings(newSettings);

    try {
      await saveNotificationSettings(newSettings);
      if (enabled) {
        await scheduleDailyNotification(newSettings);
      } else {
        await cancelAllNotifications();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update notification settings:', error);
      }
      // Revert switch to false on error
      setSettings({ ...settings, isEnabled: false });
      Alert.alert(
        t('notifications.alert.update_failed.title'),
        t('notifications.alert.update_failed.message')
      );
    }
  };

  const handleWeekdayTimeChange = async (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowWeekdayPicker(false);
    }

    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const newTime = `${hours}:${minutes}`;

      const newSettings = { ...settings, weekdayTime: newTime };
      setSettings(newSettings);

      try {
        await saveNotificationSettings(newSettings);
        if (settings.isEnabled) {
          await scheduleDailyNotification(newSettings);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to update notification time:', error);
        }
      }
    }
  };

  const handleWeekendTimeChange = async (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowWeekendPicker(false);
    }

    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const newTime = `${hours}:${minutes}`;

      const newSettings = { ...settings, weekendTime: newTime };
      setSettings(newSettings);

      try {
        await saveNotificationSettings(newSettings);
        if (settings.isEnabled) {
          await scheduleDailyNotification(newSettings);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to update notification time:', error);
        }
      }
    }
  };

  const handleTestNotification = async () => {
    if (!hasPermissions) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          t('notifications.alert.permission_required.title'),
          t('notifications.alert.permission_required.message'),
          [{ text: t('common.done') }]
        );
        return;
      }
      setHasPermissions(true);
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
  };

  const getDateFromTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    return date;
  };

  const getNextReminderText = (): string => {
    const now = new Date();
    const todayDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = todayDay === 0 || todayDay === 6;
    const nextTime = isWeekend ? settings.weekendTime : settings.weekdayTime;

    const [hours, minutes] = nextTime.split(':').map(Number);
    const nextReminder = new Date();
    nextReminder.setHours(hours, minutes, 0);

    // If the reminder time has already passed today
    if (nextReminder <= now) {
      nextReminder.setDate(nextReminder.getDate() + 1);
      const nextDay = nextReminder.getDay();
      // Skip to Monday if it's Sunday
      if (nextDay === 0) {
        nextReminder.setDate(nextReminder.getDate() + 1);
      }
    }

    const nextDayName = nextReminder.toLocaleDateString('default', { weekday: 'long' });
    const isTomorrow = nextReminder.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    const isToday = nextReminder.toDateString() === now.toDateString();

    if (isToday) {
      return t('notifications.next_reminder_today', { time: nextTime });
    }
    if (isTomorrow) {
      return t('notifications.next_reminder_tomorrow', { time: nextTime });
    }
    return t('notifications.next_reminder', { day: nextDayName, time: nextTime });
  };

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('notifications.title')}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{t('notifications.loading')}</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('notifications.title')}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{t('notifications.unsupported')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('notifications.card.title')}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{t('notifications.card.description')}</Text>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('notifications.setting.enable')}</Text>
          <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
            {settings.isEnabled ? getNextReminderText() : t('notifications.setting.enable_hint_inactive')}
          </Text>
        </View>
        <Switch
          value={settings.isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.backgroundSecondary, true: colors.accentLight }}
          thumbColor={settings.isEnabled ? colors.accent : '#f4f3f4'}
        />
      </View>

      {settings.isEnabled && (
        <View ref={optionsContainerRef}>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Explanatory text */}
          <Text style={[styles.explanatoryText, { color: colors.textSecondary }]}>
            {t('notifications.setting.different_times')}
          </Text>

          {/* Weekday Time Picker */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                🌅 {t('notifications.setting.weekday')}
              </Text>
              <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                {t('notifications.setting.time_hint')}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowWeekdayPicker(true)}
              style={[
                styles.timeButton,
                { backgroundColor: colors.accent, borderColor: colors.accentDark },
              ]}
            >
              <Text style={[styles.timeButtonText, { color: colors.textOnAccentSurface }]}>
                {settings.weekdayTime}
              </Text>
            </Pressable>
          </View>

          {showWeekdayPicker && (
            <DateTimePicker
              value={getDateFromTime(settings.weekdayTime)}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleWeekdayTimeChange}
            />
          )}

          {Platform.OS === 'ios' && showWeekdayPicker && (
            <Pressable
              style={[styles.doneButton, { backgroundColor: colors.accent }]}
              onPress={() => setShowWeekdayPicker(false)}
            >
              <Text style={[styles.doneButtonText, { color: colors.backgroundCard }]}>{t('notifications.button.done')}</Text>
            </Pressable>
          )}

          {/* Weekend Time Picker */}
          <View style={[styles.settingRow, styles.marginTop12]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                🌙 {t('notifications.setting.weekend')}
              </Text>
              <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                {t('notifications.setting.time_hint')}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowWeekendPicker(true)}
              style={[
                styles.timeButton,
                { backgroundColor: colors.accent, borderColor: colors.accentDark },
              ]}
            >
              <Text style={[styles.timeButtonText, { color: colors.textOnAccentSurface }]}>
                {settings.weekendTime}
              </Text>
            </Pressable>
          </View>

          {showWeekendPicker && (
            <DateTimePicker
              value={getDateFromTime(settings.weekendTime)}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleWeekendTimeChange}
            />
          )}

          {Platform.OS === 'ios' && showWeekendPicker && (
            <Pressable
              style={[styles.doneButton, { backgroundColor: colors.accent }]}
              onPress={() => setShowWeekendPicker(false)}
            >
              <Text style={[styles.doneButtonText, { color: colors.backgroundCard }]}>{t('notifications.button.done')}</Text>
            </Pressable>
          )}

          <View style={styles.testButtonContainer}>
            <Pressable
              style={[
                styles.testButton,
                { backgroundColor: colors.accent, borderColor: colors.accentDark },
              ]}
              onPress={handleTestNotification}
            >
              <Text style={[styles.testButtonText, { color: colors.textOnAccentSurface }]}>
                {t('notifications.button.test')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {!hasPermissions && (
        <View style={[styles.warningBox, { backgroundColor: '#000000', borderColor: '#FF6B35', borderWidth: 2 }]}>
          <Text style={[styles.warningText, { color: '#FFFFFF', fontWeight: 'bold' }]}>{t('notifications.warning.permissions')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.md,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: ThemeLayout.spacing.xs,
  },
  description: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: ThemeLayout.spacing.md,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: ThemeLayout.spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    marginBottom: 2,
  },
  settingHint: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  timeButton: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: ThemeLayout.spacing.sm,
    borderRadius: ThemeLayout.borderRadius.sm,
    borderWidth: 1,
  },
  timeButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  doneButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: ThemeLayout.borderRadius.sm,
    alignItems: 'center',
  },
  doneButtonText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  testButtonContainer: {
    marginTop: ThemeLayout.spacing.sm,
  },
  testButton: {
    paddingVertical: ThemeLayout.spacing.sm,
    borderRadius: ThemeLayout.borderRadius.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  testButtonText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  warningBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: ThemeLayout.borderRadius.sm,
    borderWidth: 2,
    width: '100%',
  },
  warningText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 18,
  },
  explanatoryText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: ThemeLayout.spacing.md,
    lineHeight: 18,
  },
  marginTop12: {
    marginTop: 12,
  },
});

export default forwardRef<NotificationSettingsCardHandle, NotificationSettingsCardProps>(
  NotificationSettingsCardComponent
);
