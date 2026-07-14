import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  getProductAnalyticsPreference,
  isProductAnalyticsAvailable,
  setProductAnalyticsEnabled,
} from '@/lib/productAnalytics';

export function AnalyticsPrivacySettingsCard() {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const available = isProductAnalyticsAvailable();
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

  const handleToggle = useCallback(async (nextEnabled: boolean) => {
    if (saving) return;
    const previous = enabled;
    setEnabled(nextEnabled);
    setSaving(true);
    setError(false);
    try {
      await setProductAnalyticsEnabled(nextEnabled);
    } catch {
      // Disabling fails closed for the current session even when persistence
      // fails; keep the visible switch off and surface the retryable error.
      setEnabled(nextEnabled ? previous : false);
      setError(true);
    } finally {
      setSaving(false);
    }
  }, [enabled, saving]);

  const status = !available
    ? t('analytics.privacy.unavailable')
    : enabled
      ? t('analytics.privacy.enabled')
      : t('analytics.privacy.disabled');

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
      ]}
    >
      <Text style={[styles.title, { color: noctalia.text.primary }]}>
        {t('analytics.privacy.title')}
      </Text>
      <Text style={[styles.description, { color: noctalia.text.secondary }]}>
        {t('analytics.privacy.description')}
      </Text>
      <View style={styles.controlRow}>
        <View style={styles.statusContainer}>
          <Text style={[styles.controlLabel, { color: noctalia.text.primary }]}>
            {t('analytics.privacy.toggle_label')}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.status, { color: noctalia.text.secondary }]}
          >
            {status}
          </Text>
          {error ? (
            <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: noctalia.status.danger.text }]}>
              {t('analytics.privacy.error')}
            </Text>
          ) : null}
        </View>
        {enabled === null ? (
          <ActivityIndicator color={noctalia.accent.strong} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            disabled={saving}
            accessibilityLabel={t('analytics.privacy.toggle_label')}
            accessibilityHint={t('onboarding.privacy.toggle_hint')}
            accessibilityState={{ disabled: saving, checked: enabled }}
            testID="settings-analytics-privacy-toggle"
          />
        )}
      </View>
    </View>
  );
}

export default AnalyticsPrivacySettingsCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: ThemeLayout.borderRadius.xl,
    borderWidth: 1,
    marginBottom: ThemeLayout.spacing.md,
    padding: ThemeLayout.spacing.md,
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 18,
    marginBottom: ThemeLayout.spacing.xs,
  },
  description: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: ThemeLayout.spacing.md,
  },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  statusContainer: {
    flex: 1,
    marginRight: ThemeLayout.spacing.sm,
  },
  controlLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  status: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  error: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});
