import React from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';

export type RitualPickerSurfaceProps = {
  children: React.ReactNode;
  onClose: () => void;
  saving: boolean;
};
export function RitualPickerSurface({ children, onClose, saving }: RitualPickerSurfaceProps) {
  return (
    <BottomSheet
      visible
      onClose={onClose}
      dismissBehavior={saving ? 'none' : 'pan'}
      scrollable={false}
      testID="ritual-picker"
      className="p-0"
    >
      {children}
    </BottomSheet>
  );
}
