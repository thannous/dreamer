import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { LARGE_TEXT_FONT_SCALE } from '@/constants/layout';
import { useTheme } from '@/context/ThemeContext';
import { TID } from '@/lib/testIDs';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';

interface RecordingFooterProps {
  onSave: () => void;
  isSaveDisabled: boolean;
  saveButtonLabel: string;
  saveButtonAccessibilityLabel?: string;
}

export function RecordingFooter({
  onSave,
  isSaveDisabled,
  saveButtonLabel,
  saveButtonAccessibilityLabel,
}: RecordingFooterProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { width, fontScale } = useWindowDimensions();
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
          style={[
            styles.submitButtonText,
            {
              color: isSaveDisabled
                ? colors.textTertiary
                : noctalia.action.primaryText,
            },
          ]}
        >
          {saveButtonLabel}
        </Text>
      </Pressable>
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
    minWidth: 260,
    maxWidth: '100%',
    flexShrink: 0,
    paddingVertical: 17,
    paddingHorizontal: 34,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  submitButtonDisabled: {
    ...(Platform.OS === 'web'
      ? { boxShadow: 'none' }
      : { shadowOpacity: 0, elevation: 0 }),
  } as ViewStyle,
  submitButtonText: {
    textAlign: 'center',
    alignSelf: 'stretch',
    flexShrink: 0,
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
