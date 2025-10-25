import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SurrealTheme } from '@/constants/theme';

interface MicButtonProps {
  isRecording: boolean;
  onPress: () => void;
}

export function MicButton({ isRecording, onPress }: MicButtonProps) {
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

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SurrealTheme.accent, '#9d7bc8'],
  });

  return (
    <Pressable onPress={onPress} style={styles.container}>
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
          isRecording && styles.buttonRecording,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Ionicons
          name={isRecording ? 'stop' : 'mic'}
          size={72}
          color={SurrealTheme.textLight}
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
  button: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: SurrealTheme.shape,
    borderWidth: 2,
    borderColor: SurrealTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  buttonRecording: {
    backgroundColor: '#5a3d7b',
  },
  glow: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 4,
  },
});
