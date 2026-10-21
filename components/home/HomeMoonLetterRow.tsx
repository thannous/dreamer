import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FullMoonSeal } from '@/components/ui/FullMoonSeal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { MOON_LETTER_ROUTE, type MoonLetterInvite } from '@/lib/moonLetter';
import { TID } from '@/lib/testIDs';

/** The morning after a full moon and the two days after: this cycle's letter waits to be opened. */
export function HomeMoonLetterRow({ invite }: { invite: MoonLetterInvite }) {
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const label = t('home.moon_letter.label');
  const body = t('home.moon_letter.body', { count: invite.dreamCount });
  return (
    <Pressable testID={TID.Button.HomeMoonLetter} accessibilityRole="button" accessibilityLabel={`${label}. ${body}`}
      onPress={() => router.push(MOON_LETTER_ROUTE)}
      className="min-h-[60px] flex-row items-center gap-3 border-t border-line py-4 active:opacity-70">
      <View className="w-10 items-center">
        <IconSymbol name="envelope" size={24} color={ink.accent.text} />
        <View className="absolute -right-0.5 -top-1"><FullMoonSeal size={14} /></View>
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text maxFontSizeMultiplier={1.4} className="font-sans-medium text-overline uppercase text-ivory-muted">{label}</Text>
        <Text maxFontSizeMultiplier={1.4} className="font-sans text-body leading-[22px] text-ivory">{body}</Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={ink.text.tertiary} />
    </Pressable>
  );
}
