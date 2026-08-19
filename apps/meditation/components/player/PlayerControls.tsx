import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import { TID } from '@/lib/testIDs';
import { SEEK_STEP_SEC } from '@/lib/audio';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  playing: boolean;
  onToggle: () => void;
  onSkip: (deltaSec: number) => void;
};

function SkipButton({
  label,
  glyph,
  onPress,
  testID,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  testID: string;
}) {
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'chip' });

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={16}
      style={style}
      className="h-12 w-12 items-center justify-center rounded-full border border-hairline">
      <Text variant="bodySm" tone="accent" className="font-medium">
        {glyph}
      </Text>
    </AnimatedPressable>
  );
}

/** Three controls, nothing else. The rest of the screen is the session. */
export function PlayerControls({ playing, onToggle, onSkip }: Props) {
  const { t } = useTranslation();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'button' });

  return (
    <View className="flex-row items-center justify-center gap-8">
      <SkipButton
        testID={TID.Button.PlayerBack}
        label={t('player.back15')}
        glyph={`−${SEEK_STEP_SEC}`}
        onPress={() => onSkip(-SEEK_STEP_SEC)}
      />

      <AnimatedPressable
        testID={TID.Button.PlayerToggle}
        accessibilityRole="button"
        accessibilityLabel={playing ? t('player.pause') : t('player.play')}
        onPress={onToggle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}
        className="h-20 w-20 items-center justify-center rounded-full border border-champagne-soft bg-champagne">
        <Text variant="h2" tone="onAccent">
          {playing ? '❙❙' : '▶'}
        </Text>
      </AnimatedPressable>

      <SkipButton
        testID={TID.Button.PlayerForward}
        label={t('player.forward15')}
        glyph={`+${SEEK_STEP_SEC}`}
        onPress={() => onSkip(SEEK_STEP_SEC)}
      />
    </View>
  );
}
