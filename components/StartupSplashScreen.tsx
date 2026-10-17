import { memo, useEffect, useRef } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

/** Shortest time the still splash stays once fonts are ready (reduced motion skips it). */
export const STARTUP_SPLASH_MINIMUM_VISIBLE_MS = 1500;

// Expo generates both from the native splash configuration: an asset catalog image
// on iOS, a drawable on Android, each at the size the native splash draws it.
const NATIVE_SPLASH_LOGO = Platform.select({
  ios: { uri: 'SplashScreenLogo', size: 280 },
  default: { uri: 'splashscreen_logo', size: 180 },
});

type StartupSplashScreenProps = {
  /** The first screen has painted: the splash leaves at once. */
  done?: boolean;
  /** Called once, when `done` first becomes true. */
  onDone?: () => void;
};

/** The native splash's own bitmap, held until the first screen has painted. */
function NativeStartupSplashScreen({ done = false, onDone }: StartupSplashScreenProps) {
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
      style={styles.container}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={{ uri: NATIVE_SPLASH_LOGO.uri }}
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
    height: NATIVE_SPLASH_LOGO.size,
    width: NATIVE_SPLASH_LOGO.size,
  },
});

export default memo(NativeStartupSplashScreen);
