import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { DarkTheme } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { TypeScale } from '@/constants/typeScale';

const COLORS = {
  bgStart: DarkTheme.backgroundDark,
  bgEnd: DarkTheme.backgroundCard,
  gold: DarkTheme.accent,
  cyan: DarkTheme.accentLight,
  moonFill: DarkTheme.backgroundSecondary,
  text: DarkTheme.textPrimary,
};

// --- Logo Paths ---
// Canvas: 280x280
// Center: 140, 140

// Crescent Moon / Eye Shape
const MOON_PATH = `
  M 140 50
  C 80 50, 50 140, 140 230
  C 95 180, 95 100, 140 50
  Z
`;

// 4-Pointed Star (Pupil)
const STAR_PATH = `
  M 140 110
  Q 150 140, 170 140
  Q 150 140, 140 170
  Q 130 140, 110 140
  Q 130 140, 140 110
  Z
`;

/** Shortest time the still splash stays once fonts are ready (reduced motion skips it). */
export const STARTUP_SPLASH_MINIMUM_VISIBLE_MS = 150;

type StartupSplashScreenProps = {
  /** Native only: web has no native splash to match. */
  nativeSplash?: { logoSize: number; backgroundColor: string };
  /** The first screen is ready: the splash leaves at once. */
  done?: boolean;
  /** Called once, when `done` first becomes true. */
  onDone?: () => void;
};

/**
 * Web: a still cover until the first screen, while fonts, language and the start
 * route settle. Nothing animates; it simply goes away. iOS and Android hold the
 * native splash image instead (StartupSplashScreen.tsx).
 */
function StartupSplashScreen({ done = false, onDone }: StartupSplashScreenProps) {
  const doneCalledRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!done) {
      doneCalledRef.current = false;
      return;
    }
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    onDoneRef.current?.();
  }, [done]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.container]}
    >
      <LinearGradient
        colors={[COLORS.bgStart, COLORS.bgEnd]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <View style={styles.starGlowContainer}>
          <Svg height="100%" width="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="splashCyanGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor={COLORS.cyan} stopOpacity="0.8" />
                <Stop offset="100%" stopColor={COLORS.cyan} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#splashCyanGlow)" />
          </Svg>
        </View>
        <View style={styles.logoContainer}>
          <Svg width={280} height={280} viewBox="0 0 280 280">
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
}

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
  textContainer: {
    marginTop: -40, // Pull up closer to logo bottom
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.outfit.regular,
    fontSize: TypeScale.hero.fontSize,
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
    opacity: 0.8,
  },
});

export default memo(StartupSplashScreen);
