import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Text,
  View,
} from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getLegalLink, type LegalLinkKind } from '@/constants/legalLinks';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { SettingsSection } from './SettingsSection';
import { SettingsToggle } from './SettingsToggle';
import { useAnalyticsPreferenceController } from '@/components/settings/useAnalyticsPreferenceController';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  finalizeAccountDeletion,
  requestAccountDeletion,
} from '@/services/accountDeletionService';

/** Rows are stacked edge to edge; hit slop would overlap the neighbouring row. */
const NO_HIT_SLOP = 0;

const ROW_CLASS = 'min-h-[64px] w-full flex-row items-center gap-3 border-t border-line py-3';

type LegalLinkRow = {
  icon: 'lock.shield' | 'doc.on.doc' | 'globe';
  kind: LegalLinkKind;
  labelKey: string;
  testID: string;
};

const LEGAL_LINK_ROWS: LegalLinkRow[] = [
  {
    icon: 'lock.shield',
    kind: 'privacyPolicy',
    labelKey: 'settings.legal.privacyPolicy',
    testID: 'settings-legal-privacy-policy',
  },
  {
    icon: 'doc.on.doc',
    kind: 'termsOfUse',
    labelKey: 'settings.legal.termsOfUse',
    testID: 'settings-legal-terms-of-use',
  },
  {
    icon: 'globe',
    kind: 'accountDeletion',
    labelKey: 'settings.legal.accountDeletion',
    testID: 'settings-legal-account-deletion',
  },
];

export function LegalSection() {
  const { colors, mode } = useTheme();
  const { user } = useAuth();
  const { t, currentLang } = useTranslation();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const [isDeleting, setIsDeleting] = useState(false);
  const analyticsPreference = useAnalyticsPreferenceController();

  const openLegalLink = useCallback(
    (kind: LegalLinkKind) => {
      void Linking.openURL(getLegalLink(kind, currentLang)).catch(() => {
        // No browser available: nothing actionable to surface here.
      });
    },
    [currentLang]
  );

  const runDeletion = useCallback(() => {
    if (isDeleting) return;
    setIsDeleting(true);
    requestAccountDeletion()
      .then(async () => {
        // Sign out right away: the local session is dead server-side, and the
        // auth gate must route back to the sign-in screen even if the user
        // dismisses the confirmation alert.
        await finalizeAccountDeletion().catch(() => {
          // The account is already deleted; stale local tokens expire on their own.
        });
        Alert.alert(
          t('settings.deleteAccount.successTitle'),
          t('settings.deleteAccount.successMessage')
        );
      })
      .catch(() => {
        setIsDeleting(false);
        Alert.alert(t('settings.deleteAccount.errorMessage'));
      });
  }, [isDeleting, t]);

  const confirmDeletion = useCallback(() => {
    Alert.alert(
      t('settings.deleteAccount.confirmTitle'),
      t('settings.deleteAccount.confirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccount.confirmButton'),
          onPress: () => {
            Alert.alert(
              t('settings.deleteAccount.confirmTitle'),
              t('settings.deleteAccount.subscriptionWarning'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('settings.deleteAccount.confirmButton'),
                  style: 'destructive',
                  onPress: runDeletion,
                },
              ]
            );
          },
        },
      ]
    );
  }, [runDeletion, t]);

  return (
    <SettingsSection title={t('settings.legal.sectionTitle')} testID="settings-section-legal">
      {analyticsPreference.available ? (
        <View
          accessibilityRole="switch"
          accessibilityState={{ checked: analyticsPreference.enabled === true }}
          aria-checked={analyticsPreference.enabled === true}
          accessibilityLabel={analyticsPreference.toggleLabel}
          className="min-h-[64px] w-full flex-row items-center gap-3 py-3"
          testID="settings-analytics-preference"
        >
          <IconSymbol name="chart.bar.fill" size={21} color={noctalia.accent.text} />
          <View className="flex-1 gap-0.5">
            <Text className="flex-1 font-sans text-[15px] leading-[20px] text-ivory">
              {analyticsPreference.title}
            </Text>
            <Text className="font-sans text-caption text-ivory-muted">
              {analyticsPreference.error ? analyticsPreference.errorMessage : analyticsPreference.description}
            </Text>
          </View>
          <SettingsToggle
            disabled={analyticsPreference.loading || analyticsPreference.saving}
            onValueChange={(next) => {
              void analyticsPreference.toggle(next);
            }}
            testID="settings-analytics-preference-switch"
            value={analyticsPreference.enabled === true}
          />
        </View>
      ) : null}
      {LEGAL_LINK_ROWS.map((row, index) => (
        <PressableScale
          accessibilityRole="link"
          key={row.kind}
          onPress={() => openLegalLink(row.kind)}
          className={index === 0 && !analyticsPreference.available ? ROW_CLASS.replace('border-t border-line', '') : ROW_CLASS}
          hitSlop={NO_HIT_SLOP}
          testID={row.testID}
        >
          <IconSymbol name={row.icon} size={21} color={noctalia.accent.text} />
          <Text className="flex-1 font-sans text-[15px] leading-[20px] text-ivory">
            {t(row.labelKey)}
          </Text>
          <IconSymbol name="chevron.right" size={20} color={noctalia.text.tertiary} />
        </PressableScale>
      ))}
      {user ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ disabled: isDeleting }}
          disabled={isDeleting}
          onPress={confirmDeletion}
          className={ROW_CLASS}
          hitSlop={NO_HIT_SLOP}
          testID="settings-delete-account"
        >
          <IconSymbol name="trash" size={21} color={noctalia.status.danger.icon} />
          <View className="flex-1 gap-0.5">
            <Text className="flex-1 font-sans text-[15px] leading-[20px] text-danger-on">
              {t('settings.deleteAccount.title')}
            </Text>
            <Text className="font-sans text-caption text-ivory-muted">
              {t('settings.deleteAccount.description')}
            </Text>
          </View>
          {isDeleting ? (
            <ActivityIndicator color={noctalia.status.danger.icon} testID="settings-delete-account-loading" />
          ) : null}
        </PressableScale>
      ) : null}
    </SettingsSection>
  );
}
