import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  VOICE_LIVE_SPIKE_FEATURE_FLAG,
  VOICE_LIVE_SPIKE_FEATURE_ENABLED_DEFAULT,
} from '@/lib/voiceLiveSpike';
import {
  canMountVoiceLiveSpikeHost,
  VOICE_LIVE_SPIKE_HOST_LABEL,
  VOICE_LIVE_SPIKE_TEST_IDS,
} from '@/lib/voiceLiveSpikeHost';
import {
  loadDebugEnabled,
  loadFeatureEnabled,
  saveDebugEnabled,
  saveFeatureEnabled,
} from '@/services/voiceLiveSpikeStorage';

export function VoiceLiveSpikeDebugEntry() {
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ === true : false;
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    if (!isDev) return;
    let cancelled = false;
    void Promise.all([loadFeatureEnabled(), loadDebugEnabled()]).then(([feature, debug]) => {
      if (cancelled) return;
      setFeatureEnabled(feature);
      setDebugEnabled(debug);
    });
    return () => {
      cancelled = true;
    };
  }, [isDev]);

  const toggleFeature = useCallback(async () => {
    const next = !featureEnabled;
    await saveFeatureEnabled(next);
    setFeatureEnabled(next);
  }, [featureEnabled]);

  const toggleDebug = useCallback(async () => {
    const next = !debugEnabled;
    await saveDebugEnabled(next);
    setDebugEnabled(next);
  }, [debugEnabled]);

  if (!isDev) return null;

  const mountable = canMountVoiceLiveSpikeHost({
    isDev: true,
    featureEnabled,
    debugEnabled,
  });

  return (
    <View style={styles.card} testID={VOICE_LIVE_SPIKE_TEST_IDS.debugEntry}>
      <Text style={styles.kicker}>{VOICE_LIVE_SPIKE_HOST_LABEL}</Text>
      <Text style={styles.title}>Voice Live spike V3</Text>
      <Text style={styles.body}>
        {VOICE_LIVE_SPIKE_FEATURE_FLAG} stays {String(VOICE_LIVE_SPIKE_FEATURE_ENABLED_DEFAULT)} in
        production. Both debug enablement and the local flag are required.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void toggleFeature()}
        style={styles.button}
        testID={VOICE_LIVE_SPIKE_TEST_IDS.enable}
      >
        <Text style={styles.buttonLabel}>
          Feature flag {featureEnabled ? 'on' : 'off'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void toggleDebug()}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>
          Debug enablement {debugEnabled ? 'on' : 'off'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={!mountable}
        onPress={() => router.push('/dev/voice-live-spike')}
        style={[styles.button, !mountable && styles.disabled]}
        testID={VOICE_LIVE_SPIKE_TEST_IDS.open}
      >
        <Text style={styles.buttonLabel}>Open prototype host</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#171717',
    gap: 8,
  },
  kicker: {
    color: '#C4B59A',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4F0E6',
    fontSize: 16,
  },
  body: {
    color: '#B8B0A4',
    fontSize: 13,
  },
  button: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  disabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    color: '#F4F0E6',
    fontSize: 14,
  },
});
