import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { MotiView } from 'moti';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export function MicClouds() {
  const { mode } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isFocused, setIsFocused] = useState(true);
  const isDark = mode === 'dark';
  const shouldAnimate = isFocused && !prefersReducedMotion;

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  // Cloud colors based on theme
  const cloudColor = isDark ? 'rgba(100, 80, 120, 0.15)' : 'rgba(255, 255, 255, 0.4)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.centerContainer}>
        {/* Clouds / Fog - 3 Ellipses */}
        {[0, 1, 2].map((i) => (
          <MotiView
            key={`cloud-${i}`}
            from={{
              opacity: 0.3,
              scale: 1,
              translateX: 0,
              translateY: 0,
            }}
            animate={
              shouldAnimate
                ? {
                    opacity: 0.6,
                    scale: 1.1 + (i * 0.05),
                    translateX: (i % 2 === 0 ? 10 : -10),
                    translateY: -10,
                  }
                : {
                    opacity: 0.5,
                    scale: 1.05,
                    translateX: 0,
                    translateY: -4,
                  }
            }
            transition={
              shouldAnimate
                ? {
                    type: 'timing',
                    duration: 4000 + (i * 1000),
                    loop: true,
                    repeatReverse: true,
                    delay: i * 500,
                  }
                : undefined
            }
            style={[
              styles.cloud,
              {
                backgroundColor: cloudColor,
                width: 200 + (i * 50),
                height: 100 + (i * 30),
                // Center the cloud relative to the container
                // We use negative margins or transform to center if we were using absolute positioning from top/left
                // But here we are in a centered container.
                // Let's just rely on flex center of the parent or absolute positioning with center alignment.
                // Since we want them stacked behind the button, absolute positioning centered is best.
              }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloud: {
    position: 'absolute',
    borderRadius: 100,
  },
});
