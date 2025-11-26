import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDynamicAnimation } from 'moti';

import { MotiView } from '@/lib/moti';

type DreamSignatureHeroProps = {
  children: ReactNode;
};

export function DreamSignatureHero({ children }: DreamSignatureHeroProps) {
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
        style={styles.glassCard}
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
          style={styles.auroraStripe}
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
          style={styles.orbTop}
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
          style={styles.orbBottom}
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
    backgroundColor: 'rgba(11, 6, 31, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(209, 196, 255, 0.18)',
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
    backgroundColor: 'rgba(149, 129, 255, 0.35)',
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
    backgroundColor: 'rgba(236, 227, 255, 0.45)',
    zIndex: 1,
  },
  orbBottom: {
    position: 'absolute',
    left: -40,
    bottom: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(85, 63, 154, 0.6)',
    zIndex: 1,
  },
});
