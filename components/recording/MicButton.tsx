import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useTranslation } from '@/hooks/useTranslation';
import { MotiView } from '@/lib/moti';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, type AccessibilityState } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type MicButtonStatus = 'idle' | 'preparing' | 'recording';
export type MicButtonInteraction = 'enabled' | 'disabled';
export type MicButtonSize = 'inline' | 'compact' | 'expressive';

interface MicButtonProps {
  status: MicButtonStatus;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  interaction?: MicButtonInteraction;
  size?: MicButtonSize;
}

export function MicButton({
  status,
  onPress,
  testID,
  accessibilityLabel,
  interaction = 'enabled',
  size = 'expressive',
}: MicButtonProps) {
  const { t } = useTranslation();
  const { colors, shadows, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isFocused, setIsFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const buttonBackground = noctalia.surface.active;
  const buttonRecordingBackground = noctalia.accent.strong;
  const glowColor = noctalia.accent.base;
  const shouldAnimate = isFocused && !prefersReducedMotion;
  const isRecording = status === 'recording';
  const isPreparing = status === 'preparing';
  const disabled = interaction === 'disabled';
  const showPulses = isRecording && shouldAnimate;
  const isInline = size === 'inline';
  const isCompact = size === 'compact' || isInline;
  const dimensions = isInline
    ? {
        container: 48,
        button: 40,
        glow: 44,
        icon: 18,
        border: 1,
        pulseScale: 1.16,
      }
    : isCompact
      ? {
          container: 76,
          button: 62,
          glow: 68,
          icon: 28,
          border: 1,
          pulseScale: 1.2,
        }
      : {
          container: 240,
          button: 206,
          glow: 216,
          icon: 104,
          border: 2,
          pulseScale: 1.4,
        };

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onPress();
      }}
      disabled={disabled}
      style={[
        styles.container,
        {
          width: dimensions.container,
          height: dimensions.container,
        },
        disabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (isRecording ? t('recording.mic.pause') : t('recording.mic.start'))
      }
      accessibilityState={{
        disabled: disabled ?? false,
        busy: isRecording || isPreparing,
      } as AccessibilityState}
      accessibilityHint={
        isRecording
          ? t('recording.mic.pause_hint', { defaultValue: 'Double tap to pause dictation' })
          : t('recording.mic.start_hint', { defaultValue: 'Double tap to start voice recording' })
      }
      testID={testID}
    >
      {/* Outer Pulse Circle */}
      {showPulses && (
        <MotiView
          from={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: dimensions.pulseScale }}
          transition={{
            type: 'timing',
            duration: 1600,
            loop: true,
            repeatReverse: false,
          }}
          style={[
            styles.pulseCircle,
            {
              backgroundColor: glowColor,
              width: dimensions.button,
              height: dimensions.button,
              borderRadius: dimensions.button / 2,
            }
          ]}
        />
      )}

      {/* Glow Effect */}
      {showPulses && (
        <MotiView
          from={{ opacity: 0.6, scale: 1.05 }}
          animate={{ opacity: 0.2, scale: 1.15 }}
          transition={{
            type: 'timing',
            duration: 1200,
            loop: true,
            repeatReverse: true,
          }}
          style={[
            styles.glow,
            {
              borderColor: glowColor,
              width: dimensions.glow,
              height: dimensions.glow,
              borderRadius: dimensions.glow / 2,
              borderWidth: isCompact ? 2 : 4,
            },
          ]}
        />
      )}

      {/* Main Button */}
      <MotiView
        animate={{
          scale: isRecording ? 1.05 : isPreparing ? 1.02 : 1,
          backgroundColor: isRecording ? buttonRecordingBackground : buttonBackground,
        }}
        transition={{
          type: 'timing',
          duration: isPreparing ? 250 : 800,
        }}
        style={[
          styles.button,
          shadows.xl,
          {
            borderColor: noctalia.accent.base,
            width: dimensions.button,
            height: dimensions.button,
            borderRadius: dimensions.button / 2,
            borderWidth: dimensions.border,
          },
        ]}
      >
        {/* Breathing Icon */}
        <MotiView
          animate={{
            scale: isRecording ? 1.1 : 1,
            opacity: isRecording ? 1 : 0.9,
          }}
          transition={{
            type: 'timing',
            duration: 1000,
            loop: isRecording && shouldAnimate,
            repeatReverse: true,
          }}
          // Hide icon from accessibility tree since parent has the label
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden={true}
        >
          <IconSymbol
            name={isRecording ? 'pause.fill' : 'mic.fill'}
            size={dimensions.icon}
            color={noctalia.text.primary}
          />
        </MotiView>
      </MotiView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  disabled: {
    opacity: 0.5,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  glow: {
    position: 'absolute',
    zIndex: 5,
  },
  pulseCircle: {
    position: 'absolute',
    zIndex: 1,
  },
});
