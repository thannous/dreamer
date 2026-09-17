import * as Haptics from 'expo-haptics';
import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { ScopedTheme } from 'uniwind';

import { Text } from '@/components/ui/Text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ArtworkScrim, NightTheme, Radius } from '@/constants/theme';
import type { MeditationWorld, WorldId } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import { usePressMotion } from '@/hooks/usePressMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HIT_SLOP = { top: 4, bottom: 4, left: 2, right: 2 } as const;
const PRESS_RETENTION = { top: 12, bottom: 12, left: 12, right: 12 } as const;

export type WorldChoiceProps = Omit<
  PressableProps,
  | 'accessibilityLabel'
  | 'accessibilityRole'
  | 'accessibilityState'
  | 'children'
  | 'onPress'
  | 'style'
> & {
  world: MeditationWorld;
  selected: boolean;
  onSelect: (worldId: WorldId) => void;
  testID?: string;
};

/** A compact, image-led radio choice. The artwork does the world-building. */
export function WorldChoice({
  world,
  selected,
  onSelect,
  testID,
  onPressIn,
  onPressOut,
  ...rest
}: WorldChoiceProps) {
  const { t } = useTranslation();
  const name = t(world.nameKey);
  const description = t(world.descriptionKey);
  const { style, handlePressIn, handlePressOut } = usePressMotion({
    surface: 'card',
    onPressIn,
    onPressOut,
  });

  const handlePress = (_event: GestureResponderEvent) => {
    if (selected) return;
    Haptics.selectionAsync().catch(() => {});
    onSelect(world.id);
  };

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityHint={description}
      accessibilityState={{ checked: selected, selected }}
      hitSlop={HIT_SLOP}
      pressRetentionOffset={PRESS_RETENTION}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        style,
        {
          borderColor: selected ? NightTheme.accentLight : NightTheme.divider,
          borderRadius: Radius.xl,
          borderWidth: selected ? 1.5 : 1,
          overflow: 'hidden',
        },
      ]}
      className="min-h-28 flex-1 overflow-hidden"
      testID={testID}
      {...rest}>
      <Image
        accessible={false}
        source={world.thumbnail as ImageProps['source']}
        contentFit="cover"
        recyclingKey={`${world.id}-choice`}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[ArtworkScrim.transparent, ArtworkScrim.strong]}
        locations={[0.2, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScopedTheme theme="dark">
        <View className="min-h-28 flex-1 justify-between p-3">
          <View className="items-end">
            <View
              className="h-7 w-7 items-center justify-center rounded-full border"
              style={{
                backgroundColor: selected ? NightTheme.accent : NightTheme.backgroundCard,
                borderColor: selected ? NightTheme.accentLight : NightTheme.divider,
              }}>
              {selected ? (
                <IconSymbol
                  name="checkmark"
                  size={15}
                  color={NightTheme.textOnAccent}
                  weight="semibold"
                />
              ) : null}
            </View>
          </View>

          <Text variant="h3" tone="default">
            {name}
          </Text>
        </View>
      </ScopedTheme>
    </AnimatedPressable>
  );
}

export type WorldSwitcherProps = {
  worlds: readonly MeditationWorld[];
  selectedWorldId: WorldId;
  onSelect: (worldId: WorldId) => void;
  accessibilityLabel?: string;
  className?: string;
  testID?: string;
};

/**
 * Radio group only; routes decide where it lives. Keeping it free of modal or
 * navigation state makes the same selector usable in onboarding and settings.
 */
export function WorldSwitcher({
  worlds,
  selectedWorldId,
  onSelect,
  accessibilityLabel,
  className,
  testID,
}: WorldSwitcherProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className={`flex-row gap-3 ${className ?? ''}`}
      testID={testID}>
      {worlds.map((world) => (
        <WorldChoice
          key={world.id}
          world={world}
          selected={world.id === selectedWorldId}
          onSelect={onSelect}
          testID={testID ? `${testID}.${world.id}` : undefined}
        />
      ))}
    </View>
  );
}
