import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import React, { type ReactNode, memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

export interface NoctaliaHeaderAction {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  testID?: string;
}

export interface NoctaliaHeaderChip {
  id: string;
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

interface NoctaliaScreenHeaderProps {
  titleKey: string;
  actions?: NoctaliaHeaderAction[];
  chips?: NoctaliaHeaderChip[];
  slot?: ReactNode;
}

export const NoctaliaScreenHeader = memo(function NoctaliaScreenHeader({
  titleKey,
  actions = [],
  chips = [],
  slot,
}: NoctaliaScreenHeaderProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;
  const iconButtonBg = mode === 'dark' ? 'rgba(72, 59, 111, 0.26)' : 'rgba(255, 253, 248, 0.8)';

  return (
    <View style={[styles.container, { paddingTop: insets.top + ThemeLayout.spacing.md }]}>
      <View style={[styles.titleRow, isNarrow && styles.titleRowNarrow]}>
        <View style={styles.titleBlock}>
          <Text
            style={[styles.brand, { color: colors.accentLight }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.84}
          >
            Noctalia
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.accentLight }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.84}
          >
            {t(titleKey)}
          </Text>
        </View>
        {actions.length > 0 ? (
          <View style={[styles.headerActions, isNarrow && styles.headerActionsNarrow]}>
            {actions.map((action) => (
              <Pressable
                key={action.accessibilityLabel}
                onPress={action.onPress}
                style={[
                  styles.iconButton,
                  isNarrow && styles.iconButtonNarrow,
                  {
                    backgroundColor: action.active ? colors.accent : iconButtonBg,
                    borderColor: action.active ? colors.accentLight : colors.divider,
                  },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
                testID={action.testID}
              >
                <IconSymbol
                  name={action.icon}
                  size={isNarrow ? 22 : 24}
                  color={action.active ? colors.textOnAccentSurface : colors.textPrimary}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {slot ? <View style={styles.slot}>{slot}</View> : null}

      {chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {chips.map((chip) => (
            <Pressable
              key={chip.id}
              onPress={chip.onPress}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: chip.active ? colors.accent : iconButtonBg,
                  borderColor: chip.active ? colors.accentLight : colors.divider,
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={chip.accessibilityLabel ?? chip.label}
              testID={chip.testID}
            >
              <IconSymbol
                name={chip.icon}
                size={17}
                color={chip.active ? colors.textOnAccentSurface : colors.accentLight}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: chip.active ? colors.textOnAccentSurface : colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: ThemeLayout.spacing.md,
    paddingBottom: ThemeLayout.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ThemeLayout.spacing.md,
    paddingHorizontal: ThemeLayout.spacing.lg,
  },
  titleRowNarrow: {
    gap: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  brand: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 47,
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 24,
    letterSpacing: 0,
    opacity: 0.92,
  },
  headerActions: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.md,
    flexShrink: 0,
  },
  headerActionsNarrow: {
    gap: ThemeLayout.spacing.sm,
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonNarrow: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  slot: {
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  chips: {
    gap: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.lg,
    paddingBottom: ThemeLayout.spacing.xs,
  },
  chip: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  chipText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.76,
  },
});
