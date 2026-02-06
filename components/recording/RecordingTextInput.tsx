import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { IconSymbol } from '@/components/ui/icon-symbol';

export interface RecordingTextInputProps {
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
  lengthWarning: string;
  instructionText: string;
  onSwitchToVoice: () => void;
  onClear?: () => void;
}

export const RecordingTextInput = forwardRef<TextInput, RecordingTextInputProps>(
  function RecordingTextInput(
    { value, onChange, disabled, lengthWarning, instructionText, onSwitchToVoice, onClear },
    ref
  ) {
    const { colors, shadows } = useTheme();
    const { t } = useTranslation();

    return (
      <>
        <View style={styles.recordingSection}>
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            {instructionText}
          </Text>
        </View>

        <View style={styles.textInputSection}>
          <View style={shadows.md}>
            <TextInput
              ref={ref}
              value={value}
              onChangeText={onChange}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.textPrimary,
                },
              ]}
              multiline
              editable={!disabled}
              testID={TID.Input.DreamTranscript}
              accessibilityLabel={t('recording.placeholder.accessibility')}
              autoFocus
            />
          </View>

          {lengthWarning ? (
            <Text style={[styles.lengthWarning, { color: colors.accent }]}>
              {lengthWarning}
            </Text>
          ) : null}

          <Pressable
            onPress={onSwitchToVoice}
            style={[styles.modeSwitchButton, styles.modeSwitchVoiceButton]}
            testID={TID.Button.SwitchToVoice}
          >
            <IconSymbol
              name="mic"
              size={16}
              color={colors.textSecondary}
              style={styles.modeSwitchIcon}
            />
            <Text style={[styles.modeSwitchText, { color: colors.textSecondary }]}>
              {t('recording.mode.switch_to_voice') || 'Dicter mon r\u00eave'}
            </Text>
          </Pressable>

          {onClear ? (
            <Pressable
              onPress={onClear}
              style={[
                styles.modeSwitchButton,
                styles.modeSwitchVoiceButton,
                !value.trim() && styles.hiddenButton,
              ]}
              testID={TID.Button.ClearDream}
              disabled={disabled || !value.trim()}
              accessibilityElementsHidden={!value.trim()}
              importantForAccessibility={value.trim() ? 'yes' : 'no-hide-descendants'}
            >
              <IconSymbol
                name="trash"
                size={16}
                color={colors.textSecondary}
                style={styles.modeSwitchIcon}
              />
              <Text style={[styles.modeSwitchText, { color: colors.textSecondary }]}>
                {t('recording.mode.clear_dream') || 'Effacer le rêve'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </>
    );
  }
);

const styles = StyleSheet.create({
  recordingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  instructionText: {
    fontSize: 24,
    lineHeight: 34,
    fontFamily: Fonts.lora.regularItalic,
    textAlign: 'center',
  },
  textInputSection: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    gap: 16,
  },
  textInput: {
    minHeight: 160,
    maxHeight: 240,
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    fontFamily: Fonts.lora.regularItalic,
    textAlignVertical: 'top',
  },
  lengthWarning: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    textAlign: 'right',
  },
  modeSwitchButton: {
    paddingVertical: 6,
    paddingHorizontal: 0,
    alignSelf: 'center',
    marginTop: 8,
  },
  modeSwitchVoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeSwitchIcon: {
    marginRight: 6,
  },
  modeSwitchText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  hiddenButton: {
    opacity: 0,
  },
});
