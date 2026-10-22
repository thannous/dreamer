import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { sparklePath } from '@/components/journal/story/sparkle';
import { PressableScale, ProgressFill } from '@/components/motion';
import { BADGE_TIERS, type BadgeFamilyId, type BadgeTier, type BadgeTierLevel } from '@/lib/badges/catalog';
import type { BadgeFamilyState } from '@/lib/badges/ledger';

import { BadgeMedallion } from './BadgeMedallion';
import { COLLECTION, getBadgeMaterial, tierOfLevel } from './badgeMaterials';

/** Width over height: the proportion of a playing card. */
export const BADGE_CARD_RATIO = 0.7;

/** Three small diamonds, lit in their metal once earned. */
export function TierPips({ tier, size = 9 }: { tier: BadgeTierLevel; size?: number }) {
  return (
    <View className="flex-row items-center gap-1.5" accessible={false}>
      {BADGE_TIERS.map((name, index) => {
        const lit = index < tier;
        const material = getBadgeMaterial(name);
        return (
          <View
            key={name}
            style={{
              width: size,
              height: size,
              transform: [{ rotate: '45deg' }],
              borderWidth: 1,
              borderColor: lit ? material.frame[1] : COLLECTION.locked.frame[1],
              backgroundColor: lit ? material.ink : 'transparent',
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * What makes each tier rarer than the last, beyond its metal: a heavier frame, an inner
 * rim, stars set in the corners and, on gold, a holographic film across the whole card.
 */
const RARITY = {
  locked: { frame: 2, rim: false, corners: 0 },
  bronze: { frame: 3, rim: false, corners: 0 },
  silver: { frame: 4, rim: true, corners: 2 },
  gold: { frame: 5, rim: true, corners: 4 },
} as const;

type Light = { x: SharedValue<number>; y: SharedValue<number> } | null;

/** A card's metal frame and night ground, shared by both faces. */
export function BadgeCardFrame({
  tier,
  width,
  veiled = false,
  light = null,
  children,
}: {
  tier: BadgeTier | null;
  width: number;
  veiled?: boolean;
  /** Moves gold's film with the hand that tilts the card; still when absent. */
  light?: Light;
  children: React.ReactNode;
}) {
  const material = getBadgeMaterial(tier);
  const rarity = RARITY[tier ?? 'locked'];
  const radius = Math.max(14, Math.round(width * 0.09));
  const inner = radius - rarity.frame;
  const star = Math.max(4, Math.round(width * 0.03));
  const corners = rarity.corners === 4
    ? [{ top: 9, left: 9 }, { top: 9, right: 9 }, { bottom: 9, left: 9 }, { bottom: 9, right: 9 }]
    : rarity.corners === 2 ? [{ top: 9, left: 9 }, { bottom: 9, right: 9 }] : [];
  return (
    <LinearGradient
      colors={material.frame}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width,
        // Taller when enlarged text needs it: cards of one row stretch to the tallest.
        minHeight: Math.round(width / BADGE_CARD_RATIO),
        borderRadius: radius,
        padding: rarity.frame,
        opacity: veiled ? 0.55 : 1,
        boxShadow: [{ offsetX: 0, offsetY: 6, blurRadius: tier === 'gold' ? 26 : 18, spreadDistance: -4, color: material.glow }],
      }}
    >
      <LinearGradient
        colors={COLLECTION.ground}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1, borderRadius: inner, overflow: 'hidden' }}
      >
        {tier === 'gold' ? <CardFoil light={light} width={width} /> : null}
        {rarity.rim ? (
          <View pointerEvents="none" style={{
            position: 'absolute', inset: 4, borderRadius: Math.max(4, inner - 4), borderWidth: 1,
            borderColor: material.frame[1], opacity: 0.45,
          }} />
        ) : null}
        {corners.map((corner, index) => (
          <View key={index} pointerEvents="none" style={{ position: 'absolute', ...corner }}>
            <Svg width={star * 2} height={star * 2}>
              <Path d={sparklePath(star, star, star)} fill={material.ink} />
            </Svg>
          </View>
        ))}
        {children}
      </LinearGradient>
    </LinearGradient>
  );
}

/** Gold's holographic film over the night ground, drifting with the light. */
function CardFoil({ light, width }: { light: Light; width: number }) {
  const height = width / BADGE_CARD_RATIO;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (light ? light.x.get() : -0.15) * width * 0.35 },
      { translateY: (light ? light.y.get() : 0.1) * height * 0.25 },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: 'absolute', top: -height / 2, left: -width / 2, width: width * 2, height: height * 2,
      opacity: 0.2, mixBlendMode: 'screen',
    }, style]}>
      <LinearGradient colors={COLLECTION.foil} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

/** The back of a card earned but not unveiled yet: its frame already tells the metal. */
export function BadgeCardBackFace({ tier, width, caption, name }: {
  tier: BadgeTier;
  width: number;
  caption: string;
  name?: string;
}) {
  const material = getBadgeMaterial(tier);
  const size = width * 0.62;
  const r = size / 2;
  return (
    <BadgeCardFrame tier={tier} width={width}>
      <View className="flex-1 items-center justify-center gap-3 px-2.5">
        <Svg width={size} height={size}>
          <Circle cx={r} cy={r} r={r * 0.96} stroke={material.ink} strokeOpacity={0.5} strokeWidth={1} fill="none" />
          <Circle cx={r} cy={r} r={r * 0.7} stroke={material.ink} strokeOpacity={0.35} strokeWidth={1} fill="none" />
          <Path d={sparklePath(r, r, r * 0.86)} fill={material.ink} opacity={0.9} />
          <Path d={sparklePath(r, r, r * 0.5)} fill={COLLECTION.ground[1]} opacity={0.55} transform={`rotate(45 ${r} ${r})`} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
            const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
            return (
              <Path key={index} d={sparklePath(r + Math.cos(angle) * r * 0.83, r + Math.sin(angle) * r * 0.83, r * 0.06)}
                fill={material.ink} opacity={0.75} />
            );
          })}
        </Svg>
        <Text maxFontSizeMultiplier={1.4} style={{ color: material.ink }}
          className="text-center font-sans-medium text-overline uppercase tracking-[1.3px]">
          {caption}
        </Text>
        {name ? (
          <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={{ color: COLLECTION.muted }}
            className="text-center font-sans text-caption">
            {name}
          </Text>
        ) : null}
      </View>
    </BadgeCardFrame>
  );
}

type BadgeCardProps = {
  state: BadgeFamilyState;
  width: number;
  name: string;
  /** Under the name: the tier held, or the goal still ahead. */
  status: string;
  /** Said by a screen reader: the family, its tier and the next step. */
  accessibilityLabel: string;
  newCaption: string;
  onPress: (id: BadgeFamilyId) => void;
  testID?: string;
};

/** A family in the album: its highest tier face up, or face down while a new one waits. */
export const BadgeCard = memo(function BadgeCard({
  state,
  width,
  name,
  status,
  accessibilityLabel,
  newCaption,
  onPress,
  testID,
}: BadgeCardProps) {
  const tier = tierOfLevel(state.tier);
  const material = getBadgeMaterial(tier);
  const goal = state.nextThreshold;
  const previous = state.tier === 0 ? 0 : state.family.thresholds[state.tier - 1];
  const percent = goal == null ? 100 : ((state.progress - previous) / Math.max(1, goal - previous)) * 100;

  return (
    <PressableScale
      onPress={() => onPress(state.family.id)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      haptic="light"
    >
      {state.unrevealed > 0 && tier ? (
        <BadgeCardBackFace tier={tier} width={width} caption={newCaption} name={name} />
      ) : (
        <BadgeCardFrame tier={tier} width={width}>
          <View className="flex-1 items-center justify-center gap-2.5 px-2.5 pb-3 pt-3.5">
            <BadgeMedallion family={state.family.id} tier={tier} size={Math.round(width * 0.7)} veiled={!tier} small />
            <View className="w-full items-center gap-1.5">
              <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={{ color: tier ? COLLECTION.text : COLLECTION.muted }}
                className="text-center font-display-semibold text-body-sm leading-[18px]">
                {name}
              </Text>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={{ color: material.ink }}
                className="text-center font-sans-medium text-caption">
                {status}
              </Text>
              <View className="h-[3px] w-[70%] overflow-hidden rounded-full" style={{ backgroundColor: COLLECTION.track }}>
                <ProgressFill percent={percent} growOnMount={false} className="h-full rounded-full"
                  style={{ backgroundColor: material.ink }} />
              </View>
              <TierPips tier={state.tier} size={7} />
            </View>
          </View>
        </BadgeCardFrame>
      )}
    </PressableScale>
  );
});
