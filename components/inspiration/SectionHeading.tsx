import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  colors: ReturnType<typeof useTheme>['colors'];
  icon?: IconName;
};

export function SectionHeading({
  title,
  subtitle,
  colors,
  icon,
}: SectionHeadingProps) {
  const { mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);

  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingRow}>
        {icon && (
          <View
            style={[
              styles.sectionHeadingIcon,
              {
                backgroundColor: noctalia.surface.soft,
                borderColor: noctalia.surface.border,
              },
            ]}
          >
            <IconSymbol name={icon} size={14} color={noctalia.accent.base} />
          </View>
        )}
        <Text style={[styles.sectionTitle, { color: noctalia.text.primary }]}>
          {title}
        </Text>
      </View>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: noctalia.text.secondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeading: {
    marginBottom: 18,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeadingIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 22,
  },
  sectionSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
});
