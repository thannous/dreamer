import { memo, useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, SurrealTheme } from '@/constants/theme';
import { FloatingCloudRow } from '@/components/animations/FloatingCloudRow';

const { width } = Dimensions.get('window');

type AnimatedSplashScreenProps = {
  status?: 'intro' | 'outro';
  onAnimationEnd?: () => void;
};

const AnimatedSplashScreen = ({ status = 'intro', onAnimationEnd }: AnimatedSplashScreenProps) => {
  const containerOpacity = useSharedValue(1);
  const gradientShift = useSharedValue(0);
  const orbPulse = useSharedValue(0);
  const titleFloat = useSharedValue(0);

  useEffect(() => {
    gradientShift.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, true);
    orbPulse.value = withRepeat(
      withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    titleFloat.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(gradientShift);
      cancelAnimation(orbPulse);
      cancelAnimation(titleFloat);
    };
  }, [gradientShift, orbPulse, titleFloat]);

  useEffect(() => {
    if (status === 'outro') {
      containerOpacity.value = withTiming(
        0,
        { duration: 650, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished && onAnimationEnd) {
            runOnJS(onAnimationEnd)();
          }
        },
      );
    } else {
      containerOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    }
  }, [containerOpacity, onAnimationEnd, status]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const gradientOverlayStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + gradientShift.value * 0.3,
    transform: [
      { translateY: (gradientShift.value - 0.5) * 30 },
      { rotate: `${gradientShift.value * 8}deg` },
    ],
  }));

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + orbPulse.value * 0.04 }],
    opacity: 0.55 + orbPulse.value * 0.2,
    shadowRadius: 40 + orbPulse.value * 16,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (titleFloat.value - 0.5) * 4 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.container, containerStyle]} pointerEvents="auto">
      <LinearGradient
        colors={[SurrealTheme.bgStart, SurrealTheme.bgEnd, '#090513']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.gradientOverlay, gradientOverlayStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <Animated.View style={[styles.glowOrb, orbStyle]} />

      <View style={styles.content}>
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>Dreamer</Text>
          <Text style={styles.tagline}>Conversez avec vos rêves, laissez-les vous guider.</Text>
        </Animated.View>
      </View>

      <View style={StyleSheet.absoluteFill}>
        <FloatingCloudRow top={140} opacity={0.5} />
        <FloatingCloudRow top={220} delay={3000} opacity={0.32} reverse />
        <FloatingCloudRow top={310} delay={6000} opacity={0.4} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: SurrealTheme.bgStart,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  gradientOverlay: {
    position: 'absolute',
    width: width * 1.4,
    height: width * 1.4,
    top: -width * 0.2,
    left: -width * 0.2,
  },
  glowOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#9b7cf4',
    top: '32%',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 46,
    letterSpacing: 0.5,
    color: '#F8F5FF',
    textAlign: 'center',
  },
  tagline: {
    marginTop: 8,
    fontFamily: Fonts.lora.regularItalic,
    fontSize: 16,
    color: SurrealTheme.textMuted,
    textAlign: 'center',
  },
  cloud: {
    position: 'absolute',
    left: -110,
  },
});

export default memo(AnimatedSplashScreen);
