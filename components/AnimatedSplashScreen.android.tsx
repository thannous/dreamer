import { memo, useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';

export const SPLASH_MINIMUM_VISIBLE_MS = 600;
export const ANDROID_STATIC_SPLASH_MINIMUM_VISIBLE_MS = 150;
export const SPLASH_OUTRO_DURATION_MS = 0;
export const SPLASH_PARTICLE_COUNT = 0;

export const getSplashMinimumVisibleMs = (): number =>
  ANDROID_STATIC_SPLASH_MINIMUM_VISIBLE_MS;

export const shouldUseAnimatedSplash = (): boolean => false;

type AnimatedSplashScreenProps = {
  status?: 'intro' | 'outro';
  forceStatic?: boolean;
  onAnimationEnd?: () => void;
};

function AndroidStaticSplashScreen({
  status = 'intro',
  onAnimationEnd,
}: AnimatedSplashScreenProps) {
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
      style={styles.container}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        // Expo generates this drawable from the native splash configuration.
        source={{ uri: 'splashscreen_logo' }}
        style={styles.logo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'center',
    backgroundColor: '#21162b',
    justifyContent: 'center',
    zIndex: 999,
  },
  logo: {
    height: 180,
    width: 180,
  },
});

export default memo(AndroidStaticSplashScreen);
