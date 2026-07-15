import {
  BottomSheet as ExpoBottomSheet,
  RNHostView,
} from '@expo/ui';
import React, { useEffect, useState, type ReactElement } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens, type NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

import {
  getDateFromTime,
  useNotificationSettingsController,
} from './useNotificationSettingsController';
import {
  type SettingsPreferenceController,
  useSettingsPreferences,
} from './useSettingsPreferences';
type SettingsFieldGroupProps = {
  account: ReactElement;
  bottomPadding: number;
  onOpenSubscription: () => void;
  quota: ReactElement;
  returningGuestBlocked: boolean;
  subscriptionSubtitle: string;
  subscriptionTitle: string;
};

type PreferenceKind = 'theme' | 'language' | 'journal';

type PreferenceSheetProps<T extends string> = {
  controller: SettingsPreferenceController<T>;
  isPresented: boolean;
  kind: PreferenceKind;
  onDismiss: () => void;
  testID: string;
};

const PREFERENCE_HEADER_ICONS = {
  theme: 'sun.max.fill',
  language: 'globe',
  journal: 'book.closed.fill',
} as const;

function getPreferenceOptionIcon(kind: PreferenceKind, value: string) {
  if (kind === 'theme') {
    if (value === 'light') return 'sun.max.fill' as const;
    if (value === 'dark') return 'moon.stars.fill' as const;
    return 'iphone' as const;
  }
  if (kind === 'journal') {
    return value === 'compact'
      ? 'list.bullet.rectangle.fill' as const
      : 'book.closed.fill' as const;
  }
  return 'globe' as const;
}

function PreferenceSheet<T extends string>({
  controller,
  isPresented,
  kind,
  onDismiss,
  testID,
}: PreferenceSheetProps<T>) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);

  return (
    <BottomSheet
      visible={isPresented}
      onClose={onDismiss}
      style={styles.preferenceSheet}
      testID={`${testID}.sheet`}
    >
      <View style={[styles.sheetHandle, { backgroundColor: noctalia.surface.borderStrong }]} />
      <View style={styles.preferenceHeader}>
        <View
          style={[
            styles.preferenceHeaderIcon,
            {
              backgroundColor: noctalia.surface.soft,
              borderColor: noctalia.accent.soft,
            },
          ]}
        >
          <IconSymbol
            name={PREFERENCE_HEADER_ICONS[kind]}
            size={24}
            color={noctalia.accent.base}
          />
        </View>
        <View style={styles.preferenceHeaderCopy}>
          <Text style={[styles.preferenceTitle, { color: noctalia.text.primary }]}>
            {controller.title}
          </Text>
          <Text style={[styles.preferenceSubtitle, { color: noctalia.text.secondary }]}>
            {controller.description}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={t('common.cancel')}
          accessibilityRole="button"
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.sheetCloseButton,
            { backgroundColor: noctalia.surface.soft },
            pressed && styles.rowPressed,
          ]}
        >
          <IconSymbol name="xmark" size={20} color={noctalia.text.secondary} />
        </Pressable>
      </View>

      <View
        accessibilityLabel={controller.title}
        accessibilityRole="radiogroup"
        style={[
          styles.preferenceOptions,
          {
            backgroundColor: noctalia.surface.base,
            borderColor: noctalia.surface.borderStrong,
          },
        ]}
      >
          {controller.options.map((option, index) => {
            const selectOption = () => {
              if (controller.saving) return;
              void controller.select(option.value).then(onDismiss);
            };

            return (
              <Pressable
                accessibilityHint={option.description.replace(/\s+/g, ' ')}
                accessibilityLabel={option.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: option.current, disabled: controller.saving }}
                disabled={controller.saving}
                key={option.value}
                onPress={selectOption}
                style={({ pressed }) => [
                  styles.preferenceOption,
                  index < controller.options.length - 1 && {
                    borderBottomColor: noctalia.surface.border,
                    borderBottomWidth: 1,
                  },
                  option.current && { backgroundColor: noctalia.surface.active },
                  pressed && styles.rowPressed,
                ]}
                testID={option.testID ?? `${testID}.option.${option.value}`}
              >
                <View
                  style={[
                    styles.preferenceOptionIcon,
                    {
                      backgroundColor: option.current
                        ? noctalia.action.primary
                        : noctalia.surface.soft,
                    },
                  ]}
                >
                  <IconSymbol
                    name={getPreferenceOptionIcon(kind, option.value)}
                    size={20}
                    color={option.current
                      ? noctalia.action.primaryText
                      : noctalia.accent.base}
                  />
                </View>
                <View style={styles.preferenceOptionCopy}>
                  <Text
                    style={[
                      styles.preferenceOptionLabel,
                      option.current && styles.preferenceOptionLabelSelected,
                      { color: noctalia.text.primary },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={[styles.preferenceOptionDescription, { color: noctalia.text.secondary }]}>
                    {option.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioOutline,
                    { borderColor: option.current ? noctalia.accent.base : noctalia.text.tertiary },
                  ]}
                >
                  {option.current ? (
                    <View style={[styles.radioDot, { backgroundColor: noctalia.accent.base }]} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
      </View>
    </BottomSheet>
  );
}

type EditorialCardProps = {
  children: React.ReactNode;
  compact?: boolean;
  icon: 'book.closed.fill' | 'bell';
  noctalia: NoctaliaDesignTokens;
  title: string;
  testID: string;
};

function EditorialCard({ children, compact = false, icon, noctalia, title, testID }: EditorialCardProps) {
  return (
    <View
      style={[
        styles.editorialCard,
        {
          backgroundColor: noctalia.surface.raised,
          borderColor: noctalia.surface.borderStrong,
        },
      ]}
      testID={testID}
    >
      <View style={[styles.cardHeader, compact && styles.compactCardHeader]}>
        <Text style={[styles.cardTitle, { color: noctalia.text.primary }]}>{title}</Text>
        <IconSymbol name={icon} size={23} color={noctalia.accent.base} />
      </View>
      {children}
    </View>
  );
}

type PreferenceRowProps = {
  icon: 'sun.max.fill' | 'globe' | 'book.closed.fill' | 'arrow.clockwise';
  isLast?: boolean;
  label: string;
  noctalia: NoctaliaDesignTokens;
  onPress: () => void;
  testID: string;
  value: string;
  wideValue?: boolean;
};

function PreferenceRow({
  icon,
  isLast = false,
  label,
  noctalia,
  onPress,
  testID,
  value,
  wideValue = false,
}: PreferenceRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.editorialRow,
        !isLast && { borderBottomColor: noctalia.surface.border, borderBottomWidth: 1 },
        pressed && styles.rowPressed,
      ]}
      testID={testID}
    >
      <IconSymbol name={icon} size={21} color={noctalia.accent.base} />
      <Text style={[styles.rowLabel, { color: noctalia.text.primary }]}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[
          styles.rowValue,
          wideValue && styles.rowValueWide,
          { color: noctalia.text.secondary },
        ]}
      >
        {value}
      </Text>
      <IconSymbol name="chevron.right" size={20} color={noctalia.text.tertiary} />
    </Pressable>
  );
}

export function SettingsFieldGroup({
  account,
  bottomPadding,
  onOpenSubscription,
  quota,
  returningGuestBlocked,
  subscriptionSubtitle,
  subscriptionTitle,
}: SettingsFieldGroupProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const { theme, language, journalLayout, recording } = useSettingsPreferences();
  const notifications = useNotificationSettingsController();
  const [themeSheetVisible, setThemeSheetVisible] = useState(false);
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [journalLayoutSheetVisible, setJournalLayoutSheetVisible] = useState(false);
  const [weekdayPickerVisible, setWeekdayPickerVisible] = useState(false);

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      (!themeSheetVisible && !languageSheetVisible && !journalLayoutSheetVisible)
    ) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (journalLayoutSheetVisible) setJournalLayoutSheetVisible(false);
      else if (languageSheetVisible) setLanguageSheetVisible(false);
      else setThemeSheetVisible(false);
      return true;
    });

    return () => subscription.remove();
  }, [journalLayoutSheetVisible, languageSheetVisible, themeSheetVisible]);

  const reminderEnabled = notifications.notificationsEnabled;
  const reminderTime = notifications.settings.weekdayTime;

  const toggleReminder = () => {
    void notifications.toggleWeekday(!notifications.settings.weekdayEnabled);
  };

  return (
    <>
      <RNHostView
        style={{ height: '100%', width: '100%' }}
        testID="settings-editorial-host"
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(bottomPadding, 112) },
          ]}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          testID="settings-field-group"
        >
          <View
            style={[
              styles.accountCard,
              {
                backgroundColor: noctalia.surface.raised,
                borderColor: noctalia.surface.borderStrong,
              },
            ]}
            testID="settings-section-account"
          >
            {account}
          </View>

          <EditorialCard
            icon="book.closed.fill"
            noctalia={noctalia}
            title={t('settings.section.experience')}
            testID="settings-section-preferences"
          >
            {!returningGuestBlocked ? (
              <PreferenceRow
                icon="sun.max.fill"
                label={theme.title}
                noctalia={noctalia}
                onPress={() => setThemeSheetVisible(true)}
                testID="settings-theme-choice"
                value={theme.currentLabel}
              />
            ) : null}
            <PreferenceRow
              icon="globe"
              isLast={returningGuestBlocked}
              label={language.title}
              noctalia={noctalia}
              onPress={() => setLanguageSheetVisible(true)}
              testID="settings-language-choice"
              value={language.currentLabel}
            />
            {!returningGuestBlocked ? (
              <>
                <PreferenceRow
                  icon="book.closed.fill"
                  label={journalLayout.title}
                  noctalia={noctalia}
                  onPress={() => setJournalLayoutSheetVisible(true)}
                  testID="settings-journal-layout-choice"
                  value={journalLayout.currentLabel}
                />
                <PreferenceRow
                  icon="arrow.clockwise"
                  isLast
                  label={recording.title}
                  noctalia={noctalia}
                  onPress={() => void recording.restart()}
                  testID={recording.testID}
                  value={recording.actionLabel}
                  wideValue
                />
              </>
            ) : null}
          </EditorialCard>

          {!returningGuestBlocked ? (
            <>
              <EditorialCard
                compact
                icon="bell"
                noctalia={noctalia}
                title={t('settings.section.rituals')}
                testID="settings-section-notifications"
              >
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: reminderEnabled }}
                  onPress={toggleReminder}
                  style={[
                    styles.editorialRow,
                    styles.ritualRow,
                    { borderBottomColor: noctalia.surface.border, borderBottomWidth: 1 },
                  ]}
                  testID="settings-notifications-reminder-toggle"
                >
                  <IconSymbol name="bell" size={21} color={noctalia.accent.base} />
                  <Text style={[styles.rowLabel, { color: noctalia.text.primary }]}>
                    {t('settings.rituals.reminders')}
                  </Text>
                  <Switch
                    ios_backgroundColor={noctalia.surface.soft}
                    onValueChange={(enabled) => {
                      void notifications.toggleWeekday(enabled);
                    }}
                    thumbColor={noctalia.text.primary}
                    trackColor={{ false: noctalia.surface.soft, true: noctalia.accent.base }}
                    value={reminderEnabled}
                    style={styles.reminderSwitch}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setWeekdayPickerVisible(true)}
                  style={({ pressed }) => [
                    styles.editorialRow,
                    styles.ritualRow,
                    pressed && styles.rowPressed,
                  ]}
                  testID="settings-notifications-weekday-time"
                >
                  <IconSymbol name="clock" size={21} color={noctalia.accent.base} />
                  <Text style={[styles.rowLabel, { color: noctalia.text.primary }]}>
                    {t('settings.rituals.reminder_time')}
                  </Text>
                  <Text style={[styles.rowValue, { color: noctalia.text.secondary }]}>
                    {reminderTime}
                  </Text>
                  <IconSymbol name="chevron.right" size={20} color={noctalia.text.tertiary} />
                </Pressable>
              </EditorialCard>

              <Pressable
                accessibilityRole="button"
                onPress={onOpenSubscription}
                style={({ pressed }) => [
                  styles.plusCard,
                  {
                    backgroundColor: noctalia.surface.raised,
                    borderColor: noctalia.accent.base,
                  },
                  pressed && styles.rowPressed,
                ]}
                testID="settings-section-subscription"
              >
                <View style={[styles.plusIcon, { borderColor: noctalia.accent.base }]}>
                  <IconSymbol name="sparkles" size={28} color={noctalia.accent.base} />
                </View>
                <View style={styles.plusCopy}>
                  <Text style={[styles.plusTitle, { color: noctalia.text.primary }]}>
                    {subscriptionTitle}
                  </Text>
                  <Text style={[styles.plusSubtitle, { color: noctalia.text.secondary }]}>
                    {subscriptionSubtitle}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={26} color={noctalia.accent.base} />
              </Pressable>

              <View
                style={[
                  styles.quotaCard,
                  {
                    backgroundColor: noctalia.surface.raised,
                    borderColor: noctalia.surface.borderStrong,
                  },
                ]}
                testID="settings-section-quota"
              >
                {quota}
              </View>
            </>
          ) : null}
        </ScrollView>
      </RNHostView>

      <PreferenceSheet
        controller={theme}
        isPresented={themeSheetVisible}
        kind="theme"
        onDismiss={() => setThemeSheetVisible(false)}
        testID="settings-theme-choice"
      />
      <PreferenceSheet
        controller={language}
        isPresented={languageSheetVisible}
        kind="language"
        onDismiss={() => setLanguageSheetVisible(false)}
        testID="settings-language-choice"
      />
      <PreferenceSheet
        controller={journalLayout}
        isPresented={journalLayoutSheetVisible}
        kind="journal"
        onDismiss={() => setJournalLayoutSheetVisible(false)}
        testID="settings-journal-layout-choice"
      />

      {Platform.OS === 'ios' ? (
        <ExpoBottomSheet
          isPresented={weekdayPickerVisible}
          onDismiss={() => setWeekdayPickerVisible(false)}
          showDragIndicator={false}
          testID="settings-notifications-weekday-sheet"
        >
          <RNHostView matchContents>
            <View style={[styles.iosTimePicker, { backgroundColor: noctalia.surface.raised }]}>
              <DateTimePicker
                display="spinner"
                mode="time"
                onValueChange={(_event, date) => void notifications.setWeekdayTime(date)}
                testID="settings-notifications-weekday-picker"
                value={getDateFromTime(notifications.settings.weekdayTime)}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setWeekdayPickerVisible(false)}
                style={[styles.doneButton, { backgroundColor: noctalia.action.primary }]}
              >
                <Text style={[styles.doneButtonText, { color: noctalia.action.primaryText }]}>
                  {t('notifications.button.done')}
                </Text>
              </Pressable>
            </View>
          </RNHostView>
        </ExpoBottomSheet>
      ) : null}

      {Platform.OS === 'web' ? (
        <BottomSheet
          visible={weekdayPickerVisible}
          onClose={() => setWeekdayPickerVisible(false)}
          style={styles.timeSheet}
          testID="settings-notifications-weekday-sheet"
        >
          <View style={[styles.sheetHandle, { backgroundColor: noctalia.surface.borderStrong }]} />
          <View style={styles.timeSheetHeader}>
            <View
              style={[
                styles.preferenceHeaderIcon,
                {
                  backgroundColor: noctalia.surface.soft,
                  borderColor: noctalia.accent.soft,
                },
              ]}
            >
              <IconSymbol name="clock" size={24} color={noctalia.accent.base} />
            </View>
            <View style={styles.preferenceHeaderCopy}>
              <Text style={[styles.preferenceTitle, { color: noctalia.text.primary }]}>
                {t('settings.rituals.reminder_time')}
              </Text>
              <Text style={[styles.preferenceSubtitle, { color: noctalia.text.secondary }]}>
                {notifications.nextReminderText}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.webTimePickerFrame,
              {
                backgroundColor: noctalia.surface.base,
                borderColor: noctalia.surface.borderStrong,
              },
            ]}
          >
            <DateTimePicker
              mode="time"
              onValueChange={(_event, date) => void notifications.setWeekdayTime(date)}
              style={{
                ...styles.webTimePicker,
                color: noctalia.text.primary,
                colorScheme: mode,
              } as never}
              testID="settings-notifications-weekday-picker"
              value={getDateFromTime(notifications.settings.weekdayTime)}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setWeekdayPickerVisible(false)}
            style={({ pressed }) => [
              styles.doneButton,
              { backgroundColor: noctalia.action.primary },
              pressed && styles.rowPressed,
            ]}
          >
            <Text style={[styles.doneButtonText, { color: noctalia.action.primaryText }]}>
              {t('notifications.button.done')}
            </Text>
          </Pressable>
        </BottomSheet>
      ) : null}

      {Platform.OS === 'android' && weekdayPickerVisible ? (
        <RNHostView matchContents>
          <View style={styles.pickerHost}>
            <DateTimePicker
              display="default"
              is24Hour
              mode="time"
              onDismiss={() => setWeekdayPickerVisible(false)}
              onValueChange={(_event, date) => {
                void notifications.setWeekdayTime(date);
                setWeekdayPickerVisible(false);
              }}
              presentation="dialog"
              testID="settings-notifications-weekday-picker"
              value={getDateFromTime(notifications.settings.weekdayTime)}
            />
          </View>
        </RNHostView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 35,
  },
  accountCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 4,
    width: '100%',
  },
  preferenceSheet: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    borderRadius: 2,
    height: 4,
    marginBottom: 18,
    width: 38,
  },
  preferenceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  preferenceHeaderIcon: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  preferenceHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  preferenceTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 23,
    lineHeight: 28,
  },
  preferenceSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  sheetCloseButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  preferenceOptions: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  preferenceOption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  preferenceOptionIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  preferenceOptionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  preferenceOptionLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
    lineHeight: 19,
  },
  preferenceOptionLabelSelected: {
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  preferenceOptionDescription: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  radioOutline: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  editorialCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 16,
    width: '100%',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  compactCardHeader: {
    minHeight: 40,
  },
  cardTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 22,
    lineHeight: 28,
  },
  editorialRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    minHeight: 46,
    width: '100%',
  },
  ritualRow: {
    minHeight: 42,
  },
  rowPressed: {
    opacity: 0.82,
  },
  rowLabel: {
    flex: 1,
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 20,
    maxWidth: '36%',
    textAlign: 'right',
  },
  rowValueWide: {
    maxWidth: '48%',
  },
  plusCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  quotaCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    width: '100%',
  },
  plusIcon: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  plusCopy: {
    flex: 1,
    gap: 2,
  },
  plusTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 20,
    lineHeight: 25,
  },
  plusSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 17,
  },
  reminderSwitch: {
    transform: [{ scale: 1.15 }],
  },
  pickerHost: {
    width: 1,
  },
  timeSheet: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  timeSheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  webTimePickerFrame: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  webTimePicker: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 28,
    minHeight: 48,
    textAlign: 'center',
    width: '100%',
  },
  iosTimePicker: {
    padding: ThemeLayout.spacing.md,
    width: '100%',
  },
  doneButton: {
    alignItems: 'center',
    borderRadius: ThemeLayout.borderRadius.sm,
    marginTop: ThemeLayout.spacing.sm,
    paddingVertical: ThemeLayout.spacing.sm,
  },
  doneButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
});
