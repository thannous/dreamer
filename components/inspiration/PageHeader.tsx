import React, { useMemo } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
  /** Extra style on the header View (e.g. headerDesktop) */
  style?: StyleProp<ViewStyle>;
  /** Top spacing added to insets.top. Default: ThemeLayout.spacing.sm */
  topSpacing?: number;
  /** Changes the animation key to replay the entrance animation. */
  animationSeed?: string | number;
};

export function PageHeader({
  titleKey,
  style,
  topSpacing = ThemeLayout.spacing.sm,
  animationSeed,
}: PageHeaderProps) {
  const content = (
    <PageHeaderContent
      titleKey={titleKey}
      style={style}
      topSpacing={topSpacing}
      animationSeed={animationSeed}
    />
  );

  return <ScreenContainer>{content}</ScreenContainer>;
}

export function PageHeaderContent({
  titleKey,
  style,
  topSpacing = ThemeLayout.spacing.sm,
  animationSeed,
}: PageHeaderProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const seed = animationSeed ?? 'default';

  const headerGradientColors = useMemo(
    () =>
      mode === 'dark'
        ? ([colors.accentLight, colors.accent] as const)
        : ([colors.textPrimary, colors.accentDark] as const),
    [colors.accent, colors.accentDark, colors.accentLight, colors.textPrimary, mode],
  );

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + topSpacing },
        style,
      ]}
    >
      <MotiView
        key={`header-${seed}`}
        from={{ opacity: 0, translateY: 16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 700 }}
      >
        <GradientText colors={headerGradientColors} style={styles.headerTitle}>
          {t(titleKey)}
        </GradientText>
      </MotiView>
      <MotiView
        key={`header-rule-${seed}`}
        from={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ type: 'timing', duration: 600, delay: 350 }}
      >
        <View style={[styles.headerRule, { backgroundColor: colors.accent }]} />
      </MotiView>
    </View>
  );
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
