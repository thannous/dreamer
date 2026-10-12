import React, { useMemo } from 'react';
import { Image } from 'react-native';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

const PAPER = require('@/assets/images/journal-paper.webp');

/**
 * The grain of a dream journal page behind a dream: cloudy mottling, fine grain and fibres
 * from one seamless mask, tinted with the theme's text so it reads as night paper or as
 * ivory paper. It stays still behind the reading, is decorative, and leaves the colours and
 * contrast of the copy as they are.
 */
export function JournalPaper() {
  const { colors, mode } = useTheme();
  const tint = useMemo(() => getNoctaliaDesignTokens(colors, mode).text.primary, [colors, mode]);
  return (
    <Image
      source={PAPER}
      resizeMode="repeat"
      tintColor={tint}
      accessible={false}
      importantForAccessibility="no"
      pointerEvents="none"
      // A bundled image takes its file's size unless told otherwise; the paper fills the page.
      className="absolute left-0 top-0"
      style={{ width: '100%', height: '100%', opacity: mode === 'dark' ? 0.1 : 0.14 }}
    />
  );
}
