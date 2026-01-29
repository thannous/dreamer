import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import type { ThemePreference } from '@/lib/types';
import { ThemeLayout } from '@/constants/journalTheme';
import { getGlassCardBackground, GLASS_CARD_BORDER_WIDTH } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';

const THEME_OPTIONS: {
  value: ThemePreference;
  icon: string;
  labelKey: string;
  descriptionKey: string;
}[] = [
  {
    value: 'auto',
    icon: 'phone-portrait-outline',
    labelKey: 'settings.theme.option.auto.label',
    descriptionKey: 'settings.theme.option.auto.description',
  },
  {
    value: 'light',
    icon: 'sunny-outline',
    labelKey: 'settings.theme.option.light.label',
    descriptionKey: 'settings.theme.option.light.description',
  },
  {
    value: 'dark',
    icon: 'moon-outline',
    labelKey: 'settings.theme.option.dark.label',
    descriptionKey: 'settings.theme.option.dark.description',
  },
];

export default function ThemeSettingsCard() {
  const { colors, preference, setPreference, systemMode, mode } = useTheme();
  const { t } = useTranslation();

  const handleSelectTheme = async (value: ThemePreference) => {
    try {
      await setPreference(value);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update theme preference:', error);
      }
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: getGlassCardBackground(colors.backgroundCard, mode), borderColor: colors.divider, borderWidth: GLASS_CARD_BORDER_WIDTH }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('settings.theme.title')}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('settings.theme.description')}
      </Text>

      {THEME_OPTIONS.map((option, index) => {
        const isSelected = preference === option.value;

        const iconColor = isSelected
          ? colors.textOnAccentSurface
          : mode === 'dark'
            ? colors.textOnAccentSurface
            : colors.accent;

        return (
          <View key={option.value}>
            {index > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            <Pressable
              style={({ pressed }) => [
                styles.optionButton,
                { backgroundColor: isSelected ? colors.backgroundSecondary : 'transparent' },
                pressed && styles.optionPressed,
              ]}
              onPress={() => handleSelectTheme(option.value)}
            >
              <View style={styles.optionLeft}>
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.backgroundSecondary,
                    },
                  ]}
                >
                  <Ionicons name={option.icon as any} size={20} color={iconColor} />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                    {t(option.labelKey)}
                  </Text>
                  <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                    {option.value === 'auto'
                      ? `${t(option.descriptionKey)}\n${t('settings.theme.option.auto.system_hint', {
                          theme: t(`settings.theme.option.${systemMode}.label`),
                        })}`
                      : t(option.descriptionKey)}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.radio,
                  {
                    borderColor: isSelected ? colors.accent : colors.textTertiary,
                  },
                ]}
              >
                {isSelected && (
                  <View
                    style={[
                      styles.radioInner,
                      {
                        backgroundColor: colors.accent,
                      },
                    ]}
                  />
                )}
              </View>
            </Pressable>
          </View>
        );
      })}
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
  divider: {
    height: 1,
    marginVertical: ThemeLayout.spacing.xs,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.sm,
    borderRadius: ThemeLayout.borderRadius.sm,
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: ThemeLayout.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ThemeLayout.spacing.sm,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
