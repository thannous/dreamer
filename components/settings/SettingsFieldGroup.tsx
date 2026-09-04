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
  Switch,
  Text,
  useWindowDimensions,
  View,
  type TextStyle,
} from 'react-native';

import { PressableScale } from '@/components/motion';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import {
  BottomSheet,
  getNativeBottomSheetContentWidth,
} from '@/components/ui/BottomSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens, type NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

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
  appVersionLabel?: string;
  bottomPadding: number;
  legal?: ReactElement;
  onOpenSubscription: () => void;
  quota: ReactElement;
  returningGuestBlocked: boolean;
  subscriptionSubtitle: string;
  subscriptionTitle: string;
};

/**
 * Values `className` cannot reach.
 *
 * `Switch` accepts no `className` (Uniwind types it as `never`); the web time input is a
 * DOM node, not a React Native view; and `fontVariant` has no utility.
 */
const REMINDER_SWITCH_STYLE = { transform: [{ scale: 1.15 }] } as const;
const TABULAR_NUMS_STYLE: TextStyle = { fontVariant: ['tabular-nums'] };
const WEB_TIME_PICKER_STYLE = {
  backgroundColor: 'transparent',
  borderWidth: 0,
  fontFamily: 'SpaceGrotesk_700Bold',
  fontSize: 28,
  minHeight: 48,
  textAlign: 'center',
  width: '100%',
} as const;

/** Settings rows are stacked edge to edge; hit slop would overlap the neighbouring row. */
const NO_HIT_SLOP = 0;

const ROW_CLASS = 'min-h-[46px] w-full flex-row items-center gap-4';
const RITUAL_ROW_CLASS = `${ROW_CLASS} min-h-[42px]`;
const ROW_LABEL_CLASS = 'flex-1 font-sans text-[15px] leading-[20px] text-ivory';
const ROW_VALUE_CLASS = 'max-w-[36%] shrink font-sans text-[15px] leading-[20px] text-right text-ivory-muted';
const CARD_CLASS = 'w-full rounded-[18px] border border-line-strong bg-ink-raised';
const SHEET_HANDLE_CLASS = 'mb-[18px] h-1 w-[38px] self-center rounded-[2px] bg-line-strong';
const SHEET_HEADER_CLASS = 'mb-[18px] flex-row items-center gap-3';
const SHEET_HEADER_ICON_CLASS =
  'h-11 w-11 items-center justify-center rounded-[22px] border border-champagne-soft bg-ink-soft';
const SHEET_TITLE_CLASS = 'font-display-semibold text-[23px] leading-[28px] text-ivory';
const SHEET_SUBTITLE_CLASS = 'font-sans text-[13px] leading-[18px] text-ivory-muted';
const SHEET_CONTENT_CLASS = 'px-gutter pt-2 pb-6';
const DONE_BUTTON_CLASS = 'mt-2 items-center rounded-sm bg-champagne py-2';
const DONE_BUTTON_LABEL_CLASS = 'font-sans-bold text-[16px] text-on-champagne';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

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
      className={SHEET_CONTENT_CLASS}
      testID={`${testID}.sheet`}
    >
      <View className={SHEET_HANDLE_CLASS} />
      <View className={SHEET_HEADER_CLASS}>
        <View className={SHEET_HEADER_ICON_CLASS}>
          <IconSymbol
            name={PREFERENCE_HEADER_ICONS[kind]}
            size={24}
            color={noctalia.accent.text}
          />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className={SHEET_TITLE_CLASS}>
            {controller.title}
          </Text>
          <Text className={SHEET_SUBTITLE_CLASS}>
            {controller.description}
          </Text>
        </View>
        <PressableScale
          accessibilityLabel={t('common.cancel')}
          accessibilityRole="button"
          onPress={onDismiss}
          className="h-9 w-9 items-center justify-center rounded-[18px] bg-ink-soft"
        >
          <IconSymbol name="xmark" size={20} color={noctalia.text.secondary} />
        </PressableScale>
      </View>

      <View
        accessibilityLabel={controller.title}
        accessibilityRole="radiogroup"
        className="overflow-hidden rounded-lg border border-line-strong bg-ink-card"
      >
          {controller.options.map((option, index) => {
            const selectOption = () => {
              if (controller.saving) return;
              void controller.select(option.value).then(onDismiss);
            };

            return (
              <PressableScale
                accessibilityHint={option.description.replace(/\s+/g, ' ')}
                accessibilityLabel={option.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: option.current, disabled: controller.saving }}
                disabled={controller.saving}
                key={option.value}
                onPress={selectOption}
                hitSlop={NO_HIT_SLOP}
                className={cx(
                  'min-h-[66px] flex-row items-center gap-3 px-3.5 py-2.5',
                  index < controller.options.length - 1 && 'border-b border-b-line',
                  option.current && 'bg-ink-active'
                )}
                testID={option.testID ?? `${testID}.option.${option.value}`}
              >
                <View
                  className={cx(
                    'h-9 w-9 items-center justify-center rounded-[18px]',
                    option.current ? 'bg-champagne' : 'bg-ink-soft'
                  )}
                >
                  <IconSymbol
                    name={getPreferenceOptionIcon(kind, option.value)}
                    size={20}
                    color={option.current
                      ? noctalia.action.primaryText
                      : noctalia.accent.text}
                  />
                </View>
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text
                    className={cx(
                      'text-[15px] leading-[19px] text-ivory',
                      option.current ? 'font-sans-bold' : 'font-sans-medium'
                    )}
                  >
                    {option.label}
                  </Text>
                  <Text className="font-sans text-caption text-ivory-muted">
                    {option.description}
                  </Text>
                </View>
                <View
                  className={cx(
                    'h-5 w-5 items-center justify-center rounded-[10px] border-[1.5px]',
                    option.current ? 'border-champagne' : 'border-ivory-faint'
                  )}
                >
                  {option.current ? (
                    <View className="h-2.5 w-2.5 rounded-[5px] bg-champagne" />
                  ) : null}
                </View>
              </PressableScale>
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
    <View className={`${CARD_CLASS} overflow-hidden px-4`} testID={testID}>
      <View
        className={cx(
          'flex-row items-center justify-between',
          compact ? 'min-h-10' : 'min-h-12'
        )}
      >
        <Text className="font-display-semibold text-h2 text-ivory">{title}</Text>
        <IconSymbol name={icon} size={23} color={noctalia.accent.text} />
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
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={NO_HIT_SLOP}
      className={cx(ROW_CLASS, !isLast && 'border-b border-b-line')}
      testID={testID}
    >
      <IconSymbol name={icon} size={21} color={noctalia.accent.text} />
      <Text className={ROW_LABEL_CLASS}>{label}</Text>
      <Text
        numberOfLines={1}
        className={cx(ROW_VALUE_CLASS, wideValue && 'max-w-[48%]')}
      >
        {value}
      </Text>
      <IconSymbol name="chevron.right" size={20} color={noctalia.text.tertiary} />
    </PressableScale>
  );
}

/**
 * Wrapper for the settings React Native content.
 *
 * On Android (Jetpack Compose) and web the content lives inside the @expo/ui
 * `Host` through `RNHostView`. On iOS the SwiftUI `RNHostView` only attaches
 * its touch handler to the hosted RN view during SwiftUI `onAppear`; when the
 * RN subtree mounts after that (the normal order for this screen) the whole
 * settings content renders but never receives touches. The content here is
 * plain React Native, so iOS renders it directly and skips the SwiftUI host.
 */
function SettingsContentHost({ children, testID }: { children: ReactElement; testID?: string }) {
  if (Platform.OS === 'ios') {
    return (
      <View className="w-full flex-1" testID={testID}>
        {children}
      </View>
    );
  }
  return (
    <RNHostView style={{ height: '100%', width: '100%' }} testID={testID}>
      {children}
    </RNHostView>
  );
}

export function SettingsFieldGroup({
  account,
  appVersionLabel,
  bottomPadding,
  legal,
  onOpenSubscription,
  quota,
  returningGuestBlocked,
  subscriptionSubtitle,
  subscriptionTitle,
}: SettingsFieldGroupProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const { width: viewportWidth } = useWindowDimensions();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const { theme, language } = useSettingsPreferences();
  const notifications = useNotificationSettingsController();
  const [themeSheetVisible, setThemeSheetVisible] = useState(false);
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [activeTimePicker, setActiveTimePicker] = useState<'weekday' | 'weekend' | null>(null);
  const weekdayPickerVisible = activeTimePicker !== null;
  const setWeekdayPickerVisible = (visible: boolean) => setActiveTimePicker(visible ? 'weekday' : null);

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      (!themeSheetVisible && !languageSheetVisible)
    ) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (languageSheetVisible) setLanguageSheetVisible(false);
      else setThemeSheetVisible(false);
      return true;
    });

    return () => subscription.remove();
  }, [languageSheetVisible, themeSheetVisible]);

  const reminderEnabled = notifications.notificationsEnabled;
  const reminderTime = notifications.settings.weekdayTime;
  const weekendEnabled = notifications.settings.weekendEnabled;
  const weekendTime = notifications.settings.weekendTime;
  const activePickerTime =
    activeTimePicker === 'weekend' ? notifications.settings.weekendTime : notifications.settings.weekdayTime;
  const setActivePickerTime = (date: Date | undefined) =>
    activeTimePicker === 'weekend'
      ? notifications.setWeekendTime(date)
      : notifications.setWeekdayTime(date);
  const activePickerTitle =
    activeTimePicker === 'weekend'
      ? t('settings.rituals.weekend_reminder_time')
      : t('settings.rituals.reminder_time');

  const toggleReminder = () => {
    void notifications.toggleWeekday(!notifications.settings.weekdayEnabled);
  };
  const toggleWeekendReminder = () => {
    void notifications.toggleWeekend(!notifications.settings.weekendEnabled);
  };
  const weeklyRecapEnabled = notifications.settings.weeklyRecapEnabled === true;
  const toggleWeeklyRecap = () => {
    void notifications.toggleWeeklyRecap(!weeklyRecapEnabled);
  };
  const streakRiskEnabled = notifications.settings.streakRiskEnabled === true;
  const toggleStreakRisk = () => {
    void notifications.toggleStreakRisk(!streakRiskEnabled);
  };
  const inactivityNudgeEnabled = notifications.settings.inactivityNudgeEnabled === true;
  const toggleInactivityNudge = () => {
    void notifications.toggleInactivityNudge(!inactivityNudgeEnabled);
  };

  return (
    <>
      <SettingsContentHost testID="settings-editorial-host">
        <ScrollView
          contentContainerClassName="gap-3.5 px-gutter pt-[35px]"
          contentContainerStyle={{ paddingBottom: Math.max(bottomPadding, 112) }}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          className="w-full flex-1"
          testID="settings-field-group"
        >
          <View
            className={`${CARD_CLASS} overflow-hidden px-4 py-1`}
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
              isLast
              label={language.title}
              noctalia={noctalia}
              onPress={() => setLanguageSheetVisible(true)}
              testID="settings-language-choice"
              value={language.currentLabel}
            />
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
                {!notifications.isLoading && !notifications.unsupported && !notifications.hasPermissions ? (
                  <View
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                    className="mb-2 flex-row items-center gap-2.5 rounded-md border border-warning-line bg-warning px-3 py-2.5"
                  >
                    <IconSymbol
                      name="exclamationmark.triangle.fill"
                      size={18}
                      color={noctalia.status.warning.icon}
                    />
                    <Text
                      className="flex-1 font-sans-medium text-[13px] leading-[18px] text-warning-on"
                      testID="text.settings.notificationsPermissionWarning"
                    >
                      {t('notifications.warning.permissions')}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: reminderEnabled }}
                  onPress={toggleReminder}
                  className={`${RITUAL_ROW_CLASS} border-b border-b-line`}
                  testID="settings-notifications-reminder-toggle"
                >
                  <IconSymbol name="bell" size={21} color={noctalia.accent.text} />
                  <Text className={ROW_LABEL_CLASS}>
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
                    style={REMINDER_SWITCH_STYLE}
                  />
                </Pressable>
                <PressableScale
                  accessibilityRole="button"
                  onPress={() => setActiveTimePicker('weekday')}
                  hitSlop={NO_HIT_SLOP}
                  className={`${RITUAL_ROW_CLASS} border-b border-b-line`}
                  testID="settings-notifications-weekday-time"
                >
                  <IconSymbol name="clock" size={21} color={noctalia.accent.text} />
                  <Text className={ROW_LABEL_CLASS}>
                    {t('settings.rituals.reminder_time')}
                  </Text>
                  <Text className={ROW_VALUE_CLASS}>
                    {reminderTime}
                  </Text>
                  <IconSymbol name="chevron.right" size={20} color={noctalia.text.tertiary} />
                </PressableScale>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: weekendEnabled }}
                  onPress={toggleWeekendReminder}
                  className={cx(RITUAL_ROW_CLASS, weekendEnabled && 'border-b border-b-line')}
                  testID="settings-notifications-weekend-toggle"
                >
                  <IconSymbol name="sun.max.fill" size={21} color={noctalia.accent.text} />
                  <Text className={ROW_LABEL_CLASS}>
                    {t('settings.rituals.weekend_reminders')}
                  </Text>
                  <Switch
                    ios_backgroundColor={noctalia.surface.soft}
                    onValueChange={(enabled) => {
                      void notifications.toggleWeekend(enabled);
                    }}
                    thumbColor={noctalia.text.primary}
                    trackColor={{ false: noctalia.surface.soft, true: noctalia.accent.base }}
                    value={weekendEnabled}
                    style={REMINDER_SWITCH_STYLE}
                  />
                </Pressable>
                {weekendEnabled ? (
                  <PressableScale
                    accessibilityRole="button"
                    onPress={() => setActiveTimePicker('weekend')}
                    hitSlop={NO_HIT_SLOP}
                    className={RITUAL_ROW_CLASS}
                    testID="settings-notifications-weekend-time"
                  >
                    <IconSymbol name="clock" size={21} color={noctalia.accent.text} />
                    <Text className={ROW_LABEL_CLASS}>
                      {t('settings.rituals.weekend_reminder_time')}
                    </Text>
                    <Text className={ROW_VALUE_CLASS}>
                      {weekendTime}
                    </Text>
                    <IconSymbol name="chevron.right" size={20} color={noctalia.text.tertiary} />
                  </PressableScale>
                ) : null}
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: weeklyRecapEnabled }}
                  onPress={toggleWeeklyRecap}
                  className={`${RITUAL_ROW_CLASS} border-t border-t-line`}
                  testID="settings-notifications-weekly-recap-toggle"
                >
                  <IconSymbol name="calendar" size={21} color={noctalia.accent.text} />
                  <View className="flex-1 gap-0.5">
                    <Text className={`${ROW_LABEL_CLASS} flex-[0]`}>
                      {t('settings.rituals.weekly_recap')}
                    </Text>
                    <Text className="text-caption text-ivory-faint" numberOfLines={2}>
                      {t('settings.rituals.weekly_recap_hint')}
                    </Text>
                  </View>
                  <Switch
                    ios_backgroundColor={noctalia.surface.soft}
                    onValueChange={(enabled) => {
                      void notifications.toggleWeeklyRecap(enabled);
                    }}
                    thumbColor={noctalia.text.primary}
                    trackColor={{ false: noctalia.surface.soft, true: noctalia.accent.base }}
                    value={weeklyRecapEnabled}
                    style={REMINDER_SWITCH_STYLE}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: streakRiskEnabled }}
                  onPress={toggleStreakRisk}
                  className={`${RITUAL_ROW_CLASS} border-t border-t-line`}
                  testID={TID.Button.SettingsStreakRiskToggle}
                >
                  <IconSymbol name="flame.fill" size={21} color={noctalia.accent.text} />
                  <View className="flex-1 gap-0.5">
                    <Text className={`${ROW_LABEL_CLASS} flex-[0]`}>
                      {t('settings.rituals.streak_risk')}
                    </Text>
                    <Text className="text-caption text-ivory-faint" numberOfLines={2}>
                      {t('settings.rituals.streak_risk_hint')}
                    </Text>
                  </View>
                  <Switch
                    ios_backgroundColor={noctalia.surface.soft}
                    onValueChange={(enabled) => {
                      void notifications.toggleStreakRisk(enabled);
                    }}
                    thumbColor={noctalia.text.primary}
                    trackColor={{ false: noctalia.surface.soft, true: noctalia.accent.base }}
                    value={streakRiskEnabled}
                    style={REMINDER_SWITCH_STYLE}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: inactivityNudgeEnabled }}
                  onPress={toggleInactivityNudge}
                  className={`${RITUAL_ROW_CLASS} border-t border-t-line`}
                  testID={TID.Button.SettingsInactivityNudgeToggle}
                >
                  <IconSymbol name="moon.stars.fill" size={21} color={noctalia.accent.text} />
                  <View className="flex-1 gap-0.5">
                    <Text className={`${ROW_LABEL_CLASS} flex-[0]`}>
                      {t('settings.rituals.inactivity_nudge')}
                    </Text>
                    <Text className="text-caption text-ivory-faint" numberOfLines={2}>
                      {t('settings.rituals.inactivity_nudge_hint')}
                    </Text>
                  </View>
                  <Switch
                    ios_backgroundColor={noctalia.surface.soft}
                    onValueChange={(enabled) => {
                      void notifications.toggleInactivityNudge(enabled);
                    }}
                    thumbColor={noctalia.text.primary}
                    trackColor={{ false: noctalia.surface.soft, true: noctalia.accent.base }}
                    value={inactivityNudgeEnabled}
                    style={REMINDER_SWITCH_STYLE}
                  />
                </Pressable>
                {!notifications.unsupported && reminderEnabled ? (
                  <View className="flex-col items-start gap-0.5 px-4 pt-2.5 pb-3">
                    <Text
                      className="text-[13px] leading-[18px] text-ivory-faint"
                      testID="text.settings.nextReminder"
                    >
                      {notifications.nextReminderText}
                    </Text>
                    <PressableScale
                      accessibilityRole="button"
                      onPress={() => void notifications.sendTest()}
                      className="px-0 py-1.5"
                      testID="settings-notifications-send-test"
                    >
                      <Text className="font-semibold text-[14px] text-champagne-on">
                        {t('notifications.button.test')}
                      </Text>
                    </PressableScale>
                  </View>
                ) : null}
              </EditorialCard>

              <PressableScale
                accessibilityRole="button"
                onPress={onOpenSubscription}
                hitSlop={NO_HIT_SLOP}
                className="min-h-16 w-full flex-row items-center gap-3.5 rounded-[18px] border border-champagne bg-ink-raised px-4 py-2.5"
                testID="settings-section-subscription"
              >
                <View className="h-11 w-11 items-center justify-center rounded-[22px] border border-champagne">
                  <IconSymbol name="sparkles" size={28} color={noctalia.accent.text} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="font-display-semibold text-[20px] leading-[25px] text-ivory">
                    {subscriptionTitle}
                  </Text>
                  <Text className="font-sans text-[13px] leading-[17px] text-ivory-muted">
                    {subscriptionSubtitle}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={26} color={noctalia.accent.text} />
              </PressableScale>

              <View
                className={`${CARD_CLASS} p-4`}
                testID="settings-section-quota"
              >
                {quota}
              </View>
            </>
          ) : null}

          {legal}

          {appVersionLabel ? (
            <View className="items-center px-4 py-2.5" testID="settings-app-version">
              <Text
                selectable
                className="text-center font-sans text-caption tracking-[0.2px] text-ivory-faint"
                style={TABULAR_NUMS_STYLE}
              >
                {appVersionLabel}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SettingsContentHost>

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

      {Platform.OS === 'ios' ? (
        <ExpoBottomSheet
          isPresented={weekdayPickerVisible}
          onDismiss={() => setWeekdayPickerVisible(false)}
          showDragIndicator={false}
          testID="settings-notifications-weekday-sheet"
        >
          <RNHostView matchContents>
            <View
              className="w-full bg-ink-raised p-4"
              style={{ width: getNativeBottomSheetContentWidth(viewportWidth, 'ios') }}
            >
              <DateTimePicker
                display="spinner"
                mode="time"
                onValueChange={(_event, date) => void setActivePickerTime(date)}
                testID="settings-notifications-weekday-picker"
                themeVariant={mode}
                value={getDateFromTime(activePickerTime)}
              />
              <PressableScale
                accessibilityRole="button"
                onPress={() => setWeekdayPickerVisible(false)}
                className={DONE_BUTTON_CLASS}
              >
                <Text className={DONE_BUTTON_LABEL_CLASS}>
                  {t('notifications.button.done')}
                </Text>
              </PressableScale>
            </View>
          </RNHostView>
        </ExpoBottomSheet>
      ) : null}

      {Platform.OS === 'web' ? (
        <BottomSheet
          visible={weekdayPickerVisible}
          onClose={() => setWeekdayPickerVisible(false)}
          className={SHEET_CONTENT_CLASS}
          testID="settings-notifications-weekday-sheet"
        >
          <View className={SHEET_HANDLE_CLASS} />
          <View className={SHEET_HEADER_CLASS}>
            <View className={SHEET_HEADER_ICON_CLASS}>
              <IconSymbol name="clock" size={24} color={noctalia.accent.text} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className={SHEET_TITLE_CLASS}>
                {activePickerTitle}
              </Text>
              <Text className={SHEET_SUBTITLE_CLASS}>
                {notifications.nextReminderText}
              </Text>
            </View>
          </View>
          <View className="mb-4 items-center rounded-lg border border-line-strong bg-ink-card p-4">
            <DateTimePicker
              mode="time"
              onValueChange={(_event, date) => void setActivePickerTime(date)}
              style={{
                ...WEB_TIME_PICKER_STYLE,
                color: noctalia.text.primary,
                colorScheme: mode,
              } as never}
              testID="settings-notifications-weekday-picker"
              value={getDateFromTime(activePickerTime)}
            />
          </View>
          <PressableScale
            accessibilityRole="button"
            onPress={() => setWeekdayPickerVisible(false)}
            className={DONE_BUTTON_CLASS}
          >
            <Text className={DONE_BUTTON_LABEL_CLASS}>
              {t('notifications.button.done')}
            </Text>
          </PressableScale>
        </BottomSheet>
      ) : null}

      {Platform.OS === 'android' && weekdayPickerVisible ? (
        <RNHostView matchContents>
          <View className="w-px">
            <DateTimePicker
              display="default"
              is24Hour
              mode="time"
              onDismiss={() => setWeekdayPickerVisible(false)}
              onValueChange={(_event, date) => {
                void setActivePickerTime(date);
                setWeekdayPickerVisible(false);
              }}
              presentation="dialog"
              testID="settings-notifications-weekday-picker"
              value={getDateFromTime(activePickerTime)}
            />
          </View>
        </RNHostView>
      ) : null}
    </>
  );
}
