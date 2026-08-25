import * as Haptics from 'expo-haptics';
import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { ScopedTheme } from 'uniwind';

import { Text } from '@/components/ui';
import { Curve, Duration } from '@/constants/motion';
import { FontFamily } from '@/constants/typography';
import { NightTheme } from '@/constants/theme';
import { usePressMotion } from '@/hooks/usePressMotion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { ExperienceLevel } from '@/lib/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const BASE_WIDTH = 390;
const BASE_HEIGHT = 540;
const PANEL_Y = [14, 184, 370] as const;

const STAGE_GEOMETRY = [
  { top: 48, height: 112, imageLeft: 53, imageTop: 8, size: 68, textLeft: 143, textTop: 20 },
  {
    top: 194,
    height: 180,
    imageLeft: 39,
    imageTop: 34,
    size: 98,
    textLeft: 176,
    textTop: 57,
  },
  {
    top: 409,
    height: 118,
    imageLeft: 42,
    imageTop: 10,
    size: 92,
    textLeft: 144,
    textTop: 23,
  },
] as const;

export type ExperienceJourneyItem = {
  artwork: ImageProps['source'];
  hint: string;
  label: string;
  level: ExperienceLevel;
  testID?: string;
};

type Props = {
  items: readonly ExperienceJourneyItem[];
  onSelect: (level: ExperienceLevel) => void;
  selected: ExperienceLevel | null;
};

type StageProps = {
  geometry: (typeof STAGE_GEOMETRY)[number];
  item: ExperienceJourneyItem;
  onPress: () => void;
  scale: number;
  selected: boolean;
};

function ExperienceStage({ geometry, item, onPress, scale, selected }: StageProps) {
  const reducedMotion = useReducedMotion();
  const selection = useSharedValue(selected ? 1 : 0);
  const { style: pressStyle, handlePressIn, handlePressOut } = usePressMotion({
    surface: 'card',
  });

  useEffect(() => {
    selection.set(
      reducedMotion
        ? selected
          ? 1
          : 0
        : withTiming(selected ? 1 : 0, {
            duration: Duration.fast,
            easing: Curve.standard,
          })
    );
  }, [reducedMotion, selected, selection]);

  const artworkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(selection.get(), [0, 1], [0.82, 1]),
    transform: [
      { scale: reducedMotion ? 1 : interpolate(selection.get(), [0, 1], [1, 1.025]) },
    ],
  }));

  const ruleStyle = useAnimatedStyle(() => ({ opacity: selection.get() }));

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <AnimatedPressable
      testID={item.testID}
      accessibilityRole="radio"
      accessibilityLabel={`${item.label}. ${item.hint}`}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      pressRetentionOffset={12}
      style={[
        styles.stage,
        {
          height: geometry.height * scale,
          top: geometry.top * scale,
        },
        pressStyle,
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.artwork,
          selected ? styles.selectedArtwork : null,
          {
            borderRadius: (geometry.size * scale) / 2,
            height: geometry.size * scale,
            left: geometry.imageLeft * scale,
            top: geometry.imageTop * scale,
            width: geometry.size * scale,
          },
          artworkStyle,
        ]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.artworkClip,
            { borderRadius: (geometry.size * scale) / 2 },
          ]}>
          <Image
            accessible={false}
            source={item.artwork}
            contentFit="cover"
            recyclingKey={`experience-${item.level}`}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </Animated.View>

      <View
        pointerEvents="none"
        style={{
          left: geometry.textLeft * scale,
          position: 'absolute',
          right: 18 * scale,
          top: geometry.textTop * scale,
        }}>
        <Text variant="h2" numberOfLines={1} style={styles.label}>
          {item.label}
        </Text>
        <Text variant="bodySm" numberOfLines={2} className="mt-2" style={styles.hint}>
          {item.hint}
        </Text>
        <Animated.View
          style={[styles.selectionRule, { marginTop: 12 * scale }, ruleStyle]}
        />
      </View>
    </AnimatedPressable>
  );
}

/**
 * The selected mock is deliberately treated as a measured canvas: the path,
 * three progressive artworks and the expanding capsule all share one 390 pt
 * coordinate system. Only the scale changes with the viewport.
 */
export function ExperienceJourney({ items, onSelect, selected }: Props) {
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const canvasWidth = Math.min(width, 480);
  const scale = canvasWidth / BASE_WIDTH;
  const selectedIndex = selected ? items.findIndex((item) => item.level === selected) : 1;
  const panelY = useSharedValue<number>(PANEL_Y[selectedIndex]);
  const visible = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const move = (value: number) =>
      reducedMotion
        ? value
        : withTiming(value, { duration: Duration.fast, easing: Curve.move });

    panelY.set(move(PANEL_Y[selectedIndex]));
    visible.set(
      reducedMotion
        ? selected
          ? 1
          : 0
        : withTiming(selected ? 1 : 0, {
            duration: Duration.fast,
            easing: Curve.standard,
          })
    );
  }, [panelY, reducedMotion, selected, selectedIndex, visible]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: visible.get(),
    transform: [{ translateY: panelY.get() * scale }],
  }));

  return (
    <ScopedTheme theme="dark">
      <View style={{ height: BASE_HEIGHT * scale, width: canvasWidth }}>
        <Svg
          pointerEvents="none"
          width={canvasWidth}
          height={BASE_HEIGHT * scale}
          viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
          style={StyleSheet.absoluteFill}>
          <Path
            d="M90 0 C88 70 91 106 111 143 C140 194 156 218 147 253 C137 298 106 342 95 387 C88 417 92 463 96 520"
            fill="none"
            stroke={NightTheme.accent}
            strokeOpacity={0.92}
            strokeWidth={1.25}
          />
          <Circle cx={91} cy={48} r={3} fill={NightTheme.accentLight} opacity={0.86} />
          <Circle cx={96} cy={520} r={2.5} fill={NightTheme.accent} opacity={0.58} />
        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.selectionPanel,
            {
              borderRadius: 88 * scale,
              height: 178 * scale,
              left: 20 * scale,
              right: 20 * scale,
            },
            panelStyle,
          ]}>
          <LinearGradient
            colors={[
              'rgba(212, 165, 116, 0.08)',
              'rgba(212, 165, 116, 0.28)',
              'rgba(212, 165, 116, 0.66)',
            ]}
            locations={[0, 0.38, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.selectionSurface,
              {
                borderRadius: 87 * scale,
                bottom: 1,
                left: 1,
                right: 1,
                top: 1,
              },
            ]}>
            <LinearGradient
            colors={[
              'rgba(212, 165, 116, 0.13)',
              'rgba(20, 18, 40, 0.025)',
              'rgba(20, 18, 40, 0)',
            ]}
            locations={[0, 0.46, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            />
          </View>
        </Animated.View>

        {items.map((item, index) => (
          <ExperienceStage
            key={item.level}
            geometry={STAGE_GEOMETRY[index]}
            item={item}
            selected={selected === item.level}
            scale={scale}
            onPress={() => onSelect(item.level)}
          />
        ))}

      </View>
    </ScopedTheme>
  );
}

const styles = StyleSheet.create({
  artwork: {
    boxShadow: '0 0 12px rgba(212, 165, 116, 0.16)',
    position: 'absolute',
  },
  artworkClip: {
    overflow: 'hidden',
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    fontFamily: FontFamily.displayLight,
    fontSize: 17,
  },
  selectedArtwork: {
    boxShadow: '0 0 48px 10px rgba(212, 165, 116, 0.42)',
  },
  selectionPanel: {
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  selectionSurface: {
    backgroundColor: 'rgba(20, 18, 40, 0.94)',
    overflow: 'hidden',
    position: 'absolute',
  },
  selectionRule: {
    backgroundColor: NightTheme.accent,
    borderRadius: 2,
    height: 2.5,
    width: 26,
  },
  stage: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
