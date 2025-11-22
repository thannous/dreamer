import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface ImageRetryProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function ImageRetry({ onRetry, isRetrying = false }: ImageRetryProps) {
  const { t } = useTranslation();
  const { colors, shadows } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary, borderColor: colors.divider }]}>
      <View style={styles.iconContainer}>
        <Ionicons name="image-outline" size={64} color={colors.textSecondary} />
        {!isRetrying && (
          <View style={[styles.errorBadge, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
          </View>
        )}
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('image_retry.generation_failed')}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        We couldn&apos;t generate an image for this dream. You can try again to create dream imagery.
      </Text>

      <Pressable
        style={[styles.retryButton, shadows.lg, { backgroundColor: colors.accent }, isRetrying && styles.retryButtonDisabled]}
        onPress={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color={colors.textPrimary} />
            <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>{t('image_retry.generating')}</Text>
          </View>
        ) : (
          <View style={styles.buttonContent}>
            <Ionicons name="refresh" size={20} color={colors.textPrimary} />
            <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>{t('image_retry.retry_generation')}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 2 / 3,
    // backgroundColor: set dynamically
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    // borderColor: set dynamically
    borderStyle: 'dashed',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  errorBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    // backgroundColor: set dynamically
    borderRadius: 12,
    padding: 2,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: set dynamically
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    // shadow: applied via theme shadows.lg
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
    letterSpacing: 0.3,
  },
});
