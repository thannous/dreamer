import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Text,
  View,
} from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getLegalLink, type LegalLinkKind } from '@/constants/legalLinks';
import { CONTACT_EMAIL, openContactMail } from '@/lib/contact';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { SettingsSection } from './SettingsSection';
import { SettingsToggle } from './SettingsToggle';
import { useAiConsentController } from '@/components/settings/useAiConsentController';
import { useAnalyticsPreferenceController } from '@/components/settings/useAnalyticsPreferenceController';
import { useStabilityReportsController } from '@/components/settings/useStabilityReportsController';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import {
  finalizeAccountDeletion,
  requestAccountDeletion,
} from '@/services/accountDeletionService';

// react-native-web's Alert is a no-op: the browser's own dialogs ask and tell there.
const confirmInBrowser = (title: string, message: string): boolean =>
  typeof window !== 'undefined' && typeof window.confirm === 'function' && window.confirm(`${title}\n\n${message}`);

function tell(title: string, message?: string) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message);
    return;
  }
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(message ? `${title}\n\n${message}` : title);
  }
}

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
  const aiConsent = useAiConsentController();
  const analyticsPreference = useAnalyticsPreferenceController();
  const stabilityReports = useStabilityReportsController();

  const openLegalLink = useCallback(
    (kind: LegalLinkKind) => {
      void Linking.openURL(getLegalLink(kind, currentLang)).catch(() => {
        // No browser available: nothing actionable to surface here.
      });
    },
    [currentLang]
  );

  const writeToUs = useCallback(() => {
    void openContactMail({
      unavailableTitle: t('settings.legal.contact'),
      unavailableMessage: t('contact.mail_unavailable', { email: CONTACT_EMAIL }),
    });
  }, [t]);

  const runDeletion = useCallback(() => {
    if (isDeleting || !user) return;
    setIsDeleting(true);
    requestAccountDeletion()
      .then(async () => {
        // Sign out right away: the local session is dead server-side, and the
        // auth gate must route back to the sign-in screen even if the user
        // dismisses the confirmation alert.
        await finalizeAccountDeletion(user.id).catch(() => {
          // The account is already deleted; stale local tokens expire on their own.
        });
        tell(
          t('settings.deleteAccount.successTitle'),
          t('settings.deleteAccount.successMessage')
        );
      })
      .catch(() => {
        setIsDeleting(false);
        tell(t('settings.deleteAccount.errorMessage'));
      });
  }, [isDeleting, t, user]);

  const confirmDeletion = useCallback(() => {
    if (Platform.OS === 'web') {
      // The same two steps as on a phone, one browser question each.
      const title = t('settings.deleteAccount.confirmTitle');
      if (confirmInBrowser(title, t('settings.deleteAccount.confirmMessage'))
        && confirmInBrowser(title, t('settings.deleteAccount.subscriptionWarning'))) runDeletion();
      return;
    }
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
      <View
        accessibilityRole="switch"
        accessibilityState={{ checked: aiConsent.enabled }}
        aria-checked={aiConsent.enabled}
        accessibilityLabel={aiConsent.toggleLabel}
        className={ROW_CLASS.replace('border-t border-line', '')}
        testID="settings-ai-consent"
      >
        <IconSymbol name="sparkles" size={21} color={noctalia.accent.text} />
        <View className="flex-1 gap-0.5">
          <Text className="flex-1 font-sans text-body leading-[20px] text-ivory">
            {aiConsent.title}
          </Text>
          <Text className="font-sans text-caption text-ivory-muted">
            {aiConsent.error ? aiConsent.errorMessage : aiConsent.description}
          </Text>
        </View>
        <SettingsToggle
          disabled={aiConsent.loading || aiConsent.saving}
          onValueChange={(next) => {
            void aiConsent.toggle(next);
          }}
          testID={TID.Button.SettingsAiConsentToggle}
          value={aiConsent.enabled}
        />
      </View>
      {analyticsPreference.available ? (
        <View
          accessibilityRole="switch"
          accessibilityState={{ checked: analyticsPreference.enabled === true }}
          aria-checked={analyticsPreference.enabled === true}
          accessibilityLabel={analyticsPreference.toggleLabel}
          className={ROW_CLASS}
          testID="settings-analytics-preference"
        >
          <IconSymbol name="chart.bar.fill" size={21} color={noctalia.accent.text} />
          <View className="flex-1 gap-0.5">
            <Text className="flex-1 font-sans text-body leading-[20px] text-ivory">
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
      {stabilityReports.available ? (
        <View
          accessibilityRole="switch"
          accessibilityState={{ checked: stabilityReports.enabled }}
          aria-checked={stabilityReports.enabled}
          accessibilityLabel={stabilityReports.toggleLabel}
          className={ROW_CLASS}
          testID="settings-stability-reports"
        >
          <IconSymbol name="exclamationmark.triangle" size={21} color={noctalia.accent.text} />
          <View className="flex-1 gap-0.5">
            <Text className="flex-1 font-sans text-body leading-[20px] text-ivory">
              {stabilityReports.title}
            </Text>
            <Text className="font-sans text-caption text-ivory-muted">
              {stabilityReports.error ? stabilityReports.errorMessage : stabilityReports.description}
            </Text>
          </View>
          <SettingsToggle
            disabled={stabilityReports.loading || stabilityReports.saving}
            onValueChange={(next) => {
              void stabilityReports.toggle(next);
            }}
            testID="settings-stability-reports-switch"
            value={stabilityReports.enabled}
          />
        </View>
      ) : null}
      {LEGAL_LINK_ROWS.map((row) => (
        <PressableScale
          accessibilityRole="link"
          key={row.kind}
          onPress={() => openLegalLink(row.kind)}
          className={ROW_CLASS}
          hitSlop={NO_HIT_SLOP}
          testID={row.testID}
        >
          <IconSymbol name={row.icon} size={21} color={noctalia.accent.text} />
          <Text className="flex-1 font-sans text-body leading-[20px] text-ivory">
            {t(row.labelKey)}
          </Text>
          <IconSymbol name="chevron.right" size={20} color={noctalia.text.tertiary} />
        </PressableScale>
      ))}
      <PressableScale
        accessibilityRole="link"
        onPress={writeToUs}
        className={ROW_CLASS}
        hitSlop={NO_HIT_SLOP}
        testID="settings-legal-contact"
      >
        <IconSymbol name="envelope" size={21} color={noctalia.accent.text} />
        <View className="flex-1 gap-0.5">
          <Text className="flex-1 font-sans text-body leading-[20px] text-ivory">
            {t('settings.legal.contact')}
          </Text>
          <Text className="font-sans text-caption text-ivory-muted">{CONTACT_EMAIL}</Text>
        </View>
        <IconSymbol name="chevron.right" size={20} color={noctalia.text.tertiary} />
      </PressableScale>
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
            <Text className="flex-1 font-sans text-body leading-[20px] text-danger-on">
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
