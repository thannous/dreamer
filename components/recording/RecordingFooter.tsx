import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { MotiView } from '@/lib/moti';
import { TID } from '@/lib/testIDs';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

interface RecordingFooterProps {
  onSave: () => void;
  onGoToJournal: () => void;
  isSaveDisabled: boolean;
  saveButtonLabel: string;
  journalLinkLabel: string;
  saveButtonAccessibilityLabel?: string;
  journalLinkAccessibilityLabel?: string;
}

export function RecordingFooter({
  onSave,
  onGoToJournal,
  isSaveDisabled,
  saveButtonLabel,
  journalLinkLabel,
  saveButtonAccessibilityLabel,
  journalLinkAccessibilityLabel,
}: RecordingFooterProps) {
  const { colors, shadows } = useTheme();

  return (
    <View style={styles.footerActions}>
      <View style={styles.actionButtons}>
        <MotiView
          animate={{ opacity: isSaveDisabled ? 0.65 : 1 }}
          transition={{ type: 'timing', duration: 300 }}
        >
          <Pressable
            onPress={onSave}
            disabled={isSaveDisabled}
            style={[
              styles.submitButton,
              shadows.lg,
              { backgroundColor: isSaveDisabled ? colors.textSecondary : colors.accent },
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
                  color: isSaveDisabled ? colors.textPrimary : colors.textOnAccentSurface,
                  opacity: isSaveDisabled ? 0.9 : 1,
                },
              ]}
            >
              {saveButtonLabel}
            </Text>
          </Pressable>
        </MotiView>
      </View>

      <Pressable
        onPress={onGoToJournal}
        style={styles.journalLinkButton}
        testID={TID.Button.NavigateJournal}
        accessibilityRole="link"
        accessibilityLabel={journalLinkAccessibilityLabel ?? journalLinkLabel}
      >
        <Text style={[styles.journalLinkText, { color: colors.accent }]}>
          {journalLinkLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footerActions: {
    marginTop: 'auto',
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  actionButtons: {
    gap: 12,
  },
  submitButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
    ...(Platform.OS === 'web'
      ? { boxShadow: 'none' }
      : { shadowOpacity: 0, elevation: 0 }),
  } as ViewStyle,
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    letterSpacing: 0.5,
  },
  journalLinkButton: {
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'center',
  },
  journalLinkText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
