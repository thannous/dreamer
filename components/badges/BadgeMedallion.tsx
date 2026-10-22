import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { sparklePath } from '@/components/journal/story/sparkle';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BADGE_GLYPHS, getBadgeArtwork } from '@/constants/badgeArtwork';
import type { BadgeFamilyId, BadgeTier } from '@/lib/badges/catalog';

import { COLLECTION, getBadgeMaterial } from './badgeMaterials';

type Props = {
  family: BadgeFamilyId;
  tier: BadgeTier | null;
  size: number;
  /** A tier not earned yet is shown veiled: blurred and dimmed, like a dream half remembered. */
  veiled?: boolean;
  /** The light's position across the card, -1 to 1 on each axis; still when absent. */
  light?: { x: SharedValue<number>; y: SharedValue<number> } | null;
  /** The lighter export, for the album grid and other small medallions. */
  small?: boolean;
};

const ART_INSET = 0.02;
/** The painted disc's share of the medallion, inside the points of its frame. */
const DISC = 0.84;
const RING = '#E9C77B';
const GLYPH = '#F5E6C0';

/** The medallion drawn when a family's illustration cannot be shown. */
const BadgePlaceholderArt = memo(function BadgePlaceholderArt({ family, size }: { family: BadgeFamilyId; size: number }) {
  const r = size / 2;
  const stars = [
    [r, size * 0.045],
    [size * 0.955, r],
    [r, size * 0.955],
    [size * 0.045, r],
  ] as const;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="badge-night" cx="50%" cy="42%" r="62%">
            <Stop offset="0" stopColor="#24307A" />
            <Stop offset="0.6" stopColor="#101849" />
            <Stop offset="1" stopColor="#060A24" />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r * 0.94} fill="url(#badge-night)" />
        <Circle cx={r} cy={r} r={r * 0.94} stroke={RING} strokeWidth={size * 0.028} fill="none" />
        <Circle cx={r} cy={r} r={r * 0.82} stroke={RING} strokeOpacity={0.55} strokeWidth={size * 0.008} fill="none" />
        {stars.map(([x, y], index) => (
          <Path key={index} d={sparklePath(x, y, size * 0.06)} fill={RING} />
        ))}
        {[[0.3, 0.28], [0.7, 0.3], [0.26, 0.66], [0.74, 0.7], [0.5, 0.2]].map(([x, y], index) => (
          <Path key={`dust-${index}`} d={sparklePath(size * x, size * y, size * 0.018)} fill={GLYPH} opacity={0.8} />
        ))}
      </Svg>
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <IconSymbol name={BADGE_GLYPHS[family]} size={Math.round(size * 0.34)} color={GLYPH} />
      </View>
    </View>
  );
});

/**
 * A family's medallion as a card shows it: the illustration (or its drawn stand-in) in a
 * circle, the glow of the tier's metal behind it, and on silver and gold the light it
 * catches, moving with the card when a light is given.
 */
export const BadgeMedallion = memo(function BadgeMedallion({ family, tier, size, veiled = false, light = null, small = false }: Props) {
  const [failed, setFailed] = useState(false);
  const art = failed ? null : getBadgeArtwork(family, small ? 'small' : 'full');
  const material = getBadgeMaterial(veiled ? null : tier);
  const inset = Math.round(size * ART_INSET);

  // The painting's disc, inside its frame's star points: the light is laid on it alone.
  const disc = Math.round(size * DISC);
  const discInset = (size - disc) / 2;

  return (
    // Never a target of its own: on the web an image would start a native drag under the hand
    // that tilts the card.
    <View pointerEvents="none" style={{ width: size, height: size, opacity: veiled ? 0.42 : 1 }}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {tier === 'gold' && !veiled ? <Rays size={size} light={light} color={material.ink} /> : null}
      {tier === 'silver' && !veiled ? (
        <View pointerEvents="none" style={{
          position: 'absolute', inset: -size * 0.04, borderRadius: size, borderWidth: 1, borderColor: material.frame[1], opacity: 0.5,
        }} />
      ) : null}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: size * 0.08,
          borderRadius: size,
          boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: size * 0.22, spreadDistance: size * 0.02, color: material.glow }],
        }}
      />
      {art ? (
        <Image
          source={art}
          contentFit="contain"
          blurRadius={veiled ? Math.max(2, Math.round(size / 40)) : 0}
          style={{ position: 'absolute', top: inset, left: inset, width: size - 2 * inset, height: size - 2 * inset }}
          onError={() => setFailed(true)}
        />
      ) : (
        <BadgePlaceholderArt family={family} size={size} />
      )}
      {material.foil || material.sheen ? (
        <View pointerEvents="none" style={{
          position: 'absolute', top: discInset, left: discInset, width: disc, height: disc, borderRadius: disc / 2, overflow: 'hidden',
        }}>
          {material.foil ? <Foil size={disc} light={light} /> : null}
          {material.sheen ? <Sheen size={disc} light={light} /> : null}
        </View>
      ) : null}
    </View>
  );
});

/** Gold's crown of light behind the medallion, turning a little with the card. */
function Rays({ size, light, color }: { size: number; light: Props['light']; color: string }) {
  const span = size * 1.7;
  const c = span / 2;
  const rays = Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2;
    const long = index % 2 === 0;
    const reach = c * (long ? 0.98 : 0.8);
    const spread = long ? 0.07 : 0.05;
    const point = (a: number, r: number) => `${c + Math.cos(a) * r} ${c + Math.sin(a) * r}`;
    return `M${point(angle - spread, c * 0.42)} L${point(angle, reach)} L${point(angle + spread, c * 0.42)} Z`;
  }).join(' ');
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(light ? light.x.get() : 0) * 10}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: 'absolute', left: (size - span) / 2, top: (size - span) / 2, width: span, height: span, opacity: 0.22 }, style]}>
      <Svg width={span} height={span}>
        <Path d={rays} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/** Gold's holographic film: iridescent bands drifting across the painting with the light. */
function Foil({ size, light }: { size: number; light: Props['light'] }) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (light ? light.x.get() : -0.2) * size * 0.9 },
      { translateY: (light ? light.y.get() : 0.15) * size * 0.9 },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: -size, top: -size, width: size * 3, height: size * 3, opacity: 0.32, mixBlendMode: 'soft-light' }, style]}
    >
      <LinearGradient colors={COLLECTION.foil} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

/** A narrow band of light across the metal, opposite the tilt. */
function Sheen({ size, light }: { size: number; light: Props['light'] }) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (light ? -light.x.get() : -0.55) * size * 1.1 },
      { rotate: '24deg' },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: -size * 0.25, left: size * 0.32, width: size * 0.36, height: size * 1.5, opacity: 0.7 }, style]}
    >
      <LinearGradient colors={COLLECTION.sheen} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}
