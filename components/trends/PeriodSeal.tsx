import { Image as Painting } from 'expo-image';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Image, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
  type CSSStyle,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { SEAL_EMBLEMS, SEAL_GOLD, SealLegend } from '@/components/journal/story/sealMarks';
import { sparklePath } from '@/components/journal/story/sparkle';
import { PressableScale } from '@/components/motion';
import { EASE, EASING } from '@/components/motion/motion';
import { DREAM_THEMES } from '@/lib/dreamThemes';
import type { DreamTheme } from '@/lib/types';

const ASTRAL_ART = require('@/assets/images/onboarding-astral-background.webp');

/** The seal's square, at full size; a narrow screen draws it smaller. */
export const PERIOD_SEAL_SIZE = 312;
const CENTER = PERIOD_SEAL_SIZE / 2;
/** The window and its emblem keep the dream seal's measures, so both seals read as one object. */
const WINDOW = 148;
const EMBLEM = 92;
/** The dream seal's legend is laid out in its own 240-point square. */
const LEGEND_BOX = 240;
const ARC_RADIUS = 101;
const ORBIT_RADIUS = 128;
const MEDAL = 40;
const MEDAL_TARGET = 44;
const SIGN = 22;
const STEP = 360 / DREAM_THEMES.length;
/** Half of the longest arc: the busiest theme's arc spans 48 degrees, leaving its neighbours a gap. */
const ARC_HALF = (24 * Math.PI) / 180;
const ARC_LENGTH = ARC_HALF * ARC_RADIUS;
const TRACK_MARKS = 12;
const SPARKS = 8;

/** The entrance, in milliseconds: the signs spin onto the orbit and slow, then the window is struck. */
export const PERIOD_SEAL_BEATS = { spin: 1500, press: 1350, arcs: 1450, settled: 2300 } as const;

// Fixed points so the sky is identical on every visit and in screenshots.
const HALO_STARS = [
  { x: 34, y: 58, r: 1.2 },
  { x: 282, y: 40, r: 1.1 },
  { x: 296, y: 208, r: 1.4 },
  { x: 18, y: 230, r: 1 },
  { x: 250, y: 292, r: 0.9 },
  { x: 70, y: 296, r: 1.2 },
] as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);

const point = (radius: number, angle: number) => ({
  x: CENTER + radius * Math.sin(angle),
  y: CENTER - radius * Math.cos(angle),
});

/** Half an arc, drawn from its theme's place on the ring, clockwise or back, as far as its count reaches. */
const ArcHalf = memo(function ArcHalf({ angle, clockwise, length, color, opacity, delay }: {
  angle: number;
  clockwise: boolean;
  length: number;
  color: string;
  opacity: number;
  delay: number;
}) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withDelay(delay, withTiming(length, {
      duration: 700,
      easing: EASING.out,
      reduceMotion: ReduceMotion.System,
    })));
  }, [delay, length, shown]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: ARC_LENGTH - shown.get() }));
  const from = point(ARC_RADIUS, angle);
  const to = point(ARC_RADIUS, angle + (clockwise ? ARC_HALF : -ARC_HALF));
  return (
    <AnimatedPath
      d={`M${from.x} ${from.y} A${ARC_RADIUS} ${ARC_RADIUS} 0 0 ${clockwise ? 1 : 0} ${to.x} ${to.y}`}
      fill="none"
      stroke={color}
      strokeOpacity={opacity}
      strokeWidth={3}
      strokeLinecap="butt"
      strokeDasharray={[ARC_LENGTH, ARC_LENGTH]}
      animatedProps={animatedProps}
    />
  );
});

function Glow({ size, color, id }: { size: number; color: string; id: string }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.5} />
          <Stop offset="0.55" stopColor={color} stopOpacity={0.14} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * A sign on the orbit, in its engraved medal, with its count. Drawn again only when its
 * own state changes: turning the ring to another sign redraws the two that trade places.
 */
const SealSign = memo(function SealSign({ theme, count, chosen, selected, label, ink, onSelect }: {
  theme: DreamTheme;
  count: number;
  chosen: boolean;
  selected: boolean;
  label: string;
  ink: string;
  onSelect: (theme: DreamTheme) => void;
}) {
  return (
    <PressableScale
      testID={`trends.seal.sign.${theme}`}
      onPress={() => onSelect(theme)}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      className="items-center justify-center"
      style={{ width: MEDAL_TARGET, height: MEDAL_TARGET }}
    >
      {chosen ? (
        <View className="absolute" pointerEvents="none" style={{ width: MEDAL * 2, height: MEDAL * 2 }}>
          <Glow size={MEDAL * 2} color={SEAL_GOLD} id={`periodSealGlow${theme}`} />
        </View>
      ) : null}
      <View className="items-center justify-center" style={{ width: MEDAL, height: MEDAL, opacity: count > 0 ? 1 : 0.42 }}>
        <Svg width={MEDAL} height={MEDAL} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Circle cx={MEDAL / 2} cy={MEDAL / 2} r={MEDAL / 2 - 0.9} fill={chosen ? ink : 'none'}
            fillOpacity={chosen ? 0.14 : 0} stroke={ink} strokeOpacity={chosen ? 1 : 0.72}
            strokeWidth={chosen ? 1.5 : 0.9} />
          <Circle cx={MEDAL / 2} cy={MEDAL / 2} r={MEDAL / 2 - 3} fill="none" stroke={ink}
            strokeOpacity={0.42} strokeWidth={0.6} strokeDasharray="0.8 2.4" />
        </Svg>
        <Image source={SEAL_EMBLEMS[theme]} tintColor={ink} resizeMode="contain"
          style={{ width: SIGN, height: SIGN }} />
      </View>
      {count > 0 ? (
        <View className="absolute items-center justify-center rounded-full bg-champagne"
          style={{ minWidth: 18, height: 18, paddingHorizontal: 4, right: -3, top: -3 }}>
          <Text allowFontScaling={false} className="font-sans-bold text-[11px] leading-[13px] text-on-champagne">
            {count}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
});

export type PeriodSealProps = {
  counts: Record<DreamTheme, number>;
  /** The emblem pressed into the window: the chosen theme, or the one that leads. */
  shown: DreamTheme | null;
  /** The theme the reader picked, which the ring turns to the top. */
  selected: DreamTheme | null;
  onSelect: (theme: DreamTheme) => void;
  /** Engraved along the foot: the period's dates. */
  dates: string;
  medalLabel: (theme: DreamTheme) => string;
  /** The ink of the rim, the arcs and the signs (the page's accent). */
  ink: string;
  glow: string;
  star: string;
  /** Plays the entrance once; otherwise the seal is drawn as it was left. */
  entrance: boolean;
  reduced: boolean;
  size?: number;
};

/**
 * The period's seal: the dream seal's astrolabe, holding the period's six themes. Each
 * sign rides the orbit with its count; an arc on the inner ring is as long as the share
 * of the period's dreams it carries. The theme that leads, or the one chosen, is turned
 * to the top and pressed into the window, with the period's dates along its foot; the
 * sentence under the seal gives the theme's count. On arrival the signs spin onto the orbit and slow, the
 * window is struck with a few sparks, and the arcs grow; afterwards a choice only turns
 * the ring. Under reduced motion the seal is drawn at rest.
 */
export function PeriodSeal({
  counts, shown, selected, onSelect, dates, medalLabel, ink, glow, star, entrance, reduced,
  size = PERIOD_SEAL_SIZE,
}: PeriodSealProps) {
  const animate = entrance && !reduced;
  const [settled, setSettled] = useState(!animate);
  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(() => setSettled(true), PERIOD_SEAL_BEATS.settled);
    return () => clearTimeout(timer);
  }, [settled]);

  // The ring turns the shortest way to the sign at the top.
  const top = selected ?? shown;
  const [rotation, setRotation] = useState(() => (top ? -DREAM_THEMES.indexOf(top) * STEP : 0));
  const [turnedTo, setTurnedTo] = useState(top);
  if (top !== turnedTo) {
    setTurnedTo(top);
    if (top) {
      const target = -DREAM_THEMES.indexOf(top) * STEP;
      setRotation(rotation + ((((target - rotation) % 360) + 540) % 360) - 180);
    }
  }

  const max = Math.max(1, ...DREAM_THEMES.map((theme) => counts[theme]));
  const motion = useMemo(() => {
    const spin = (degrees: number) => (animate ? {
      animationName: {
        from: { transform: [{ rotate: `${degrees}deg` }] },
        to: { transform: [{ rotate: '0deg' }] },
      },
      animationDuration: PERIOD_SEAL_BEATS.spin,
      animationTimingFunction: EASE.out,
      animationFillMode: 'both',
    } : null) as CSSStyle<ViewStyle> | null;
    return {
      ringSpin: spin(150),
      uprightSpin: spin(-150),
      track: (animate ? {
        animationName: {
          from: { opacity: 0, transform: [{ scale: 0.94 }] },
          to: { opacity: 1, transform: [{ scale: 1 }] },
        },
        animationDuration: 600,
        animationTimingFunction: EASE.out,
        animationFillMode: 'both',
      } : null) as CSSStyle<ViewStyle> | null,
      medals: DREAM_THEMES.map((_, index) => (animate ? {
        animationName: {
          from: { opacity: 0, transform: [{ scale: 0.6 }] },
          to: { opacity: 1, transform: [{ scale: 1 }] },
        },
        animationDuration: 420,
        animationDelay: 120 + index * 110,
        animationTimingFunction: EASE.out,
        animationFillMode: 'both',
      } : null) as CSSStyle<ViewStyle> | null),
      sparks: Array.from({ length: SPARKS }, (_, index) => {
        const angle = ((index + 0.5) / SPARKS) * Math.PI * 2;
        const reach = (index % 2 ? 0.82 : 0.96) * (EMBLEM * 0.9);
        const from = { x: Math.sin(angle) * EMBLEM * 0.42, y: -Math.cos(angle) * EMBLEM * 0.42 };
        const to = { x: Math.sin(angle) * reach, y: -Math.cos(angle) * reach };
        return {
          animationName: {
            from: { opacity: 1, transform: [{ translateX: from.x }, { translateY: from.y }, { scale: 1 }] },
            to: { opacity: 0, transform: [{ translateX: to.x }, { translateY: to.y }, { scale: 0.5 }] },
          },
          animationDuration: 700,
          animationDelay: PERIOD_SEAL_BEATS.press,
          animationTimingFunction: EASE.out,
          animationFillMode: 'both',
        } as CSSStyle<ViewStyle>;
      }),
    };
  }, [animate]);

  // The strike: pressed in a little too deep, then settling. Each new emblem is struck again.
  const strikeDelay = settled ? 0 : PERIOD_SEAL_BEATS.press;
  const strike = useMemo(() => (reduced ? null : {
    animationName: {
      '0%': { opacity: 0, transform: [{ scale: 1.12 }] },
      '4%': { opacity: 1, transform: [{ scale: 1.12 }] },
      '30%': { opacity: 1, transform: [{ scale: 0.94 }] },
      '100%': { opacity: 1, transform: [{ scale: 1 }] },
    },
    animationDuration: 520,
    animationDelay: strikeDelay,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }) as CSSStyle<ViewStyle> | null, [reduced, strikeDelay]);
  const ripple = useMemo(() => (reduced ? null : {
    animationName: {
      from: { opacity: 0.6, transform: [{ scale: 1 }] },
      to: { opacity: 0, transform: [{ scale: 1.24 }] },
    },
    animationDuration: 720,
    animationDelay: strikeDelay,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }) as CSSStyle<ViewStyle> | null, [reduced, strikeDelay]);

  const turn = (degrees: number) => ({
    transform: [{ rotate: `${degrees}deg` }],
    transitionProperty: 'transform',
    transitionDuration: reduced ? 0 : 700,
    transitionTimingFunction: EASE.inOut,
  }) as CSSStyle<ViewStyle>;
  const scale = size / PERIOD_SEAL_SIZE;
  const square = { width: PERIOD_SEAL_SIZE, height: PERIOD_SEAL_SIZE };

  return (
    // Everything drawn stays inside the seal's circle; clipping to its square keeps the
    // turning ring's corners from widening the page on the web.
    <View className="overflow-hidden" style={{ width: size, height: size }}>
      <View
        className="absolute"
        style={{
          ...square,
          left: (size - PERIOD_SEAL_SIZE) / 2,
          top: (size - PERIOD_SEAL_SIZE) / 2,
          transform: [{ scale }],
        }}
      >
        <View className="absolute inset-0" pointerEvents="none" accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Svg width={PERIOD_SEAL_SIZE} height={PERIOD_SEAL_SIZE}>
            <Defs>
              <RadialGradient id="periodSealHalo" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor={glow} stopOpacity={0.22} />
                <Stop offset="55%" stopColor={glow} stopOpacity={0.06} />
                <Stop offset="100%" stopColor={glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={CENTER} cy={CENTER} rx={CENTER} ry={CENTER} fill="url(#periodSealHalo)" />
            {HALO_STARS.map((dot) => <Circle key={`${dot.x}:${dot.y}`} cx={dot.x} cy={dot.y} r={dot.r} fill={star} />)}
          </Svg>
          <Animated.View className="absolute inset-0" style={motion.track as StyleProp<ViewStyle>}>
            <Svg width={PERIOD_SEAL_SIZE} height={PERIOD_SEAL_SIZE}>
              <Circle cx={CENTER} cy={CENTER} r={ORBIT_RADIUS} fill="none" stroke={ink} strokeOpacity={0.5}
                strokeWidth={0.9} strokeDasharray="1.2 4.2" />
              <Circle cx={CENTER} cy={CENTER} r={ARC_RADIUS} fill="none" stroke={ink} strokeOpacity={0.18} strokeWidth={0.75} />
              {Array.from({ length: TRACK_MARKS }, (_, index) => {
                const angle = ((index + 0.5) / TRACK_MARKS) * Math.PI * 2;
                const inner = point(ORBIT_RADIUS - (index % 2 ? 3 : 5), angle);
                const outer = point(ORBIT_RADIUS + (index % 2 ? 3 : 5), angle);
                return (
                  <Path key={index} stroke={ink} strokeOpacity={0.55} strokeWidth={0.9} strokeLinecap="round"
                    d={`M${inner.x} ${inner.y} L${outer.x} ${outer.y}`} />
                );
              })}
            </Svg>
          </Animated.View>
        </View>

        <Animated.View className="absolute inset-0" style={turn(rotation) as StyleProp<ViewStyle>}>
          <Animated.View className="absolute inset-0" style={motion.ringSpin as StyleProp<ViewStyle>}>
            <View className="absolute inset-0" pointerEvents="none" accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <Svg width={PERIOD_SEAL_SIZE} height={PERIOD_SEAL_SIZE}>
                {DREAM_THEMES.flatMap((theme, index) => {
                  const angle = (index * STEP * Math.PI) / 180;
                  const length = (counts[theme] / max) * ARC_LENGTH;
                  const opacity = theme === top ? 1 : 0.5;
                  const delay = settled ? 0 : PERIOD_SEAL_BEATS.arcs;
                  return [true, false].map((clockwise) => (
                    <ArcHalf key={`${theme}:${clockwise}`} angle={angle} clockwise={clockwise} length={length}
                      color={ink} opacity={opacity} delay={delay} />
                  ));
                })}
              </Svg>
            </View>
            {DREAM_THEMES.map((theme, index) => {
              const angle = (index * STEP * Math.PI) / 180;
              const at = point(ORBIT_RADIUS, angle);
              return (
                <Animated.View key={theme} className="absolute" style={[{
                  left: at.x - MEDAL_TARGET / 2,
                  top: at.y - MEDAL_TARGET / 2,
                  width: MEDAL_TARGET,
                  height: MEDAL_TARGET,
                }, turn(-rotation)] as StyleProp<ViewStyle>}>
                  <Animated.View style={motion.uprightSpin as StyleProp<ViewStyle>}>
                    <Animated.View style={motion.medals[index] as StyleProp<ViewStyle>}>
                      <SealSign theme={theme} count={counts[theme]} chosen={theme === top} selected={selected === theme}
                        label={medalLabel(theme)} ink={ink} onSelect={onSelect} />
                    </Animated.View>
                  </Animated.View>
                </Animated.View>
              );
            })}
          </Animated.View>
        </Animated.View>

        <View className="absolute" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ left: CENTER - WINDOW / 2, top: CENTER - WINDOW / 2, width: WINDOW, height: WINDOW }}>
          {shown && !reduced ? (
            <Animated.View key={`ripple:${shown}`} className="absolute rounded-full"
              style={[{ width: WINDOW, height: WINDOW, borderWidth: 1.5, borderColor: ink }, ripple] as StyleProp<ViewStyle>} />
          ) : null}
          <View className="overflow-hidden rounded-full bg-ink" style={{ width: WINDOW, height: WINDOW }}>
            <Painting source={ASTRAL_ART} contentFit="cover" contentPosition="center" style={{ width: '100%', height: '100%' }} />
            {shown ? <View className="absolute inset-0 bg-black" style={{ opacity: 0.32 }} /> : null}
            {shown ? (
              <Animated.View key={shown} testID="trends.seal.emblem" className="absolute" style={[{
                left: (WINDOW - EMBLEM) / 2, top: (WINDOW - EMBLEM) / 2, width: EMBLEM, height: EMBLEM,
              }, strike] as StyleProp<ViewStyle>}>
                <Image source={SEAL_EMBLEMS[shown]} tintColor={SEAL_GOLD} resizeMode="contain"
                  style={{ width: EMBLEM, height: EMBLEM }} />
              </Animated.View>
            ) : null}
            <Svg width={WINDOW} height={WINDOW} style={{ position: 'absolute', top: 0, left: 0 }}>
              <Circle cx={WINDOW / 2} cy={WINDOW / 2} r={WINDOW / 2 - 0.75} fill="none" stroke={ink} strokeOpacity={0.7} strokeWidth={1.5} />
            </Svg>
          </View>
          {animate && shown ? motion.sparks.map((spark, index) => (
            <Animated.View key={index} className="absolute" style={[{
              left: WINDOW / 2 - 5, top: WINDOW / 2 - 5, width: 10, height: 10,
            }, spark] as StyleProp<ViewStyle>}>
              <Svg width={10} height={10}><Path d={sparklePath(5, 5, 5)} fill={SEAL_GOLD} /></Svg>
            </Animated.View>
          )) : null}
        </View>

        <View className="absolute" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ left: CENTER - LEGEND_BOX / 2, top: CENTER - LEGEND_BOX / 2, width: LEGEND_BOX, height: LEGEND_BOX }}>
          <SealLegend key={dates} text={dates} side="bottom" reduced={reduced}
            from={settled ? 0 : PERIOD_SEAL_BEATS.press + 260} still={reduced} />
        </View>
      </View>
    </View>
  );
}
