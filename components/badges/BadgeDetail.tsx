import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { sparklePath } from '@/components/journal/story/sparkle';
import { DURATION, EASING, PressableScale, ProgressFill, Reveal, SPRING } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useContentWindow } from '@/context/ContentWindowContext';
import { BADGE_TIERS, type BadgeFamilyId, type BadgeTierLevel } from '@/lib/badges/catalog';
import { nextTierPercent, type BadgeFamilyState } from '@/lib/badges/ledger';
import type { TranslateFunction as Translate } from '@/lib/errors';

import { BADGE_CARD_RATIO, BadgeCardBackFace, BadgeCardFrame, TierPips } from './BadgeCard';
import { BadgeMedallion } from './BadgeMedallion';
import { badgeActionLabel, badgeGoal, badgeName, badgeProgressText, badgeRule, badgeTierName } from './badgeCopy';
import { COLLECTION, getBadgeMaterial, NIGHT_ACTION, tierOfLevel } from './badgeMaterials';

type Props = {
  state: BadgeFamilyState;
  t: Translate;
  formatNumber: (value: number) => string;
  formatDate: (value: number, options?: Intl.DateTimeFormatOptions) => string;
  onClose: () => void;
  onReveal: (id: BadgeFamilyId, tier: BadgeTierLevel) => void;
  onAction: (state: BadgeFamilyState) => void;
};

/** Degrees the card leans at full tilt, sideways and back. */
const TILT_Y = 14;
const TILT_X = 11;
/** The finger travel, in points, that leans it all the way. */
const TILT_TRAVEL = 140;
const FLIP_MS = 720;
const BURST = 10;

const clamp = (value: number) => {
  'worklet';
  return Math.max(-1, Math.min(1, value));
};

/**
 * One family held in the hand: its card large enough to see the metal, leaning under the
 * finger so its light moves, its three tiers side by side and the next step. A tier newly
 * earned waits face down and turns over when touched.
 */
export function BadgeDetail({ state, t, formatNumber, formatDate, onClose, onReveal, onAction }: Props) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useContentWindow();
  const family = state.family;
  const name = badgeName(t, family.id);
  const heldTier = tierOfLevel(state.tier);
  const [faceDown, setFaceDown] = useState(state.unrevealed > 0 && heldTier !== null);
  // The back stays under the front once turned here, so the turn plays to its end.
  const [arrivedFaceDown] = useState(faceDown);
  const [shownLevel, setShownLevel] = useState<1 | 2 | 3>(state.tier === 0 ? 1 : state.tier);
  const shownTier = BADGE_TIERS[shownLevel - 1];
  const shownVeiled = shownLevel > state.tier;
  const cardWidth = Math.round(Math.max(200, Math.min(width - 72, 300, (height - insets.top - 220) * 0.62)));

  const flip = useSharedValue(faceDown ? 0 : 1);
  const lightX = useSharedValue(reduced ? -0.2 : -1);
  const lightY = useSharedValue(0);
  const burst = useSharedValue(0);

  // On arrival the light runs once across the metal, then rests where a hand would hold it.
  // A card arriving face down plays it as it turns over instead.
  useEffect(() => {
    if (reduced || arrivedFaceDown) return;
    lightX.set(withDelay(240, withTiming(0.25, { duration: 1100, easing: EASING.out })));
  }, [arrivedFaceDown, lightX, reduced]);

  // A screen reader lands on the card held, or on its back while it waits to be turned. Both
  // refs stay attached from mount: an animated view does not take a ref that changes later.
  const backRef = useRef<React.ComponentRef<typeof View>>(null);
  const frontRef = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    const target = (faceDown ? backRef : frontRef).current;
    if (!target) return;
    // The web has no node handles: the element itself takes the focus.
    if (Platform.OS === 'web') {
      (target as unknown as { focus?: () => void }).focus?.();
      return;
    }
    const node = findNodeHandle(target);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [faceDown]);

  // Turned over once: the ledger keeps it unveiled from now on.
  const reveal = () => {
    if (!faceDown) return;
    setFaceDown(false);
    setShownLevel(state.tier === 0 ? 1 : state.tier);
    onReveal(family.id, state.tier);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    if (reduced) {
      flip.set(withTiming(1, { duration: DURATION.fast }));
      return;
    }
    flip.set(withTiming(1, { duration: FLIP_MS, easing: EASING.inOut }));
    lightX.set(-1);
    lightX.set(withDelay(FLIP_MS * 0.6, withTiming(0.25, { duration: 1100, easing: EASING.out })));
    burst.set(0);
    burst.set(withDelay(FLIP_MS * 0.45, withTiming(1, { duration: 900, easing: EASING.out })));
  };

  const pan = Gesture.Pan()
    .enabled(!reduced && !faceDown)
    // A sideways hand leans the card; one moving up or down scrolls the page instead.
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      lightX.set(clamp(event.translationX / TILT_TRAVEL));
      lightY.set(clamp(event.translationY / TILT_TRAVEL));
    })
    .onFinalize(() => {
      lightX.set(withSpring(0.25, SPRING.snapBack));
      lightY.set(withSpring(0, SPRING.snapBack));
    });

  const leanStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${reduced ? 0 : (lightX.get() - 0.25) * TILT_Y}deg` },
      { rotateX: `${reduced ? 0 : -lightY.get() * TILT_X}deg` },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 1 - flip.get() : flip.get() < 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${reduced ? 0 : interpolate(flip.get(), [0, 0.5], [0, 90], 'clamp')}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: reduced ? flip.get() : flip.get() >= 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${reduced ? 0 : interpolate(flip.get(), [0.5, 1], [-90, 0], 'clamp')}deg` }],
  }));

  const nextLevel = state.tier < 3 ? ((state.tier + 1) as 1 | 2 | 3) : null;
  const percent = nextTierPercent(state);
  const remaining = state.nextThreshold == null ? 0 : Math.max(0, state.nextThreshold - state.progress);
  const remainingText = t(remaining === 1 ? 'badges.detail.remaining_one' : 'badges.detail.remaining', { count: formatNumber(remaining) });
  const earnedOn = (level: number) => {
    const at = state.earnedAt[level - 1];
    return at ? t('badges.detail.earned_on', {
      tier: badgeTierName(t, BADGE_TIERS[level - 1]),
      date: formatDate(at, { day: 'numeric', month: 'long', year: 'numeric' }),
    }) : null;
  };
  const cardHeight = Math.round(cardWidth / BADGE_CARD_RATIO);
  const shownMaterial = getBadgeMaterial(shownVeiled ? null : shownTier);

  return (
    <View
      className="absolute inset-0"
      accessibilityViewIsModal
      onAccessibilityEscape={onClose}
      testID="collection.detail"
      style={{ backgroundColor: COLLECTION.scrim }}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32, alignItems: 'center', gap: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: cardWidth, minHeight: cardHeight }}>
          {/* The face not shown is hidden from assistive technology on every platform (the web
              reads aria-hidden), and the turned back is no longer a button to tab to. */}
          {arrivedFaceDown ? (
            <Animated.View style={[{ position: faceDown ? 'relative' : 'absolute', inset: faceDown ? undefined : 0 }, backStyle]}
              pointerEvents={faceDown ? 'auto' : 'none'} aria-hidden={!faceDown}
              accessibilityElementsHidden={!faceDown} importantForAccessibility={faceDown ? 'auto' : 'no-hide-descendants'}>
              <PressableScale ref={backRef} onPress={reveal} disabled={!faceDown} haptic="medium" accessibilityRole="button"
                accessibilityLabel={t('badges.a11y.new_card', { name, tier: heldTier ? badgeTierName(t, heldTier) : '' })}
                accessibilityHint={t('badges.detail.reveal_hint')} testID="collection.detail.reveal">
                <BadgeCardBackFace tier={heldTier ?? 'bronze'} width={cardWidth} caption={t('badges.detail.reveal')} />
              </PressableScale>
            </Animated.View>
          ) : null}
          <Animated.View style={[faceDown ? { position: 'absolute', inset: 0 } : null, frontStyle]} pointerEvents={faceDown ? 'none' : 'auto'}
            aria-hidden={faceDown} accessibilityElementsHidden={faceDown} importantForAccessibility={faceDown ? 'no-hide-descendants' : 'auto'}>
            {/* The image a screen reader or the keyboard lands on is a plain view with a stable
                ref, so the web hands it the element. The web focuses only an element with a tab
                index; -1 adds no tab stop. */}
            <View ref={frontRef} accessible accessibilityRole="image"
              tabIndex={Platform.OS === 'web' ? -1 : undefined}
              accessibilityLabel={shownVeiled
                ? t('badges.a11y.preview', { name, tier: badgeTierName(t, shownTier) })
                : `${name}, ${badgeTierName(t, shownTier)}`}>
            <GestureDetector gesture={pan}>
              <Animated.View style={leanStyle}>
                <BadgeCardFrame tier={shownVeiled ? null : shownTier} width={cardWidth}
                  light={reduced ? null : { x: lightX, y: lightY }}>
                  <View className="flex-1 items-center justify-center gap-5 px-4 pb-6 pt-7">
                    <BadgeMedallion family={family.id} tier={shownTier} size={Math.round(cardWidth * 0.78)} veiled={shownVeiled}
                      light={reduced ? null : { x: lightX, y: lightY }} />
                    <View className="items-center gap-2">
                      <Ornament color={shownMaterial.ink} width={cardWidth * 0.5} />
                      <Text style={{ color: COLLECTION.text }} maxFontSizeMultiplier={1.3}
                        className="text-center font-display-semibold text-h2">
                        {name}
                      </Text>
                      <Text style={{ color: shownMaterial.ink }} maxFontSizeMultiplier={1.3}
                        className="text-center font-sans-medium text-overline uppercase tracking-[1.6px]">
                        {shownVeiled ? t('badges.detail.to_reach', { tier: badgeTierName(t, shownTier) }) : badgeTierName(t, shownTier)}
                      </Text>
                    </View>
                  </View>
                </BadgeCardFrame>
              </Animated.View>
            </GestureDetector>
            </View>
          </Animated.View>
          {!reduced ? <RevealBurst progress={burst} width={cardWidth} height={cardHeight} color={getBadgeMaterial(heldTier).ink} /> : null}
        </View>

        {!faceDown ? (
          <Reveal className="w-full max-w-[420px] gap-5 px-6">
            <View className="flex-row justify-center gap-3" accessibilityRole="radiogroup">
              {BADGE_TIERS.map((tier, index) => {
                const level = (index + 1) as 1 | 2 | 3;
                const earned = level <= state.tier;
                const selected = level === shownLevel;
                const material = getBadgeMaterial(earned ? tier : null);
                // The web reads the ARIA prop, not accessibilityState; native reads both.
                return (
                  <PressableScale key={tier} onPress={() => setShownLevel(level)} haptic="selection"
                    accessibilityRole="radio" accessibilityState={{ selected }} aria-checked={selected}
                    accessibilityLabel={`${badgeTierName(t, tier)}. ${badgeGoal(t, family, level, formatNumber)}. ${earned ? earnedOn(level) ?? t('badges.a11y.held', { tier: badgeTierName(t, tier) }) : t('badges.detail.not_yet')}`}
                    testID={`collection.detail.tier.${tier}`}
                    className="flex-1 items-center gap-1.5 rounded-[16px] border px-1.5 pb-2.5 pt-3"
                    style={{
                      borderColor: selected ? getBadgeMaterial(tier).frame[1] : COLLECTION.hairline,
                      backgroundColor: selected ? COLLECTION.chosen : 'transparent',
                    }}>
                    <BadgeMedallion family={family.id} tier={tier} size={46} veiled={!earned} small />
                    <Text style={{ color: material.ink }} maxFontSizeMultiplier={1.4}
                      className="font-sans-bold text-caption uppercase tracking-[1px]">
                      {badgeTierName(t, tier)}
                    </Text>
                    <Text style={{ color: COLLECTION.muted }} maxFontSizeMultiplier={1.4} className="text-center font-sans text-caption">
                      {badgeGoal(t, family, level, formatNumber)}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            <View className="gap-2.5">
              {nextLevel ? (
                <>
                  <View className="flex-row items-baseline justify-between gap-3">
                    <Text style={{ color: COLLECTION.text }} className="min-w-0 shrink font-sans-bold text-body">
                      {t('badges.detail.next', { tier: badgeTierName(t, BADGE_TIERS[nextLevel - 1]) })}
                    </Text>
                    <Text style={{ color: getBadgeMaterial(BADGE_TIERS[nextLevel - 1]).ink }} className="font-sans-medium text-body-sm">
                      {badgeProgressText(t, state, formatNumber)}
                    </Text>
                  </View>
                  <View accessible accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(100, Math.max(0, percent))) }}
                    accessibilityLabel={remainingText}
                    className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: COLLECTION.track }}>
                    <ProgressFill percent={percent} className="h-full rounded-full"
                      style={{ backgroundColor: getBadgeMaterial(BADGE_TIERS[nextLevel - 1]).ink }} />
                  </View>
                  <Text style={{ color: COLLECTION.muted }} className="font-sans text-body-sm">
                    {badgeGoal(t, family, nextLevel, formatNumber)}
                    {' · '}
                    {remainingText}
                  </Text>
                </>
              ) : (
                <View className="flex-row items-center gap-3">
                  <TierPips tier={3} />
                  <Text style={{ color: COLLECTION.gold.ink }} className="min-w-0 shrink font-sans-bold text-body">
                    {t('badges.detail.complete')}
                  </Text>
                </View>
              )}
              {state.tier > 0 ? (
                <Text style={{ color: COLLECTION.muted }} className="font-sans text-caption">
                  {earnedOn(state.tier)}
                </Text>
              ) : null}
            </View>

            <Text style={{ color: COLLECTION.text }} className="font-sans text-body">
              {badgeRule(t, family.id)}
            </Text>

            <PressableScale onPress={() => onAction(state)} haptic="light" accessibilityRole="button"
              testID="collection.detail.action"
              className="min-h-[50px] flex-row items-center justify-center gap-2 rounded-[18px] border px-5"
              style={{ backgroundColor: NIGHT_ACTION.primary, borderColor: NIGHT_ACTION.primaryBorder }}>
              <Text style={{ color: NIGHT_ACTION.primaryText }} className="font-sans-bold text-body">{badgeActionLabel(t, family.action)}</Text>
            </PressableScale>
          </Reveal>
        ) : (
          <Text style={{ color: COLLECTION.muted }} className="px-8 text-center font-sans text-body">
            {t('badges.detail.reveal_hint')}
          </Text>
        )}
      </ScrollView>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('badges.detail.close')}
        testID="collection.detail.close" hitSlop={8}
        className="absolute h-11 w-11 items-center justify-center rounded-full border"
        style={{ top: insets.top + 8, right: 16, borderColor: COLLECTION.hairlineStrong, backgroundColor: COLLECTION.button }}>
        <IconSymbol name="xmark" size={18} color={COLLECTION.text} />
      </Pressable>
    </View>
  );
}

/** A thin rule with a star at its heart, between the medallion and the card's name. */
function Ornament({ color, width }: { color: string; width: number }) {
  const half = Math.max(0, (width - 18) / 2);
  return (
    <View className="flex-row items-center gap-1.5" accessible={false}>
      <View style={{ width: half, height: 1, backgroundColor: color, opacity: 0.5 }} />
      <Svg width={12} height={12}>
        <Path d={sparklePath(6, 6, 6)} fill={color} />
      </Svg>
      <View style={{ width: half, height: 1, backgroundColor: color, opacity: 0.5 }} />
    </View>
  );
}

/** Small stars flung from the card as it turns over, once. */
function RevealBurst({ progress, width, height, color }: {
  progress: SharedValue<number>;
  width: number;
  height: number;
  color: string;
}) {
  return (
    <View pointerEvents="none" className="absolute inset-0" accessible={false}>
      {Array.from({ length: BURST }, (_, index) => (
        <BurstStar key={index} index={index} progress={progress} width={width} height={height} color={color} />
      ))}
    </View>
  );
}

function BurstStar({ index, progress, width, height, color }: {
  index: number;
  progress: SharedValue<number>;
  width: number;
  height: number;
  color: string;
}) {
  const angle = (index / BURST) * Math.PI * 2 + (index % 2) * 0.3;
  const reach = Math.max(width, height) * (0.55 + (index % 3) * 0.08);
  const size = 10 + (index % 3) * 4;
  const style = useAnimatedStyle(() => {
    const value = progress.get();
    return {
      opacity: value <= 0 || value >= 1 ? 0 : Math.sin(value * Math.PI),
      transform: [
        { translateX: Math.cos(angle) * reach * value },
        { translateY: Math.sin(angle) * reach * value },
        { scale: 0.4 + value * 0.8 },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: width / 2 - size, top: height / 2 - size }, style]}>
      <Svg width={size * 2} height={size * 2}>
        <Path d={sparklePath(size, size, size)} fill={color} />
      </Svg>
    </Animated.View>
  );
}
