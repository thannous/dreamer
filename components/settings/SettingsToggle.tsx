import React from 'react';
import { Platform, Switch, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

const SWITCH_STYLE = { transform: [{ scale: 1.08 }] } as const;
const WEB_SWITCH_STYLE = { height: 28, width: 50 } as const;

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

/** Native control plus a visible state word; colour is never the only signal. */
export function SettingsToggle({ value, onValueChange, disabled, testID }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  // RN Web uses activeThumbColor for ON; native uses thumbColor for both states.
  const thumbProps = Platform.OS === 'web'
    ? { thumbColor: colors.textPrimary, activeThumbColor: colors.textOnAccentSurface }
    : { thumbColor: value ? colors.textOnAccentSurface : colors.textPrimary };
  return (
    <View className="min-w-[72px] shrink-0 items-end gap-1">
      <Switch
        disabled={disabled}
        ios_backgroundColor={colors.divider}
        onValueChange={onValueChange}
        style={Platform.OS === 'web' ? WEB_SWITCH_STYLE : SWITCH_STYLE}
        testID={testID}
        {...thumbProps}
        trackColor={{ false: colors.divider, true: colors.accent }}
        value={value}
      />
      <Text accessible={false} className="font-sans text-[12px] leading-[16px] text-ivory-muted">
        {t(value ? 'settings.control.enabled' : 'settings.control.disabled')}
      </Text>
    </View>
  );
}
