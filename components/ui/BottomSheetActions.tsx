import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

export type BottomSheetActionState = 'enabled' | 'disabled' | 'loading';
export type BottomSheetActionIcon = React.ComponentProps<typeof IconSymbol>['name'];

export function BottomSheetActions({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
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
  const backgroundColor = variant === 'danger' ? noctalia.status.danger.background : noctalia.action.primary;
  const borderColor = variant === 'danger' ? noctalia.status.danger.border : noctalia.action.primaryBorder;
  const textColor = variant === 'danger' ? noctalia.status.danger.text : noctalia.action.primaryText;
  const usesRichLayout = Boolean(detail || leadingIcon || trailingIcon);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        usesRichLayout && styles.richButton,
        {
          backgroundColor,
          borderColor,
        },
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      testID={testID}
    >
      {isLoading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={[styles.actionContent, !usesRichLayout && styles.centeredActionContent]}>
          {leadingIcon ? (
            <View style={[styles.primaryIconSurface, { borderColor: textColor }]}>
              <IconSymbol name={leadingIcon} size={24} color={textColor} />
            </View>
          ) : null}
          <View style={[styles.actionCopy, !usesRichLayout && styles.centeredActionCopy]}>
            <Text style={[styles.primaryButtonText, { color: textColor }]}>
              {label}
            </Text>
            {detail ? (
              <Text style={[styles.primaryButtonDetail, { color: textColor, opacity: 0.72 }]}>
                {detail}
              </Text>
            ) : null}
          </View>
          {trailingIcon ? (
            <IconSymbol name={trailingIcon} size={24} color={textColor} />
          ) : null}
        </View>
      )}
    </Pressable>
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
    <Pressable
      style={({ pressed }) => [
        styles.secondaryButton,
        usesRichLayout && styles.richButton,
        {
          borderColor: noctalia.surface.border,
          backgroundColor: noctalia.surface.soft,
        },
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      testID={testID}
    >
      <View style={[styles.actionContent, !usesRichLayout && styles.centeredActionContent]}>
        {leadingIcon ? (
          <View
            style={[
              styles.secondaryIconSurface,
              {
                backgroundColor: noctalia.surface.raised,
                borderColor: noctalia.surface.borderStrong ?? noctalia.surface.border,
              },
            ]}
          >
            <IconSymbol name={leadingIcon} size={24} color={noctalia.text.secondary} />
          </View>
        ) : null}
        <View style={[styles.actionCopy, !usesRichLayout && styles.centeredActionCopy]}>
          <Text style={[styles.secondaryButtonText, { color: noctalia.text.primary }]}>
            {label}
          </Text>
          {detail ? (
            <Text style={[styles.secondaryButtonDetail, { color: noctalia.text.secondary }]}>
              {detail}
            </Text>
          ) : null}
        </View>
        {trailingIcon ? (
          <IconSymbol name={trailingIcon} size={24} color={noctalia.text.secondary} />
        ) : null}
      </View>
    </Pressable>
  );
}

export type BottomSheetLinkActionProps = {
  label: string;
  onPress: () => void;
  testID?: string;
};

export function BottomSheetLinkAction({ label, onPress, testID }: BottomSheetLinkActionProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.linkButton,
        pressed && styles.pressedButton,
      ]}
      onPress={onPress}
      testID={testID}
    >
      <Text style={[styles.linkButtonText, { color: noctalia.text.secondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  primaryButtonDetail: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
  },
  secondaryButtonDetail: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  richButton: {
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'stretch',
  },
  actionContent: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  centeredActionContent: {
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    gap: 3,
  },
  centeredActionCopy: {
    alignItems: 'center',
  },
  primaryIconSurface: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryIconSurface: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButton: {
    minHeight: 44,
    paddingVertical: ThemeLayout.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButtonText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressedButton: {
    opacity: 0.8,
  },
});

export default BottomSheetActions;
