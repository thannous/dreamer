import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ScreenContainer';
import { GradientText } from '@/components/inspiration/GradientText';
import { ThemeLayout } from '@/constants/journalTheme';
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

  // `LinearGradient` takes colour values, not styles, so the gradient stays in TS.
  const headerGradientColors = useMemo(
    () =>
      mode === 'dark'
        ? ([colors.accentLight, colors.accent] as const)
        : ([colors.textPrimary, colors.textPrimary] as const),
    [colors.accent, colors.accentLight, colors.textPrimary, mode],
  );

  return (
    <View
      className="items-center px-4 pb-2"
      // The safe-area inset is a runtime measurement; only its value can be inline.
      style={[{ paddingTop: insets.top + topSpacing }, style]}
    >
      <MotiView
        key={`header-${seed}`}
        from={{ opacity: 0, translateY: 16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 700 }}
      >
        <GradientText colors={headerGradientColors} className="font-display-semibold text-[20px]">
          {t(titleKey)}
        </GradientText>
      </MotiView>
      <MotiView
        key={`header-rule-${seed}`}
        from={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ type: 'timing', duration: 600, delay: 350 }}
      >
        <View className="mt-[10px] h-[2.5px] w-9 self-center rounded-[1.5px] bg-champagne opacity-85" />
      </MotiView>
    </View>
  );
}
