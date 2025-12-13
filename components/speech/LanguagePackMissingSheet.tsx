import React, { useMemo } from 'react';

import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { useTranslation } from '@/hooks/useTranslation';

type LanguagePackMissingSheetProps = {
  visible: boolean;
  onClose: () => void;
  locale: string;
  installedLocales: string[];
  onOpenSettings: () => void;
  onOpenGoogleAppSettings?: () => void;
};

export function LanguagePackMissingSheet({
  visible,
  onClose,
  locale,
  installedLocales,
  onOpenSettings,
  onOpenGoogleAppSettings,
}: LanguagePackMissingSheetProps) {
  const { t } = useTranslation();

  const installedText = useMemo(() => {
    if (!installedLocales.length) return t('recording.alert.language_pack_missing.none');
    return installedLocales.join(', ');
  }, [installedLocales, t]);

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('recording.alert.language_pack_missing.title')}
      subtitle={t('recording.alert.language_pack_missing.message', {
        locale,
        installed: installedText,
      })}
      actions={{
        primaryLabel: t('recording.alert.language_pack_missing.cta'),
        onPrimary: onOpenSettings,
        secondaryLabel: t('common.cancel'),
        onSecondary: onClose,
        linkLabel: onOpenGoogleAppSettings ? t('recording.alert.language_pack_missing.google_cta') : undefined,
        onLink: onOpenGoogleAppSettings,
      }}
    />
  );
}

export default LanguagePackMissingSheet;
