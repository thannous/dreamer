import { MotiText } from '@/lib/moti';
import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, TextProps, TextStyle, View } from 'react-native';

interface TypewriterTextProps extends TextProps {
  text: string;
  delay?: number;
  speed?: number;
}

function TypewriterTextComponent({ text, style, delay = 0, speed = 30, ...props }: TypewriterTextProps) {
  const animationDuration = useMemo(
    () => Math.min(1600, Math.max(450, text.length * speed * 0.6)),
    [speed, text.length]
  );

  return (
    <View style={styles.container}>
      <MotiText
        from={{ opacity: 0, translateY: -4 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: animationDuration, delay }}
        style={[style, styles.textContainer, styles.textShadow]}
        {...props}
      >
        {text}
      </MotiText>
    </View>
  );
}

export const TypewriterText = memo(TypewriterTextComponent);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    // Ensure text wraps correctly
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  textShadow: (Platform.OS === 'web'
    ? { textShadow: '0px 0px 6px rgba(255, 255, 255, 0.35)' }
    : {
        textShadowColor: 'rgba(255, 255, 255, 0.35)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 6,
      }) as TextStyle,
});
