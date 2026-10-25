import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import {
  hasAiConsent,
  requestAiConsent,
  subscribeAiConsent,
  withdrawAiConsent,
} from '@/lib/aiConsent';

/**
 * The AI permission as a setting. Turning it on shows the same disclosure as any AI action;
 * turning it off withdraws it at once and keeps every dream and reading.
 */
export function useAiConsentController() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void hasAiConsent().then((granted) => {
        if (active) setEnabled(granted);
      });
    };
    refresh();
    const unsubscribe = subscribeAiConsent(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const toggle = useCallback(async (nextEnabled: boolean) => {
    if (saving) return;
    setSaving(true);
    setError(false);
    try {
      if (nextEnabled) {
        setEnabled(await requestAiConsent(t));
      } else {
        setEnabled(false);
        await withdrawAiConsent();
      }
    } catch {
      // Withdrawal already holds for this session even if the device could not store it.
      setError(true);
    } finally {
      setSaving(false);
    }
  }, [saving, t]);

  return {
    title: t('settings.ai.title'),
    description: t('settings.ai.description'),
    toggleLabel: t('settings.ai.toggle_label'),
    errorMessage: t('analytics.privacy.error'),
    enabled: enabled === true,
    loading: enabled === null,
    saving,
    error,
    toggle,
  };
}

export default useAiConsentController;
