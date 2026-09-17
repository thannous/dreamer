import React, { useEffect, useRef, useState } from 'react';
import { Host, ModalBottomSheet, Column, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { fillMaxHeight, testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import type { BottomSheetSurfaceProps } from './BottomSheetSurface.types';

export function BottomSheetSurface({
  isPresented,
  onDismiss,
  dismissible,
  children,
  showDragIndicator,
  snapPoints,
  scrimColor,
  containerColor,
  testID,
}: BottomSheetSurfaceProps) {
  const { colors, mode } = useTheme();
  const palette = getNoctaliaDesignTokens(colors, mode);
  const ref = useRef<ModalBottomSheetRef>(null);
  const [mounted, setMounted] = useState(isPresented);
  const [previousPresented, setPreviousPresented] = useState(isPresented);
  const [presentation, setPresentation] = useState(0);
  if (previousPresented !== isPresented) {
    setPreviousPresented(isPresented);
    if (isPresented) {
      setMounted(true);
      setPresentation((value) => value + 1);
    }
  }
  useEffect(() => {
    if (isPresented || !mounted) return;
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setMounted(false);
    };
    // A fresh presentation gets its own native sheet if reopened during hide.
    // If the native view has already detached, complete the controlled close.
    void ref.current?.hide().then(finish, finish);
    return () => {
      cancelled = true;
    };
  }, [isPresented, mounted]);
  if (!mounted) return null;
  const fullHeight = snapPoints?.some(
    (point) =>
      point === 'full' || (typeof point === 'object' && 'fraction' in point && point.fraction >= 1),
  );
  const hasPartial = snapPoints?.some(
    (point) =>
      point === 'half' ||
      (typeof point === 'object' &&
        ('height' in point || ('fraction' in point && point.fraction < 1))),
  );
  return (
    <Host style={{ position: 'absolute' }} pointerEvents="none" colorScheme={mode}>
      <ModalBottomSheet
        key={presentation}
        ref={ref}
        onDismissRequest={() => {
          if (dismissible) onDismiss();
        }}
        skipPartiallyExpanded={!hasPartial}
        showDragHandle={showDragIndicator && dismissible}
        sheetGesturesEnabled={dismissible}
        properties={{
          shouldDismissOnBackPress: dismissible,
          shouldDismissOnClickOutside: dismissible,
        }}
        containerColor={containerColor ?? colors.backgroundCard}
        contentColor={colors.textPrimary}
        scrimColor={scrimColor ?? palette.surface.overlay}
      >
        <Column
          modifiers={[
            ...(fullHeight ? [fillMaxHeight()] : []),
            ...(testID ? [testIDModifier(testID)] : []),
          ]}
        >
          {children}
        </Column>
      </ModalBottomSheet>
    </Host>
  );
}
