import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { DarkTheme } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
const DEFAULT_VIEWPORT = { width: 360, height: 640 };
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// --- Configuration ---
export const SPLASH_MINIMUM_VISIBLE_MS = 600;
export const ANDROID_STATIC_SPLASH_MINIMUM_VISIBLE_MS = 150;
export const SPLASH_OUTRO_DURATION_MS = 250;
export const SPLASH_PARTICLE_COUNT = 12;

export const getSplashMinimumVisibleMs = (platform: string): number =>
  platform === 'android'
    ? ANDROID_STATIC_SPLASH_MINIMUM_VISIBLE_MS
    : SPLASH_MINIMUM_VISIBLE_MS;

const getInitialViewport = () => {
  const { width, height } = Dimensions.get('window');
  return width > 0 && height > 0 ? { width, height } : DEFAULT_VIEWPORT;
};

const COLORS = {
  bgStart: DarkTheme.backgroundDark,
  bgEnd: DarkTheme.backgroundCard,
  gold: DarkTheme.accent,
  cyan: DarkTheme.accentLight,
  moonFill: DarkTheme.backgroundSecondary,
  text: DarkTheme.textPrimary,
};

export const shouldUseAnimatedSplash = (
  prefersReducedMotion: boolean,
  forceStatic = false
): boolean => !prefersReducedMotion && !forceStatic;

export const shouldUseMinimalStaticSplash = (platform: string): boolean =>
  platform === 'android';

// --- Logo Paths ---
// Canvas: 280x280
// Center: 140, 140

// Crescent Moon / Eye Shape
// Starts at top tip, curves left and down to bottom tip, then curves up inner edge.
const MOON_PATH = `
  M 140 50
  C 80 50, 50 140, 140 230
  C 95 180, 95 100, 140 50
  Z
`;
const MOON_LENGTH = 500;

// 4-Pointed Star (Pupil)
// Center at approx 140, 140
const STAR_PATH = `
  M 140 110
  Q 150 140, 170 140
  Q 150 140, 140 170
  Q 130 140, 110 140
  Q 130 140, 140 110
  Z
`;
const STAR_LENGTH = 200;

// --- Components ---

const AnimatedPath = Animated.createAnimatedComponent(Path);

type AnimatedSplashScreenProps = {
  status?: 'intro' | 'outro';
  forceStatic?: boolean;
  onAnimationEnd?: () => void;
};

const AnimatedSplashContent = ({
  status = 'intro',
  onAnimationEnd,
}: Omit<AnimatedSplashScreenProps, 'forceStatic'>) => {
  const [viewport] = useState(getInitialViewport);
  const animateSplash = true;

  // Shared values
  const phase = useSharedValue(0); // 0 to 4
  // 0-1: Ether
  // 1-2: Draw Moon
  // 2-3: Draw Star
  // 3-4: Fill & Glow & Text

  const floatProgress = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const animationEndCalledRef = useRef(false);
  const onAnimationEndRef = useRef(onAnimationEnd);

  useEffect(() => {
    onAnimationEndRef.current = onAnimationEnd;
  }, [onAnimationEnd]);

  const notifyAnimationEnd = useCallback(() => {
    if (animationEndCalledRef.current) return;
    animationEndCalledRef.current = true;
    onAnimationEndRef.current?.();
  }, []);

  useEffect(() => {
    if (!animateSplash || status !== 'intro') {
      cancelAnimation(phase);
      phase.value = 4;
      return () => cancelAnimation(phase);
    }

    phase.value = 0;
    phase.value = withSequence(
      withTiming(1, { duration: 150, easing: Easing.linear }),
      withTiming(2, { duration: 250, easing: Easing.inOut(Easing.cubic) }),
      withTiming(3, { duration: 150, easing: Easing.inOut(Easing.cubic) }),
      withTiming(4, { duration: 250, easing: Easing.out(Easing.quad) })
    );

    return () => cancelAnimation(phase);
  }, [animateSplash, phase, status]);

  useEffect(() => {
    if (!animateSplash || status !== 'intro') {
      cancelAnimation(floatProgress);
      floatProgress.value = 0;
      return () => cancelAnimation(floatProgress);
    }
    floatProgress.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 2400, easing: Easing.linear }),
      -1
    );
    return () => cancelAnimation(floatProgress);
  }, [animateSplash, floatProgress, status]);

  useEffect(() => {
    cancelAnimation(containerOpacity);

    if (status !== 'outro') {
      animationEndCalledRef.current = false;
      containerOpacity.value = 1;
      return () => cancelAnimation(containerOpacity);
    }

    // The two effects declared above stop every shared value that feeds a child
    // style before this fade can unmount the Fabric tree.

    if (!animateSplash) {
      containerOpacity.value = 0;
      notifyAnimationEnd();
      return () => cancelAnimation(containerOpacity);
    }

    containerOpacity.value = withTiming(
      0,
      { duration: SPLASH_OUTRO_DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(notifyAnimationEnd)();
      }
    );

    return () => cancelAnimation(containerOpacity);
  }, [
    animateSplash,
    containerOpacity,
    notifyAnimationEnd,
    status,
  ]);

  // --- Styles & Props ---

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  // Moon Drawing Animation
  const moonPathProps = useAnimatedProps(() => {
    // Draw from phase 1 to 2
    const drawProgress = interpolate(phase.value, [1, 2], [0, 1], 'clamp');

    // Fill Opacity: Increases in Phase 3-4
    const fillOpacity = interpolate(phase.value, [3, 3.8], [0, 1], 'clamp');

    return {
      strokeDashoffset: MOON_LENGTH * (1 - drawProgress),
      stroke: COLORS.gold,
      strokeWidth: 2,
      fill: COLORS.moonFill,
      fillOpacity: fillOpacity,
      opacity: interpolate(phase.value, [0.5, 1], [0, 1], 'clamp'),
    };
  });

  // Star Drawing Animation
  const starPathProps = useAnimatedProps(() => {
    // Draw from phase 2 to 3
    const drawProgress = interpolate(phase.value, [2, 3], [0, 1], 'clamp');

    // Color transition: Gold -> Cyan
    const strokeColor = interpolateColor(
      phase.value,
      [2.8, 3.5],
      [COLORS.gold, COLORS.cyan]
    );

    const fillOpacity = interpolate(phase.value, [3, 3.5], [0, 1], 'clamp');

    return {
      strokeDashoffset: STAR_LENGTH * (1 - drawProgress),
      stroke: strokeColor,
      strokeWidth: 2,
      fill: COLORS.cyan, // Star fills with Cyan
      fillOpacity: fillOpacity,
      opacity: interpolate(phase.value, [1.8, 2], [0, 1], 'clamp'),
    };
  });

  // Ripple Effect (At end of star drawing / fill start)
  const rippleStyle = useAnimatedStyle(() => {
    const rippleProgress = interpolate(phase.value, [3, 4], [0, 1], 'clamp');
    return {
      transform: [{ scale: interpolate(rippleProgress, [0, 1], [0.2, 2.5]) }],
      opacity: interpolate(rippleProgress, [0, 0.2, 1], [0, 0.6, 0]),
    };
  });

  // Text & Final Glow
  const textStyle = useAnimatedStyle(() => {
    const textProgress = interpolate(phase.value, [3.2, 4], [0, 1], 'clamp');
    return {
      opacity: textProgress,
      transform: [{ translateY: interpolate(textProgress, [0, 1], [10, 0]) }],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    // Glow appears when star fills
    const baseOpacity = interpolate(phase.value, [3, 4], [0, 0.8], 'clamp');
    return {
      opacity: baseOpacity,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.container, containerStyle]}
    >
      {/* Background */}
      <LinearGradient
        colors={[COLORS.bgStart, COLORS.bgEnd]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Particles */}
      {animateSplash && (
        <View style={StyleSheet.absoluteFill}>
          {Array.from({ length: SPLASH_PARTICLE_COUNT }).map((_, i) => (
            <Particle key={i} index={i} phase={phase} float={floatProgress} viewport={viewport} />
          ))}
        </View>
      )}

      {/* Central Content */}
      <View style={styles.content}>
        {/* Glow behind Star */}
        <Animated.View style={[styles.starGlowContainer, glowStyle]}>
          <Svg height="100%" width="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="cyanGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor={COLORS.cyan} stopOpacity="0.8" />
                <Stop offset="100%" stopColor={COLORS.cyan} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#cyanGlow)" />
          </Svg>
        </Animated.View>

        {/* Ripple Effect */}
        <Animated.View style={[styles.ripple, rippleStyle]} />

        {/* Logo SVG */}
        <View style={styles.logoContainer}>
          <Svg width={280} height={280} viewBox="0 0 280 280" style={styles.svg}>
            <Defs>
              {/* Optional Defs */}
            </Defs>

            {/* Moon */}
            <AnimatedPath
              d={MOON_PATH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={MOON_LENGTH}
              animatedProps={moonPathProps}
            />

            {/* Star */}
            <AnimatedPath
              d={STAR_PATH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={STAR_LENGTH}
              animatedProps={starPathProps}
            />
          </Svg>
        </View>

        {/* Text */}
        <Animated.View style={[styles.textContainer, textStyle]}>
          <Text style={styles.title}>NOCTALIA</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const StaticSplashContent = ({
  status = 'intro',
  minimal = false,
  onAnimationEnd,
}: Omit<AnimatedSplashScreenProps, 'forceStatic'> & { minimal?: boolean }) => {
  const animationEndCalledRef = useRef(false);
  const onAnimationEndRef = useRef(onAnimationEnd);

  useEffect(() => {
    onAnimationEndRef.current = onAnimationEnd;
  }, [onAnimationEnd]);

  useEffect(() => {
    if (status !== 'outro') {
      animationEndCalledRef.current = false;
      return;
    }
    if (animationEndCalledRef.current) return;
    animationEndCalledRef.current = true;
    onAnimationEndRef.current?.();
  }, [status]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.container]}
    >
      {!minimal ? (
        <LinearGradient
          colors={[COLORS.bgStart, COLORS.bgEnd]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.content}>
        {!minimal ? (
          <View style={[styles.starGlowContainer, styles.staticGlow]}>
            <Svg height="100%" width="100%" viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="staticCyanGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor={COLORS.cyan} stopOpacity="0.8" />
                  <Stop offset="100%" stopColor={COLORS.cyan} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="100" fill="url(#staticCyanGlow)" />
            </Svg>
          </View>
        ) : null}
        <View style={styles.logoContainer}>
          <Svg width={280} height={280} viewBox="0 0 280 280" style={styles.svg}>
            <Path
              d={MOON_PATH}
              fill={COLORS.moonFill}
              stroke={COLORS.gold}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
            <Path
              d={STAR_PATH}
              fill={COLORS.cyan}
              stroke={COLORS.cyan}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </Svg>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>NOCTALIA</Text>
        </View>
      </View>
    </View>
  );
};

const AnimatedSplashScreen = ({
  status = 'intro',
  forceStatic = false,
  onAnimationEnd,
}: AnimatedSplashScreenProps) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animateSplash = shouldUseAnimatedSplash(prefersReducedMotion, forceStatic);

  return animateSplash ? (
    <AnimatedSplashContent status={status} onAnimationEnd={onAnimationEnd} />
  ) : (
    <StaticSplashContent
      status={status}
      minimal={shouldUseMinimalStaticSplash(Platform.OS)}
      onAnimationEnd={onAnimationEnd}
    />
  );
};

// --- Helper Components ---

const Particle = ({
  index,
  phase,
  float,
  viewport,
}: {
  index: number;
  phase: SharedValue<number>;
  float: SharedValue<number>;
  viewport: { width: number; height: number };
}) => {
  const randomX = useMemo(() => seededRandom(index + 1) * viewport.width, [index, viewport.width]);
  const randomY = useMemo(() => seededRandom(index + 101) * viewport.height, [index, viewport.height]);
  const size = useMemo(() => seededRandom(index + 201) * 2 + 1, [index]);
  const phaseOffset = useMemo(() => seededRandom(index + 301) * Math.PI * 2, [index]);

  const style = useAnimatedStyle(() => {
    // Floating movement (UI thread)
    const wave = 0.5 + 0.5 * Math.sin(float.value + phaseOffset);
    const floatY = (wave - 0.5) * 30;

    // Convergence to center in Phase 1-2
    const progress = interpolate(phase.value, [0, 2], [0, 1], 'clamp');

    const targetX = viewport.width / 2;
    const targetY = viewport.height / 2 - 20; // Approx logo center

    // Interpolate position
    const currentX = interpolate(progress, [0, 1], [randomX, targetX]);
    const currentY = interpolate(progress, [0, 1], [randomY, targetY]);

    // Fade out as they converge
    const opacity = interpolate(progress, [0, 0.8, 1], [0, 0.6, 0]);

    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: COLORS.gold, // Stardust gold
      opacity,
      transform: [
        { translateX: currentX },
        { translateY: currentY + floatY },
      ],
    };
  });

  return <Animated.View style={style} />;
};

const styles = StyleSheet.create({
  container: {
    zIndex: 999,
    backgroundColor: COLORS.bgStart,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 300,
    height: 400,
  },
  logoContainer: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  svg: {
    // Overflow visible?
  },
  textContainer: {
    marginTop: -40, // Pull up closer to logo bottom
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 36,
    color: COLORS.text,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  starGlowContainer: {
    position: 'absolute',
    width: 120,
    height: 120,
    zIndex: 5,
    top: '50%',
    left: '50%',
    transform: [{ translateX: -60 }, { translateY: -80 }], // Adjust Y to match visual star center
  },
  staticGlow: {
    opacity: 0.8,
  },
  ripple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    zIndex: 5,
    top: '50%',
    left: '50%',
    marginLeft: -50,
    marginTop: -70, // Align with star
  },
});

export default memo(AnimatedSplashScreen);
