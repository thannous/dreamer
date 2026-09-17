import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useVoiceLiveSpikeHost } from '@/hooks/useVoiceLiveSpikeHost';
import { useRecordingSession } from '@/hooks/useRecordingSession';
import {
  VOICE_LIVE_SPIKE_HOST_LABEL,
  VOICE_LIVE_SPIKE_TEST_IDS,
  visibleVoiceLiveSpikeTurns,
} from '@/lib/voiceLiveSpikeHost';

const RECORDING_ALERTS: Record<string, string> = {
  'recording.alert.permission_required.title': 'Microphone needed',
  'recording.alert.permission_required.message': 'Allow the microphone to capture this prototype segment.',
  'recording.alert.stt_unavailable.title': 'Speech unavailable',
  'recording.alert.stt_unavailable.message': 'Native speech recognition is not available on this device.',
  'recording.alert.insecure_context': 'Speech capture needs a secure context.',
};

function prototypeCopy(key: string): string {
  return RECORDING_ALERTS[key] ?? key;
}

export function VoiceLiveSpikeHost() {
  const host = useVoiceLiveSpikeHost();
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');
  const stopFromNativeEndRef = useRef<(() => void) | null>(null);

  const recordingSession = useRecordingSession({
    transcriptionLocale: 'en-US',
    t: prototypeCopy,
    onNativeEnd: () => {
      stopFromNativeEndRef.current?.();
    },
    onPartialTranscript: (text) => {
      draftRef.current = text;
      setDraft(text);
    },
  });

  const commitCapturedSpeech = useCallback(async () => {
    const stopped = await recordingSession.stopRecording();
    const text = (stopped.transcript || draftRef.current).trim();
    draftRef.current = '';
    setDraft('');
    if (!text) return;
    await host.ingestCapturedSpeech(text);
  }, [host, recordingSession]);

  useEffect(() => {
    stopFromNativeEndRef.current = () => {
      void commitCapturedSpeech();
    };
  }, [commitCapturedSpeech]);

  if (!host.available || !host.operational || !host.snapshot) {
    return (
      <View style={styles.screen} testID={VOICE_LIVE_SPIKE_TEST_IDS.unavailable}>
        <Text style={styles.kicker}>{VOICE_LIVE_SPIKE_HOST_LABEL}</Text>
        <Text style={styles.body}>This prototype is not mounted outside an explicit debug session.</Text>
      </View>
    );
  }

  const { snapshot } = host;
  const turns = visibleVoiceLiveSpikeTurns(snapshot.state);

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      testID={VOICE_LIVE_SPIKE_TEST_IDS.host}
    >
      <Text style={styles.kicker}>{VOICE_LIVE_SPIKE_HOST_LABEL}</Text>
      <Text style={styles.title}>Voice Live spike V3</Text>
      <Text style={styles.body}>
        Prototype A only. Native STT, persist the captured segment, then a local stub answer.
        No Gemini, backend, quota, or purchase path.
      </Text>
      <Text style={styles.meta}>
        status {snapshot.state.status} · command {snapshot.command.kind} · audio retention{' '}
        {snapshot.state.audioRetention}
      </Text>

      {turns.map((turn) => (
        <View key={turn.id} style={styles.turn}>
          <Text style={styles.turnRole}>{turn.role} · {turn.lane}</Text>
          <Text style={styles.body}>{turn.text}</Text>
        </View>
      ))}

      {draft ? <Text style={styles.draft}>listening: {draft}</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (recordingSession.isRecording) {
            void commitCapturedSpeech();
            return;
          }
          void recordingSession.startRecording('');
        }}
        style={styles.button}
        testID={VOICE_LIVE_SPIKE_TEST_IDS.capture}
      >
        <Text style={styles.buttonLabel}>
          {recordingSession.isRecording ? 'Persist captured segment' : 'Capture speech'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => void host.bargeIn()}
        style={styles.button}
        testID={VOICE_LIVE_SPIKE_TEST_IDS.bargeIn}
      >
        <Text style={styles.buttonLabel}>Barge in</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void host.pause()}
        style={styles.button}
        testID={VOICE_LIVE_SPIKE_TEST_IDS.pause}
      >
        <Text style={styles.buttonLabel}>Pause</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void host.resume()}
        style={styles.button}
        testID={VOICE_LIVE_SPIKE_TEST_IDS.resume}
      >
        <Text style={styles.buttonLabel}>Resume</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void host.goOffline()}
        style={styles.button}
        testID={VOICE_LIVE_SPIKE_TEST_IDS.offline}
      >
        <Text style={styles.buttonLabel}>Go offline</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void host.goOnline()}
        style={styles.button}
        testID={VOICE_LIVE_SPIKE_TEST_IDS.online}
      >
        <Text style={styles.buttonLabel}>Go online</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: '#111111',
    padding: 24,
    gap: 12,
  },
  kicker: {
    color: '#C4B59A',
    fontSize: 12,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4F0E6',
    fontSize: 24,
  },
  body: {
    color: '#D7D0C4',
    fontSize: 15,
  },
  meta: {
    color: '#9A9286',
    fontSize: 13,
  },
  draft: {
    color: '#E8DCC8',
    fontSize: 14,
  },
  turn: {
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  turnRole: {
    color: '#C4B59A',
    fontSize: 12,
  },
  button: {
    backgroundColor: '#1C1C1C',
    borderColor: '#3A3A3A',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonLabel: {
    color: '#F4F0E6',
    fontSize: 15,
  },
});
