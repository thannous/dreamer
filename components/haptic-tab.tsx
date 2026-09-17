import { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { PlatformPressable } from 'expo-router/react-navigation';
import * as Haptics from 'expo-haptics';

type HapticTabProps = BottomTabBarButtonProps & {
  accessibilityBusy?: boolean;
};

export function HapticTab({
  accessibilityRole,
  accessibilityState,
  accessibilityBusy,
  ...props
}: HapticTabProps) {
  return (
    <PlatformPressable
      {...props}
      accessibilityRole={accessibilityRole ?? 'tab'}
      accessibilityState={{
        ...accessibilityState,
        selected: accessibilityState?.selected ?? Boolean(props['aria-selected']),
        busy: accessibilityBusy ?? accessibilityState?.busy,
      }}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
