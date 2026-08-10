import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MotiText, MotiView } from '@/lib/moti';

// How long the recording flow holds on the reveal before navigating to the dream.
export const ANALYSIS_REVEAL_HOLD_MS = 950;

const ORB_SIZE = 96;
const SPARKLE_COUNT = 8;
const SPARKLE_DISTANCE = 120;

const SPARKLES = Array.from({ length: SPARKLE_COUNT }).map((_, i) => {
  const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
  return {
    id: i,
    dx: Math.cos(angle) * SPARKLE_DISTANCE,
    dy: Math.sin(angle) * SPARKLE_DISTANCE,
    size: i % 2 === 0 ? 6 : 4,
  };
});

interface AnalysisRevealOverlayProps {
  visible: boolean;
}

// Full-screen celebratory burst shown when the dream analysis completes,
// bridging the wait into the navigation towards the analyzed dream.
export function AnalysisRevealOverlay({ visible }: AnalysisRevealOverlayProps) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  if (!visible) {
    return null;
  }

  const animate = !prefersReducedMotion;
  const title = t('analysis.reveal.title');

  return (
    <View
      style={[styles.container, { backgroundColor: noctalia.surface.overlay }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={title}
    >
      {/* Soft accent flash washing over the screen */}
      {animate ? (
        <MotiView
          from={{ opacity: 0.28 }}
          animate={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 700 }}
          style={[StyleSheet.absoluteFill, { backgroundColor: noctalia.atmosphere.glow }]}
        />
      ) : null}

      <View style={styles.stage}>
        {/* Halo waves expanding from the orb */}
        {animate
          ? [0, 1].map((ring) => (
              <MotiView
                key={`reveal-halo-${ring}`}
                from={{ opacity: 0.4, scale: 0.5 }}
                animate={{ opacity: 0, scale: 5 + ring * 2 }}
                transition={{ type: 'timing', duration: 900, delay: ring * 140 }}
                style={[styles.halo, { borderColor: noctalia.accent.base }]}
              />
            ))
          : null}

        {/* Sparkle burst */}
        {animate
          ? SPARKLES.map((sparkle) => (
              <MotiView
                key={`reveal-sparkle-${sparkle.id}`}
                from={{ opacity: 0.9, translateX: 0, translateY: 0, scale: 0.5 }}
                animate={{
                  opacity: 0,
                  translateX: sparkle.dx,
                  translateY: sparkle.dy,
                  scale: 1.15,
                }}
                transition={{ type: 'timing', duration: 780, delay: 160 }}
                style={[
                  styles.sparkle,
                  {
                    width: sparkle.size,
                    height: sparkle.size,
                    backgroundColor: noctalia.atmosphere.star,
                  },
                ]}
              />
            ))
          : null}

        {/* Lunar orb blooming in */}
        <MotiView
          from={{ opacity: 0, scale: animate ? 0.3 : 1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 460 }}
          style={[
            styles.orb,
            {
              backgroundColor: noctalia.surface.raised,
              borderColor: noctalia.surface.borderStrong,
              shadowColor: noctalia.atmosphere.glow,
            },
          ]}
        >
          <IconSymbol name="sparkles" size={40} color={noctalia.accent.base} />
        </MotiView>
      </View>

      <MotiText
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 520, delay: animate ? 240 : 0 }}
        style={[styles.title, { color: noctalia.text.primary }]}
      >
        {title}
      </MotiText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 24,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: set dynamically
  },
  stage: {
    width: ORB_SIZE * 2,
    height: ORB_SIZE * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 1.5,
  },
  sparkle: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // shadowColor: set dynamically
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 10,
  },
  title: {
    marginTop: 22,
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.medium,
    // color: set dynamically
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
