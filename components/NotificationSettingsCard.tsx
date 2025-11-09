import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import type { NotificationSettings } from '@/lib/types';
import {
  requestNotificationPermissions,
  scheduleDailyNotification,
  cancelAllNotifications,
  hasNotificationPermissions,
} from '@/services/notificationService';
import { getNotificationSettings, saveNotificationSettings } from '@/services/storageService';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

export default function NotificationSettingsCard() {
  const [settings, setSettings] = useState<NotificationSettings>({
    isEnabled: false,
    weekdayTime: '07:00',
    weekendTime: '10:00',
  });
  const [hasPermissions, setHasPermissions] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { colors } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await getNotificationSettings();
      setSettings(savedSettings);
      const permissions = await hasNotificationPermissions();
      setHasPermissions(permissions);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to load notification settings:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
        Alert.alert(
          t('notifications.alert.reminder_set.title'),
          t('notifications.alert.reminder_set.message', { time: newSettings.weekdayTime }),
          [{ text: t('common.done') }]
        );
      } else {
        await cancelAllNotifications();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update notification settings:', error);
      }
      Alert.alert(
        t('notifications.alert.update_failed.title'),
        t('notifications.alert.update_failed.message')
      );
    }
  };

  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
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

  const getDateFromTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    return date;
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
            {settings.isEnabled
              ? t('notifications.setting.enable_hint_active', { time: settings.weekdayTime })
              : t('notifications.setting.enable_hint_inactive')}
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
        <>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('notifications.setting.time')}</Text>
              <Text style={[styles.settingHint, { color: colors.textSecondary }]}>{t('notifications.setting.time_hint')}</Text>
            </View>
            <Pressable onPress={() => setShowTimePicker(true)} style={[styles.timeButton, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.timeButtonText, { color: colors.accent }]}>{settings.weekdayTime}</Text>
            </Pressable>
          </View>

          {showTimePicker && (
            <DateTimePicker
              value={getDateFromTime(settings.weekdayTime)}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
            />
          )}

          {Platform.OS === 'ios' && showTimePicker && (
            <Pressable
              style={[styles.doneButton, { backgroundColor: colors.accent }]}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={[styles.doneButtonText, { color: colors.backgroundCard }]}>{t('notifications.button.done')}</Text>
            </Pressable>
          )}
        </>
      )}

      {!hasPermissions && !settings.isEnabled && (
        <View style={[styles.warningBox, { borderColor: colors.accent }]}>
          <Text style={[styles.warningText, { color: colors.accentLight }]}>{t('notifications.warning.permissions')}</Text>
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
  warningBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(254, 243, 199, 0.1)',
    borderRadius: ThemeLayout.borderRadius.sm,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 18,
  },
});
