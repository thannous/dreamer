import React from 'react';
import { BottomSheet as ExpoBottomSheet } from '@expo/ui';
import { useTheme } from '@/context/ThemeContext';
import type { BottomSheetSurfaceProps } from './BottomSheetSurface.types';

export function BottomSheetSurface({
  dismissible: _dismissible,
  containerColor,
  ...props
}: BottomSheetSurfaceProps) {
  const { colors } = useTheme();
  return (
    <ExpoBottomSheet
      {...props}
      contentPadding={0}
      containerColor={containerColor ?? colors.backgroundCard}
    />
  );
}
