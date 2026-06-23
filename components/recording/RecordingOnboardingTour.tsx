import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { RecordingInputModePreference } from '@/lib/types';
import React, { useEffect, useMemo, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { RecordingSpotlightRect } from './RecordingOnboardingSpotlightOverlay';

export type RecordingOnboardingTarget = 'voice' | 'text';

const CAPTURE_BACKGROUND_IMAGE = require('@/assets/images/onboarding-capture-background.png');

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
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
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
        isPreference && styles.preferenceCard,
        {
          backgroundColor: isPreference ? noctalia.screen.background : noctalia.surface.raised,
          borderColor: isPreference ? 'transparent' : noctalia.surface.borderStrong,
        },
      ]}
      testID={TID.Component.RecordingOnboardingTour}
    >
      {isPreference ? (
        <>
          <View style={styles.preferenceHero}>
            <Image
              source={CAPTURE_BACKGROUND_IMAGE}
              resizeMode="cover"
              style={styles.preferenceHeroImage}
            />
            <View style={[styles.preferenceHeroShade, { backgroundColor: noctalia.atmosphere.horizon }]} />
            <View style={styles.preferenceTopBar}>
            <Text style={[styles.preferenceBrand, { color: noctalia.text.primary }]}>Noctalia</Text>
              <Pressable
                onPress={props.onSkip}
                style={styles.preferenceTopSkip}
                accessibilityRole="button"
                testID={TID.Button.RecordingOnboardingSkip}
              >
                <Text style={[styles.preferenceTopSkipText, { color: noctalia.accent.soft }]}>
                  {t('recording.onboarding.skip')}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.preferenceCopyBlock}>
            {t('recording.onboarding.preference.title') === 'Comment veux-tu raconter ?' ? (
              <Text style={[styles.preferenceHeroTitle, { color: noctalia.text.primary }]}>
                Comment veux-tu{'\n'}
                <Text style={[styles.preferenceHeroTitleAccent, { color: noctalia.accent.base }]}>raconter</Text>
                {' ?'}
              </Text>
            ) : (
              <Text style={[styles.preferenceHeroTitle, { color: noctalia.text.primary }]}>
                {t('recording.onboarding.preference.title')}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.preferencePanel,
              {
                backgroundColor: noctalia.surface.raised,
                borderColor: noctalia.surface.borderStrong,
              },
            ]}
          >
            {options.map((option) => {
              const isSelected = option.value === props.value;
              const isLast = option.value === options[options.length - 1].value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => props.onSelectPreference(option.value)}
                  style={[
                    styles.preferenceRow,
                    {
                      borderBottomColor: isLast ? 'transparent' : noctalia.surface.border,
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
                        backgroundColor: noctalia.surface.soft,
                        borderColor: noctalia.surface.border,
                      },
                    ]}
                  >
                    <IconSymbol
                      name={option.icon}
                      size={28}
                      color={noctalia.accent.base}
                    />
                  </View>
                  <View style={styles.preferenceCopy}>
                    <Text style={[styles.preferenceTitle, { color: noctalia.text.primary }]}>
                      {option.title}
                    </Text>
                    <Text style={[styles.preferenceDetail, { color: noctalia.text.secondary }]}>
                      {option.detail}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View style={[styles.preferenceCheck, { backgroundColor: noctalia.accent.base }]}>
                      <IconSymbol name="checkmark" size={14} color={noctalia.text.onAccent} />
                    </View>
                  ) : (
                    <View style={[styles.preferenceRadio, { borderColor: `${noctalia.text.secondary}8A` }]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => props.onSelectPreference(props.value)}
            style={[
              styles.preferenceContinue,
              {
                backgroundColor: noctalia.action.primary,
                shadowColor: noctalia.action.primary,
              },
            ]}
            accessibilityRole="button"
            testID={TID.Button.RecordingOnboardingNext}
          >
            <Text style={[styles.preferenceContinueText, { color: noctalia.action.primaryText }]}>
              {t('recording.onboarding.preference.cta')}
            </Text>
            <IconSymbol name="arrow.right" size={25} color={noctalia.action.primaryText} />
          </Pressable>
        </>
      ) : (
        <View style={styles.copy}>
          <View
            style={[
              styles.stepBadge,
              {
                backgroundColor: noctalia.surface.active,
                borderColor: noctalia.surface.border,
              },
            ]}
          >
            <Text style={[styles.stepText, { color: noctalia.text.primary }]}>
              {t('recording.onboarding.step_count', {
                current: props.index + 1,
                total: props.total,
              })}
            </Text>
          </View>
          <Text style={[styles.body, { color: noctalia.text.secondary }]}>
            {t(`recording.onboarding.${props.target}.body`)}
          </Text>
        </View>
      )}

      {!isPreference ? (
        <View style={styles.actions}>
          <Pressable
            onPress={props.onSkip}
            style={styles.skipButton}
            accessibilityRole="button"
            testID={TID.Button.RecordingOnboardingSkip}
          >
            <Text style={[styles.skipText, { color: noctalia.text.secondary }]}>
              {t('recording.onboarding.skip')}
            </Text>
          </Pressable>
          <Pressable
            onPress={props.onNext}
            style={[styles.nextButton, { backgroundColor: noctalia.surface.active }]}
            accessibilityRole="button"
            testID={TID.Button.RecordingOnboardingNext}
          >
            <Text style={[styles.nextText, { color: noctalia.text.primary }]}>
              {isLast ? t('recording.onboarding.done') : t('recording.onboarding.next')}
            </Text>
          </Pressable>
        </View>
      ) : null}
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
  preferenceCard: {
    marginHorizontal: -20,
    marginTop: -16,
    padding: 0,
    gap: 0,
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  preferenceHero: {
    height: 330,
    overflow: 'hidden',
  },
  preferenceHeroImage: {
    width: '100%',
    height: '100%',
  },
  preferenceHeroShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  preferenceTopBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 28,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  preferenceBrand: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 30,
    lineHeight: 36,
  },
  preferenceTopSkip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  preferenceTopSkipText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  preferenceCopyBlock: {
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  preferenceHeroTitle: {
    fontFamily: Fonts.fraunces.regular,
    fontSize: 40,
    lineHeight: 47,
  },
  preferenceHeroTitleAccent: {
  },
  preferencePanel: {
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
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
  preferenceRow: {
    minHeight: 104,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  preferenceIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceCopy: {
    flex: 1,
    gap: 8,
  },
  preferenceTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 22,
    lineHeight: 27,
  },
  preferenceDetail: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 16,
    lineHeight: 21,
  },
  preferenceCheck: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceRadio: {
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  preferenceContinue: {
    minHeight: 64,
    marginHorizontal: 20,
    marginTop: 26,
    marginBottom: 18,
    borderRadius: 22,
    borderCurve: 'continuous',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  preferenceContinueText: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 25,
    lineHeight: 31,
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
