import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import { SEEK_STEP_SEC } from '@/lib/audio';
import { TID } from '@/lib/testIDs';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  playing: boolean;
  loading?: boolean;
  onToggle: () => void;
  onSkip: (deltaSec: number) => void;
  secondaryIconColor?: string;
  primaryIconColor?: string;
};

function SkipButton({
  label,
  icon,
  onPress,
  testID,
  iconColor,
}: {
  label: string;
  icon: 'gobackward.15' | 'goforward.15';
  onPress: () => void;
  testID: string;
  iconColor?: string;
}) {
  const { colors } = useTheme();
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
      <IconSymbol name={icon} color={iconColor ?? colors.accentText} size={22} />
    </AnimatedPressable>
  );
}

/** Three controls, nothing else. The rest of the screen is the session. */
export function PlayerControls({
  playing,
  loading = false,
  onToggle,
  onSkip,
  secondaryIconColor,
  primaryIconColor,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'button' });

  return (
    <View className="flex-row items-center justify-center gap-8">
      <SkipButton
        testID={TID.Button.PlayerBack}
        label={t('player.back15')}
        icon="gobackward.15"
        iconColor={secondaryIconColor}
        onPress={() => onSkip(-SEEK_STEP_SEC)}
      />

      <AnimatedPressable
        testID={TID.Button.PlayerToggle}
        accessibilityRole="button"
        accessibilityLabel={playing ? t('player.pause') : t('player.play')}
        accessibilityState={{ busy: loading }}
        disabled={loading}
        onPress={onToggle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}
        className="h-20 w-20 items-center justify-center rounded-full border border-champagne-soft bg-champagne">
        {loading ? (
          <ActivityIndicator
            size="small"
            color={primaryIconColor ?? colors.textOnAccent}
          />
        ) : (
          <IconSymbol
            name={playing ? 'pause.fill' : 'play.fill'}
            color={primaryIconColor ?? colors.textOnAccent}
            size={28}
          />
        )}
      </AnimatedPressable>

      <SkipButton
        testID={TID.Button.PlayerForward}
        label={t('player.forward15')}
        icon="goforward.15"
        iconColor={secondaryIconColor}
        onPress={() => onSkip(SEEK_STEP_SEC)}
      />
    </View>
  );
}
