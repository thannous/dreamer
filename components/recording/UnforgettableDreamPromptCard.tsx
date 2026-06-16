import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

type UnforgettableDreamPromptCardProps = {
  disabled?: boolean;
  onStartRememberedDream: () => void;
  onStartFreshTonight: () => void;
  onDismiss: () => void;
};

export function UnforgettableDreamPromptCard({
  disabled = false,
  onStartRememberedDream,
  onStartFreshTonight,
  onDismiss,
}: UnforgettableDreamPromptCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: `${colors.accentLight}55`,
        },
      ]}
      testID={TID.Component.UnforgettableDreamPrompt}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconShell,
            {
              backgroundColor: `${colors.accentLight}18`,
              borderColor: `${colors.accentLight}44`,
            },
          ]}
        >
          <IconSymbol name="moon.stars.fill" size={20} color={colors.accentLight} />
        </View>
        <View style={styles.copy}>
          <Text
            style={[styles.eyebrow, { color: colors.textSecondary }]}
          >
            {t('recording.remembered_prompt.eyebrow')}
          </Text>
          <Text
            style={[styles.title, { color: colors.textPrimary }]}
            testID={TID.Text.UnforgettableDreamPromptTitle}
          >
            {t('recording.remembered_prompt.title')}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {t('recording.remembered_prompt.body')}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onStartRememberedDream}
          disabled={disabled}
          accessibilityRole="button"
          style={[
            styles.primaryButton,
            {
              backgroundColor: disabled ? colors.divider : colors.accent,
            },
          ]}
          testID={TID.Button.UnforgettableDreamYes}
        >
          <IconSymbol name="pencil" size={18} color={colors.textPrimary} />
          <Text style={[styles.primaryText, { color: colors.textPrimary }]}>
            {t('recording.remembered_prompt.yes')}
          </Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            onPress={onStartFreshTonight}
            disabled={disabled}
            accessibilityRole="button"
            style={styles.secondaryButton}
            testID={TID.Button.UnforgettableDreamTonight}
          >
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
              {t('recording.remembered_prompt.tonight')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            disabled={disabled}
            accessibilityRole="button"
            style={styles.secondaryButton}
            testID={TID.Button.UnforgettableDreamSkip}
          >
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
              {t('recording.remembered_prompt.skip')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.md,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconShell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 18,
    lineHeight: 23,
  },
  body: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
    textAlign: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    minHeight: 42,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  secondaryText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    textAlign: 'center',
  },
});
