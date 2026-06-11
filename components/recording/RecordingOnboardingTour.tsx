import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { RecordingInputModePreference } from '@/lib/types';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { RecordingSpotlightRect } from './RecordingOnboardingSpotlightOverlay';

export type RecordingOnboardingTarget = 'voice' | 'text';

type RecordingOnboardingPreferenceProps = {
  variant: 'preference';
  value: RecordingInputModePreference;
  onSelectPreference: (value: RecordingInputModePreference) => void | Promise<void>;
  onSkip: () => void;
  onSpotlightLayout?: (rect: RecordingSpotlightRect) => void;
  spotlightMeasureKey?: number;
};

type RecordingOnboardingStepProps = {
  variant: 'step';
  target: RecordingOnboardingTarget;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  onSpotlightLayout?: (rect: RecordingSpotlightRect) => void;
  spotlightMeasureKey?: number;
};

type RecordingOnboardingTourProps =
  | RecordingOnboardingPreferenceProps
  | RecordingOnboardingStepProps;

export function RecordingOnboardingTour(props: RecordingOnboardingTourProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const cardRef = useRef<View | null>(null);
  const isPreference = props.variant === 'preference';
  const isLast = props.variant === 'step' && props.index >= props.total - 1;
  const options: {
    value: RecordingInputModePreference;
    title: string;
    detail: string;
    icon: React.ComponentProps<typeof IconSymbol>['name'];
    testID: string;
  }[] = [
    {
      value: 'text',
      title: t('recording.preference.text'),
      detail: t('recording.onboarding.preference.text_detail'),
      icon: 'pencil',
      testID: TID.Button.RecordingOnboardingChooseText,
    },
    {
      value: 'voice',
      title: t('recording.preference.voice'),
      detail: t('recording.onboarding.preference.voice_detail'),
      icon: 'mic',
      testID: TID.Button.RecordingOnboardingChooseVoice,
    },
  ];

  useEffect(() => {
    if (!props.onSpotlightLayout) {
      return;
    }

    const measureCard = () => {
      cardRef.current?.measureInWindow((x, y, width, height) => {
        props.onSpotlightLayout?.({ x, y, width, height });
      });
    };

    const frame = requestAnimationFrame(measureCard);
    const timeout = setTimeout(measureCard, 220);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [props]);

  return (
    <View
      ref={cardRef}
      collapsable={false}
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: `${colors.accentLight}55`,
        },
      ]}
      testID={TID.Component.RecordingOnboardingTour}
    >
      {isPreference ? (
        <>
          <View style={styles.copy}>
            <View
              style={[
                styles.stepBadge,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.divider,
                },
              ]}
            >
              <Text style={[styles.stepText, { color: colors.textPrimary }]}>
                {t('recording.onboarding.preference.badge')}
              </Text>
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('recording.onboarding.preference.title')}
            </Text>
          </View>

          <View style={styles.preferenceGrid}>
            {options.map((option) => {
              const isSelected = option.value === props.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => props.onSelectPreference(option.value)}
                  style={[
                    styles.preferenceButton,
                    {
                      backgroundColor: isSelected
                        ? `${colors.accentLight}22`
                        : colors.backgroundSecondary,
                      borderColor: isSelected ? colors.accentLight : colors.divider,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  testID={option.testID}
                >
                  <View
                    style={[
                      styles.preferenceIcon,
                      {
                        backgroundColor: isSelected ? colors.backgroundSecondary : `${colors.accentLight}18`,
                      },
                    ]}
                  >
                    <IconSymbol
                      name={option.icon}
                      size={18}
                      color={isSelected ? colors.textPrimary : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.preferenceCopy}>
                    <Text style={[styles.preferenceTitle, { color: colors.textPrimary }]}>
                      {option.title}
                    </Text>
                    <Text style={[styles.preferenceDetail, { color: colors.textSecondary }]}>
                      {option.detail}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.settingsHint, { color: colors.textSecondary }]}>
            {t('recording.onboarding.preference.settings_hint')}
          </Text>
        </>
      ) : (
        <View style={styles.copy}>
          <View
            style={[
              styles.stepBadge,
              {
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.divider,
              },
            ]}
          >
            <Text style={[styles.stepText, { color: colors.textPrimary }]}>
              {t('recording.onboarding.step_count', {
                current: props.index + 1,
                total: props.total,
              })}
            </Text>
          </View>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {t(`recording.onboarding.${props.target}.body`)}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={props.onSkip}
          style={styles.skipButton}
          accessibilityRole="button"
          testID={TID.Button.RecordingOnboardingSkip}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            {t('recording.onboarding.skip')}
          </Text>
        </Pressable>
        {!isPreference ? (
          <Pressable
            onPress={props.onNext}
            style={[styles.nextButton, { backgroundColor: colors.backgroundSecondary }]}
            accessibilityRole="button"
            testID={TID.Button.RecordingOnboardingNext}
          >
            <Text style={[styles.nextText, { color: colors.textPrimary }]}>
              {isLast ? t('recording.onboarding.done') : t('recording.onboarding.next')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.md,
  },
  copy: {
    alignItems: 'flex-start',
    gap: 8,
  },
  stepBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  stepText: {
    fontSize: 11,
    fontFamily: Fonts.spaceGrotesk.bold,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  title: {
    fontSize: 19,
    lineHeight: 25,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  preferenceGrid: {
    gap: 10,
  },
  preferenceButton: {
    minHeight: 78,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceIcon: {
    width: 38,
    height: 38,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceCopy: {
    flex: 1,
    gap: 3,
  },
  preferenceTitle: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  preferenceDetail: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  settingsHint: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  skipButton: {
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  nextButton: {
    minHeight: 38,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
