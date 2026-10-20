import React, { memo, useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Polyline, RadialGradient, Rect, Stop } from 'react-native-svg';

import { sparklePath } from '@/components/journal/story/sparkle';
import { SymbolMedallion } from '@/components/journal/symbols/SymbolMedallion';
import { PressableScale } from '@/components/motion';
import { EASE } from '@/components/motion/motion';
import type { DreamSky, SkyConstellation } from '@/lib/dreamSky';
import type { DreamAnalysis } from '@/lib/types';

import { TrendsSectionHead } from './TrendsSectionHead';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const SKY_HEIGHT = 280;
/** Stars keep clear of the sky's rounded edges. */
const INSET_X = 22;
const INSET_Y = 26;
/** A tap this close to a star opens its dream: a finger, not a pixel. */
const REACH = 30;
const DUST = 72;
/** The other constellations stay faintly drawn behind the chosen one. */
const DIMMED = 0.16;

type Placed = { dream: DreamAnalysis; x: number; y: number; analyzed: boolean; joined: boolean };

/** A scatter of faint dust, the same at every visit: depth, not data. */
function dustOf(width: number) {
  return Array.from({ length: DUST }, (_, index) => {
    const a = Math.sin(index * 12.9898 + 4.1414) * 43758.5453;
    const b = Math.sin(index * 78.233 + 1.618) * 24634.6345;
    const u = a - Math.floor(a);
    const v = b - Math.floor(b);
    return { x: u * width, y: v * SKY_HEIGHT, r: 0.6 + ((index * 7) % 5) * 0.2 };
  });
}

/** Drawn again only with the sky's size or stars: choosing a constellation leaves it alone. */
const StarField = memo(function StarField({ placed, width, ink, glow, glowOpacity, dust }: {
  placed: readonly Placed[];
  width: number;
  ink: string;
  glow: string;
  /** How strongly the theme lets its glow show: soft by night, softer on paper. */
  glowOpacity: number;
  dust: string;
}) {
  const specks = useMemo(() => dustOf(width), [width]);
  return (
    <Svg width={width} height={SKY_HEIGHT}>
      <Defs>
        <RadialGradient id="trends-sky-glow" cx="72%" cy="18%" rx="70%" ry="80%">
          <Stop offset="0" stopColor={glow} stopOpacity={glowOpacity} />
          <Stop offset="1" stopColor={glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={SKY_HEIGHT} fill="url(#trends-sky-glow)" />
      {specks.map((speck, index) => (
        <Circle key={`dust-${index}`} cx={speck.x} cy={speck.y} r={speck.r} fill={dust} />
      ))}
      {placed.map((star) => (star.analyzed ? (
        <Circle key={`halo-${star.dream.id}`} cx={star.x} cy={star.y} r={star.joined ? 12 : 9} fill={glow} opacity={0.14} />
      ) : null))}
      {/* A dream still waiting for its reading is a fainter, smaller star. */}
      {placed.map((star) => (
        <Path key={star.dream.id} d={sparklePath(star.x, star.y, star.joined ? 6 : star.analyzed ? 5 : 3.5)}
          fill={ink} opacity={star.analyzed ? 1 : 0.5} />
      ))}
    </Svg>
  );
});

/** One constellation on its own layer, so choosing it fades layers without redrawing a star. */
const ConstellationLayer = memo(function ConstellationLayer({ constellation, placed, width, ink, glow, order, lit, reduced, opacity }: {
  constellation: SkyConstellation;
  placed: readonly Placed[];
  width: number;
  ink: string;
  glow: string;
  order: number;
  lit: boolean;
  reduced: boolean;
  opacity: number;
}) {
  const points = constellation.stars.map((index) => placed[index]);
  const entrance = useMemo(() => (lit && !reduced ? {
    animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
    animationDuration: 700,
    animationDelay: 650 + order * 380,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  } : lit || reduced ? null : { opacity: 0 }) as CSSStyle<ViewStyle> | null, [lit, order, reduced]);
  const highlight = useMemo(() => ({
    opacity,
    transitionProperty: 'opacity',
    transitionDuration: reduced ? 0 : 320,
    transitionTimingFunction: EASE.out,
  }) as CSSStyle<ViewStyle>, [opacity, reduced]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, entrance] as StyleProp<ViewStyle>}>
      <Animated.View style={[StyleSheet.absoluteFill, highlight] as StyleProp<ViewStyle>}>
        <Svg width={width} height={SKY_HEIGHT}>
          {points.map((point) => (
            <Circle key={`glow-${point.dream.id}`} cx={point.x} cy={point.y} r={16} fill={glow} opacity={0.22} />
          ))}
          <Polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none" stroke={ink} strokeWidth={1.4} strokeOpacity={0.75} strokeLinejoin="round" />
          {points.map((point) => (
            <Path key={point.dream.id} d={sparklePath(point.x, point.y, 8)} fill={ink} />
          ))}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
});

/**
 * The period's dreams as a night sky: each dream a star, set across by when it was noted,
 * and each symbol that came back a constellation through its dreams, oldest to newest.
 * One constellation is drawn bright at a time; its chip below chooses it. A tap on a star
 * reopens its dream. The sky lights once, as it comes on screen, then stays still.
 *
 * For assistive technology the sky is one picture with its count; the chips name each
 * constellation, and the journal and the nights above open the same dreams.
 */
export function TrendsSky({ sky, lit, reduced, ink, glow, glowOpacity, dust, t, formatNumber, onOpenDream }: {
  sky: DreamSky;
  /** The section is on screen: the sky lights then, not out of sight. */
  lit: boolean;
  reduced: boolean;
  ink: string;
  glow: string;
  glowOpacity: number;
  dust: string;
  t: Translate;
  formatNumber: (value: number) => string;
  onOpenDream: (dream: DreamAnalysis) => void;
}) {
  const [width, setWidth] = useState(0);
  // Unset, the constellation that returns most leads; null, every one is drawn alike.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const { stars, constellations } = sky;
  const selected = chosen === null ? null
    : constellations.find(({ symbol }) => symbol.linkKey === chosen)?.symbol.linkKey
      ?? constellations[0]?.symbol.linkKey ?? null;
  const chosenOne = constellations.find(({ symbol }) => symbol.linkKey === selected);

  const placed = useMemo<Placed[]>(() => {
    const joined = new Set(constellations.flatMap((constellation) => constellation.stars));
    return stars.map((star, index) => ({
      dream: star.dream,
      x: INSET_X + star.x * Math.max(0, width - 2 * INSET_X),
      y: INSET_Y + star.y * (SKY_HEIGHT - 2 * INSET_Y),
      analyzed: star.analyzed,
      joined: joined.has(index),
    }));
  }, [constellations, stars, width]);

  const pick = useCallback((event: GestureResponderEvent) => {
    // A mouse click on the web carries its point as an offset in the element instead.
    const native = event.nativeEvent as GestureResponderEvent['nativeEvent'] & { offsetX?: number; offsetY?: number };
    const touchX = Number.isFinite(native.locationX) ? native.locationX : native.offsetX ?? Number.NaN;
    const touchY = Number.isFinite(native.locationY) ? native.locationY : native.offsetY ?? Number.NaN;
    let nearest: Placed | undefined;
    let distance = REACH;
    for (const star of placed) {
      const away = Math.hypot(star.x - touchX, star.y - touchY);
      if (away < distance) {
        nearest = star;
        distance = away;
      }
    }
    if (nearest) onOpenDream(nearest.dream);
  }, [onOpenDream, placed]);

  const choose = useCallback((linkKey: string) => {
    setChosen(linkKey === selected ? null : linkKey);
  }, [selected]);

  const field = useMemo(() => (lit && !reduced ? {
    animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
    animationDuration: 900,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  } : lit || reduced ? null : { opacity: 0 }) as CSSStyle<ViewStyle> | null, [lit, reduced]);

  const count = stars.length;
  // Past the cap the sky draws the newest dreams only, and says so against the period's count.
  const basis = sky.total > count
    ? t('trends.sky.basis_capped', { shown: formatNumber(count), count: formatNumber(sky.total) })
    : t(count === 1 ? 'trends.sky.basis_one' : 'trends.sky.basis', { count: formatNumber(count) });
  const caption = chosenOne
    ? t('trends.sky.links', { symbol: chosenOne.symbol.name, count: formatNumber(chosenOne.stars.length) })
    : constellations.length === 0 ? t('trends.sky.waiting') : null;

  return (
    <View className="gap-5" testID="trends.section.sky" accessible={false} accessibilityRole="none">
      <TrendsSectionHead title={t('trends.section.sky')} subtitle={basis} />
      <View
        testID="trends.sky.canvas"
        className="overflow-hidden rounded-[24px] border border-line bg-ink-card"
        style={{ height: SKY_HEIGHT }}
        onLayout={({ nativeEvent }) => setWidth((previous) => (previous === nativeEvent.layout.width ? previous : nativeEvent.layout.width))}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t(count === 1 ? 'trends.sky.label_one' : 'trends.sky.label', { count: formatNumber(count) })}
        // VoiceOver activates a picture by tapping its centre, which would open whichever
        // dream sits there. The picture itself opens nothing.
        onAccessibilityTap={() => {}}
      >
        {width > 0 ? (
          <>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, field] as StyleProp<ViewStyle>}>
              <StarField placed={placed} width={width} ink={ink} glow={glow} glowOpacity={glowOpacity} dust={dust} />
            </Animated.View>
            {constellations.map((constellation, order) => (
              <ConstellationLayer key={constellation.symbol.linkKey} constellation={constellation} placed={placed}
                width={width} ink={ink} glow={glow} order={order} lit={lit} reduced={reduced}
                opacity={selected === null ? 0.7 : constellation.symbol.linkKey === selected ? 1 : DIMMED} />
            ))}
            {/* Touch only: the picture is one element for assistive technology. */}
            <Pressable testID="trends.sky.stars" onPress={pick} style={StyleSheet.absoluteFill}
              accessible={false} focusable={false} {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})} />
          </>
        ) : null}
      </View>

      {constellations.length > 0 ? (
        <View className="flex-row flex-wrap gap-2" testID="trends.sky.constellations">
          {constellations.map(({ symbol, stars: joined }) => {
            const on = symbol.linkKey === selected;
            return (
              <PressableScale key={symbol.linkKey} testID={`trends.sky.constellation.${symbol.linkKey.replace(':', '.')}`}
                onPress={() => choose(symbol.linkKey)} haptic="light" accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t('trends.sky.constellation_label', { symbol: symbol.name, count: formatNumber(joined.length) })}
                className={`min-h-[44px] max-w-full flex-row items-center gap-2 rounded-full border py-1 pl-1 pr-4 ${on ? 'border-champagne bg-champagne-dim' : 'border-line'}`}>
                <SymbolMedallion symbol={symbol} size={34} />
                <Text numberOfLines={1} className="min-w-0 shrink text-[14px] leading-[19px] font-sans-medium text-ivory">{symbol.name}</Text>
                <Text className="text-[12px] leading-[16px] font-sans text-ivory-muted">{formatNumber(joined.length)}</Text>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      <Text className="text-[14px] leading-[21px] font-sans text-ivory-muted" accessibilityLiveRegion="polite" testID="trends.sky.caption">
        {[caption, t('trends.sky.hint')].filter(Boolean).join(' ')}
      </Text>
    </View>
  );
}
