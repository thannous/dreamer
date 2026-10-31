import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { createScopedLogger } from '@/lib/logger';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

type OfflineModelDownloadSheetProps = {
  visible: boolean;
  onClose: () => void;
  locale: string;
  onDownloadComplete: (success: boolean) => void;
};

const log = createScopedLogger('[OfflineModelDownloadSheet]');

export function OfflineModelDownloadSheet({
  visible,
  onClose,
  locale,
  onDownloadComplete,
}: OfflineModelDownloadSheetProps) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const [isDownloading, setIsDownloading] = useState(false);
  // The sheet names the language, never its code ("en-US"); an unknown code is shown as is.
  const languageKey = `recording.alert.offline_model_vocal.language.${locale.split(/[-_]/)[0].toLowerCase()}`;
  const languageName = t(languageKey);
  const language = languageName && languageName !== languageKey ? languageName : locale;

  const handleDownload = useCallback(async () => {
    try {
      setIsDownloading(true);
      log.debug('triggering offline model download', { locale });

      const res = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload?.({ locale });
      const downloadSuccess = res?.status === 'download_success' || res?.status === 'opened_dialog';

      log.debug('offline model download response', {
        locale,
        status: res?.status,
        success: downloadSuccess,
      });

      onDownloadComplete(downloadSuccess);
      onClose();
    } catch (error) {
      log.warn('offline model download failed', { locale, error });
      onDownloadComplete(false);
      onClose();
    } finally {
      setIsDownloading(false);
    }
  }, [locale, onDownloadComplete, onClose]);

  const handleCancel = useCallback(() => {
    log.debug('offline model download cancelled by user', { locale });
    onDownloadComplete(false);
    onClose();
  }, [locale, onDownloadComplete, onClose]);

  return (
    <StandardBottomSheet
      testID="sheet.offline-model-download"
      visible={visible}
      onClose={handleCancel}
      title={t('recording.alert.offline_model_vocal.title') || 'Pack de langue pour la reconnaissance vocale'}
      subtitle={
        // The copy writes the approximation sign itself.
        t('recording.alert.offline_model_vocal.message', { locale: language, size: '45 MB' }) ||
        `Pour enregistrer vos rêves vocalement en ${language}, téléchargez le pack de langue (~45 MB).`
      }
      actions={{
        primaryLabel: t('common.download') || 'Télécharger',
        onPrimary: handleDownload,
        primaryDisabled: isDownloading,
        primaryLoading: isDownloading,
        secondaryLabel: t('common.cancel') || 'Annuler',
        secondaryTestID: 'btn.offline-model.cancel',
        onSecondary: handleCancel,
        secondaryDisabled: isDownloading,
      }}
    >
      {isDownloading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={noctalia.accent.text} />
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
