import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

type OfflineModelDownloadSheetProps = {
  visible: boolean;
  onClose: () => void;
  locale: string;
  onDownloadComplete: (success: boolean) => void;
};

export function OfflineModelDownloadSheet({
  visible,
  onClose,
  locale,
  onDownloadComplete,
}: OfflineModelDownloadSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      setIsDownloading(true);
      if (__DEV__) {
        console.log('[OfflineModelDownloadSheet] triggering offline model download', { locale });
      }

      const res = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload?.({ locale });
      const downloadSuccess = res?.status === 'download_success' || res?.status === 'opened_dialog';

      if (__DEV__) {
        console.log('[OfflineModelDownloadSheet] offline model download response', {
          locale,
          status: res?.status,
          success: downloadSuccess,
        });
      }

      onDownloadComplete(downloadSuccess);
      onClose();
    } catch (error) {
      if (__DEV__) {
        console.warn('[OfflineModelDownloadSheet] offline model download failed', { locale, error });
      }
      onDownloadComplete(false);
      onClose();
    } finally {
      setIsDownloading(false);
    }
  }, [locale, onDownloadComplete, onClose]);

  const handleCancel = useCallback(() => {
    if (__DEV__) {
      console.log('[OfflineModelDownloadSheet] offline model download cancelled by user', { locale });
    }
    onDownloadComplete(false);
    onClose();
  }, [locale, onDownloadComplete, onClose]);

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={handleCancel}
      title={t('recording.alert.offline_model_vocal.title') || 'Pack de langue pour la reconnaissance vocale'}
      subtitle={
        t('recording.alert.offline_model_vocal.message', { locale, size: '~45 MB' }) ||
        `Pour enregistrer vos rêves vocalement en ${locale}, téléchargez le pack de langue (~45 MB).`
      }
      actions={{
        primaryLabel: t('common.download') || 'Télécharger',
        onPrimary: handleDownload,
        primaryDisabled: isDownloading,
        primaryLoading: isDownloading,
        secondaryLabel: t('common.cancel') || 'Annuler',
        onSecondary: handleCancel,
        secondaryDisabled: isDownloading,
      }}
    >
      {isDownloading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </StandardBottomSheet>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
