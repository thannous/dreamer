import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

export type BottomSheetActionState = 'enabled' | 'disabled' | 'loading';
export type BottomSheetActionIcon = React.ComponentProps<typeof IconSymbol>['name'];

/** Buttons are already 44pt+ tall and sit 12px apart; extra hit slop would overlap them. */
const NO_HIT_SLOP = 0;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export function BottomSheetActions({ children }: { children: React.ReactNode }) {
  return (
    <View className="w-full gap-3">
      {children}
    </View>
  );
}

export type BottomSheetPrimaryActionProps = {
  label: string;
  detail?: string;
  leadingIcon?: BottomSheetActionIcon;
  trailingIcon?: BottomSheetActionIcon;
  onPress: () => void;
  state?: BottomSheetActionState;
  testID?: string;
  variant?: 'accent' | 'danger';
};

export function BottomSheetPrimaryAction({
  label,
  detail,
  leadingIcon,
  trailingIcon,
  onPress,
  state = 'enabled',
  testID,
  variant = 'accent',
}: BottomSheetPrimaryActionProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  const isDisabled = state !== 'enabled';
  const isLoading = state === 'loading';
  const isDanger = variant === 'danger';
  // Icons and the activity indicator take a colour value, not a style.
  const textColor = isDanger ? noctalia.status.danger.text : noctalia.action.primaryText;
  const usesRichLayout = Boolean(detail || leadingIcon || trailingIcon);

  return (
    <PressableScale
      className={cx(
        'items-center justify-center rounded-lg border py-4',
        isDanger ? 'border-danger-line bg-danger' : 'border-champagne-soft bg-champagne',
        usesRichLayout && 'min-h-[72px] items-stretch px-3.5 py-3',
        detail && 'min-h-[88px]',
        isDisabled && 'opacity-60'
      )}
      hitSlop={NO_HIT_SLOP}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading, disabled: isDisabled }}
      testID={testID}
    >
      {isLoading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View className={cx('w-full flex-row items-center gap-3', !usesRichLayout && 'justify-center')}>
          {leadingIcon ? (
            <View
              className={cx(
                'h-12 w-12 items-center justify-center rounded-xl border',
                isDanger ? 'border-danger-on' : 'border-on-champagne'
              )}
            >
              <IconSymbol name={leadingIcon} size={24} color={textColor} />
            </View>
          ) : null}
          <View className={cx('flex-1 gap-[3px]', !usesRichLayout && 'items-center')}>
            <Text
              className={cx('font-sans-bold text-[16px]', isDanger ? 'text-danger-on' : 'text-on-champagne')}
            >
              {label}
            </Text>
            {detail ? (
              <Text
                className={cx(
                  'font-sans-medium text-[13px] leading-[18px] opacity-[0.72]',
                  isDanger ? 'text-danger-on' : 'text-on-champagne'
                )}
              >
                {detail}
              </Text>
            ) : null}
          </View>
          {trailingIcon ? (
            <IconSymbol name={trailingIcon} size={24} color={textColor} />
          ) : null}
        </View>
      )}
    </PressableScale>
  );
}

export type BottomSheetSecondaryActionProps = {
  label: string;
  detail?: string;
  leadingIcon?: BottomSheetActionIcon;
  trailingIcon?: BottomSheetActionIcon;
  onPress: () => void;
  state?: Exclude<BottomSheetActionState, 'loading'>;
  testID?: string;
};

export function BottomSheetSecondaryAction({
  label,
  detail,
  leadingIcon,
  trailingIcon,
  onPress,
  state = 'enabled',
  testID,
}: BottomSheetSecondaryActionProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const isDisabled = state === 'disabled';
  const usesRichLayout = Boolean(detail || leadingIcon || trailingIcon);

  return (
    <PressableScale
      className={cx(
        'items-center justify-center rounded-lg border border-line bg-ink-soft py-3.5',
        usesRichLayout && 'min-h-[72px] items-stretch px-3.5 py-3',
        detail && 'min-h-[88px]',
        isDisabled && 'opacity-60'
      )}
      hitSlop={NO_HIT_SLOP}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      testID={testID}
    >
      <View className={cx('w-full flex-row items-center gap-3', !usesRichLayout && 'justify-center')}>
        {leadingIcon ? (
          <View className="h-12 w-12 items-center justify-center rounded-xl border border-line-strong bg-ink-raised">
            <IconSymbol name={leadingIcon} size={24} color={noctalia.text.secondary} />
          </View>
        ) : null}
        <View className={cx('flex-1 gap-[3px]', !usesRichLayout && 'items-center')}>
          <Text className="font-sans-medium text-[16px] text-ivory">
            {label}
          </Text>
          {detail ? (
            <Text className="font-sans text-[13px] leading-[18px] text-ivory-muted">
              {detail}
            </Text>
          ) : null}
        </View>
        {trailingIcon ? (
          <IconSymbol name={trailingIcon} size={24} color={noctalia.text.secondary} />
        ) : null}
      </View>
    </PressableScale>
  );
}

export type BottomSheetLinkActionProps = {
  label: string;
  onPress: () => void;
  testID?: string;
};

export function BottomSheetLinkAction({ label, onPress, testID }: BottomSheetLinkActionProps) {
  return (
    <PressableScale
      className="min-h-11 items-center justify-center py-1"
      hitSlop={NO_HIT_SLOP}
      onPress={onPress}
      testID={testID}
    >
      <Text className="font-sans-medium text-[14px] text-ivory-muted">
        {label}
      </Text>
    </PressableScale>
  );
}

export default BottomSheetActions;
