import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import type { LanguagePreference } from '@/lib/types';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTranslation } from '@/hooks/useTranslation';
import {
  ensureOfflineSttModel,
} from '@/services/nativeSpeechRecognition';
import { updateLanguagePreference } from '@/lib/languagePreference';

const LANGUAGE_LABEL_KEYS: Record<Exclude<LanguagePreference, 'auto'>, string> = {
  en: 'settings.language.option.en.label',
  fr: 'settings.language.option.fr.label',
  es: 'settings.language.option.es.label',
};

export default function LanguageSettingsCard() {
  const { colors, mode } = useTheme();
  const { preference, setPreference, systemLanguage } = useLanguage();
  const { t } = useTranslation();
  const systemLanguageLabel = t(LANGUAGE_LABEL_KEYS[systemLanguage]);
  const autoLanguageHint = t('settings.language.option.auto.system_hint', {
    language: systemLanguageLabel,
  });

  const languageOptions = useMemo(
    () =>
      [
        {
          value: 'auto',
          label: t('settings.language.option.auto.label'),
          icon: 'phone-portrait-outline',
          description: `${t('settings.language.option.auto.description')}\n${autoLanguageHint}`,
        },
        {
          value: 'en' as LanguagePreference,
          label: t('settings.language.option.en.label'),
          icon: 'language-outline',
          description: t('settings.language.option.en.description'),
        },
        {
          value: 'fr' as LanguagePreference,
          label: t('settings.language.option.fr.label'),
          icon: 'language-outline',
          description: t('settings.language.option.fr.description'),
        },
        {
          value: 'es' as LanguagePreference,
          label: t('settings.language.option.es.label'),
          icon: 'language-outline',
          description: t('settings.language.option.es.description'),
        },
      ] as const,
    [t, autoLanguageHint]
  );

  const handleSelectLanguage = async (value: LanguagePreference) => {
    try {
      await updateLanguagePreference({
        preference: value,
        systemLanguage,
        setPreference,
        ensureOfflineModel: ensureOfflineSttModel,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update language preference:', error);
      }
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundCard }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
        {t('settings.language.title')}
      </Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('settings.language.description')}
      </Text>

      {languageOptions.map((option, index) => {
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
              onPress={() => handleSelectLanguage(option.value)}
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
                    {option.label}
                  </Text>
                  <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                    {option.description}
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
