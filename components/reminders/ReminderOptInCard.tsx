import React, { memo, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useReminderOptIn, type ReminderOptInSurface } from '@/hooks/useReminderOptIn';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

type Props = {
  surface: ReminderOptInSurface;
  style?: object;
};

/**
 * One-time "set your morning reminder" card offered right after the first dream.
 * Renders nothing when the user is not eligible (web, reminders already on,
 * card dismissed before, no dream yet).
 */
export const ReminderOptInCard = memo(function ReminderOptInCard({ surface, style }: Props) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const optIn = useReminderOptIn(surface);

  if (!optIn.visible) {
    return null;
  }

  const primaryBackground = mode === 'dark' ? noctalia.surface.active : noctalia.action.primary;
  const primaryForeground = mode === 'dark' ? noctalia.accent.base : noctalia.action.primaryText;

  return (
    <View
      accessibilityRole="summary"
      testID={TID.Component.ReminderOptInCard}
      style={[
        styles.card,
        {
          backgroundColor: noctalia.surface.soft,
          borderColor: noctalia.surface.borderStrong,
        },
        style,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: noctalia.surface.raised }]}>
          <IconSymbol name="bell" size={18} color={noctalia.accent.text} />
        </View>
        <Text style={[styles.title, { color: noctalia.text.primary }]}>
          {optIn.enabled ? t('reminders.opt_in.enabled_title') : t('reminders.opt_in.title')}
        </Text>
      </View>
      <Text style={[styles.body, { color: noctalia.text.secondary }]}>
        {optIn.enabled
          ? t('reminders.opt_in.enabled_body', { time: optIn.selectedTime })
          : t('reminders.opt_in.body')}
      </Text>
      {/* Accepting the card arms the morning reminder and the Sunday recap.
          Streak and inactivity stay off unless already enabled in Settings. */}
      <Text style={[styles.includes, { color: noctalia.text.tertiary }]}>
        {t('reminders.opt_in.includes')}
      </Text>

      {optIn.enabled ? null : (
        <>
          <View style={styles.presets} accessibilityRole="radiogroup">
            {optIn.presets.map((time) => {
              const selected = time === optIn.selectedTime;
              return (
                <Pressable
                  key={time}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={t('reminders.opt_in.time_a11y', { time })}
                  onPress={() => optIn.selectTime(time)}
                  testID={`btn.reminderOptIn.time.${time.replace(':', '')}`}
                  style={[
                    styles.preset,
                    {
                      borderColor: selected ? noctalia.accent.base : noctalia.surface.border,
                      backgroundColor: selected ? noctalia.surface.active : noctalia.surface.raised,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetLabel,
                      { color: selected ? noctalia.accent.text : noctalia.text.primary },
                    ]}
                  >
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={optIn.busy}
              onPress={() => void optIn.enable()}
              testID="btn.reminderOptIn.enable"
              style={({ pressed }) => [
                styles.primary,
                {
                  backgroundColor: primaryBackground,
                  borderColor: noctalia.action.primaryBorder,
                  opacity: optIn.busy ? 0.7 : 1,
                },
                pressed && styles.pressed,
              ]}
            >
              {optIn.busy ? (
                <ActivityIndicator size="small" color={primaryForeground} />
              ) : (
                <Text style={[styles.primaryLabel, { color: primaryForeground }]}>
                  {t('reminders.opt_in.cta', { time: optIn.selectedTime })}
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={optIn.busy}
              onPress={() => void optIn.dismiss()}
              testID="btn.reminderOptIn.dismiss"
              hitSlop={8}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Text style={[styles.linkLabel, { color: noctalia.text.tertiary }]}>
                {t('reminders.opt_in.dismiss')}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  includes: {
    fontSize: 12,
    lineHeight: 17,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  preset: {
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  primary: {
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
  },
  link: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
