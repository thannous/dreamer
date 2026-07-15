import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import {
  getProductAnalyticsPreference,
  isProductAnalyticsAvailable,
  setProductAnalyticsEnabled,
} from '@/lib/productAnalytics';

export function useAnalyticsPreferenceController() {
  const { t } = useTranslation();
  const available = isProductAnalyticsAvailable();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!available) return;

    let active = true;
    void getProductAnalyticsPreference()
      .then((preference) => {
        if (active) setEnabled(preference === 'enabled');
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [available]);

  const toggle = useCallback(async (nextEnabled: boolean) => {
    if (!available || saving) return;
    const previous = enabled;
    setEnabled(nextEnabled);
    setSaving(true);
    setError(false);
    try {
      await setProductAnalyticsEnabled(nextEnabled);
    } catch {
      // Keep disabling fail-closed for the current session, matching the
      // existing privacy control even if the preference cannot be persisted.
      setEnabled(nextEnabled ? previous : false);
      setError(true);
    } finally {
      setSaving(false);
    }
  }, [available, enabled, saving]);

  const status = !available
    ? t('analytics.privacy.unavailable')
    : enabled
      ? t('analytics.privacy.enabled')
      : t('analytics.privacy.disabled');

  return {
    title: t('analytics.privacy.title'),
    description: t('analytics.privacy.description'),
    toggleLabel: t('analytics.privacy.toggle_label'),
    status,
    errorMessage: t('analytics.privacy.error'),
    available,
    enabled: available ? enabled : false,
    loading: available && enabled === null,
    saving,
    error,
    toggle,
  };
}

export default useAnalyticsPreferenceController;
