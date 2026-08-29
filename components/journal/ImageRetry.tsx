import { PressableScale } from '@/components/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { ErrorType } from '@/lib/errors';
import { TID } from '@/lib/testIDs';
import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ImageRetryProps {
  onRetry: () => void;
  isRetrying?: boolean;
  /** Optional error type for contextual messaging */
  errorType?: ErrorType;
}

export function ImageRetry({ onRetry, isRetrying = false, errorType }: ImageRetryProps) {
  const { t } = useTranslation();
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

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
    <View className="aspect-[2/3] w-full items-center justify-center rounded-lg border-2 border-dashed border-line bg-ink-soft p-6">
      <View className="relative mb-5">
        <IconSymbol name="photo" size={64} color={noctalia.text.secondary} />
        {!isRetrying && (
          <View className="absolute -bottom-1 -right-1 rounded-md bg-ink-raised p-0.5">
            <IconSymbol
              name={isBlocked ? 'xmark.circle.fill' : 'exclamationmark.circle.fill'}
              size={24}
              color={isBlocked ? noctalia.text.secondary : noctalia.status.danger.icon}
            />
          </View>
        )}
      </View>

      <Text className="mb-3 text-center font-sans-bold text-[20px] text-ivory">{getTitle()}</Text>
      <Text className="mb-6 px-4 text-center font-sans text-[15px] leading-[22px] text-ivory-muted">
        {getMessage()}
      </Text>

      {canRetry && (
        <PressableScale
          className={`flex-row items-center justify-center rounded-md border border-champagne-soft bg-champagne px-6 py-3.5 ${
            isRetrying ? 'opacity-60' : ''
          }`}
          style={shadows.lg}
          onPress={onRetry}
          disabled={isRetrying}
          testID={TID.Button.JournalImageRetry}
          accessibilityRole="button"
        >
          <View className="flex-row items-center gap-2">
            {isRetrying ? (
              <ActivityIndicator size="small" color={noctalia.action.primaryText} />
            ) : (
              <IconSymbol name="arrow.clockwise" size={20} color={noctalia.action.primaryText} />
            )}
            <Text className="font-sans-bold text-[16px] text-on-champagne">
              {isRetrying ? t('image_retry.generating') : t('image_retry.retry_generation')}
            </Text>
          </View>
        </PressableScale>
      )}
    </View>
  );
}
