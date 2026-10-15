import React from 'react';
import { Text } from 'react-native';

import { Fonts } from '@/constants/theme';

/** The page's number at its foot, as in a book. Decorative: the page is not read by it. */
export function JournalFolio({ folio, className = '' }: { folio?: number; className?: string }) {
  if (!folio) return null;
  return (
    <Text allowFontScaling={false} accessible={false} importantForAccessibility="no"
      className={`text-center text-[13px] text-ivory-muted ${className}`} style={{ fontFamily: Fonts.lora.regular }}>
      — {folio} —
    </Text>
  );
}
