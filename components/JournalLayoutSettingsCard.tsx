import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts, GlassCardTokens } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useJournalLayoutPreference } from '@/hooks/useJournalLayoutPreference';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { JournalLayoutPreference } from '@/lib/types';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

const JOURNAL_LAYOUT_OPTIONS: {
  value: JournalLayoutPreference;
  icon: IconName;
  testID: string;
  labelKey: string;
  descriptionKey: string;
}[] = [
  {
    value: 'cards',
    icon: 'rectangle.stack.fill',
    testID: TID.Button.JournalLayoutCards,
    labelKey: 'settings.journal_layout.option.cards.label',
    descriptionKey: 'settings.journal_layout.option.cards.description',
  },
  {
    value: 'compact',
    icon: 'list.bullet.rectangle.fill',
    testID: TID.Button.JournalLayoutCompact,
    labelKey: 'settings.journal_layout.option.compact.label',
    descriptionKey: 'settings.journal_layout.option.compact.description',
  },
];

export default function JournalLayoutSettingsCard() {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const { preference, setPreference } = useJournalLayoutPreference();

  const handleSelectLayout = async (value: JournalLayoutPreference) => {
    try {
      await setPreference(value);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to update journal layout preference:', error);
      }
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: GlassCardTokens.getBackground(colors.backgroundCard, mode),
          borderColor: colors.divider,
          borderWidth: GlassCardTokens.borderWidth,
        },
      ]}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('settings.journal_layout.title')}
    >
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
        {t('settings.journal_layout.title')}
      </Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('settings.journal_layout.description')}
      </Text>

      {JOURNAL_LAYOUT_OPTIONS.map((option, index) => {
        const isSelected = preference === option.value;
        const optionLabel = t(option.labelKey);
        const optionDescription = t(option.descriptionKey);
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
              onPress={() => handleSelectLayout(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={optionLabel}
              accessibilityHint={optionDescription}
              accessibilityState={{ checked: isSelected }}
              testID={option.testID}
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
                  <IconSymbol name={option.icon} size={20} color={iconColor} />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                    {optionLabel}
                  </Text>
                  <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                    {optionDescription}
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
    borderRadius: ThemeLayout.borderRadius.xl,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    marginBottom: ThemeLayout.spacing.xs,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
    fontFamily: Fonts.spaceGrotesk.medium,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 18,
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
