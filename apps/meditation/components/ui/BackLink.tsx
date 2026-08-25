import { type Href, useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Pressable, View } from 'react-native';

import { PressOpacity } from '@/constants/motion';
import { useTheme } from '@/context/ThemeContext';

import { IconSymbol } from './icon-symbol';
import { Text } from './Text';

type Props = {
  label: string;
  /** Native icon colour for a surface whose scoped Uniwind theme differs
   * from the app-wide ThemeContext (for example, a light meditation world). */
  iconColor?: string;
  /** Where to land when there is no history — a deep link opened cold. */
  // The tabs sit under two route groups, so the canonical href names both.
  // Plain '/' is ambiguous with `app/index.tsx` and redirects onto itself.
  fallbackHref?: Href;
  className?: string;
  testID?: string;
};

/**
 * Back affordance for screens with no header. The OS gesture is not enough on
 * its own: it does not exist on Android hardware-button setups, and a
 * deep-linked screen may have nothing to go back to at all.
 */
export function BackLink({
  label,
  iconColor,
  fallbackHref = '/(drawer)/(tabs)',
  className,
  testID,
}: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const navigationCommitted = useRef(false);

  const goBack = () => {
    // A second tap in the same mounted frame must not pop another route. The
    // component unmounts after a successful navigation, naturally resetting
    // the lock for the previous screen.
    if (navigationCommitted.current) return;
    navigationCommitted.current = true;

    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  };

  return (
    <View className={className}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={goBack}
        hitSlop={12}
        pressRetentionOffset={12}
        style={({ pressed }) => ({ opacity: pressed ? PressOpacity.link : 1 })}
        className="flex-row items-center gap-1 self-start">
        <IconSymbol name="chevron.left" color={iconColor ?? colors.accentText} size={18} />
        <Text variant="bodySm" tone="accent">
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
