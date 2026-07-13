import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { RecordingInputModePreference } from '@/lib/types';

export type RecordingOnboardingTarget = 'voice' | 'text';

type RecordingOnboardingTourProps = {
  visible: boolean;
  step: 0 | 1;
  inputMode: RecordingInputModePreference;
  onNext: () => void;
  onDismiss: () => void;
};

export function RecordingOnboardingTour({
  visible,
  step,
  inputMode,
  onNext,
  onDismiss,
}: RecordingOnboardingTourProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const isLast = step === 1;
  const icon = step === 0 ? 'slider.horizontal.3' : inputMode === 'voice' ? 'mic' : 'pencil';

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onDismiss}
      title={t('recording.guide.title')}
      testID={TID.Component.RecordingOnboardingTour}
      actions={{
        primaryLabel: t(isLast ? 'recording.guide.done' : 'recording.guide.next'),
        onPrimary: onNext,
        primaryTestID: TID.Button.RecordingOnboardingNext,
        linkLabel: t('recording.guide.dismiss'),
        onLink: onDismiss,
        linkTestID: TID.Button.RecordingOnboardingSkip,
      }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.stepCard,
          {
            backgroundColor: noctalia.surface.soft,
            borderColor: noctalia.surface.border,
          },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: `${noctalia.accent.base}24` }]}>
          <IconSymbol name={icon} size={24} color={noctalia.accent.base} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.progress, { color: noctalia.text.secondary }]}>
            {t('recording.onboarding.step_count', { current: step + 1, total: 2 })}
          </Text>
          <Text style={[styles.body, { color: noctalia.text.primary }]}>
            {t(step === 0 ? 'recording.guide.step_mode' : 'recording.guide.step_control')}
          </Text>
        </View>
      </View>
    </StandardBottomSheet>
  );
}

const styles = StyleSheet.create({
  stepCard: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 5 },
  progress: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },
  body: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 15, lineHeight: 21 },
});
