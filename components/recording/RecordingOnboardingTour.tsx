import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RecordingSpotlightRect } from '@/components/recording/RecordingOnboardingSpotlightOverlay';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { RecordingInputModePreference } from '@/lib/types';

export type RecordingOnboardingTarget = 'voice' | 'text';

type RecordingOnboardingTourProps = {
  bottomOffset: number;
  measureKey?: number;
  step: 0 | 1 | 2;
  inputMode: RecordingInputModePreference;
  onLayoutMeasured?: (rect: RecordingSpotlightRect) => void;
  onDone: () => void;
  onDismiss: () => void;
};

export function RecordingOnboardingTour({
  bottomOffset,
  measureKey = 0,
  step,
  inputMode,
  onLayoutMeasured,
  onDone,
  onDismiss,
}: RecordingOnboardingTourProps) {
  const { colors, mode, shadows } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const cardRef = useRef<View | null>(null);
  const isLast = step === 2;
  const icon = step < 2 ? 'slider.horizontal.3' : inputMode === 'voice' ? 'mic' : 'pencil';
  const bodyKey = step === 0
    ? 'recording.guide.step_mode'
    : step === 1
      ? 'recording.guide.step_modes'
      : inputMode === 'voice'
        ? 'recording.guide.step_control_voice'
        : 'recording.guide.step_control_text';

  useEffect(() => {
    if (!onLayoutMeasured) {
      return;
    }

    const measureCard = () => {
      cardRef.current?.measureInWindow((x, y, width, height) => {
        onLayoutMeasured({ x, y, width, height });
      });
    };

    const frame = requestAnimationFrame(measureCard);
    const timeout = setTimeout(measureCard, 220);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [bottomOffset, inputMode, measureKey, onLayoutMeasured, step]);

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View
        ref={cardRef}
        collapsable={false}
        accessibilityLiveRegion="polite"
        style={[
          styles.card,
          {
            bottom: bottomOffset + 16,
            backgroundColor: noctalia.surface.raised,
            borderColor: noctalia.surface.borderStrong,
          },
          shadows.xl,
        ]}
        testID={TID.Component.RecordingOnboardingTour}
      >
        <View style={styles.header}>
          <View style={[styles.icon, { backgroundColor: `${noctalia.accent.base}24` }]}>
            <IconSymbol name={icon} size={23} color={noctalia.accent.base} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.progress, { color: noctalia.accent.soft }]}>
              {t('recording.onboarding.step_count', { current: step + 1, total: 3 })}
            </Text>
            <Text style={[styles.body, { color: noctalia.text.primary }]}>
              {t(bodyKey)}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.dismissButton, { opacity: pressed ? 0.68 : 1 }]}
            accessibilityRole="button"
            testID={TID.Button.RecordingOnboardingSkip}
          >
            <Text style={[styles.dismissText, { color: noctalia.text.secondary }]}>
              {t('recording.guide.dismiss')}
            </Text>
          </Pressable>
          {isLast ? (
            <Pressable
              onPress={onDone}
              style={({ pressed }) => [
                styles.doneButton,
                {
                  backgroundColor: noctalia.action.primary,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
              accessibilityRole="button"
              testID={TID.Button.RecordingOnboardingNext}
            >
              <Text style={[styles.doneText, { color: noctalia.action.primaryText }]}>
                {t('recording.guide.done')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
  },
  card: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderWidth: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  progress: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 11,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dismissButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
  doneButton: {
    minWidth: 112,
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
  },
});
