import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDynamicAnimation } from 'moti';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { MotiView } from '@/lib/moti';

type DreamSignatureHeroProps = {
  children: ReactNode;
};

export function DreamSignatureHero({ children }: DreamSignatureHeroProps) {
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const backgroundAnimation = useDynamicAnimation(() => ({
    opacity: 0,
    translateY: 16,
    scale: 0.98,
  }));

  return (
    <View style={styles.container}>
      <MotiView
        state={backgroundAnimation}
        from={{ opacity: 0, translateY: 16, scale: 0.96 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{
          type: 'timing',
          duration: 900,
          delay: 220,
        }}
        style={[
          styles.glassCard,
          {
            backgroundColor: noctalia.surface.raised,
            borderColor: noctalia.surface.borderStrong,
          },
        ]}
      >
        <MotiView
          from={{ opacity: 0.15, translateX: -40 }}
          animate={{ opacity: 0.35, translateX: 40 }}
          transition={{
            type: 'timing',
            duration: 18000,
            loop: true,
            repeatReverse: true,
          }}
          style={[styles.auroraStripe, { backgroundColor: noctalia.atmosphere.veil }]}
        />

        <MotiView
          from={{ opacity: 0.6, translateY: 0 }}
          animate={{ opacity: 0.15, translateY: -22 }}
          transition={{
            type: 'timing',
            duration: 22000,
            loop: true,
            repeatReverse: true,
          }}
          style={[styles.orbTop, { backgroundColor: noctalia.surface.soft }]}
        />

        <MotiView
          from={{ opacity: 0.35, translateY: 18, scale: 0.94 }}
          animate={{ opacity: 0.7, translateY: -14, scale: 1.03 }}
          transition={{
            type: 'timing',
            duration: 26000,
            loop: true,
            repeatReverse: true,
          }}
          style={[styles.orbBottom, { backgroundColor: noctalia.atmosphere.horizon }]}
        />

        <View style={styles.content}>{children}</View>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  glassCard: {
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  content: {
    position: 'relative',
    zIndex: 2,
  },
  auroraStripe: {
    position: 'absolute',
    left: -80,
    top: -40,
    width: 220,
    height: 220,
    borderRadius: 120,
    transform: [{ rotate: '-22deg' }],
    zIndex: 1,
  },
  orbTop: {
    position: 'absolute',
    right: -30,
    top: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    zIndex: 1,
  },
  orbBottom: {
    position: 'absolute',
    left: -40,
    bottom: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    zIndex: 1,
  },
});
