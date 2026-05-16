import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { TID } from '@/lib/testIDs';
import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { RecordingSpotlightRect } from './RecordingOnboardingSpotlightOverlay';

interface RecordingFooterProps {
  onSave: () => void;
  onGoToJournal: () => void;
  isSaveDisabled: boolean;
  spotlightExplore?: boolean;
  onSpotlightLayout?: (rect: RecordingSpotlightRect) => void;
  spotlightMeasureKey?: number;
  saveButtonLabel: string;
  journalLinkLabel: string;
  saveButtonAccessibilityLabel?: string;
  journalLinkAccessibilityLabel?: string;
}

export function RecordingFooter({
  onSave,
  onGoToJournal,
  isSaveDisabled,
  spotlightExplore,
  onSpotlightLayout,
  spotlightMeasureKey = 0,
  saveButtonLabel,
  journalLinkLabel,
  saveButtonAccessibilityLabel,
  journalLinkAccessibilityLabel,
}: RecordingFooterProps) {
  const { colors, shadows } = useTheme();
  const exploreSpotlightRef = useRef<View | null>(null);

  useEffect(() => {
    if (!spotlightExplore || !onSpotlightLayout) {
      return;
    }

    const measureExploreLink = () => {
      exploreSpotlightRef.current?.measureInWindow((x, y, width, height) => {
        onSpotlightLayout({ x, y, width, height });
      });
    };

    const frame = requestAnimationFrame(measureExploreLink);
    const timeout = setTimeout(measureExploreLink, 220);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [onSpotlightLayout, spotlightMeasureKey, spotlightExplore]);

  return (
    <View style={styles.footerActions}>
      <View style={styles.actionButtons}>
        <View style={isSaveDisabled ? styles.submitButtonWrapperDisabled : undefined}>
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
        </View>
      </View>

      <View
        ref={exploreSpotlightRef}
        collapsable={false}
        style={[
          styles.journalLinkTarget,
          spotlightExplore && [
            styles.journalLinkSpotlight,
            {
              backgroundColor: `${colors.accent}1A`,
              borderColor: colors.accentLight,
            },
          ],
        ]}
      >
        <Pressable
          onPress={onGoToJournal}
          style={({ pressed }) => [
            styles.journalLinkButton,
            pressed && styles.journalLinkPressed,
          ]}
          testID={TID.Button.NavigateJournal}
          accessibilityRole="link"
          accessibilityLabel={journalLinkAccessibilityLabel ?? journalLinkLabel}
        >
          <Text style={[styles.journalLinkText, { color: colors.accent }]}>
            {journalLinkLabel}
            <Text style={styles.journalLinkArrow}>{' '}→</Text>
          </Text>
        </Pressable>
      </View>
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
  submitButtonWrapperDisabled: {
    opacity: 0.65,
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
  journalLinkTarget: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 999,
    alignItems: 'center',
    alignSelf: 'center',
  },
  journalLinkButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  journalLinkSpotlight: {
    borderCurve: 'continuous',
  },
  journalLinkText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  journalLinkArrow: {
    fontSize: 15,
  },
  journalLinkPressed: {
    opacity: 0.5,
  },
});
