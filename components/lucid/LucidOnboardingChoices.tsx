import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, type ComponentProps } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { PressableScale } from '@/components/motion/PressableScale';
import { EASING } from '@/components/motion/motion';
import {
  getLucidPalette,
  LucidIcon,
  LucidRadius,
  LucidSpace,
  LucidType,
} from '@/constants/lucidTheme';
import { useTheme } from '@/context/ThemeContext';
import type { LucidExperienceLevel, LucidGoal } from '@/lib/lucid/model';

type GoalIconName = ComponentProps<typeof Feather>['name'];
type MomentKind = 'day' | 'night' | 'wake';

type Choice<Id extends string> = {
  id: Id;
  title: string;
  description: string;
};

const GOAL_ICONS: Record<LucidGoal, GoalIconName> = {
  first_lucid_dream: 'eye',
  improve_recall: 'book-open',
  more_frequent_lucidity: 'repeat',
  stabilize_lucidity: 'shield',
};

const GOAL_ANCHORS: Record<LucidGoal, ViewStyle> = {
  first_lucid_dream: { left: 0, top: '36%' },
  improve_recall: { right: 0, top: '36%' },
  more_frequent_lucidity: { left: 0, top: '55%' },
  stabilize_lucidity: { right: 0, top: '55%' },
};

const EXPERIENCE_ANCHORS: Record<LucidExperienceLevel, ViewStyle> = {
  beginner: { left: '51%', top: '69%' },
  occasional: { left: '55%', top: '45%' },
  experienced: { left: '57%', top: '25.5%' },
};

const ORB_SIZE = 64;
const EXPERIENCE_MOON = require('@/assets/images/lucid/onboarding/experience-moon.png');
const MOMENT_WAKE = require('@/assets/images/lucid/onboarding/moment-wake-sunrise.png');

export function LucidSegmentedProgress({
  current,
  label,
  total,
}: {
  current: number;
  label: string;
  total: number;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={styles.progress}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.progressSegment,
            { backgroundColor: index < current ? palette.accent : palette.border },
          ]}
        />
      ))}
    </View>
  );
}

export function LucidMomentPath() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const moments: readonly { kind: MomentKind; style: ViewStyle }[] = [
    { kind: 'day', style: { left: '15%', top: '48%' } },
    { kind: 'night', style: { left: '43%', top: '33%' } },
    { kind: 'wake', style: { left: '72%', top: '20%' } },
  ];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      {moments.map(({ kind, style }) => (
        <View
          key={kind}
          style={[styles.moment, style]}
        >
          {kind === 'night' ? (
            <View style={styles.momentMoon}>
              <Feather color={palette.accentStrong} name="moon" size={30} />
              <Ionicons
                color={palette.accentStrong}
                name="sparkles-outline"
                size={12}
                style={styles.momentMoonSparkles}
              />
            </View>
          ) : kind === 'wake' ? (
            <Image
              contentFit="contain"
              source={MOMENT_WAKE}
              style={styles.momentWakeIcon}
              tintColor={palette.accentStrong}
            />
          ) : (
            <Feather
              color={palette.accentStrong}
              name="sun"
              size={30}
            />
          )}
        </View>
      ))}
    </View>
  );
}

export function LucidGoalSelector({
  choices,
  label,
  onSelect,
  reduceMotion,
  selected,
  shortLabels,
  title,
}: {
  choices: readonly Choice<LucidGoal>[];
  label: string;
  onSelect: (value: LucidGoal) => void;
  reduceMotion: boolean;
  selected: LucidGoal | null;
  shortLabels: Record<LucidGoal, string>;
  title: string;
}) {
  const { fontScale, width } = useWindowDimensions();
  const reflow = width < 380 || fontScale >= 1.3;
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const artworkTextShadowColor = mode === 'dark'
    ? 'rgba(2, 8, 12, 0.94)'
    : 'rgba(255, 252, 244, 0.68)';

  return (
    <View style={styles.fill}>
      <Text
        accessibilityRole="header"
        style={[
          styles.sectionTitle,
          styles.goalArtworkText,
          { color: palette.text, textShadowColor: artworkTextShadowColor },
        ]}
      >
        {title}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={reflow ? styles.goalGrid : styles.fill}>
        {choices.map((choice) => (
          <PressableScale
            key={choice.id}
            accessibilityHint={choice.description}
            accessibilityLabel={choice.title}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === choice.id, selected: selected === choice.id }}
            haptic="selection"
            onPress={() => onSelect(choice.id)}
            scale={reduceMotion ? 1 : undefined}
            style={[
              styles.goalChoice,
              reflow ? styles.goalChoiceReflow : GOAL_ANCHORS[choice.id],
            ]}
            testID={`lucid-goal-${choice.id}`}
          >
            <SelectionOrb
              icon={GOAL_ICONS[choice.id]}
              reduceMotion={reduceMotion}
              reflow={reflow}
              selected={selected === choice.id}
            />
            <Text
              style={[
                styles.goalLabel,
                {
                  color: selected === choice.id
                    ? palette.accentStrong
                    : palette.text,
                  textShadowColor: artworkTextShadowColor,
                },
                styles.goalArtworkText,
              ]}
            >
              {shortLabels[choice.id]}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

export function LucidExperienceSelector({
  choices,
  hints,
  label,
  onSelect,
  question,
  reduceMotion,
  selected,
  startingPoint,
}: {
  choices: readonly Choice<LucidExperienceLevel>[];
  hints: Record<LucidExperienceLevel, string>;
  label: string;
  onSelect: (value: LucidExperienceLevel) => void;
  question: string;
  reduceMotion: boolean;
  selected: LucidExperienceLevel | null;
  startingPoint: string;
}) {
  const { fontScale, width } = useWindowDimensions();
  const reflow = width < 380 || fontScale >= 1.3;
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);

  return (
    <View style={styles.fill}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={reflow ? styles.experienceReflow : styles.fill}
      >
        {choices.map((choice) => {
          const isSelected = selected === choice.id;
          return (
            <PressableScale
              key={choice.id}
              accessibilityHint={choice.description}
              accessibilityLabel={choice.title}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, selected: isSelected }}
              haptic="selection"
              onPress={() => onSelect(choice.id)}
              scale={reduceMotion ? 1 : undefined}
              style={[
                styles.experienceChoice,
                reflow
                  ? styles.experienceChoiceReflow
                  : [styles.experienceChoiceStage, EXPERIENCE_ANCHORS[choice.id]],
              ]}
              testID={`lucid-experience-${choice.id}`}
            >
              <ExperienceMoon selected={isSelected} />
              <View
                style={[
                  styles.experienceCopy,
                  reflow ? styles.experienceCopyReflow : styles.experienceCopyStage,
                ]}
              >
                {isSelected ? (
                  <Text
                    style={[
                      styles.startingPoint,
                      !reflow && styles.experienceTextStage,
                      styles.experienceTextShadow,
                      { color: palette.accentStrong },
                    ]}
                  >
                    {startingPoint}
                  </Text>
                ) : (
                  <View style={styles.startingPointSpacer} />
                )}
                <Text
                  adjustsFontSizeToFit={!reflow}
                  minimumFontScale={0.82}
                  numberOfLines={reflow ? undefined : 1}
                  style={[
                    styles.experienceTitle,
                    !reflow && styles.experienceTextStage,
                    styles.experienceTextShadow,
                    { color: palette.text },
                  ]}
                >
                  {choice.title}
                </Text>
                <Text
                  style={[
                    styles.experienceHint,
                    !reflow && styles.experienceTextStage,
                    styles.experienceTextShadow,
                    { color: isSelected ? palette.accentStrong : palette.textSecondary },
                  ]}
                >
                  {hints[choice.id]}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
      <Text
        accessibilityRole="header"
        style={[styles.experienceQuestion, styles.experienceTextShadow, { color: palette.text }]}
      >
        {question}
      </Text>
    </View>
  );
}

export function LucidRhythmSelector({
  daysLabel,
  label,
  onSelect,
  recommended,
  reduceMotion,
  selected,
  subtitle,
  title,
}: {
  daysLabel: (value: number) => string;
  label: string;
  onSelect: (value: number) => void;
  recommended: string;
  reduceMotion: boolean;
  selected: number;
  subtitle: string;
  title: string;
}) {
  const { fontScale, width } = useWindowDimensions();
  const reflow = width < 380 || fontScale >= 1.3;
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const values = [2, 3, 5, 7] as const;

  return (
    <View style={[styles.rhythmContent, reflow && styles.rhythmContentReflow]}>
      <Text accessibilityRole="header" style={[styles.rhythmTitle, { color: palette.text }]}>
        {title}
      </Text>
      <Text style={[styles.rhythmSubtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.rhythmRow, reflow && styles.rhythmGrid]}>
        {values.map((value, index) => {
          const isSelected = selected === value;
          return (
            <PressableScale
              key={value}
              accessibilityLabel={daysLabel(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, selected: isSelected }}
              haptic="selection"
              onPress={() => onSelect(value)}
              scale={reduceMotion ? 1 : undefined}
              style={[styles.rhythmChoice, reflow && styles.rhythmChoiceReflow]}
              testID={`lucid-weekly-target-${value}`}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.rhythmOrb,
                  {
                    backgroundColor: isSelected ? palette.accentSoft : palette.surfaceMuted,
                    borderColor: isSelected ? palette.accentStrong : palette.borderInteractive,
                  },
                ]}
              >
                <View style={styles.starRow}>
                  {Array.from({ length: index + 1 }, (_, starIndex) => (
                    <Ionicons
                      color={isSelected ? palette.accentStrong : palette.textSecondary}
                      key={starIndex}
                      name="star"
                      size={index > 2 ? 10 : LucidIcon.sm}
                    />
                  ))}
                </View>
                {isSelected ? (
                  <View style={[styles.choiceBadge, { backgroundColor: palette.accentStrong }]}>
                    <Ionicons color={palette.backgroundDeep} name="checkmark" size={LucidIcon.sm} />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.rhythmLabel, { color: isSelected ? palette.accentStrong : palette.textSecondary }]}>
                {daysLabel(value)}
              </Text>
              {value === 3 ? (
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.76}
                  numberOfLines={1}
                  style={[styles.recommended, { color: palette.accentStrong }]}
                >
                  {recommended}
                </Text>
              ) : (
                <View style={styles.recommendedSpacer} />
              )}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function SelectionOrb({
  icon,
  reduceMotion,
  reflow,
  selected,
}: {
  icon: GoalIconName;
  reduceMotion: boolean;
  reflow: boolean;
  selected: boolean;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const artworkShadowColor = mode === 'dark'
    ? 'rgba(3, 11, 16, 0.5)'
    : 'rgba(255, 252, 244, 0.64)';

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.orbFrame}
    >
      {selected && !reflow ? <EnergyBubble reduceMotion={reduceMotion} /> : null}
      <View
        style={[
          styles.orb,
          !reflow && styles.goalWaypointOrb,
          selected && !reflow && styles.goalWaypointActiveOrb,
          {
            backgroundColor: reflow
              ? selected
                ? palette.accentSoft
                : palette.surfaceMuted
              : 'transparent',
            borderColor: selected
              ? palette.accentStrong
              : reflow
                ? palette.borderInteractive
                : 'transparent',
          },
        ]}
      >
        <Feather
          color={reflow
            ? selected
              ? palette.accentStrong
              : palette.textSecondary
            : selected
              ? palette.text
              : palette.text}
          name={icon}
          size={reflow ? LucidIcon.xl : selected ? LucidIcon.lg : LucidIcon.md}
          style={[
            !reflow && !selected ? styles.goalWaypointInactiveIcon : styles.goalWaypointIcon,
            !reflow && { textShadowColor: artworkShadowColor },
          ]}
        />
      </View>
      {selected && reflow ? (
        <View
          style={[
            styles.choiceBadge,
            { backgroundColor: palette.accentStrong },
          ]}
        >
          <Ionicons
            color={palette.backgroundDeep}
            name="checkmark"
            size={LucidIcon.sm}
          />
        </View>
      ) : null}
    </View>
  );
}

function EnergyBubble({ reduceMotion }: { reduceMotion: boolean }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const systemReducedMotion = useReducedMotion();
  const motionReduced = reduceMotion || systemReducedMotion;
  const pulse = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(pulse);

    if (motionReduced) {
      pulse.set(0);
      return;
    }

    pulse.set(
      withRepeat(
        withTiming(1, { duration: 2200, easing: EASING.inOut }),
        2,
        true
      )
    );

    return () => cancelAnimation(pulse);
  }, [motionReduced, pulse]);

  const energyStyle = useAnimatedStyle(() => {
    const phase = pulse.get();
    return {
      opacity: motionReduced ? 0.96 : 0.9 + phase * 0.1,
      transform: [
        { translateY: 8 },
        { scale: motionReduced ? 1 : 0.99 + phase * 0.02 },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.energyBubble, energyStyle]}>
      <Svg height={66} viewBox="0 0 86 66" width={86}>
        <Defs>
          <RadialGradient id="energyCore" cx="50%" cy="52%" rx="48%" ry="38%">
            <Stop offset="0" stopColor={palette.text} stopOpacity={0.22} />
            <Stop offset="0.42" stopColor={palette.accentStrong} stopOpacity={0.26} />
            <Stop offset="0.78" stopColor={palette.accent} stopOpacity={0.08} />
            <Stop offset="1" stopColor={palette.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="energyHalo" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={palette.accentStrong} stopOpacity={0.28} />
            <Stop offset="0.62" stopColor={palette.accent} stopOpacity={0.12} />
            <Stop offset="1" stopColor={palette.accent} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="energyRim" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={palette.text} stopOpacity={0.52} />
            <Stop offset="0.46" stopColor={palette.accentStrong} stopOpacity={0.9} />
            <Stop offset="1" stopColor={palette.accent} stopOpacity={0.32} />
          </LinearGradient>
        </Defs>

        <Ellipse cx={43} cy={34} fill="url(#energyHalo)" rx={42} ry={27} />
        <Ellipse
          cx={43}
          cy={34}
          fill="url(#energyCore)"
          rx={35}
          ry={20}
          stroke="url(#energyRim)"
          strokeWidth={1.5}
        />
        <Ellipse
          cx={43}
          cy={35}
          fill="none"
          rx={30}
          ry={16}
          stroke={palette.text}
          strokeDasharray="34 112"
          strokeLinecap="round"
          strokeOpacity={0.5}
          strokeWidth={1}
          transform="rotate(-8 43 35)"
        />
        <Path
          d="M14 36 C22 48 36 52 52 48"
          fill="none"
          stroke={palette.accentStrong}
          strokeLinecap="round"
          strokeOpacity={0.46}
          strokeWidth={1}
        />
        <Path
          d="M22 22 C31 14 45 13 57 18"
          fill="none"
          stroke={palette.text}
          strokeLinecap="round"
          strokeOpacity={0.38}
          strokeWidth={1}
        />
        <Path
          d="M43 45 C39 51 47 54 43 62"
          fill="none"
          stroke={palette.accentStrong}
          strokeLinecap="round"
          strokeOpacity={0.72}
          strokeWidth={1.1}
        />
        <Ellipse
          cx={43}
          cy={56}
          fill={palette.text}
          fillOpacity={0.08}
          rx={24}
          ry={5}
          stroke={palette.accentStrong}
          strokeOpacity={0.34}
          strokeWidth={0.8}
        />
        <Path
          d="M66 31 L67 34.2 L70 35.5 L67 36.8 L66 40 L65 36.8 L62 35.5 L65 34.2 Z"
          fill={palette.text}
          fillOpacity={0.82}
        />
        <Circle cx={67} cy={18} fill={palette.text} r={1.1} />
        <Circle cx={17} cy={29} fill={palette.accentStrong} r={0.9} />
        <Circle cx={25} cy={51} fill={palette.text} fillOpacity={0.62} r={0.8} />
      </Svg>
    </Animated.View>
  );
}

function ExperienceMoon({ selected }: { selected: boolean }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.experienceMoonFrame}
    >
      {selected ? (
        <>
          <View style={[styles.experienceMoonGlow, { backgroundColor: palette.accent }]} />
          <View style={[styles.experienceMoonRing, { borderColor: palette.accentStrong }]} />
        </>
      ) : null}
      <Image contentFit="contain" source={EXPERIENCE_MOON} style={styles.experienceMoon} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, position: 'relative' },
  progress: { width: 152, flexDirection: 'row', gap: LucidSpace.sm },
  progressSegment: { flex: 1, height: 4, borderRadius: LucidRadius.full },
  moment: {
    position: 'absolute',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentMoon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentMoonSparkles: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  momentWakeIcon: {
    width: 40,
    height: 40,
  },
  sectionTitle: {
    position: 'absolute',
    top: LucidSpace.xs,
    left: 0,
    right: 0,
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: LucidType.h2[0],
    lineHeight: LucidType.h2[1],
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'space-between',
    gap: LucidSpace.md,
    paddingTop: 76,
    paddingBottom: LucidSpace.xl,
  },
  goalChoice: {
    position: 'absolute',
    width: '44%',
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: LucidSpace.sm,
  },
  goalChoiceReflow: { position: 'relative', width: '46%', top: undefined, left: undefined, right: undefined },
  goalLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
    textAlign: 'center',
  },
  goalArtworkText: {
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  orbFrame: { width: ORB_SIZE + 8, height: ORB_SIZE + 8, alignItems: 'center', justifyContent: 'center' },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: LucidRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalWaypointOrb: { borderWidth: 0 },
  goalWaypointActiveOrb: { transform: [{ translateY: 8 }] },
  goalWaypointIcon: {
    textShadowColor: 'rgba(3, 11, 16, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  goalWaypointInactiveIcon: {
    opacity: 0.82,
    textShadowColor: 'rgba(3, 11, 16, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  energyBubble: {
    position: 'absolute',
    left: -7,
    top: 3,
    width: 86,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: LucidRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  experienceReflow: { gap: LucidSpace.sm, paddingTop: LucidSpace.md },
  experienceMoonFrame: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  experienceMoonGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: LucidRadius.full,
    opacity: 0.18,
  },
  experienceMoonRing: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: LucidRadius.full,
    borderWidth: 3,
  },
  experienceMoon: { width: 60, height: 60 },
  experienceChoice: {
    minHeight: 88,
  },
  experienceChoiceStage: {
    position: 'absolute',
    width: 160,
    minHeight: 126,
    transform: [{ translateX: -80 }],
    alignItems: 'center',
  },
  experienceChoiceReflow: {
    position: 'relative',
    width: '100%',
    top: undefined,
    left: undefined,
    right: undefined,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.md,
  },
  experienceCopy: { minWidth: 0 },
  experienceCopyReflow: { flex: 1 },
  experienceCopyStage: { width: '100%', alignItems: 'center' },
  experienceTextStage: { textAlign: 'center' },
  startingPoint: {
    minHeight: LucidType.overline[1],
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  startingPointSpacer: { minHeight: LucidType.overline[1] },
  experienceTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: LucidType.h2[0],
    lineHeight: LucidType.h2[1],
  },
  experienceHint: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  experienceTextShadow: {
    textShadowColor: 'rgba(2, 8, 12, 0.94)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  experienceQuestion: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '92%',
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: LucidType.h1[0],
    lineHeight: LucidType.h1[1],
    letterSpacing: -0.5,
  },
  rhythmContent: { position: 'absolute', left: 0, right: 0, bottom: LucidSpace.gutter + LucidSpace.xl, alignItems: 'center' },
  rhythmContentReflow: { position: 'relative', paddingTop: '62%' },
  rhythmTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: LucidType.h1[0],
    lineHeight: LucidType.h1[1],
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  rhythmSubtitle: {
    marginTop: LucidSpace.xs,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
    textAlign: 'center',
  },
  rhythmRow: { width: '100%', marginTop: LucidSpace.lg, flexDirection: 'row', justifyContent: 'space-between' },
  rhythmGrid: { flexWrap: 'wrap', rowGap: LucidSpace.md },
  rhythmChoice: { width: '24%', minHeight: 116, alignItems: 'center', gap: LucidSpace.xs },
  rhythmChoiceReflow: { width: '48%' },
  rhythmOrb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: LucidRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  rhythmLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
    textAlign: 'center',
  },
  recommended: {
    minHeight: LucidType.overline[1],
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.overline[0],
    lineHeight: LucidType.overline[1],
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  recommendedSpacer: { minHeight: LucidType.overline[1] },
});
