import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MicButton, type MicButtonStatus } from '@/components/recording/MicButton';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { RecordingOnboardingTarget } from '@/components/recording/RecordingOnboardingTour';
import type { RecordingSpotlightRect } from './RecordingOnboardingSpotlightOverlay';

export interface RecordingTextInputProps {
  layout?: 'textFirst' | 'voiceFirst';
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
  lengthWarning: string;
  instructionText: string;
  switchToVoiceLabel?: string;
  voiceStatus?: MicButtonStatus;
  recordingDurationLabel?: string;
  spotlightTarget?: RecordingOnboardingTarget;
  onSpotlightLayout?: (rect: RecordingSpotlightRect) => void;
  spotlightMeasureKey?: number;
  placeholder?: string;
  autoFocus?: boolean;
  onSwitchToVoice: () => void;
  onOpenDetails?: () => void;
  onClear?: () => void;
}

export const RecordingTextInput = forwardRef<TextInput, RecordingTextInputProps>(
  function RecordingTextInput(
    {
      value,
      layout = 'textFirst',
      onChange,
      disabled,
      lengthWarning,
      instructionText,
      switchToVoiceLabel,
      voiceStatus = 'idle',
      recordingDurationLabel,
      spotlightTarget,
      onSpotlightLayout,
      spotlightMeasureKey = 0,
      placeholder,
      autoFocus = true,
      onSwitchToVoice,
      onOpenDetails,
      onClear,
    },
    ref
  ) {
    const { colors, mode } = useTheme();
    const { t } = useTranslation();
    const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
    const hasValue = value.trim().length > 0;
    const [isFocused, setIsFocused] = useState(false);
    const textSpotlightRef = useRef<View | null>(null);
    const voiceSpotlightRef = useRef<View | null>(null);
    const isVoicePreparing = voiceStatus === 'preparing';
    const isVoiceFirst = layout === 'voiceFirst';
    const voiceLabel = switchToVoiceLabel || t('recording.mode.switch_to_voice') || 'Dicter mon r\u00eave';
    const voiceControlDisabled = disabled || isVoicePreparing;
    const showInlineActions =
      !isVoiceFirst || Boolean(onOpenDetails && hasValue) || Boolean(onClear && hasValue);

    useEffect(() => {
      if (!spotlightTarget || !onSpotlightLayout) {
        return;
      }

      const measureTarget = () => {
        const targetRef = spotlightTarget === 'text' ? textSpotlightRef : voiceSpotlightRef;
        targetRef.current?.measureInWindow((x, y, width, height) => {
          onSpotlightLayout({ x, y, width, height });
        });
      };

      const frame = requestAnimationFrame(measureTarget);
      const timeout = setTimeout(measureTarget, 220);

      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timeout);
      };
    }, [onSpotlightLayout, spotlightMeasureKey, spotlightTarget, value]);

    const textEditor = (
      <View
        ref={textSpotlightRef}
        collapsable={false}
        style={styles.spotlightTarget}
      >
        {!hasValue ? (
          <View
            style={styles.placeholderIcon}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
          >
            <IconSymbol name="pencil" size={18} color={noctalia.text.secondary} />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChange}
          style={[
            styles.textInput,
            hasValue && styles.textInputWithValue,
            showInlineActions && styles.textInputWithInlineActions,
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
          testID={TID.Input.DreamTranscript}
          accessibilityLabel={t('recording.placeholder.accessibility')}
          autoFocus={autoFocus}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {showInlineActions ? (
          <View
            style={[styles.inlineActionFooter, { backgroundColor: colors.backgroundCard }]}
          >
            <LinearGradient
              colors={['transparent', colors.backgroundCard]}
              pointerEvents="none"
              style={styles.inlineActionFade}
            />
            <View style={styles.inlineActions}>
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
              {!isVoiceFirst ? (
                <View ref={voiceSpotlightRef} collapsable={false}>
                  <MicButton
                    status={voiceStatus}
                    onPress={onSwitchToVoice}
                    interaction={voiceControlDisabled ? 'disabled' : 'enabled'}
                    size="inline"
                    testID={TID.Button.RecordToggle}
                    accessibilityLabel={voiceLabel}
                  />
                </View>
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
      <View
        ref={voiceSpotlightRef}
        collapsable={false}
        style={styles.voiceHero}
      >
        <MicButton
          status={voiceStatus}
          onPress={onSwitchToVoice}
          interaction={voiceControlDisabled ? 'disabled' : 'enabled'}
          size="expressive"
          testID={TID.Button.RecordToggle}
          accessibilityLabel={voiceLabel}
        />
        {recordingDurationLabel ? (
          <Text
            style={[styles.voiceCaptureDuration, { color: noctalia.accent.strong }]}
            testID={TID.Text.RecordingVoiceStatusDuration}
          >
            {recordingDurationLabel}
          </Text>
        ) : null}
      </View>
    );

    return (
      <>
        <View style={styles.recordingSection}>
          <Text style={[styles.instructionText, { color: noctalia.text.secondary }]}>
            {instructionText}
          </Text>
        </View>

        <View style={styles.textInputSection}>
          {isVoiceFirst ? expressiveVoiceControl : textEditor}
          {isVoiceFirst ? textEditor : null}

          {lengthWarning ? (
            <Text style={[styles.lengthWarning, { color: noctalia.accent.strong }]}>
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
  instructionText: {
    fontSize: 23,
    lineHeight: 32,
    fontFamily: Fonts.lora.regularItalic,
    textAlign: 'center',
  },
  textInputSection: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    gap: 16,
  },
  spotlightTarget: {
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
  textInputWithInlineActions: {
    paddingBottom: 90,
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
  inlineActionFade: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    height: 30,
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
  voiceCaptureDuration: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.bold,
    fontVariant: ['tabular-nums'],
  },
});
