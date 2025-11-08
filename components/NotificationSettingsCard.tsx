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
import { JournalTheme } from '@/constants/journalTheme';

export default function NotificationSettingsCard() {
  const [settings, setSettings] = useState<NotificationSettings>({
    isEnabled: false,
    weekdayTime: '07:00',
    weekendTime: '10:00',
  });
  const [hasPermissions, setHasPermissions] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
          'Permission Required',
          'Please enable notifications in your device settings to receive dream journal reminders.',
          [{ text: 'OK' }]
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
          'Reminder Set!',
          `You'll receive a daily reminder at ${newSettings.weekdayTime} to record your dreams.`,
          [{ text: 'OK' }]
        );
      } else {
        await cancelAllNotifications();
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update notification settings:', error);
      }
      Alert.alert('Error', 'Failed to update notification settings. Please try again.');
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
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Text style={styles.description}>Loading...</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Text style={styles.description}>Push notifications are not available on web.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Dream Reminders</Text>
      <Text style={styles.description}>
        Get a daily reminder to record your dreams when you wake up.
      </Text>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Enable Reminders</Text>
          <Text style={styles.settingHint}>
            {settings.isEnabled
              ? `Daily at ${settings.weekdayTime}`
              : 'Never miss recording your dreams'}
          </Text>
        </View>
        <Switch
          value={settings.isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: JournalTheme.backgroundSecondary, true: JournalTheme.accentLight }}
          thumbColor={settings.isEnabled ? JournalTheme.accent : '#f4f3f4'}
        />
      </View>

      {settings.isEnabled && (
        <>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Reminder Time</Text>
              <Text style={styles.settingHint}>When to send the notification</Text>
            </View>
            <Pressable onPress={() => setShowTimePicker(true)} style={styles.timeButton}>
              <Text style={styles.timeButtonText}>{settings.weekdayTime}</Text>
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
              style={styles.doneButton}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          )}
        </>
      )}

      {!hasPermissions && !settings.isEnabled && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Notification permissions not granted. Enable reminders to receive prompts.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: JournalTheme.backgroundCard,
    borderRadius: JournalTheme.borderRadius.md,
    padding: JournalTheme.spacing.md,
    marginBottom: JournalTheme.spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.textPrimary,
    marginBottom: JournalTheme.spacing.xs,
  },
  description: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
    marginBottom: JournalTheme.spacing.md,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: JournalTheme.spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: JournalTheme.textPrimary,
    marginBottom: 2,
  },
  settingHint: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: JournalTheme.divider,
    marginVertical: 12,
  },
  timeButton: {
    paddingHorizontal: JournalTheme.spacing.md,
    paddingVertical: JournalTheme.spacing.sm,
    backgroundColor: JournalTheme.backgroundSecondary,
    borderRadius: JournalTheme.borderRadius.sm,
  },
  timeButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: JournalTheme.accent,
  },
  doneButton: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: JournalTheme.accent,
    borderRadius: JournalTheme.borderRadius.sm,
    alignItems: 'center',
  },
  doneButtonText: {
    color: JournalTheme.backgroundCard,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  warningBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(254, 243, 199, 0.1)',
    borderRadius: JournalTheme.borderRadius.sm,
    borderWidth: 1,
    borderColor: JournalTheme.accent,
  },
  warningText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: JournalTheme.accentLight,
    lineHeight: 18,
  },
});
