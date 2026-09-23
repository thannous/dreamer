import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { GUEST_DREAM_RECORDING_LIMIT } from '@/constants/limits';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { resetGuestDreamRecordingAllowanceForDev } from '@/services/quota/GuestDreamCounter';

export function GuestRecordingQaReset() {
  const enabled = typeof __DEV__ !== 'undefined' && __DEV__;
  const { user } = useAuth();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reset = useCallback(async () => {
    if (!enabled || user || working) return;
    setWorking(true);
    setMessage(null);
    try {
      const savedDreamCount = await resetGuestDreamRecordingAllowanceForDev();
      const remaining = Math.max(0, GUEST_DREAM_RECORDING_LIMIT - savedDreamCount);
      setMessage(`${remaining} rêve${remaining > 1 ? 's' : ''} encore enregistrable${remaining > 1 ? 's' : ''} sans compte.`);
    } catch {
      setMessage('Remise à zéro impossible : vérifie que le journal local est lisible.');
    } finally {
      setWorking(false);
    }
  }, [enabled, user, working]);

  if (!enabled || user) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.borderStrong },
      ]}
      testID="guest-recording-qa-reset"
    >
      <Text style={[styles.title, { color: noctalia.text.primary }]}>Test invité · mode dev</Text>
      <Text style={[styles.body, { color: noctalia.text.secondary }]}>
        Rétablit les places utilisées par des rêves supprimés. Les rêves encore dans le journal sont conservés et comptent toujours dans les cinq places.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={working}
        onPress={() => void reset()}
        style={({ pressed }) => [
          styles.button,
          { borderColor: noctalia.surface.borderStrong },
          (pressed || working) && styles.pressed,
        ]}
        testID="guest-recording-qa-reset-button"
      >
        {working ? <ActivityIndicator color={noctalia.accent.text} /> : null}
        <Text style={[styles.buttonLabel, { color: noctalia.text.primary }]}>
          Réinitialiser les places invitées
        </Text>
      </Pressable>
      {message ? (
        <Text style={[styles.result, { color: noctalia.text.secondary }]} testID="guest-recording-qa-reset-result">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginTop: 16,
    padding: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: { opacity: 0.6 },
  result: {
    fontSize: 13,
  },
});
