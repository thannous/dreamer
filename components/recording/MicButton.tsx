import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useTranslation } from '@/hooks/useTranslation';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { MotiView } from '@/lib/moti';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, type AccessibilityState } from 'react-native';

interface MicButtonProps {
  isRecording: boolean;
  isPreparing?: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function MicButton({ isRecording, isPreparing, onPress, testID, accessibilityLabel, disabled }: MicButtonProps) {
  const { t } = useTranslation();
  const { colors, shadows, mode } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isFocused, setIsFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  // Dynamic colors
  const buttonBackground = mode === 'dark' ? '#4f3d6b' : colors.accent;
  const buttonRecordingBackground = mode === 'dark' ? '#5a3d7b' : colors.accentDark;
  const glowColor = mode === 'dark' ? colors.accent : colors.accentDark;
  const shouldAnimate = isFocused && !prefersReducedMotion;
  const showPulses = isRecording && shouldAnimate;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.container, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (isRecording ? t('recording.mic.stop') : t('recording.mic.start'))
      }
      accessibilityState={{
        disabled: disabled ?? false,
        busy: isRecording || isPreparing,
      } as AccessibilityState}
      accessibilityHint={
        isRecording
          ? t('recording.mic.stop_hint', { defaultValue: 'Double tap to stop recording' })
          : t('recording.mic.start_hint', { defaultValue: 'Double tap to start voice recording' })
      }
      testID={testID}
    >
      {/* Outer Pulse Circle */}
      {showPulses && (
        <MotiView
          from={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.4 }}
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
            borderColor: colors.accent,
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
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={104}
            color={colors.textPrimary}
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
    width: 240,
    height: 240,
  },
  disabled: {
    opacity: 0.5,
  },
  button: {
    width: 206,
    height: 206,
    borderRadius: 103,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  glow: {
    position: 'absolute',
    width: 216,
    height: 216,
    borderRadius: 108,
    borderWidth: 4,
    zIndex: 5,
  },
  pulseCircle: {
    position: 'absolute',
    width: 206,
    height: 206,
    borderRadius: 103,
    zIndex: 1,
  },
});
