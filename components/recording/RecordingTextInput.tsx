import React, { forwardRef, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';

import { MicButton, type MicButtonStatus } from '@/components/recording/MicButton';
import { getRecordingComposerLayout, LARGE_TEXT_FONT_SCALE } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { IconSymbol } from '@/components/ui/icon-symbol';

export interface RecordingTextInputProps {
  compact?: boolean;
  layout?: 'textFirst' | 'voiceFirst';
  value: string;
  onChange: (text: string) => void;
  selection?: TextInputProps['selection'];
  onSelectionChange?: TextInputProps['onSelectionChange'];
  disabled: boolean;
  lengthWarning: string;
  instructionText: string;
  switchToVoiceLabel?: string;
  /** False when the device cannot capture speech at all: the mic is hidden, not just disabled. */
  voiceSupported?: boolean;
  voiceStatus?: MicButtonStatus;
  recordingDurationLabel?: React.ReactNode;
  showVoiceHint?: boolean;
  onVoiceHintDismiss?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputTestID?: string;
  inputAccessibilityLabel?: string;
  /** Optional controls rendered inside the editor instead of its default microphone. */
  footerActions?: React.ReactNode;
  onSwitchToVoice: () => void;
  onEditTranscript?: () => void;
  onOpenDetails?: () => void;
  onClear?: () => void;
}

export const RecordingTextInput = forwardRef<TextInput, RecordingTextInputProps>(
  function RecordingTextInput(
    {
      compact = false,
      value,
      layout = 'textFirst',
      onChange,
      selection,
      onSelectionChange,
      disabled,
      lengthWarning,
      instructionText,
      switchToVoiceLabel,
      voiceSupported = true,
      voiceStatus = 'idle',
      recordingDurationLabel,
      showVoiceHint = false,
      onVoiceHintDismiss,
      placeholder,
      autoFocus = true,
      inputTestID = TID.Input.DreamTranscript,
      inputAccessibilityLabel,
      footerActions,
      onSwitchToVoice,
      onEditTranscript,
      onOpenDetails,
      onClear,
    },
    ref
  ) {
    const { colors, mode } = useTheme();
    const { t } = useTranslation();
    const { width, height, fontScale } = useWindowDimensions();
    const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
    const composerLayout = useMemo(
      () => getRecordingComposerLayout(width, height, fontScale),
      [fontScale, height, width]
    );
    const hasValue = value.trim().length > 0;
    const [isFocused, setIsFocused] = useState(false);
    const compactMinHeight = Math.max(96, 23 * fontScale + 70);
    const isVoicePreparing = voiceStatus === 'preparing';
    const isVoiceFirst = layout === 'voiceFirst';
    const voiceLabel = switchToVoiceLabel || t('recording.mode.switch_to_voice') || 'Dicter mon r\u00eave';
    const voiceControlDisabled = disabled || isVoicePreparing;
    const voiceStatusTitle = isVoicePreparing
      ? t('recording.status.preparing.title')
      : voiceStatus === 'recording'
        ? t('recording.status.recording.title')
        : null;
    const showInlineActions =
      Boolean(footerActions) || (!isVoiceFirst && voiceSupported) || Boolean(onOpenDetails && hasValue) || Boolean(onClear && hasValue);

    const textEditor = (
      <View style={styles.editor}>
        {!hasValue ? (
          <View
            style={[styles.placeholderIcon, compact && styles.placeholderIconCompact]}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
          >
            <IconSymbol name="pencil" size={18} color={noctalia.text.secondary} />
          </View>
        ) : null}
        {compact ? (
          <Text
            // Let native text layout size the editor even while dictation disables
            // keyboard input. The editable field overlays this invisible copy.
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.textInput,
              styles.textInputCompact,
              hasValue && styles.textInputWithValue,
              showInlineActions && styles.textInputWithInlineActionsCompact,
              { minHeight: compactMinHeight, maxHeight: undefined },
              styles.textMeasurement,
            ]}
            testID={`${inputTestID}-measurement`}
          >
            {value || placeholder || t('recording.placeholder')}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChange}
          selection={selection}
          onSelectionChange={onSelectionChange}
          style={[
            styles.textInput,
            composerLayout.narrow && {
              minHeight: composerLayout.inputMinHeight,
              maxHeight: composerLayout.inputMaxHeight,
            },
            isVoiceFirst && hasValue && {
              minHeight: (composerLayout.narrow ? composerLayout.inputMinHeight : 196) + 64,
              maxHeight: (composerLayout.narrow ? composerLayout.inputMaxHeight : 286) + 64,
            },
            compact && styles.textInputCompact,
            compact && styles.compactInputOverlay,
            hasValue && styles.textInputWithValue,
            showInlineActions && styles.textInputWithInlineActions,
            compact && showInlineActions && styles.textInputWithInlineActionsCompact,
            {
              backgroundColor: noctalia.surface.base,
              borderColor: isFocused ? noctalia.accent.base : noctalia.surface.border,
              color: noctalia.text.primary,
            },
          ]}
          multiline
          editable={!disabled}
          placeholder={placeholder || t('recording.placeholder')}
          placeholderTextColor={noctalia.text.secondary}
          testID={inputTestID}
          accessibilityLabel={inputAccessibilityLabel ?? t('recording.placeholder.accessibility')}
          autoFocus={autoFocus}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {showInlineActions ? (
          <View
            style={[
              styles.inlineActionFooter,
              compact && styles.inlineActionFooterCompact,
              { backgroundColor: colors.backgroundCard },
            ]}
          >
            <View style={styles.inlineActions}>
              {footerActions ?? (!isVoiceFirst && voiceSupported ? (
                <MicButton
                  status={voiceStatus}
                  onPress={onSwitchToVoice}
                  interaction={voiceControlDisabled ? 'disabled' : 'enabled'}
                  size="inline"
                  testID={TID.Button.RecordToggle}
                  accessibilityLabel={voiceLabel}
                />
              ) : null)}
              {onOpenDetails && hasValue ? (
                <Pressable
                  onPress={onOpenDetails}
                  disabled={disabled}
                  hitSlop={4}
                  style={[
                    styles.inlineUtilityButton,
                    {
                      backgroundColor: noctalia.surface.soft,
                      borderColor: noctalia.surface.border,
                      opacity: disabled ? 0.55 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('recording.remembered_profile.accordion_title')}
                  accessibilityHint={t('recording.remembered_profile.expand_hint')}
                  testID={TID.Button.RememberedDreamMetadataToggle}
                >
                  <IconSymbol name="plus" size={21} color={noctalia.text.secondary} />
                </Pressable>
              ) : null}
              {onClear && hasValue ? (
                <Pressable
                  onPress={onClear}
                  disabled={disabled}
                  hitSlop={4}
                  style={[
                    styles.inlineUtilityButton,
                    {
                      backgroundColor: noctalia.surface.soft,
                      borderColor: noctalia.surface.border,
                      opacity: disabled ? 0.55 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('recording.mode.clear_dream') || 'Effacer le rêve'}
                  testID={TID.Button.ClearDream}
                >
                  <IconSymbol name="trash" size={18} color={noctalia.text.secondary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    );

    const expressiveVoiceControl = (
      <View style={styles.voiceHero}>
        <MicButton
          status={voiceStatus}
          onPress={onSwitchToVoice}
          interaction={voiceControlDisabled ? 'disabled' : 'enabled'}
          size={hasValue ? "compact" : "expressive"}
          testID={TID.Button.RecordToggle}
          accessibilityLabel={voiceLabel}
        />
        {showVoiceHint && voiceStatus === 'idle' ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.voiceHint,
              fontScale >= LARGE_TEXT_FONT_SCALE && styles.voiceHintStacked,
              {
                backgroundColor: noctalia.surface.raised,
                borderColor: noctalia.surface.borderStrong,
              },
            ]}
            testID={TID.Component.RecordingVoiceHint}
          >
            <View
              pointerEvents="none"
              style={[
                styles.voiceHintArrow,
                {
                  backgroundColor: noctalia.surface.raised,
                  borderColor: noctalia.surface.borderStrong,
                },
              ]}
            />
            <Text style={[
              styles.voiceHintText,
              fontScale >= LARGE_TEXT_FONT_SCALE && styles.voiceHintTextStacked,
              { color: noctalia.text.primary },
            ]}>
              {t('recording.onboarding.voice.body')}
            </Text>
            <Pressable
              onPress={onVoiceHintDismiss}
              hitSlop={6}
              style={({ pressed }) => [
                styles.voiceHintDismiss,
                {
                  backgroundColor: noctalia.surface.soft,
                  borderColor: noctalia.surface.border,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('recording.voice_hint.understood')}
              testID={TID.Button.RecordingVoiceHintDismiss}
            >
              <Text style={[styles.voiceHintDismissText, { color: noctalia.text.primary }]}>
                {t('recording.voice_hint.understood')}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {voiceStatusTitle || recordingDurationLabel ? (
          <View
            accessibilityLiveRegion="polite"
            style={styles.voiceLiveStatus}
            testID={TID.Component.RecordingVoiceStatus}
          >
            {voiceStatusTitle ? (
              <Text
                style={[styles.voiceCaptureStatus, { color: noctalia.text.secondary }]}
                testID={TID.Text.RecordingVoiceStatusTitle}
              >
                {voiceStatusTitle}
              </Text>
            ) : null}
            {recordingDurationLabel ? (
              <Text
                style={[styles.voiceCaptureDuration, { color: noctalia.accent.text }]}
                testID={TID.Text.RecordingVoiceStatusDuration}
              >
                {recordingDurationLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );

    const voiceTranscript = (
      <View style={[styles.voicePreview, { backgroundColor: noctalia.surface.base, borderColor: noctalia.surface.border }]}>
        <Text style={[styles.voicePreviewTitle, { color: noctalia.text.primary }]}>
          {t('recording.tell.title')}
        </Text>
        <Text
          numberOfLines={hasValue ? 4 : undefined}
          style={[styles.voicePreviewText, { color: noctalia.text.secondary }]}
          testID="recording-voice-preview"
        >
          {hasValue ? value : t('recording.tell.empty')}
        </Text>
        {hasValue && onEditTranscript ? (
          <Pressable
            onPress={onEditTranscript}
            disabled={disabled || isVoicePreparing}
            accessibilityRole="button"
            accessibilityLabel={t('recording.tell.edit')}
            style={styles.voiceReviewButton}
            testID="recording-review-transcript"
          >
            <IconSymbol name="pencil" size={16} color={noctalia.accent.text} />
            <Text style={[styles.voiceReviewText, { color: noctalia.accent.text }]}>{t('recording.tell.edit')}</Text>
          </Pressable>
        ) : null}
      </View>
    );

    return (
      <>
        {instructionText ? <View
          style={[
            styles.recordingSection,
            composerLayout.narrow && styles.recordingSectionNarrow,
            compact && styles.recordingSectionCompact,
          ]}
        >
          <Text
            style={[
              styles.instructionText,
              composerLayout.narrow && styles.instructionTextNarrow,
              compact && styles.instructionTextCompact,
              { color: noctalia.text.secondary },
            ]}
          >
            {instructionText}
          </Text>
        </View> : null}

        <View
          nativeID={layout}
          style={styles.textInputSection}
          testID="recording-composer"
        >
          {isVoiceFirst && voiceSupported ? expressiveVoiceControl : textEditor}
          {isVoiceFirst && voiceSupported ? voiceTranscript : null}

          {lengthWarning ? (
            <Text style={[styles.lengthWarning, { color: noctalia.accent.text }]}>
              {lengthWarning}
            </Text>
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
    marginTop: 18,
  },
  recordingSectionCompact: {
    marginTop: 0,
  },
  recordingSectionNarrow: {
    marginTop: 10,
  },
  instructionText: {
    fontSize: 23,
    lineHeight: 32,
    fontFamily: Fonts.lora.regularItalic,
    textAlign: 'center',
  },
  instructionTextCompact: {
    fontSize: 18,
    lineHeight: 24,
  },
  instructionTextNarrow: {
    fontSize: 21,
    lineHeight: 29,
  },
  textInputSection: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    gap: 16,
  },
  editor: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  textInput: {
    minHeight: 196,
    maxHeight: 286,
    borderWidth: 1,
    borderRadius: 22,
    paddingTop: 20,
    paddingRight: 20,
    paddingBottom: 20,
    paddingLeft: 48,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: Fonts.lora.regularItalic,
    textAlignVertical: 'top',
  },
  textMeasurement: { opacity: 0 },
  compactInputOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    minHeight: 0,
    maxHeight: undefined,
  },
  textInputCompact: {
    paddingTop: 12,
  },
  textInputWithInlineActions: {
    paddingBottom: 90,
  },
  textInputWithInlineActionsCompact: {
    paddingBottom: 56,
  },
  textInputWithValue: {
    paddingLeft: 20,
  },
  inlineActionFooter: {
    position: 'absolute',
    left: 1,
    right: 1,
    bottom: 1,
    minHeight: 60,
    borderBottomLeftRadius: 21,
    borderBottomRightRadius: 21,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 9,
    paddingBottom: 6,
  },
  inlineActionFooterCompact: {
    minHeight: 48,
    paddingBottom: 2,
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineUtilityButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    position: 'absolute',
    top: 23,
    left: 21,
    zIndex: 2,
    pointerEvents: 'none',
  },
  placeholderIconCompact: {
    top: 15,
  },
  lengthWarning: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    textAlign: 'right',
  },
  voiceHero: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  voicePreview: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    gap: 10,
  },
  voicePreviewTitle: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  voicePreviewText: {
    fontFamily: Fonts.lora.regularItalic,
    fontSize: 16,
    lineHeight: 24,
  },
  voiceReviewButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceReviewText: {
    flexShrink: 1,
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  voiceHint: {
    width: '100%',
    maxWidth: 340,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
  },
  voiceHintArrow: {
    position: 'absolute',
    top: -7,
    left: '50%',
    width: 14,
    height: 14,
    marginLeft: -7,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  voiceHintStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 14,
  },
  voiceHintTextStacked: {
    flex: 0,
  },
  voiceHintText: {
    flex: 1,
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  voiceHintDismiss: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHintDismissText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 13,
    lineHeight: 17,
  },
  voiceLiveStatus: {
    alignItems: 'center',
    gap: 2,
    minHeight: 20,
  },
  voiceCaptureStatus: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
  },
  voiceCaptureDuration: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.bold,
    fontVariant: ['tabular-nums'],
  },
});
