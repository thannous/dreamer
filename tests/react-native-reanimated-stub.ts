import { FlatList, Image, ScrollView, Text, View } from 'react-native';

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
};

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

const enteringChain = {
  delay: () => enteringChain,
  duration: () => enteringChain,
  springify: () => springifyChain,
};

export const FadeInDown = enteringChain;
export const SlideInDown = { springify: () => springifyChain };

export default Animated;
export { createAnimatedComponent };
