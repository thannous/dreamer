import React from 'react';
import { BottomSheet as ExpoBottomSheet } from '@expo/ui';
import type { BottomSheetSurfaceProps } from './BottomSheetSurface.types';

export function BottomSheetSurface({
  dismissible: _dismissible,
  containerColor: _containerColor,
  ...props
}: BottomSheetSurfaceProps) {
  return <ExpoBottomSheet {...props} contentPadding={0} />;
}
