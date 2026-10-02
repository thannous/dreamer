import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LucidButton, LucidIconTile } from '@/components/lucid/LucidUI';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { StandardBottomSheet, type StandardBottomSheetProps } from '@/components/ui/StandardBottomSheet';
import { getLucidPalette, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useTheme } from '@/context/ThemeContext';
import { isLucidTrainer } from '@/lib/appVariant';

export function AuthBottomSheet(props: StandardBottomSheetProps) {
  return isLucidTrainer ? <LucidAuthBottomSheet {...props} /> : <StandardBottomSheet {...props} />;
}

function LucidAuthBottomSheet({ visible, onClose, title, subtitle, headerIcon, children, actions, testID, titleTestID, style, snapPoints, bodyScrollEnabled = true, dismissBehavior }: StandardBottomSheetProps) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const insets = useSafeAreaInsets();
  const titleRef = useRef<Text | null>(null);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      if (process.env.EXPO_OS === 'web') titleRef.current?.focus();
      else {
        const node = findNodeHandle(titleRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [visible]);

  return <BottomSheet visible={visible} onClose={onClose} surfaceColor={palette.surface} backdropColor={palette.overlay} scrollable={false} snapPoints={snapPoints} dismissBehavior={dismissBehavior ?? (actions.primaryLoading ? 'none' : 'pan')} style={[styles.sheet, { backgroundColor: palette.surface, paddingBottom: insets.bottom + LucidSpace.lg }, style]} testID={testID}>
    <ScrollView scrollEnabled={bodyScrollEnabled} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.scroll}>
      <View style={styles.heading}>
        {headerIcon ? <LucidIconTile icon="person-outline" /> : null}
        <Text ref={titleRef} {...(process.env.EXPO_OS === 'web' ? { tabIndex: -1 as const } : {})} accessibilityRole="header" style={[styles.title, { color: palette.text }]} testID={titleTestID}>{title}</Text>
        {subtitle ? <Text style={[styles.body, { color: palette.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {children}
    </ScrollView>
    <View style={styles.actions}>
      <LucidButton label={actions.primaryLabel} loading={actions.primaryLoading} disabled={actions.primaryDisabled} variant={actions.primaryVariant === 'danger' ? 'danger' : 'primary'} onPress={actions.onPrimary} testID={actions.primaryTestID} />
      {actions.primaryDetail ? <Text style={[styles.body, { color: palette.textSecondary }]}>{actions.primaryDetail}</Text> : null}
      {actions.secondaryLabel && actions.onSecondary ? <LucidButton label={actions.secondaryLabel} disabled={actions.secondaryDisabled} variant="secondary" onPress={actions.onSecondary} testID={actions.secondaryTestID} /> : null}
      {actions.secondaryDetail ? <Text style={[styles.body, { color: palette.textSecondary }]}>{actions.secondaryDetail}</Text> : null}
      {actions.supportingContent}
      {actions.linkLabel && actions.onLink ? <LucidButton label={actions.linkLabel} variant="ghost" onPress={actions.onLink} testID={actions.linkTestID} /> : null}
    </View>
  </BottomSheet>;
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: LucidSpace.gutter, paddingTop: LucidSpace.md, gap: LucidSpace.lg },
  scroll: { flexShrink: 1 },
  heading: { alignItems: 'center', gap: LucidSpace.sm, marginBottom: LucidSpace.lg },
  title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.h2[0], lineHeight: LucidType.h2[1], textAlign: 'center' },
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  actions: { gap: LucidSpace.sm },
});
