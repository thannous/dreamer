// Import the repo's React Native stub directly, NOT 'react-native'.
// jest-expo's preset maps 'react-native' to the real package, and this repo replaces
// RN's own jest setup (see jest.config.expo.js), so the native module registry is never
// initialised. Touching a real RN component here throws
// `new NativeEventEmitter() requires a non-null argument` at import time, before a
// single test runs.
import { FlatList, Image, ScrollView, Text, View } from './react-native-stub';

const createAnimatedComponent = (Component: any) => Component;

const Animated = {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  createAnimatedComponent,
};

const createSharedValue = <T,>(initial: T) => {
  let current = initial;
  return {
    get value() {
      return current;
    },
    set value(next: T) {
      current = next;
    },
    get: () => current,
    set: (next: T) => {
      current = next;
    },
  };
};

export const Easing = {
  linear: (value: any) => value,
  ease: (value: any) => value,
  in: (fn: any) => fn,
  out: (fn: any) => fn,
  inOut: (fn: any) => fn,
  bezier: (..._points: number[]) => (value: any) => value,
};

// Reanimated CSS easing helpers. Under test they only need to be inert values that
// survive being spread into a style object.
export const cubicBezier = (...points: number[]) => `cubic-bezier(${points.join(', ')})`;
export const linear = (...points: any[]) => `linear(${points.join(', ')})`;
export const steps = (count: number, modifier?: string) =>
  `steps(${count}${modifier ? `, ${modifier}` : ''})`;

// Motion is never reduced under test, so components render their full-motion branch.
export const useReducedMotion = () => false;

export const Extrapolation = { CLAMP: 'clamp' };
export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' };

export const cancelAnimation = () => {};
export const runOnJS = (fn: any) => fn;

export const useSharedValue = <T,>(initial: T) => createSharedValue(initial);
export const useAnimatedStyle = (factory: () => any) => factory();
export const useAnimatedProps = (factory: () => any) => factory();
export const useAnimatedReaction = () => {};
export const useAnimatedScrollHandler = () => () => {};
export const useDerivedValue = <T,>(factory: () => T) => ({
  value: factory(),
  get: factory,
});

export const withTiming = (value: any, _config?: any, callback?: (finished: boolean) => void) => {
  callback?.(true);
  return value;
};
export const withSpring = (value: any, _config?: any, callback?: (finished: boolean) => void) => {
  callback?.(true);
  return value;
};
export const withDecay = (value: any, _config?: any, callback?: (finished: boolean) => void) => {
  callback?.(true);
  return value;
};
export const withDelay = (_delay: number, value: any) => value;
export const withRepeat = (value: any) => value;
export const withSequence = (...values: any[]) => values[values.length - 1];
export const interpolate = () => 0;

const springifyChain = {
  damping: () => springifyChain,
};

const enteringChain: any = {
  delay: () => enteringChain,
  duration: () => enteringChain,
  springify: () => springifyChain,
  withInitialValues: () => enteringChain,
  easing: () => enteringChain,
  build: () => () => ({ initialValues: {}, animations: {} }),
};

export const FadeIn = enteringChain;
export const FadeOut = enteringChain;
export const FadeInDown = enteringChain;
export const FadeInUp = enteringChain;
export const FadeOutDown = enteringChain;
export const FadeOutUp = enteringChain;
export const SlideInDown = { springify: () => springifyChain, ...enteringChain };
export const SlideOutDown = enteringChain;
export const LinearTransition = enteringChain;
export const CurvedTransition = enteringChain;

export default Animated;
export { createAnimatedComponent };
