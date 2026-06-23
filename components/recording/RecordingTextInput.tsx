import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MicButton, type MicButtonStatus } from '@/components/recording/MicButton';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { RecordingActivationInsightCard } from '@/components/recording/RecordingActivationInsightCard';
import { RecordingDraftProgress } from '@/components/recording/RecordingDraftProgress';
import type { RecordingOnboardingTarget } from '@/components/recording/RecordingOnboardingTour';
import type { RecordingActivationInsight } from '@/lib/recordingActivationInsight';
import type { RecordingSpotlightRect } from './RecordingOnboardingSpotlightOverlay';

export interface RecordingTextInputProps {
  layout?: 'textFirst' | 'voiceFirst';
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
  lengthWarning: string;
  instructionText: string;
  fallbackNotice?: string;
  switchToVoiceLabel?: string;
  voiceCtaDetail?: string;
  voiceStatus?: MicButtonStatus;
  voiceAccessibilityHint?: string;
  recordingDurationLabel?: string;
  spotlightTarget?: RecordingOnboardingTarget;
  onSpotlightLayout?: (rect: RecordingSpotlightRect) => void;
  spotlightMeasureKey?: number;
  placeholder?: string;
  autoFocus?: boolean;
  activationInsight?: RecordingActivationInsight | null;
  onSwitchToVoice: () => void;
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
      fallbackNotice,
      switchToVoiceLabel,
      voiceCtaDetail,
      voiceStatus = 'idle',
      voiceAccessibilityHint,
      recordingDurationLabel,
      spotlightTarget,
      onSpotlightLayout,
      spotlightMeasureKey = 0,
      placeholder,
      autoFocus = true,
      activationInsight,
      onSwitchToVoice,
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
    const isVoiceActive = voiceStatus === 'recording';
    const isVoicePreparing = voiceStatus === 'preparing';
    const isVoiceFirst = layout === 'voiceFirst';
    const voiceLabel = switchToVoiceLabel || t('recording.mode.switch_to_voice') || 'Dicter mon r\u00eave';
    const voiceDetail =
      voiceCtaDetail ||
      t('recording.mode.voice_cta_detail') ||
      'Le micro ne demarre qu apres ton accord.';
    const voiceIconName: React.ComponentProps<typeof IconSymbol>['name'] =
      isVoiceActive ? 'pause.fill' : 'mic';
    const voiceControlDisabled = disabled || isVoicePreparing;
    const shouldShowVoiceHeroCopy =
      !isVoiceFirst || isVoiceActive || isVoicePreparing || hasValue || Boolean(recordingDurationLabel);

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

    return (
      <>
        <View style={styles.recordingSection}>
          <Text style={[styles.instructionText, { color: noctalia.text.secondary }]}>
            {instructionText}
          </Text>
        </View>

        <View style={styles.textInputSection}>
          {fallbackNotice ? (
            <View
              style={[
                styles.fallbackNotice,
                {
                  backgroundColor: noctalia.surface.base,
                  borderColor: noctalia.surface.border,
                },
              ]}
            >
              <Text
                style={[styles.fallbackNoticeText, { color: noctalia.text.secondary }]}
                testID={TID.Text.RecordingFallbackNotice}
              >
                {fallbackNotice}
              </Text>
            </View>
          ) : null}

          {isVoiceFirst ? (
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
              {shouldShowVoiceHeroCopy ? (
                <Pressable
                  onPress={onSwitchToVoice}
                  style={styles.voiceHeroCopy}
                  disabled={voiceControlDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={voiceLabel}
                  accessibilityHint={voiceAccessibilityHint}
                  testID={TID.Button.SwitchToVoice}
                >
                  <View style={styles.voiceHeroTitleRow}>
                    <Text style={[styles.voiceHeroTitle, { color: noctalia.text.primary }]}>
                      {voiceLabel}
                    </Text>
                    {recordingDurationLabel ? (
                      <Text
                        style={[styles.voiceCaptureDuration, { color: noctalia.accent.base }]}
                        testID={TID.Text.RecordingVoiceStatusDuration}
                      >
                        {recordingDurationLabel}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.voiceHeroDetail, { color: noctalia.text.secondary }]}>
                    {voiceDetail}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

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
          </View>

          <RecordingDraftProgress value={value} />

          <RecordingActivationInsightCard insight={activationInsight} />

          {lengthWarning ? (
            <Text style={[styles.lengthWarning, { color: noctalia.accent.base }]}>
              {lengthWarning}
            </Text>
          ) : null}

          {!isVoiceFirst ? (
            <View
              ref={voiceSpotlightRef}
              collapsable={false}
              style={[
                styles.voiceCaptureCard,
                isVoiceActive && styles.voiceCaptureCardActive,
                {
                  backgroundColor: isVoiceActive ? noctalia.surface.active : noctalia.surface.base,
                  borderColor: isVoiceActive ? noctalia.accent.base : noctalia.surface.border,
                },
              ]}
            >
              <Pressable
                onPress={onSwitchToVoice}
                style={styles.voiceCaptureCopy}
                testID={TID.Button.SwitchToVoice}
                disabled={voiceControlDisabled}
                accessibilityRole="button"
                accessibilityLabel={voiceLabel}
                accessibilityHint={voiceAccessibilityHint}
              >
                <View style={styles.voiceCaptureTitleRow}>
                  <IconSymbol
                    name={voiceIconName}
                    size={16}
                    color={isVoiceActive ? noctalia.accent.base : noctalia.text.primary}
                    style={styles.modeSwitchIcon}
                  />
                  <Text style={[styles.voiceCaptureTitle, { color: noctalia.text.primary }]}>
                    {voiceLabel}
                  </Text>
                  {recordingDurationLabel ? (
                    <Text
                      style={[styles.voiceCaptureDuration, { color: noctalia.accent.base }]}
                      testID={TID.Text.RecordingVoiceStatusDuration}
                    >
                      {recordingDurationLabel}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.voiceCaptureDetail, { color: noctalia.text.secondary }]}>
                  {voiceDetail}
                </Text>
              </Pressable>
              <MicButton
                status={voiceStatus}
                onPress={onSwitchToVoice}
                interaction={voiceControlDisabled ? 'disabled' : 'enabled'}
                size="compact"
                testID={TID.Button.RecordToggle}
                accessibilityLabel={voiceLabel}
              />
            </View>
          ) : null}

          {onClear ? (
            <Pressable
              onPress={onClear}
              style={[
                styles.modeSwitchButton,
                styles.modeSwitchVoiceButton,
                !hasValue && styles.hiddenButton,
              ]}
              testID={TID.Button.ClearDream}
              disabled={disabled || !hasValue}
              accessibilityElementsHidden={!hasValue}
              importantForAccessibility={hasValue ? 'yes' : 'no-hide-descendants'}
            >
              <IconSymbol
                name="trash"
                size={16}
                color={noctalia.text.secondary}
                style={styles.modeSwitchIcon}
              />
              <Text style={[styles.modeSwitchText, { color: noctalia.text.secondary }]}>
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
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  fallbackNotice: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fallbackNoticeText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  textInput: {
    minHeight: 176,
    maxHeight: 240,
    borderWidth: 1,
    borderRadius: 22,
    paddingTop: 20,
    paddingRight: 20,
    paddingBottom: 20,
    paddingLeft: 48,
    fontSize: 16,
    fontFamily: Fonts.lora.regularItalic,
    textAlignVertical: 'top',
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
  voiceHero: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
    paddingBottom: 2,
  },
  voiceHeroCopy: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 360,
    paddingHorizontal: 18,
    paddingVertical: 2,
  },
  voiceHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  voiceHeroTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },
  voiceHeroDetail: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
  },
  voiceCaptureCard: {
    minHeight: 94,
    borderWidth: 1,
    borderRadius: 22,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  voiceCaptureCardActive: {
    borderWidth: 1.5,
  },
  voiceCaptureCopy: {
    flex: 1,
    gap: 6,
    paddingVertical: 6,
  },
  voiceCaptureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  voiceCaptureTitle: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  voiceCaptureDetail: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  voiceCaptureDuration: {
    marginLeft: 8,
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.bold,
    fontVariant: ['tabular-nums'],
  },
  modeSwitchText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  hiddenButton: {
    opacity: 0,
  },
});
