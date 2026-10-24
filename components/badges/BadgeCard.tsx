import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { sparklePath } from '@/components/journal/story/sparkle';
import { PressableScale, ProgressFill } from '@/components/motion';
import { BADGE_TIERS, getBadgeFamily, isFirstCard, type BadgeFamilyId, type BadgeTierLevel } from '@/lib/badges/catalog';

import { BadgeMedallion, type BadgeLight } from './BadgeMedallion';
import { COLLECTION, finishOf, getBadgeMaterial, type BadgeFinish } from './badgeMaterials';

/** Width over height: the proportion of a playing card. */
export const BADGE_CARD_RATIO = 0.7;

/** One small diamond per tier of the family, lit in its metal once earned. */
export function TierPips({ tier, count, size = 9 }: { tier: BadgeTierLevel; count: number; size?: number }) {
  return (
    <View className="flex-row items-center gap-1.5" accessible={false}>
      {BADGE_TIERS.slice(0, count).map((name, index) => {
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

const TOP_LEFT: ViewStyle = { top: 9, left: 9 };
const TOP_RIGHT: ViewStyle = { top: 9, right: 9 };
const BOTTOM_LEFT: ViewStyle = { bottom: 9, left: 9 };
const BOTTOM_RIGHT: ViewStyle = { bottom: 9, right: 9 };
const FOUR_CORNERS = [TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT];

/**
 * What makes each tier rarer than the last, beyond its metal: a heavier frame, inner rims,
 * stars set in the corners and, from gold up, a film across the whole card; diamond adds
 * crystal facets. A discovery wears a single rim and a star above its medallion.
 */
const RARITY: Record<BadgeFinish | 'locked', { frame: number; rims: number; corners: readonly ViewStyle[]; facets?: boolean }> = {
  locked: { frame: 2, rims: 0, corners: [] },
  discovery: { frame: 3, rims: 1, corners: [{ top: 9, left: 0, right: 0, alignItems: 'center' }] },
  bronze: { frame: 3, rims: 0, corners: [] },
  silver: { frame: 4, rims: 1, corners: [TOP_LEFT, BOTTOM_RIGHT] },
  gold: { frame: 5, rims: 1, corners: FOUR_CORNERS },
  platinum: { frame: 6, rims: 2, corners: FOUR_CORNERS },
  diamond: { frame: 7, rims: 2, corners: FOUR_CORNERS, facets: true },
};

/** A card's metal frame and night ground, shared by both faces. */
export function BadgeCardFrame({
  tier,
  width,
  light = null,
  children,
}: {
  tier: BadgeFinish | null;
  width: number;
  /** Moves the film with the hand that tilts the card; still when absent. */
  light?: BadgeLight;
  children: React.ReactNode;
}) {
  const material = getBadgeMaterial(tier);
  const rarity = RARITY[tier ?? 'locked'];
  const radius = Math.max(14, Math.round(width * 0.09));
  const inner = radius - rarity.frame;
  const star = Math.max(4, Math.round(width * 0.03));
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
        boxShadow: [{ offsetX: 0, offsetY: 6, blurRadius: material.film ? 26 : 18, spreadDistance: -4, color: material.glow }],
      }}
    >
      <LinearGradient
        colors={COLLECTION.ground}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1, borderRadius: inner, overflow: 'hidden' }}
      >
        {material.film ? <CardFilm light={light} width={width} colors={material.film} /> : null}
        {rarity.facets ? <CardFacets width={width} color={material.ink} /> : null}
        {Array.from({ length: rarity.rims }, (_, index) => {
          const inset = 4 + index * 4;
          return (
            <View key={index} pointerEvents="none" style={{
              position: 'absolute', inset, borderRadius: Math.max(4, inner - inset), borderWidth: 1,
              borderColor: material.frame[1], opacity: 0.45 - index * 0.15,
            }} />
          );
        })}
        {rarity.corners.map((corner, index) => (
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

/** The film across the night ground from gold up, drifting with the light. */
function CardFilm({ light, width, colors }: { light: BadgeLight; width: number; colors: readonly [string, string, ...string[]] }) {
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
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

/** Diamond's crystal: a few cut lines across the ground, meeting near its corners. */
function CardFacets({ width, color }: { width: number; color: string }) {
  const height = Math.round(width / BADGE_CARD_RATIO);
  const w = width;
  const lines = [
    `M0 ${height * 0.18} L${w * 0.32} 0`, `M${w * 0.68} 0 L${w} ${height * 0.18}`,
    `M0 ${height * 0.82} L${w * 0.32} ${height}`, `M${w * 0.68} ${height} L${w} ${height * 0.82}`,
    `M0 ${height * 0.18} L${w * 0.5} ${height * 0.5} L${w} ${height * 0.18}`,
    `M0 ${height * 0.82} L${w * 0.5} ${height * 0.5} L${w} ${height * 0.82}`,
  ];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      <Svg width={w} height={height}>
        <Path d={lines.join(' ')} stroke={color} strokeOpacity={0.14} strokeWidth={1} fill="none" />
      </Svg>
    </View>
  );
}

/** The back of a card earned but not unveiled yet: its frame already tells the metal. */
export function BadgeCardBackFace({ tier, width, caption, name }: {
  tier: BadgeFinish;
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
  id: BadgeFamilyId;
  /** Tiers earned. */
  tier: BadgeTierLevel;
  /** The highest tier waits face down until it is turned over. */
  faceDown: boolean;
  /** How far along the next tier is; 100 once complete. */
  percent: number;
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
  id,
  tier: level,
  faceDown,
  percent,
  width,
  name,
  status,
  accessibilityLabel,
  newCaption,
  onPress,
  testID,
}: BadgeCardProps) {
  const family = getBadgeFamily(id)!;
  const tier = finishOf(family, level);
  const material = getBadgeMaterial(tier);
  const once = isFirstCard(family);

  return (
    <PressableScale
      onPress={() => onPress(id)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      haptic="light"
    >
      {faceDown && tier ? (
        <BadgeCardBackFace tier={tier} width={width} caption={newCaption} name={name} />
      ) : (
        <BadgeCardFrame tier={tier} width={width}>
          <View className="flex-1 items-center justify-center gap-2.5 px-2.5 pb-3 pt-3.5">
            <BadgeMedallion family={id} tier={tier} size={Math.round(width * 0.7)} veiled={!tier} small />
            <View className="w-full items-center gap-1.5">
              <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={{ color: tier ? COLLECTION.text : COLLECTION.muted }}
                className="text-center font-display-semibold text-body-sm leading-[18px]">
                {name}
              </Text>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={{ color: material.ink }}
                className="text-center font-sans-medium text-caption">
                {status}
              </Text>
              {/* A card earned once has nothing to fill and no tiers to light. */}
              {once ? null : (
                <>
                  <View className="h-[3px] w-[70%] overflow-hidden rounded-full" style={{ backgroundColor: COLLECTION.track }}>
                    <ProgressFill percent={percent} growOnMount={false} className="h-full rounded-full"
                      style={{ backgroundColor: material.ink }} />
                  </View>
                  <TierPips tier={level} count={family.thresholds.length} size={7} />
                </>
              )}
            </View>
          </View>
        </BadgeCardFrame>
      )}
    </PressableScale>
  );
});
