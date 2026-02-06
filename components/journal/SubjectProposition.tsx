import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { ThemeLayout } from '@/constants/journalTheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

interface SubjectPropositionProps {
  subjectType: 'person' | 'animal';
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * A non-intrusive card/banner that proposes adding reference photos
 * for a detected subject (person or animal) in the dream.
 */
export function SubjectProposition({
  subjectType,
  onAccept,
  onDismiss,
}: SubjectPropositionProps) {
  const { t } = useTranslation();
  const { colors, shadows } = useTheme();

  const iconName = subjectType === 'person' ? 'person.fill' : 'pawprint.fill';
  const title = t(`subject_proposition.title_${subjectType}`);
  const message = t(`subject_proposition.message_${subjectType}`);

  return (
    <View style={[styles.container, shadows.md, { backgroundColor: colors.backgroundCard, borderColor: colors.divider }]}>
      <View style={[styles.iconBadge, { backgroundColor: colors.accent }]}>
        <IconSymbol name={iconName} size={20} color={colors.textPrimary} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onAccept}
            style={[styles.acceptButton, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.acceptButtonText, { color: colors.textPrimary }]}>
              {t('subject_proposition.accept')}
            </Text>
          </Pressable>

          <Pressable onPress={onDismiss} style={styles.skipButton} hitSlop={8}>
            <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
              {t('subject_proposition.skip')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: ThemeLayout.spacing.md,
    borderRadius: ThemeLayout.borderRadius.lg,
    borderWidth: 1,
    gap: ThemeLayout.spacing.sm,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    marginBottom: ThemeLayout.spacing.xs,
  },
  message: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: ThemeLayout.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ThemeLayout.spacing.md,
  },
  acceptButton: {
    paddingVertical: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.md,
    borderRadius: ThemeLayout.borderRadius.md,
  },
  acceptButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
  },
  skipButton: {
    paddingVertical: ThemeLayout.spacing.sm,
  },
  skipButtonText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
  },
});

export default SubjectProposition;
