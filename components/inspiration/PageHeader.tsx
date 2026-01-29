import React, { useMemo } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ScreenContainer';
import { GradientText } from '@/components/inspiration/GradientText';
import { DecoLines, ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { MotiView } from '@/lib/moti';

type PageHeaderProps = {
  titleKey: string;
  showAnimations: boolean;
  /** Extra style on the header View (e.g. headerDesktop) */
  style?: ViewStyle;
  /** Wraps in ScreenContainer (default true). Journal passes false. */
  wrapInContainer?: boolean;
  /** Top spacing added to insets.top. Default: ThemeLayout.spacing.sm */
  topSpacing?: number;
};

export function PageHeader({
  titleKey,
  showAnimations,
  style,
  wrapInContainer = true,
  topSpacing = ThemeLayout.spacing.sm,
}: PageHeaderProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const headerGradientColors = useMemo(
    () =>
      mode === 'dark'
        ? ([colors.accentLight, colors.accent] as const)
        : ([colors.textPrimary, colors.accentDark] as const),
    [colors.accent, colors.accentDark, colors.accentLight, colors.textPrimary, mode],
  );

  const content = (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + topSpacing },
        style,
      ]}
    >
      <MotiView
        key={`header-${showAnimations}`}
        from={{ opacity: 0, translateY: 16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 700 }}
      >
        <GradientText colors={headerGradientColors} style={styles.headerTitle}>
          {t(titleKey)}
        </GradientText>
      </MotiView>
      <MotiView
        key={`header-rule-${showAnimations}`}
        from={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ type: 'timing', duration: 600, delay: 350 }}
      >
        <View style={[styles.headerRule, { backgroundColor: colors.accent }]} />
      </MotiView>
    </View>
  );

  if (wrapInContainer) {
    return <ScreenContainer>{content}</ScreenContainer>;
  }

  return content;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: ThemeLayout.spacing.sm,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.fraunces.semiBold,
    letterSpacing: 0.5,
  },
  headerRule: {
    ...DecoLines.rule,
    marginTop: 10,
  },
});
