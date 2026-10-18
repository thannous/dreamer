import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import {
  getStabilityReportsEnabled,
  isStabilityReportingAvailable,
  setStabilityReportsEnabled,
} from '@/lib/observe';

/** The opt-out for EAS Observe, which runs on legitimate interest and so is on by default. */
export function useStabilityReportsController() {
  const { t } = useTranslation();
  const available = isStabilityReportingAvailable();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!available) return;
    let active = true;
    void getStabilityReportsEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [available]);

  const toggle = useCallback(async (nextEnabled: boolean) => {
    if (saving) return;
    setEnabled(nextEnabled);
    setSaving(true);
    setError(false);
    try {
      await setStabilityReportsEnabled(nextEnabled);
    } catch {
      // Observe already took the choice for this session; only storing it failed.
      setError(true);
    } finally {
      setSaving(false);
    }
  }, [saving]);

  return {
    title: t('settings.stability.title'),
    description: t('settings.stability.description'),
    toggleLabel: t('settings.stability.toggle_label'),
    errorMessage: t('analytics.privacy.error'),
    available,
    enabled: enabled === true,
    loading: available && enabled === null && !error,
    saving,
    error,
    toggle,
  };
}
