import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

interface MicButtonProps {
  isRecording: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function MicButton({ isRecording, onPress, testID, accessibilityLabel, disabled }: MicButtonProps) {
  const { t } = useTranslation();
  const { colors, shadows, mode } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();

      // Start glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      // Reset animations
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [isRecording, pulseAnim, glowAnim]);

  // Dynamic glow colors based on theme
  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: mode === 'dark'
      ? [colors.accent, '#9d7bc8']
      : [colors.accent, colors.accentLight],
  });

  // Dynamic button colors
  const buttonBackground = mode === 'dark' ? '#4f3d6b' : colors.accent;
  const buttonRecordingBackground = mode === 'dark' ? '#5a3d7b' : colors.accentDark;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.container, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (isRecording ? t('recording.mic.stop') : t('recording.mic.start'))
      }
      testID={testID}
    >
      {isRecording && (
        <Animated.View
          style={[
            styles.glow,
            {
              borderColor: glowColor,
              opacity: glowAnim,
            },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.button,
          shadows.xl,
          {
            backgroundColor: isRecording ? buttonRecordingBackground : buttonBackground,
            borderColor: colors.accent,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Ionicons
          name={isRecording ? 'stop' : 'mic'}
          size={72}
          color={colors.textPrimary}
        />
      </Animated.View>
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
    width: 144,
    height: 144,
    borderRadius: 72,
    // backgroundColor and borderColor: set dynamically
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    // shadow: applied via theme shadows.xl
  },
  glow: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 4,
  },
});
