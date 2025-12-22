import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue
} from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
const DEFAULT_VIEWPORT = { width: 360, height: 640 };
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// --- Configuration ---
const PARTICLE_COUNT = 30;

const COLORS = {
  bgStart: '#000000',
  bgEnd: '#1a0f2b', // SurrealTheme.bgStart (Deep Purple)
  gold: '#FCD34D', // Amber 300 - Pale Gold
  cyan: '#C4B5FD', // Violet 300 - Soft Lavender (Replaced Cyan)
  moonFill: '#2e1d47', // SurrealTheme.darkAccent
  text: '#F8FAFC', // Slate 50
};

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
  onAnimationEnd?: () => void;
};

const AnimatedSplashScreen = ({ status = 'intro', onAnimationEnd }: AnimatedSplashScreenProps) => {
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);

  useEffect(() => {
    const { width, height } = Dimensions.get('window');
    setViewport({ width, height });
  }, []);

  // Shared values
  const phase = useSharedValue(0); // 0 to 4
  // 0-1: Ether
  // 1-2: Draw Moon
  // 2-3: Draw Star
  // 3-4: Fill & Glow & Text

  const floatProgress = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    // Start the animation sequence
    phase.value = withSequence(
      // Phase 1: Ether - Wait/Float
      withTiming(1, { duration: 800, easing: Easing.linear }),
      // Phase 2: Draw Moon (0.8s -> 1.8s)
      withTiming(2, { duration: 1000, easing: Easing.inOut(Easing.cubic) }),
      // Phase 3: Draw Star (1.8s -> 2.4s)
      withTiming(3, { duration: 600, easing: Easing.inOut(Easing.cubic) }),
      // Phase 4: Fill, Glow, Text (2.4s -> 3.4s)
      withTiming(4, { duration: 1000, easing: Easing.out(Easing.quad) })
    );

    // Add haptic feedback for key milestones
    const triggerHaptics = async () => {
      if (Platform.OS === 'web') return;

      // Phase 2: Moon drawn (approx 1.8s)
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 1800);

      // Phase 3-4: Star drawn / Ripple / Fill (approx 2.4s-3.4s)
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 2400);
    };

    triggerHaptics();
  }, [phase]);

  useEffect(() => {
    floatProgress.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 2400, easing: Easing.linear }),
      -1
    );
  }, [floatProgress]);

  useEffect(() => {
    if (status === 'outro') {
      // Fade out the whole screen
      containerOpacity.value = withTiming(
        0,
        { duration: 800, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished && onAnimationEnd) {
            runOnJS(onAnimationEnd)();
          }
        }
      );
    }
  }, [status, onAnimationEnd, containerOpacity]);

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
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.container, containerStyle]}>
      {/* Background */}
      <LinearGradient
        colors={[COLORS.bgStart, COLORS.bgEnd]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Particles */}
      <View style={StyleSheet.absoluteFill}>
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <Particle key={i} index={i} phase={phase} float={floatProgress} viewport={viewport} />
        ))}
      </View>

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
    letterSpacing: 8, // Wide tracking for "Light" feel
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
