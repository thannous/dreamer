import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useLibraryMetadata } from '@/context/LibraryContext';

/**
 * Small, actionable feedback for the device-only library.
 *
 * The notice intentionally does not expose the storage error itself: it is an
 * implementation detail and may contain platform-specific or sensitive data.
 * A retry is always safe because LibraryProvider keeps the optimistic state
 * available while the write is retried.
 */
export function LibraryPersistenceNotice() {
  const { loaded, persistenceError, retryPersistence } = useLibraryMetadata();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await retryPersistence();
    } catch {
      // Providers normally retain the error instead of throwing. Keep this
      // guard so a future provider implementation cannot create an unhandled
      // rejection from a button press.
    } finally {
      setRetrying(false);
    }
  }, [retryPersistence, retrying]);

  if (!persistenceError) return null;

  return (
    <View
      testID="library.persistence.notice"
      className="px-gutter"
      style={{ paddingTop: insets.top }}>
      <Card className="gap-3">
        <Text
          variant="bodySm"
          tone="default"
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {t(loaded ? 'library.persistence.writeError' : 'library.persistence.readError')}
        </Text>
        <Button
          testID="library.persistence.retry"
          label={t('library.persistence.retry')}
          variant="secondary"
          size="md"
          loading={retrying}
          onPress={handleRetry}
        />
      </Card>
    </View>
  );
}
