import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { LARGE_TEXT_FONT_SCALE } from '@/constants/layout';
import { useTheme } from '@/context/ThemeContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TID } from '@/lib/testIDs';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';

interface RecordingFooterProps {
  onSave: () => void;
  isSaveDisabled: boolean;
  saveButtonLabel: string;
  saveButtonAccessibilityLabel?: string;
  onCompleteWithHelp?: () => void;
  helpLabel?: string;
  helpHint?: string;
}

export function RecordingFooter({
  onSave,
  isSaveDisabled,
  saveButtonLabel,
  saveButtonAccessibilityLabel,
  onCompleteWithHelp,
  helpLabel,
  helpHint,
}: RecordingFooterProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { width, fontScale } = useWindowDimensions();
  const controlFontScale = Math.min(1.3, Math.max(1, fontScale));
  const [availableWidth, setAvailableWidth] = useState(0);
  const largeText = fontScale >= LARGE_TEXT_FONT_SCALE;

  return (
    <View
      style={styles.footerActions}
      onLayout={({ nativeEvent }) => setAvailableWidth(nativeEvent.layout.width)}
    >
      <Pressable
        onPress={onSave}
        disabled={isSaveDisabled}
        style={[
          styles.submitButton,
          // Give Yoga a definite wrapping width before it measures text.
          // maxWidth alone through intrinsic wrappers could retain a
          // single-line height when the translated label wraps on Android.
          largeText && { minWidth: 0, width: Math.min(420, availableWidth || Math.max(0, width - 32)) },
          {
            backgroundColor: isSaveDisabled
              ? colors.backgroundCard
              : noctalia.action.primary,
            borderColor: isSaveDisabled
              ? noctalia.surface.borderStrong
              : noctalia.action.primaryBorder,
            shadowColor: noctalia.action.primary,
          },
          isSaveDisabled && styles.submitButtonDisabled,
        ]}
        testID={TID.Button.SaveDream}
        accessibilityRole="button"
        accessibilityLabel={saveButtonAccessibilityLabel ?? saveButtonLabel}
      >
        <Text
          key={fontScale}
          allowFontScaling={false}
          style={[
            styles.submitButtonText,
            {
              fontSize: 16 * controlFontScale,
              color: isSaveDisabled
                ? colors.textTertiary
                : noctalia.action.primaryText,
            },
          ]}
        >
          {saveButtonLabel}
        </Text>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <IconSymbol name="arrow.right" size={20} color={isSaveDisabled ? colors.textTertiary : noctalia.action.primaryText} />
        </View>
      </Pressable>
      {onCompleteWithHelp && helpLabel ? (
        <Pressable
          onPress={onCompleteWithHelp}
          disabled={isSaveDisabled}
          accessibilityRole="button"
          accessibilityLabel={helpLabel}
          accessibilityHint={helpHint}
          testID="recording-complete-with-help"
          style={styles.helpButton}
        >
          <Text key={`help-${fontScale}`} allowFontScaling={false} style={[styles.helpLabel, { fontSize: 15 * controlFontScale, lineHeight: 21 * controlFontScale, color: noctalia.accent.text }]}>{helpLabel}</Text>
          {helpHint ? <Text key={`hint-${fontScale}`} allowFontScaling={false} style={[styles.helpHint, { fontSize: 12 * controlFontScale, lineHeight: 17 * controlFontScale, color: noctalia.text.secondary }]}>{helpHint}</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footerActions: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 8,
    flexShrink: 0,
  },
  submitButton: {
    width: '100%',
    minWidth: 0,
    maxWidth: 512,
    flexShrink: 0,
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  submitButtonDisabled: {
    ...(Platform.OS === 'web'
      ? { boxShadow: 'none' }
      : { shadowOpacity: 0, elevation: 0 }),
  } as ViewStyle,
  submitButtonText: {
    textAlign: 'center',
    flex: 1,
    flexShrink: 1,
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  helpButton: {
    minHeight: 48,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 4,
  },
  helpLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  helpHint: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
