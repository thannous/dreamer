import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type GuideIconName = React.ComponentProps<typeof IconSymbol>['name'];

export function FirstUseGuideCard({
  onUseText,
  showUseTextAction,
}: {
  onUseText: () => void;
  showUseTextAction: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const steps: { icon: GuideIconName; title: string; body: string }[] = [
    {
      icon: 'sparkles',
      title: t('recording.first_use.step.value.title'),
      body: t('recording.first_use.step.value.body'),
    },
    {
      icon: 'mic',
      title: t('recording.first_use.step.privacy.title'),
      body: t('recording.first_use.step.privacy.body'),
    },
    {
      icon: 'lock.fill',
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

      {showUseTextAction ? (
        <Pressable
          style={[styles.textAction, { backgroundColor: colors.backgroundSecondary }]}
          onPress={onUseText}
          accessibilityRole="button"
          testID={TID.Button.FirstUseTypeInstead}
        >
          <IconSymbol name="keyboard" size={15} color={colors.textPrimary} />
          <Text style={[styles.textActionLabel, { color: colors.textPrimary }]}>
            {t('recording.first_use.type_instead')}
          </Text>
        </Pressable>
      ) : null}
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
  textAction: {
    minHeight: 40,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  textActionLabel: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
});
