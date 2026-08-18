import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
import { Fonts } from '@/constants/theme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { AnalysisStep } from '@/hooks/useAnalysisProgress';
import type { ClassifiedError } from '@/lib/errors';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MotiText, MotiView } from '@/lib/moti';

interface AnalysisProgressProps {
  step: AnalysisStep;
  progress: number; // 0-100
  message: string;
  error: ClassifiedError | null;
  onRetry?: () => void;
}

type IconSymbolName = React.ComponentProps<typeof IconSymbol>['name'];

const STEP_ICONS: Record<AnalysisStep, IconSymbolName> = {
  [AnalysisStep.IDLE]: 'sparkles',
  [AnalysisStep.ANALYZING]: 'sparkles',
  [AnalysisStep.GENERATING_IMAGE]: 'photo',
  [AnalysisStep.FINALIZING]: 'moon.stars.fill',
  [AnalysisStep.COMPLETE]: 'checkmark.circle.fill',
  [AnalysisStep.ERROR]: 'exclamationmark.circle.fill',
};

// Poetic waiting mantras rotated under the step message so long analyses feel alive.
const MANTRA_KEYS: Partial<Record<AnalysisStep, readonly string[]>> = {
  [AnalysisStep.ANALYZING]: [
    'analysis.mantra.analyzing.1',
    'analysis.mantra.analyzing.2',
    'analysis.mantra.analyzing.3',
  ],
  [AnalysisStep.GENERATING_IMAGE]: [
    'analysis.mantra.generating_image.1',
    'analysis.mantra.generating_image.2',
    'analysis.mantra.generating_image.3',
  ],
  [AnalysisStep.FINALIZING]: [
    'analysis.mantra.finalizing.1',
    'analysis.mantra.finalizing.2',
  ],
};

const MANTRA_ROTATION_MS = 4200;

const ORB_SIZE = 72;
const HALO_SIZE = 116;
const SHIMMER_WIDTH = 64;

// Remounted via `key` on step change so the rotation restarts from the first mantra.
function RotatingMantra({ pool, color }: { pool: readonly string[]; color: string }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (pool.length < 2) {
      return;
    }
    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % pool.length);
    }, MANTRA_ROTATION_MS);
    return () => clearInterval(interval);
  }, [pool]);

  return (
    <MotiText
      key={`mantra-${index}`}
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 720 }}
      style={[styles.mantra, { color }]}
    >
      {t(pool[index % pool.length])}
    </MotiText>
  );
}

const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const STARS = Array.from({ length: 6 }).map((_, i) => ({
  id: i,
  x: 6 + seededRandom(i + 11) * 88,
  y: 8 + seededRandom(i + 23) * 54,
  size: 2 + seededRandom(i + 37) * 2.4,
  delay: seededRandom(i + 41) * 1600,
  duration: 2200 + seededRandom(i + 53) * 1800,
}));

export function AnalysisProgress({ step, progress, message, error, onRetry }: AnalysisProgressProps) {
  const { t } = useTranslation();
  const { colors, mode, shadows } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const showError = step === AnalysisStep.ERROR && error;
  const roundedProgress = Math.round(progress);

  const mantraPool = MANTRA_KEYS[step];
  const [barWidth, setBarWidth] = useState(0);
  const animate = !prefersReducedMotion;

  const handleBarLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 14, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'timing', duration: 480 }}
      style={[styles.container, { backgroundColor: noctalia.surface.active, borderColor: noctalia.surface.border }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: roundedProgress }}
      accessibilityLiveRegion="polite"
      accessibilityLabel={showError ? t('analysis.step.error') : t('analysis.step.analyzing')}
    >
      {/* Drifting aurora veil behind the content */}
      {animate && !showError ? (
        <MotiView
          from={{ opacity: 0.14, translateX: -50 }}
          animate={{ opacity: 0.32, translateX: 50 }}
          transition={{ type: 'timing', duration: 14000, loop: true, repeatReverse: true }}
          style={[styles.auroraStripe, { backgroundColor: noctalia.atmosphere.veil }]}
        />
      ) : null}

      {/* Twinkling stars */}
      {!showError &&
        STARS.map((star) =>
          animate ? (
            <MotiView
              key={`star-${star.id}`}
              from={{ opacity: 0.12, scale: 0.8 }}
              animate={{ opacity: 0.75, scale: 1.15 }}
              transition={{
                type: 'timing',
                duration: star.duration,
                loop: true,
                repeatReverse: true,
                delay: star.delay,
              }}
              style={[
                styles.star,
                {
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: star.size,
                  height: star.size,
                  backgroundColor: noctalia.atmosphere.star,
                },
              ]}
            />
          ) : (
            <View
              key={`star-${star.id}`}
              style={[
                styles.star,
                styles.staticStar,
                {
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: star.size,
                  height: star.size,
                  backgroundColor: noctalia.atmosphere.star,
                },
              ]}
            />
          )
        )}

      {showError ? (
        <View style={styles.errorContent}>
          <IconSymbol name="exclamationmark.circle.fill" size={24} color={noctalia.status.danger.icon} />
          <Text style={[styles.errorMessage, { color: noctalia.status.danger.text }]}>{message}</Text>
        </View>
      ) : (
        <View style={styles.dreamContent}>
          {/* Lunar orb with breathing halos */}
          <View style={styles.orbStage}>
            <View
              style={[
                styles.orbGlow,
                { backgroundColor: noctalia.atmosphere.glow, opacity: noctalia.atmosphere.glowOpacity },
              ]}
            />
            {animate
              ? [0, 1].map((ring) => (
                  <MotiView
                    key={`halo-${ring}`}
                    from={{ opacity: 0.45, scale: 0.72 }}
                    animate={{ opacity: 0, scale: 1.55 }}
                    transition={{
                      type: 'timing',
                      duration: 2600,
                      loop: true,
                      repeatReverse: false,
                      delay: ring * 1300,
                    }}
                    style={[styles.halo, { borderColor: noctalia.accent.base }]}
                  />
                ))
              : null}
            <MotiView
              from={{ scale: 1 }}
              animate={{ scale: animate ? 1.06 : 1 }}
              transition={{ type: 'timing', duration: 2000, loop: animate, repeatReverse: true }}
              style={[
                styles.orb,
                {
                  backgroundColor: noctalia.surface.raised,
                  borderColor: noctalia.surface.borderStrong,
                  shadowColor: noctalia.atmosphere.glow,
                },
              ]}
            >
              <MotiView
                key={`icon-${step}`}
                from={{ opacity: 0, scale: 0.5, rotate: '-18deg' }}
                animate={{ opacity: 1, scale: 1, rotate: '0deg' }}
                transition={{ type: 'timing', duration: 640 }}
                style={styles.orbIcon}
              >
                <IconSymbol name={STEP_ICONS[step]} size={30} color={noctalia.accent.text} />
              </MotiView>
            </MotiView>
          </View>

          {/* Step message, crossfaded on step change */}
          <MotiText
            key={`message-${step}`}
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 520 }}
            style={[styles.statusMessage, { color: noctalia.text.primary }]}
          >
            {message}
          </MotiText>

          {/* Rotating dreamy mantra */}
          {mantraPool ? (
            <RotatingMantra key={`mantra-${step}`} pool={mantraPool} color={noctalia.text.tertiary} />
          ) : null}

          {/* Progress bar with shimmer sweep */}
          <View style={styles.progressBarContainer}>
            <View
              style={[styles.progressBarBackground, { backgroundColor: noctalia.surface.soft }]}
              onLayout={handleBarLayout}
            >
              <View
                style={[
                  styles.progressBarFill,
                  { backgroundColor: noctalia.action.primary },
                  { width: `${progress}%` },
                ]}
              />
              {animate && barWidth > 0 ? (
                <MotiView
                  from={{ translateX: -SHIMMER_WIDTH }}
                  animate={{ translateX: barWidth }}
                  transition={{ type: 'timing', duration: 1700, loop: true, repeatReverse: false }}
                  style={styles.shimmer}
                />
              ) : null}
            </View>
            <Text style={[styles.progressText, { color: noctalia.text.primary }]}>{roundedProgress}%</Text>
          </View>
        </View>
      )}

      {/* Retry Button */}
      {showError && onRetry && error?.canRetry && (
        <Pressable
          style={[
            styles.retryButton,
            shadows.md,
            { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder },
          ]}
          onPress={onRetry}
        >
          <IconSymbol name="arrow.clockwise" size={20} color={noctalia.action.primaryText} />
          <Text style={[styles.retryButtonText, { color: noctalia.action.primaryText }]}>{t('analysis.retry')}</Text>
        </Pressable>
      )}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 24,
    // backgroundColor: set dynamically
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  auroraStripe: {
    position: 'absolute',
    left: -70,
    top: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    transform: [{ rotate: '-24deg' }],
  },
  star: {
    position: 'absolute',
    borderRadius: 999,
  },
  staticStar: {
    opacity: 0.3,
  },
  dreamContent: {
    alignItems: 'center',
  },
  orbStage: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  orbGlow: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
  },
  halo: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 1.5,
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
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 8,
  },
  orbIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMessage: {
    fontSize: 17,
    fontFamily: Fonts.spaceGrotesk.medium,
    // color: set dynamically
    textAlign: 'center',
  },
  mantra: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    fontStyle: 'italic',
    // color: set dynamically
    textAlign: 'center',
    minHeight: 20,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    alignSelf: 'stretch',
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    // backgroundColor: set dynamically
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    // backgroundColor: set dynamically
    borderRadius: 4,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SHIMMER_WIDTH,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  progressText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
    minWidth: 40,
    textAlign: 'right',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  errorMessage: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // backgroundColor: set dynamically
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 12,
    // shadow: applied via theme shadows.md
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
  },
});
