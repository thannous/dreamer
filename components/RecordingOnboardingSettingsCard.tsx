import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import {
  saveRecordingOnboardingCompleted,
  saveRecordingVoiceStatusHidden,
} from '@/services/storageService';

export default function RecordingOnboardingSettingsCard() {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const [isRestarting, setIsRestarting] = useState(false);

  const handleRestartOnboarding = useCallback(async () => {
    setIsRestarting(true);
    try {
      await Promise.all([
        saveRecordingOnboardingCompleted(false),
        saveRecordingVoiceStatusHidden(false),
      ]);
      router.push('/recording');
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to restart recording onboarding:', error);
      }
    } finally {
      setIsRestarting(false);
    }
  }, []);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: noctalia.surface.raised,
          borderColor: noctalia.surface.border,
        },
      ]}
    >
      <Text style={[styles.cardTitle, { color: noctalia.text.primary }]}>
        {t('settings.onboarding.title')}
      </Text>
      <Text style={[styles.description, { color: noctalia.text.secondary }]}>
        {t('settings.onboarding.description')}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.actionButton,
          { backgroundColor: noctalia.surface.active },
          pressed && styles.actionPressed,
          isRestarting && styles.actionDisabled,
        ]}
        onPress={handleRestartOnboarding}
        disabled={isRestarting}
        accessibilityRole="button"
        accessibilityLabel={t('settings.onboarding.restart')}
        testID={TID.Button.RecordingOnboardingRestart}
      >
        <View style={[styles.iconContainer, { backgroundColor: noctalia.action.primary }]}>
          <IconSymbol name="arrow.clockwise" size={20} color={noctalia.action.primaryText} />
        </View>
        <View style={styles.actionText}>
          <Text style={[styles.actionLabel, { color: noctalia.text.primary }]}>
            {t('settings.onboarding.restart')}
          </Text>
          <Text style={[styles.actionDescription, { color: noctalia.text.secondary }]}>
            {t('settings.onboarding.restart_hint')}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={20} color={noctalia.text.tertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.xl,
    padding: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    marginBottom: ThemeLayout.spacing.xs,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    marginBottom: ThemeLayout.spacing.md,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.sm,
    borderRadius: ThemeLayout.borderRadius.sm,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionDisabled: {
    opacity: 0.55,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: ThemeLayout.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ThemeLayout.spacing.sm,
  },
  actionText: {
    flex: 1,
    marginRight: ThemeLayout.spacing.sm,
  },
  actionLabel: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
});
