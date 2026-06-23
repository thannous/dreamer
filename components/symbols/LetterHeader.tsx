import React, { useMemo } from "react";
import { Text, View } from "react-native";

import { ThemeLayout } from "@/constants/journalTheme";
import { getNoctaliaDesignTokens } from "@/constants/noctaliaDesign";
import { Fonts } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

interface LetterHeaderProps {
  letter: string;
  count: number;
}

export function LetterHeader({ letter, count }: LetterHeaderProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return (
    <View
      style={{
        paddingHorizontal: ThemeLayout.spacing.md,
        paddingTop: ThemeLayout.spacing.lg,
        paddingBottom: ThemeLayout.spacing.sm,
        gap: 6,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: ThemeLayout.spacing.sm,
        }}
      >
        <Text
          selectable
          style={{
            fontFamily: Fonts.fraunces.bold,
            fontSize: 18,
            color: noctalia.text.primary,
          }}
        >
          {letter}
        </Text>
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: noctalia.surface.border,
            opacity: 0.4,
          }}
        />
        <Text
          selectable
          style={{
            fontFamily: Fonts.spaceGrotesk.regular,
            fontSize: 13,
            color: noctalia.text.tertiary,
            fontVariant: ["tabular-nums"],
          }}
        >
          {count}
        </Text>
      </View>
    </View>
  );
}
