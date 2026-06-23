import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
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
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: noctalia.surface.raised,
          borderColor: noctalia.surface.borderStrong,
        },
      ]}
      testID={TID.Component.UnforgettableDreamPrompt}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconShell,
            {
              backgroundColor: noctalia.surface.soft,
              borderColor: noctalia.surface.border,
            },
          ]}
        >
          <IconSymbol name="moon.stars.fill" size={20} color={noctalia.accent.soft} />
        </View>
        <View style={styles.copy}>
          <Text
            style={[styles.eyebrow, { color: noctalia.text.secondary }]}
          >
            {t('recording.remembered_prompt.eyebrow')}
          </Text>
          <Text
            style={[styles.title, { color: noctalia.text.primary }]}
            testID={TID.Text.UnforgettableDreamPromptTitle}
          >
            {t('recording.remembered_prompt.title')}
          </Text>
          <Text style={[styles.body, { color: noctalia.text.secondary }]}>
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
              backgroundColor: disabled ? noctalia.action.disabled : noctalia.action.primary,
            },
          ]}
          testID={TID.Button.UnforgettableDreamYes}
        >
          <IconSymbol name="pencil" size={18} color={disabled ? noctalia.action.disabledText : noctalia.action.primaryText} />
          <Text style={[styles.primaryText, { color: disabled ? noctalia.action.disabledText : noctalia.action.primaryText }]}>
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
            <Text style={[styles.secondaryText, { color: noctalia.text.secondary }]}>
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
            <Text style={[styles.secondaryText, { color: noctalia.text.secondary }]}>
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
