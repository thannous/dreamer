import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { TID } from '@/lib/testIDs';
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

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

  return (
    <View style={styles.footerActions}>
      <View style={styles.actionButtons}>
        <View style={isSaveDisabled ? styles.submitButtonWrapperDisabled : undefined}>
          <Pressable
            onPress={onSave}
            disabled={isSaveDisabled}
            style={[
              styles.submitButton,
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerActions: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 8,
  },
  actionButtons: {
    gap: 12,
  },
  submitButtonWrapperDisabled: {
    opacity: 1,
  },
  submitButton: {
    minWidth: 260,
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
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
