import React from 'react';
import { BottomSheet as ExpoBottomSheet } from '@expo/ui';
import { interactiveDismissDisabled, presentationBackground } from '@expo/ui/swift-ui/modifiers';
import { useTheme } from '@/context/ThemeContext';
import type { BottomSheetSurfaceProps } from './BottomSheetSurface.types';

export function BottomSheetSurface({
  dismissible,
  containerColor,
  ...props
}: BottomSheetSurfaceProps) {
  const { colors } = useTheme();
  return (
    <ExpoBottomSheet
      {...props}
      contentPadding={{ top: props.showDragIndicator ? 24 : 0 }}
      modifiers={[
        presentationBackground(containerColor ?? colors.backgroundCard),
        interactiveDismissDisabled(!dismissible),
      ]}
    />
  );
}
