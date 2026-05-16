import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type GuideIconName = React.ComponentProps<typeof IconSymbol>['name'];

export function FirstUseGuideCard() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const steps: { icon: GuideIconName; title: string; body: string }[] = [
    {
      icon: 'mic',
      title: t('recording.first_use.step.value.title'),
      body: t('recording.first_use.step.value.body'),
    },
    {
      icon: 'keyboard',
      title: t('recording.first_use.step.privacy.title'),
      body: t('recording.first_use.step.privacy.body'),
    },
    {
      icon: 'book.closed.fill',
      title: t('recording.first_use.step.backup.title'),
      body: t('recording.first_use.step.backup.body'),
    },
  ];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: colors.timeline,
        },
      ]}
      testID={TID.Component.FirstUseGuideCard}
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>
          {t('recording.first_use.eyebrow')}
        </Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('recording.first_use.title')}
        </Text>
      </View>

      <View style={styles.steps}>
        {steps.map((step) => (
          <View key={step.title} style={styles.step}>
            <View style={[styles.stepIcon, { backgroundColor: colors.backgroundSecondary }]}>
              <IconSymbol name={step.icon} size={15} color={colors.accent} />
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                {step.title}
              </Text>
              <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                {step.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    padding: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.md,
  },
  header: {
    gap: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: Fonts.spaceGrotesk.bold,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  steps: {
    gap: ThemeLayout.spacing.sm,
  },
  step: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  stepBody: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
});
