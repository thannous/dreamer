import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import {
  getProductAnalyticsPreference,
  isProductAnalyticsAvailable,
  setProductAnalyticsEnabled,
} from '@/lib/productAnalytics';

export function useAnalyticsPreferenceController() {
  const { t } = useTranslation();
  const collectionAvailable = isProductAnalyticsAvailable();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
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
  }, []);

  const toggle = useCallback(async (nextEnabled: boolean) => {
    if ((nextEnabled && !collectionAvailable) || saving) return;
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
  }, [collectionAvailable, enabled, saving]);

  // Previously granted consent must remain withdrawable while collection is off.
  const available = collectionAvailable || enabled === true;
  const status = !collectionAvailable
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
