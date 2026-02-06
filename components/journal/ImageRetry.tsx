import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { ErrorType } from '@/lib/errors';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ImageRetryProps {
  onRetry: () => void;
  isRetrying?: boolean;
  /** Optional error type for contextual messaging */
  errorType?: ErrorType;
}

export function ImageRetry({ onRetry, isRetrying = false, errorType }: ImageRetryProps) {
  const { t } = useTranslation();
  const { colors, shadows } = useTheme();

  // Determine if error is transient (can retry) or blocked (cannot retry)
  const isBlocked = errorType === ErrorType.IMAGE_BLOCKED;
  const isTransient = errorType === ErrorType.IMAGE_TRANSIENT;

  // Get contextual title and message based on error type
  const getTitle = () => {
    if (isBlocked) return t('image_retry.content_blocked');
    if (isTransient) return t('image_retry.transient_error');
    return t('image_retry.generation_failed');
  };

  const getMessage = () => {
    if (isBlocked) return t('image_retry.blocked_message');
    if (isTransient) return t('image_retry.transient_message');
    return t('image_retry.default_message');
  };

  // Blocked errors cannot be retried
  const canRetry = !isBlocked;

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary, borderColor: colors.divider }]}>
      <View style={styles.iconContainer}>
        <IconSymbol name="photo" size={64} color={colors.textSecondary} />
        {!isRetrying && (
          <View style={[styles.errorBadge, { backgroundColor: colors.backgroundSecondary }]}>
            <IconSymbol
              name={isBlocked ? 'xmark.circle.fill' : 'exclamationmark.circle.fill'}
              size={24}
              color={isBlocked ? '#9CA3AF' : '#EF4444'}
            />
          </View>
        )}
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>{getTitle()}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{getMessage()}</Text>

      {canRetry && (
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
              <IconSymbol name="arrow.clockwise" size={20} color={colors.textPrimary} />
              <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>{t('image_retry.retry_generation')}</Text>
            </View>
          )}
        </Pressable>
      )}
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
