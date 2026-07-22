import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { isGuestQaLabEnabled } from '@/lib/env';
import {
  enrollGuestQaDevice,
  getGuestQaStatus,
  revokeGuestQaDevice,
  type GuestQaStatus,
} from '@/services/guestQaService';

const getErrorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || !error) {
    return null;
  }
  const body = (error as { body?: unknown }).body;
  if (typeof body !== 'object' || !body) return null;
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
};

const getErrorMessage = (error: unknown): string => {
  if (
    typeof error === 'object'
    && error !== null
    && (error as { code?: unknown }).code === 'QA_LOCAL_DREAMS_PENDING'
  ) {
    const pendingDreamCount = Number((error as { pendingDreamCount?: unknown }).pendingDreamCount);
    return `${Number.isFinite(pendingDreamCount) ? pendingDreamCount : 'Des'} rêve(s) invité(s) local(aux) doivent d’abord être synchronisés avec le compte.`;
  }
  switch (getErrorCode(error)) {
    case 'QA_ACCESS_DENIED':
      return 'Ce compte n’est pas autorisé comme opérateur QA.';
    case 'QA_DAILY_RESET_LIMIT':
      return 'Les trois réinitialisations QA du jour ont déjà été utilisées.';
    case 'QA_DEVICE_LIMIT':
      return 'Un autre appareil possède déjà le passeport QA actif.';
    case 'QA_SERVICE_UNAVAILABLE':
    case 'QA_BUDGET_UNAVAILABLE':
      return 'Le service QA est momentanément indisponible.';
    default:
      return 'Impossible de préparer le mode invité de production.';
  }
};

const formatExpiry = (value?: string): string => {
  if (!value) return 'inactive';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'inactive';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function GuestProdQALab() {
  const enabled = isGuestQaLabEnabled() && Platform.OS === 'android';
  const { user } = useAuth();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const [status, setStatus] = useState<GuestQaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !user) return;
    setLoading(true);
    setError(null);
    try {
      setStatus(await getGuestQaStatus());
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [enabled, user]);

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timeout);
  }, [refresh]);

  const startGuestRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        assertGuestQaLocalStateReady,
        prepareGuestQaLocalState,
      } = await import('@/lib/guestQaLocalState');
      // Fail before consuming a server reset if unsynchronized local guest
      // content still exists on the device.
      await assertGuestQaLocalStateReady();
      await enrollGuestQaDevice();
      await prepareGuestQaLocalState();
      const { signOut } = await import('@/lib/auth');
      await signOut();
      router.replace('/onboarding');
    } catch (cause) {
      setError(getErrorMessage(cause));
      setLoading(false);
    }
  }, []);

  const confirmStart = useCallback(() => {
    Alert.alert(
      'Démarrer un test invité réel ?',
      'Le compte sera déconnecté. Les quotas, l’anti-rafale et Play Integrity resteront actifs.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Démarrer', onPress: () => void startGuestRun() },
      ]
    );
  }, [startGuestRun]);

  const revoke = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await revokeGuestQaDevice();
      await refresh();
    } catch (cause) {
      setError(getErrorMessage(cause));
      setLoading(false);
    }
  }, [refresh]);

  if (!enabled || !user) return null;

  const passportState = status?.active
    ? status.deviceMatches
      ? `Actif sur cet appareil jusqu’au ${formatExpiry(status.validUntil)}`
      : `Actif sur un autre appareil jusqu’au ${formatExpiry(status.validUntil)}`
    : 'Aucun passeport actif';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: noctalia.surface.soft,
          borderColor: noctalia.surface.borderStrong,
        },
      ]}
      testID="guest-prod-qa-lab"
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: noctalia.accent.soft }]}>
          <IconSymbol name="checkmark.shield.fill" size={22} color={noctalia.accent.base} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: noctalia.text.primary }]}>Passeport invité QA</Text>
          <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
            Production réelle · un appareil · 24 heures
          </Text>
        </View>
        {loading ? <ActivityIndicator color={noctalia.accent.base} /> : null}
      </View>

      <Text style={[styles.status, { color: noctalia.text.primary }]}>{passportState}</Text>
      {status ? (
        <Text style={[styles.metrics, { color: noctalia.text.secondary }]}>
          Resets {status.resetsUsed}/{status.resetLimit} · IA {status.paidCallsUsed}/{status.paidCallLimit}
        </Text>
      ) : null}
      <Text style={[styles.note, { color: noctalia.text.tertiary }]}>
        Ce passeport crée un compteur invité isolé. Il ne désactive ni les quotas produit, ni les limites du chat, ni l’anti-rafale.
      </Text>

      {error ? (
        <Text style={[styles.error, { color: noctalia.status.danger.text }]} testID="guest-prod-qa-error">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={confirmStart}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: noctalia.accent.base },
            (pressed || loading) && styles.pressed,
          ]}
          testID="guest-prod-qa-start"
        >
          <Text style={[styles.primaryLabel, { color: noctalia.text.onAccent }]}>Passer en invité</Text>
        </Pressable>
        {status?.active ? (
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void revoke()}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: noctalia.surface.borderStrong },
              (pressed || loading) && styles.pressed,
            ]}
            testID="guest-prod-qa-revoke"
          >
            <Text style={[styles.secondaryLabel, { color: noctalia.text.secondary }]}>Révoquer</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    gap: ThemeLayout.spacing.sm,
    marginTop: ThemeLayout.spacing.md,
    padding: ThemeLayout.spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    marginTop: 2,
  },
  status: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
  metrics: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
  },
  note: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
    marginTop: ThemeLayout.spacing.xs,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  primaryLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 13,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  secondaryLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.68,
  },
});
