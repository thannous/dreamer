import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  canMountVoiceLiveSpikeHost,
  canOperateVoiceLiveSpikeHost,
  createVoiceLiveSpikeHost,
  VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID,
  VOICE_LIVE_SPIKE_HOST_LABEL,
  type VoiceLiveSpikeHostGate,
  type VoiceLiveSpikeHostSnapshot,
} from '@/lib/voiceLiveSpikeHost';
import {
  load as loadVoiceLiveSpikeState,
  loadDebugEnabled,
  loadFeatureEnabled,
  remove as removeVoiceLiveSpikeState,
  save as saveVoiceLiveSpikeState,
} from '@/services/voiceLiveSpikeStorage';
import { voiceLiveSpikeTts } from '@/services/voiceLiveSpikeTts';

export type UseVoiceLiveSpikeHostResult = {
  available: boolean;
  operational: boolean;
  label: typeof VOICE_LIVE_SPIKE_HOST_LABEL;
  snapshot: VoiceLiveSpikeHostSnapshot | null;
  ingestCapturedSpeech: (text: string) => Promise<void>;
  bargeIn: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  goOffline: () => Promise<void>;
  goOnline: () => Promise<void>;
  completeUtterance: () => Promise<void>;
};

function currentDevFlag(): boolean {
  return typeof __DEV__ !== 'undefined' ? __DEV__ === true : false;
}

export function useVoiceLiveSpikeHost(
  gateOverride?: Partial<VoiceLiveSpikeHostGate>
): UseVoiceLiveSpikeHostResult {
  const [gate, setGate] = useState<VoiceLiveSpikeHostGate>(() => ({
    isDev: gateOverride?.isDev ?? currentDevFlag(),
    featureEnabled: gateOverride?.featureEnabled === true,
    debugEnabled: gateOverride?.debugEnabled === true,
  }));
  const [snapshot, setSnapshot] = useState<VoiceLiveSpikeHostSnapshot | null>(null);
  const hostRef = useRef<ReturnType<typeof createVoiceLiveSpikeHost> | null>(null);

  const available = canMountVoiceLiveSpikeHost(gate);
  const operational = canOperateVoiceLiveSpikeHost(gate);

  const store = useMemo(
    () => ({
      load: loadVoiceLiveSpikeState,
      save: saveVoiceLiveSpikeState,
      remove: removeVoiceLiveSpikeState,
    }),
    []
  );

  useEffect(() => {
    if (gateOverride) return;
    let cancelled = false;
    void Promise.all([loadFeatureEnabled(), loadDebugEnabled()]).then(([featureEnabled, debugEnabled]) => {
      if (cancelled) return;
      setGate({
        isDev: currentDevFlag(),
        featureEnabled,
        debugEnabled,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [gateOverride]);

  useEffect(() => {
    if (!available) {
      hostRef.current = null;
      return;
    }

    const host = createVoiceLiveSpikeHost({
      store,
      tts: voiceLiveSpikeTts,
      gate,
      dreamId: VOICE_LIVE_SPIKE_FIXTURE_DREAM_ID,
      mode: 'chat',
    });
    hostRef.current = host;
    void host.start().then((next) => {
      if (hostRef.current === host) setSnapshot(next);
    });

    return () => {
      hostRef.current = null;
    };
  }, [available, gate, store]);

  const run = useCallback(
    async (task: (host: NonNullable<typeof hostRef.current>) => Promise<VoiceLiveSpikeHostSnapshot>) => {
      const host = hostRef.current;
      if (!host) return;
      const next = await task(host);
      setSnapshot(next);
    },
    []
  );

  const ingestCapturedSpeech = useCallback(
    (text: string) => run((host) => host.ingestCapturedSpeech(text)),
    [run]
  );
  const bargeIn = useCallback(() => run((host) => host.bargeIn()), [run]);
  const pause = useCallback(() => run((host) => host.pause()), [run]);
  const resume = useCallback(() => run((host) => host.resume()), [run]);
  const goOffline = useCallback(() => run((host) => host.goOffline()), [run]);
  const goOnline = useCallback(() => run((host) => host.goOnline()), [run]);
  const completeUtterance = useCallback(() => run((host) => host.completeUtterance()), [run]);

  return {
    available,
    operational,
    label: VOICE_LIVE_SPIKE_HOST_LABEL,
    snapshot,
    ingestCapturedSpeech,
    bargeIn,
    pause,
    resume,
    goOffline,
    goOnline,
    completeUtterance,
  };
}
