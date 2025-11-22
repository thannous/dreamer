import { MotiText } from 'moti';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TextProps, View } from 'react-native';

interface TypewriterTextProps extends TextProps {
  text: string;
  delay?: number;
  speed?: number;
}

export function TypewriterText({ text, style, delay = 0, speed = 30, ...props }: TypewriterTextProps) {
  const characters = useMemo(() => text.split(''), [text]);

  return (
    <View style={styles.container}>
      <Text style={[style, styles.textContainer]} {...props}>
        {characters.map((char, index) => (
          <MotiText
            key={`${char}-${index}`}
            from={{ 
              opacity: 0, 
              scale: 1.2, 
              translateY: -2,
            }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              translateY: 0,
            }}
            transition={{
              type: 'timing',
              duration: 200,
              delay: delay + (index * speed),
            }}
            style={{
              // We can add specific text shadow to simulate glow/fog
              textShadowColor: 'rgba(255, 255, 255, 0.5)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 10,
            }}
          >
            {char}
          </MotiText>
        ))}
      </Text>
    </View>
  );
}

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
});
