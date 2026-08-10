import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getLegalLink, type LegalLinkKind } from '@/constants/legalLinks';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  finalizeAccountDeletion,
  requestAccountDeletion,
} from '@/services/accountDeletionService';

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
    <View
      style={[
        styles.card,
        {
          backgroundColor: noctalia.surface.raised,
          borderColor: noctalia.surface.borderStrong,
        },
      ]}
      testID="settings-section-legal"
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: noctalia.text.primary }]}>
          {t('settings.legal.sectionTitle')}
        </Text>
        <IconSymbol name="lock.shield" size={23} color={noctalia.accent.base} />
      </View>
      {LEGAL_LINK_ROWS.map((row) => (
        <Pressable
          accessibilityRole="link"
          key={row.kind}
          onPress={() => openLegalLink(row.kind)}
          style={({ pressed }) => [
            styles.row,
            { borderTopColor: noctalia.surface.border, borderTopWidth: 1 },
            pressed && styles.rowPressed,
          ]}
          testID={row.testID}
        >
          <IconSymbol name={row.icon} size={21} color={noctalia.accent.base} />
          <Text style={[styles.rowLabel, { color: noctalia.text.primary }]}>
            {t(row.labelKey)}
          </Text>
          <IconSymbol name="chevron.right" size={20} color={noctalia.text.tertiary} />
        </Pressable>
      ))}
      {user ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isDeleting }}
          disabled={isDeleting}
          onPress={confirmDeletion}
          style={({ pressed }) => [
            styles.row,
            { borderTopColor: noctalia.surface.border, borderTopWidth: 1 },
            pressed && styles.rowPressed,
          ]}
          testID="settings-delete-account"
        >
          <IconSymbol name="trash" size={21} color={noctalia.status.danger.icon} />
          <View style={styles.deleteCopy}>
            <Text style={[styles.rowLabel, { color: noctalia.status.danger.text }]}>
              {t('settings.deleteAccount.title')}
            </Text>
            <Text style={[styles.deleteDescription, { color: noctalia.text.secondary }]}>
              {t('settings.deleteAccount.description')}
            </Text>
          </View>
          {isDeleting ? (
            <ActivityIndicator color={noctalia.status.danger.icon} testID="settings-delete-account-loading" />
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 16,
    width: '100%',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  cardTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 22,
    lineHeight: 28,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    minHeight: 46,
    paddingVertical: 8,
    width: '100%',
  },
  rowPressed: {
    opacity: 0.82,
  },
  rowLabel: {
    flex: 1,
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  deleteCopy: {
    flex: 1,
    gap: 2,
  },
  deleteDescription: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    lineHeight: 16,
  },
});
