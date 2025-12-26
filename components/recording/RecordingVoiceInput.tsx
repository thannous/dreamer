import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MicButton } from '@/components/recording/MicButton';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { MotiView } from '@/lib/moti';
import { TID } from '@/lib/testIDs';

export interface RecordingVoiceInputProps {
  isRecording: boolean;
  isPreparing: boolean;
  transcript: string;
  instructionText: string;
  disabled: boolean;
  onToggleRecording: () => void;
  onSwitchToText: () => void;
}

export function RecordingVoiceInput({
  isRecording,
  isPreparing,
  transcript,
  instructionText,
  disabled,
  onToggleRecording,
  onSwitchToText,
}: RecordingVoiceInputProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const switchButtonLabel = transcript
    ? t('recording.mode.switch_to_text_edit') || t('recording.mode.switch_to_text') || 'Modifier mon r\u00eave'
    : t('recording.mode.switch_to_text') || '\u00c9crire mon r\u00eave';

  return (
    <>
      <View style={styles.recordingSection}>
        <TypewriterText
          style={[styles.instructionText, { color: colors.textSecondary }]}
          text={instructionText}
        />
      </View>

      <View style={styles.micContainer}>
        <View style={styles.micButtonWrapper}>
          <MicButton
            isRecording={isRecording}
            isPreparing={isPreparing}
            onPress={onToggleRecording}
            disabled={disabled}
            testID={TID.Button.RecordToggle}
          />
        </View>

        <View style={styles.preparingSlot}>
          {isPreparing ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
        </View>

        {transcript ? (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 500 }}
            style={styles.liveTranscriptContainer}
          >
            <Text style={[styles.liveTranscriptText, { color: colors.textPrimary }]}>
              {transcript}
            </Text>
          </MotiView>
        ) : null}

        <Pressable
          onPress={onSwitchToText}
          style={styles.modeSwitchButton}
          testID={TID.Button.SwitchToText}
        >
          <Text style={[styles.modeSwitchText, { color: colors.textSecondary }]}>
            {switchButtonLabel + ' \u270E'}
          </Text>
        </Pressable>
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
  instructionText: {
    fontSize: 24,
    lineHeight: 34,
    fontFamily: Fonts.lora.regularItalic,
    textAlign: 'center',
  },
  modeSwitchButton: {
    paddingVertical: 6,
    paddingHorizontal: 0,
    alignSelf: 'center',
    marginTop: 8,
  },
  modeSwitchText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
});
