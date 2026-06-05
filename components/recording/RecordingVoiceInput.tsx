import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MicButton } from '@/components/recording/MicButton';
import { RecordingDraftProgress } from '@/components/recording/RecordingDraftProgress';
import type { RecordingOnboardingTarget } from '@/components/recording/RecordingOnboardingTour';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { RecordingSpotlightRect } from './RecordingOnboardingSpotlightOverlay';

export interface RecordingVoiceInputProps {
  status: 'idle' | 'preparing' | 'recording';
  transcript: string;
  instructionText: string;
  interaction: 'enabled' | 'disabled';
  voiceStatusTitle: string;
  voiceStatusDetail: string;
  voiceStatusTone: 'neutral' | 'active' | 'warning';
  voiceStatusHidden: boolean;
  spotlightTarget?: Extract<RecordingOnboardingTarget, 'voice' | 'text'>;
  onSpotlightLayout?: (rect: RecordingSpotlightRect) => void;
  spotlightMeasureKey?: number;
  recordingDurationLabel?: string;
  onToggleRecording: () => void;
  onSwitchToText: () => void;
  onHideVoiceStatus: () => void;
  onShowVoiceStatus: () => void;
}

export function RecordingVoiceInput({
  status,
  transcript,
  instructionText,
  interaction,
  voiceStatusTitle,
  voiceStatusDetail,
  voiceStatusTone,
  voiceStatusHidden,
  spotlightTarget,
  onSpotlightLayout,
  spotlightMeasureKey = 0,
  recordingDurationLabel,
  onToggleRecording,
  onSwitchToText,
  onHideVoiceStatus,
}: RecordingVoiceInputProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const isRecording = status === 'recording';
  const isPreparing = status === 'preparing';
  const canHideVoiceStatus = status === 'idle' && voiceStatusTone === 'neutral';
  const shouldShowVoiceStatus = !voiceStatusHidden;
  const micSpotlightRef = useRef<View | null>(null);
  const textSpotlightRef = useRef<View | null>(null);

  const switchButtonLabel = transcript
    ? t('recording.mode.switch_to_text_edit') || t('recording.mode.switch_to_text') || 'Modifier mon r\u00eave'
    : t('recording.mode.switch_to_text') || '\u00c9crire mon r\u00eave';
  const modeSwitchColor = mode === 'light' ? colors.textOnAccentSurface : colors.accentLight;
  const modeSwitchSpotlightBorder = mode === 'light' ? colors.accentDark : colors.accentLight;
  const modeSwitchSpotlightBackground = mode === 'light'
    ? colors.backgroundSecondary
    : `${colors.accent}1A`;

  useEffect(() => {
    if (!spotlightTarget || !onSpotlightLayout) {
      return;
    }

    const measureTarget = () => {
      const ref = spotlightTarget === 'voice' ? micSpotlightRef : textSpotlightRef;
      ref.current?.measureInWindow((x, y, width, height) => {
        onSpotlightLayout({ x, y, width, height });
      });
    };

    const frame = requestAnimationFrame(measureTarget);
    const timeout = setTimeout(measureTarget, 220);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [onSpotlightLayout, spotlightMeasureKey, spotlightTarget, status, transcript, voiceStatusHidden]);

  return (
    <>
      {shouldShowVoiceStatus ? (
        <View
          style={[
            isRecording ? styles.recordingStatusCompact : styles.voiceStatus,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: voiceStatusTone === 'active' ? colors.accent : colors.divider,
            },
          ]}
          testID={TID.Component.RecordingVoiceStatus}
        >
          <View style={styles.voiceStatusHeader}>
            <Text
              style={[styles.voiceStatusTitle, { color: colors.textPrimary }]}
              testID={TID.Text.RecordingVoiceStatusTitle}
            >
              {voiceStatusTitle}
            </Text>
            <View style={styles.voiceStatusActions}>
              {recordingDurationLabel ? (
                <Text
                  style={[styles.voiceStatusDuration, { color: colors.accent }]}
                  testID={TID.Text.RecordingVoiceStatusDuration}
                >
                  {recordingDurationLabel}
                </Text>
              ) : null}
              {canHideVoiceStatus ? (
                <Pressable
                  onPress={onHideVoiceStatus}
                  style={styles.voiceStatusActionButton}
                  testID={TID.Button.HideRecordingVoiceStatus}
                  accessibilityRole="button"
                  accessibilityLabel={t('recording.status.hide')}
                >
                  <Text style={[styles.voiceStatusActionText, { color: colors.textSecondary }]}>
                    {t('recording.status.hide')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {!isRecording ? (
            <Text
              style={[styles.voiceStatusDetail, { color: colors.textSecondary }]}
              testID={TID.Text.RecordingVoiceStatusDetail}
            >
              {voiceStatusDetail}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!isRecording ? (
        <View style={styles.recordingSection}>
          <TypewriterText
            style={[styles.instructionText, { color: colors.textSecondary }]}
            text={instructionText}
          />
        </View>
      ) : null}

      <View style={styles.micContainer}>
        <View style={styles.micButtonWrapper}>
          <View
            ref={micSpotlightRef}
            collapsable={false}
            style={[
              styles.spotlightShell,
              spotlightTarget === 'voice' && {
                borderColor: colors.accentLight,
                backgroundColor: `${colors.accent}1F`,
              },
            ]}
          >
            <MicButton
              status={status}
              onPress={onToggleRecording}
              interaction={interaction}
              testID={TID.Button.RecordToggle}
            />
          </View>
        </View>

        <View style={styles.preparingSlot}>
          {isPreparing ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
        </View>

        {transcript ? (
          <View style={styles.liveTranscriptContainer}>
            <Text style={[styles.liveTranscriptText, { color: colors.textPrimary }]}>
              {transcript}
            </Text>
          </View>
        ) : null}

        {transcript && !isRecording ? (
          <View style={styles.draftProgressWrap}>
            <RecordingDraftProgress value={transcript} />
          </View>
        ) : null}

        {!isRecording ? (
          <View
            ref={textSpotlightRef}
            collapsable={false}
            style={[
              styles.modeSwitchTarget,
              spotlightTarget === 'text' && [
                styles.modeSwitchSpotlight,
                {
                  borderColor: modeSwitchSpotlightBorder,
                  backgroundColor: modeSwitchSpotlightBackground,
                },
              ],
            ]}
          >
            <Pressable
              onPress={onSwitchToText}
              style={styles.modeSwitchButton}
              testID={TID.Button.SwitchToText}
              accessibilityRole="button"
              accessibilityLabel={switchButtonLabel}
            >
              <IconSymbol name="keyboard" size={15} color={modeSwitchColor} />
              <Text style={[styles.modeSwitchText, { color: modeSwitchColor }]}>
                {switchButtonLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  recordingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  micContainer: {
    alignItems: 'center',
    gap: 16,
  },
  micButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 240,
    height: 240,
  },
  spotlightShell: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 132,
    borderCurve: 'continuous',
    padding: 8,
  },
  preparingSlot: {
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTranscriptContainer: {
    marginBottom: 10,
    paddingHorizontal: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTranscriptText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Fonts.lora.regular,
  },
  draftProgressWrap: {
    width: '100%',
    maxWidth: 512,
    paddingHorizontal: 8,
  },
  voiceStatus: {
    width: '100%',
    maxWidth: 512,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  recordingStatusCompact: {
    width: '100%',
    maxWidth: 512,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  voiceStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  voiceStatusTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  voiceStatusDuration: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  voiceStatusActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  voiceStatusActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  voiceStatusActionText: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  voiceStatusDetail: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  instructionText: {
    fontSize: 24,
    lineHeight: 34,
    fontFamily: Fonts.lora.regularItalic,
    textAlign: 'center',
  },
  modeSwitchTarget: {
    alignSelf: 'center',
    marginTop: 8,
  },
  modeSwitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  modeSwitchSpotlight: {
    borderWidth: 1,
    borderRadius: 999,
    borderCurve: 'continuous',
  },
  modeSwitchText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.medium,
    textDecorationLine: 'underline',
  },
});
